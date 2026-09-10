import fs from "node:fs";

const requiredLocal = [
  "wrangler.cloudflare.example.jsonc",
  "docs/CLOUDFLARE_DEPLOYMENT_TRACK.md",
];
for (const file of requiredLocal) {
  if (!fs.existsSync(file)) throw new Error(`Thiếu Cloudflare scaffold: ${file}`);
}

function stringVar(source, key) {
  const match = source.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`));
  return match ? match[1].trim() : null;
}

function isHttpsOrigin(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value.replace(/\/$/, "") && url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

const template = fs.readFileSync("wrangler.cloudflare.example.jsonc", "utf8");
if (/"LOCAL_DEV_AUTH"\s*:/.test(template)) throw new Error("Cloudflare template tuyệt đối không được cấu hình LOCAL_DEV_AUTH.");
if (!template.includes("CF_ACCESS_TEAM_DOMAIN") || !template.includes("CF_ACCESS_AUD")) throw new Error("Cloudflare template thiếu Access identity settings.");
for (const key of ["BAUMAN_CONTROL_BASE_URL", "BAUMAN_APP_ORIGIN"]) {
  if (stringVar(template, key) === null) throw new Error(`Cloudflare template thiếu ${key}.`);
}

if (!fs.existsSync("wrangler.cloudflare.jsonc")) {
  console.error("CLOUDFLARE_NOT_CONFIGURED: copy wrangler.cloudflare.example.jsonc -> wrangler.cloudflare.jsonc và cấu hình preview D1/Access trước.");
  process.exit(2);
}

const config = fs.readFileSync("wrangler.cloudflare.jsonc", "utf8");
if (/00000000-0000-0000-0000-000000000000|replace-with-/.test(config)) {
  console.error("CLOUDFLARE_PLACEHOLDER_CONFIG: wrangler.cloudflare.jsonc vẫn còn giá trị placeholder.");
  process.exit(2);
}
if (/"LOCAL_DEV_AUTH"\s*:/.test(config)) throw new Error("CLOUDFLARE_LOCAL_AUTH_FORBIDDEN: không được deploy local auth lên Cloudflare.");

const baumanControl = stringVar(config, "BAUMAN_CONTROL_BASE_URL");
const baumanRuntime = stringVar(config, "BAUMAN_APP_ORIGIN");
if (baumanControl === null || baumanRuntime === null) {
  console.error("CLOUDFLARE_BAUMAN_ORIGINS_MISSING: config phải khai báo riêng BAUMAN_CONTROL_BASE_URL và BAUMAN_APP_ORIGIN.");
  process.exit(2);
}
if (Boolean(baumanControl) !== Boolean(baumanRuntime)) {
  console.error("CLOUDFLARE_BAUMAN_ORIGINS_INCOMPLETE: khi bật Bauman phải cấu hình cả Control Service và Learning Runtime.");
  process.exit(2);
}
if (baumanControl && (!isHttpsOrigin(baumanControl) || !isHttpsOrigin(baumanRuntime))) {
  console.error("CLOUDFLARE_BAUMAN_HTTPS_REQUIRED: cả hai origin Bauman production phải là HTTPS origin thuần.");
  process.exit(2);
}
if (baumanControl && baumanControl.replace(/\/$/, "") === baumanRuntime.replace(/\/$/, "")) {
  console.error("CLOUDFLARE_BAUMAN_ORIGINS_COLLIDE: Learning Runtime không được dùng cùng origin với Control Service.");
  process.exit(2);
}

if (!fs.existsSync("app/cloudflare-access-auth.ts")) {
  console.error("CLOUDFLARE_ACCESS_ADAPTER_REQUIRED: chưa có adapter xác thực JWT/AUD của Cloudflare Access. Không deploy control plane công khai.");
  process.exit(2);
}

const auth = fs.readFileSync("app/cloudflare-access-auth.ts", "utf8");
for (const token of ["cf-access-jwt-assertion", "CF_ACCESS_AUD", "CF_ACCESS_TEAM_DOMAIN"]) {
  if (!auth.toLowerCase().includes(token.toLowerCase())) throw new Error(`Cloudflare Access adapter thiếu: ${token}`);
}

console.log("Cloudflare preflight PASS: deployment config + Access adapter + Bauman dual-origin boundary present. Vẫn phải chạy npm test và smoke test preview trước production.");
