// Explicit evidence contract. Ports closed alone are not proof of flushed D1.
// The real full BaumanWeb stack currently has NO per-service drain attestations.
import { randomBytes } from "node:crypto";

export const REQUIRED_SHUTDOWN_UNITS = Object.freeze([
 "run-all", "run-local-system", "ADMIN", "HEALTH", "RU", "BAUMAN-CONTROL",
 "BOI", "BAUMAN-RUNTIME", "GROWUP-CONTROL", "GROWUP", "PRICE-CONTROL",
 "PRICE", "NC03",
]);
export const SHUTDOWN_PROTOCOL = "local-ops-graceful/v1";
export function unsupportedFullStack() {
  return { protocol: SHUTDOWN_PROTOCOL, supported: false,
    reason: "UNVERIFIED_GRACEFUL_DRAIN: Vite, Wrangler, nested Windows cmd/Node and D1 lack process-bound drain+exit ACK",
    missingUnits: [...REQUIRED_SHUTDOWN_UNITS], units: [] };
}
export function validateStopPreflight(data) {
  if (!data || data.protocol !== SHUTDOWN_PROTOCOL || data.supported !== true ||
      !Array.isArray(data.units)) return false;
  if (data.units.length !== REQUIRED_SHUTDOWN_UNITS.length) return false;
  const actual = new Map();
  for (const item of data.units) {
    if (typeof item?.id !== "string" || actual.has(item.id) || item.supported !== true ||
        item.d1Drained !== true || item.ownedProcess !== true ||
        item.gracefulExitSupported !== true) return false;
    actual.set(item.id, item);
  }
  return REQUIRED_SHUTDOWN_UNITS.every(id => actual.has(id));
}
export function newStopRequestId() { return randomBytes(20).toString("hex"); }
export function requestChildReply(child, type, requestId, nonce, expectedType, timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    if (!child?.connected || child.exitCode !== null || child.signalCode !== null)
      return reject(Error("SHUTDOWN_CHILD_NOT_CONNECTED"));
    let done = false;
    const cleanup = () => { clearTimeout(timer); child.off("message", message); child.off("exit", exit); child.off("error", error); };
    const finish = (cb, data) => { if (done) return; done = true; cleanup(); cb(data); };
    const message = payload => {
      if (payload?.type !== expectedType || payload.requestId !== requestId || payload.nonce !== nonce) return;
      finish(resolve, payload);
    };
    const exit = () => finish(reject, Error("SHUTDOWN_CHILD_EXITED_BEFORE_ACK"));
    const error = cause => finish(reject, cause);
    const timer = setTimeout(() => finish(reject, Error("SHUTDOWN_ACK_TIMEOUT")), timeoutMs);
    child.on("message", message); child.once("exit", exit); child.once("error", error);
    try {
      child.send({ type, protocol: SHUTDOWN_PROTOCOL, requestId, nonce }, sendError => {
        if (sendError) finish(reject, sendError);
      });
    } catch (cause) { finish(reject, cause); }
  });
}
export function childExited(child, timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolve(true);
    const timer = setTimeout(() => { child.off("exit", onExit); reject(Error("SHUTDOWN_CHILD_EXIT_TIMEOUT")); }, timeoutMs);
    const onExit = () => { clearTimeout(timer); resolve(true); };
    child.once("exit", onExit);
  });
}
