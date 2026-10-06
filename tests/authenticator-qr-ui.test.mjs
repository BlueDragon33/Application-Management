import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const auth = fs.readFileSync("worker/production-auth.ts", "utf8");
const renderer = fs.readFileSync("public/authenticator-qr.js", "utf8");
const vendor = fs.readFileSync("public/vendor/qrcode.min.js", "utf8");
const license = fs.readFileSync("public/vendor/qrcodejs.LICENSE.txt", "utf8");

test("Authenticator enrollment presents a local QR code as the primary setup path", () => {
  assert.match(auth, /Quét mã QR/);
  assert.match(auth, /data-authenticator-qr/);
  assert.match(auth, /\/vendor\/qrcode\.min\.js/);
  assert.match(auth, /\/authenticator-qr\.js/);
  assert.match(auth, /Mã QR được tạo cục bộ ngay trong App-Manager/);
  assert.match(auth, /Không quét được\? Nhập khóa thiết lập thủ công/);
  assert.doesNotMatch(auth, /URI kỹ thuật:/);
});

test("QR renderer stays local and does not send the TOTP URI to a third party", () => {
  assert.match(renderer, /new QRCode\(target/);
  assert.match(renderer, /QRCode\.CorrectLevel\.M/);
  assert.match(renderer, /delete target\.dataset\.authenticatorQr/);
  assert.doesNotMatch(renderer, /fetch\s*\(/);
  assert.doesNotMatch(renderer, /https?:\/\//);
  assert.ok(vendor.length > 10000);
  assert.match(license, /The MIT License/);
  assert.match(license, /Copyright \(c\) 2012 davidshimjs/);
});

test("account security CSP permits only same-origin scripts for QR rendering", () => {
  assert.match(auth, /script-src 'self'/);
  assert.match(auth, /img-src 'self' data:/);
  assert.doesNotMatch(auth, /script-src[^"]*https?:/);
});
