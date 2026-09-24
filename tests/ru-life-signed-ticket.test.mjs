import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { signRuLifeBrowserTicket } from "../app/ru-life-ticket.ts";

test("RU bridge signs a five-minute audience-scoped ticket for its own Control API", async () => {
  const secret = "s".repeat(48);
  const now = 1_790_000_000_000;
  const token = await signRuLifeBrowserTicket(secret, "OWNER@EXAMPLE.COM", "owner", "a".repeat(64), now);
  const [version, encoded, signature] = token.split(".");
  assert.equal(version, "v1");
  assert.equal(signature, createHmac("sha256", secret).update(`${version}.${encoded}`).digest("base64url"));
  const claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  assert.deepEqual({ iss: claims.iss, aud: claims.aud, app: claims.app, actor: claims.actor, role: claims.role, controlDeviceId: claims.controlDeviceId, exp: claims.exp }, {
    iss: "application-management", aud: "ru-life-control", app: "hoa-nhap-nga", actor: "owner@example.com", role: "owner", controlDeviceId: "a".repeat(64), exp: now + 300_000,
  });
  assert.match(claims.jti, /^[A-Za-z0-9_-]{16,100}$/);
  assert.equal(token.includes(secret), false);
});

test("RU bridge refuses malformed identity or missing shared secret", async () => {
  await assert.rejects(signRuLifeBrowserTicket("short", "owner@example.com", "owner", "a".repeat(64)));
  await assert.rejects(signRuLifeBrowserTicket("s".repeat(48), "owner@example.com", "owner", "invalid"));
});
