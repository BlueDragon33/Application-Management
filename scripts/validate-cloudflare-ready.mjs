import fs from "node:fs";

const requiredLocal = [
  "wrangler.cloudflare.example.jsonc",
  "docs/CLOUDFLARE_DEPLOYMENT_TRACK.md",
];
for (const file of requiredLocal) {
  if (!fs.existsSync(file)) throw new Error(`Thiếu Cloudflare scaffold: ${file}`);
}

const template = fs.readFileSync("wrangler.cloudflare.example.jsonc", "utf8");
if (template.includes("LOCAL_DEV_AUTH")) throw new Error("Cloudflare template tuyệt đối không được chứa LOCAL_DEV_AUTH.");
if (!template.includes("CF_ACCESS_TEAM_DOMAIN") || !template.includes("CF_ACCESS_AUD")) throw new Error("Cloudflare template thiếu Access identity settings.");

if (!fs.existsSync("wrangler.cloudflare.jsonc")) {
  console.error("CLOUDFLARE_NOT_CONFIGURED: copy wrangler.cloudflare.example.jsonc -> wrangler.cloudflare.jsonc và cấu hình preview D1/Access trước.");
  process.exit(2);
}

const config = fs.readFileSync("wrangler.cloudflare.jsonc", "utf8");
if (/00000000-0000-0000-0000-000000000000|replace-with-/.test(config)) {
  console.error("CLOUDFLARE_PLACEHOLDER_CONFIG: wrangler.cloudflare.jsonc vẫn còn giá trị placeholder.");
  process.exit(2);
}
if (config.includes("LOCAL_DEV_AUTH")) throw new Error("CLOUDFLARE_LOCAL_AUTH_FORBIDDEN: không được deploy local auth lên Cloudflare.");

if (!fs.existsSync("app/cloudflare-access-auth.ts")) {
  console.error("CLOUDFLARE_ACCESS_ADAPTER_REQUIRED: chưa có adapter xác thực JWT/AUD của Cloudflare Access. Không deploy control plane công khai.");
  process.exit(2);
}

const auth = fs.readFileSync("app/cloudflare-access-auth.ts", "utf8");
for (const token of ["cf-access-jwt-assertion", "CF_ACCESS_AUD", "CF_ACCESS_TEAM_DOMAIN"]) {
  if (!auth.toLowerCase().includes(token.toLowerCase())) throw new Error(`Cloudflare Access adapter thiếu: ${token}`);
}

console.log("Cloudflare preflight PASS: deployment config + Access adapter present. Vẫn phải chạy npm test và smoke test preview trước production.");
