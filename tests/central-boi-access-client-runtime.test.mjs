import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

test("central client serializes writes to the same Boi device across view remounts", async () => {
  let release; let requests = 0;
  const client = loadTs("app/boi-access-client.ts", { "./admin-device-client": { connectAdminCenter: async () => ({ access: { deviceId: "production-session:test", status: "approved", role: "owner" } }) } }, {
    fetch: async (_, init) => {
      requests++; const body = JSON.parse(init.body);
      assert.equal(body.expectedStatus, "approved");
      await new Promise(resolve => { release = resolve; });
      return Response.json({ verified: true });
    },
  });
  const device = { deviceId: "a".repeat(64), status: "approved", paymentStatus: "paid_verified", accessGroup: "paid" };
  const first = client.manageBoiAccess(device, "block");
  const duplicate = client.manageBoiAccess(device, "unblock");
  const duplicateRejected = assert.rejects(duplicate, /đang.*xử lý/i);
  // Let the real client perform its production-session proof and request.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1);
  await duplicateRejected;
  release(); await first;
});
