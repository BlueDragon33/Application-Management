// This supervisor owns the localhost HTTP ingress, NOT Wrangler's internal
// sockets/isolates. No stop command or "global D1 drained" assertion is possible.
import { createServer, request as forwardHttp } from "node:http";
import { once } from "node:events";

function assertPort(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("WRANGLER_UPSTREAM_PORT_INVALID");
}
export function createWranglerIngress({ upstreamPort } = {}) {
  assertPort(upstreamPort);
  let state = "open", pending = 0, completed = 0, uncertain = false;
  const waiting = new Set();
  const notify = () => { for (const check of waiting) check(); };
  const server = createServer((incoming, response) => {
    if (state !== "open") {
      response.writeHead(503, { "content-type": "application/json", "cache-control": "no-store",
        connection: "close" });
      response.end('{"ok":false,"code":"LOCAL_DRAIN_ADMISSION_CLOSED"}');
      return;
    }
    pending++;
    let settled = false, normal = false;
    const finished = () => {
      if (settled) return;
      settled = true;
      if (!normal) uncertain = true; // A canceled HTTP request may still write D1.
      pending--;
      completed++;
      notify();
    };
    const upstream = forwardHttp({
      hostname: "127.0.0.1", port: upstreamPort,
      method: incoming.method, path: incoming.url,
      headers: { ...incoming.headers, host: "127.0.0.1:" + upstreamPort, connection: "close" },
      agent: false,
    }, reply => {
      response.writeHead(reply.statusCode || 502, {
        ...reply.headers, connection: "close",
      });
      reply.pipe(response);
    });
    upstream.once("error", () => {
      if (!response.headersSent) response.writeHead(502, { connection: "close" });
      if (!response.writableEnded) response.end();
    });
    response.once("finish", () => { normal = true; finished(); });
    response.once("close", finished);
    incoming.once("aborted", () => upstream.destroy());
    incoming.pipe(upstream);
  });
  server.on("clientError", (_error, socket) => { socket.destroy(); uncertain = true; });
  return {
    listen: async (port = 0) => {
      if (state !== "open") throw Error("WRANGLER_INGRESS_ALREADY_DRAINING");
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(); });
      });
      return server.address().port;
    },
    status: () => ({
      state, pending, completed, uncertain, localOnly: true, upstreamPort,
      completeGlobalWorkerIsolateCoverage: false, d1DurableCommitProven: false,
      safeToStopWrangler: false,
    }),
    drainIngress: async ({ timeoutMs = 12000 } = {}) => {
      if (state !== "open") throw Error("WRANGLER_DRAIN_ALREADY_REQUESTED");
      state = "draining";
      // close() waits for admitted connections. Any late keep-alive request
      // will receive 503. Never signal/kill the Wrangler child here.
      const closed = new Promise((resolve, reject) =>
        server.close(error => error ? reject(error) : resolve()));
      await Promise.race([
        closed,
        new Promise((_, reject) => setTimeout(() => reject(Error("INGRESS_DRAIN_TIMEOUT")), timeoutMs)),
      ]);
      if (pending !== 0 || uncertain) throw Error("INGRESS_DRAIN_UNCERTAIN_OR_PENDING");
      state = "closed";
      return {
        ingressClosed: true, admittedRequestsCompleted: true, count: completed,
        allWorkerIsolatesDrained: false, d1CommitReadbackVerified: false,
        windowsProcessTreeGone: false, safeToStopWrangler: false,
        autoRestartApproved: false,
      };
    },
    // This is intended for fixture-only server cleanup, never a process kill.
    close: async () => {
      if (server.listening) {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
      }
    },
  };
}
