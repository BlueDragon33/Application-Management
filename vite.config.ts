import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const LOCAL_ONLY_DATABASE_ID = "00000000-0000-0000-0000-000000000003";
const LOCAL_RUNTIME_KEYS = [
  "LOCAL_DEV_AUTH",
  "LOCAL_DEV_USER_ID",
  "LOCAL_DEV_USER_EMAIL",
  "LOCAL_DEV_USER_NAME",
  "CONTROL_OWNER_EMAILS",
  "CONTROL_PLANE_NETWORK_MODE",
  "CONTROL_SERVICE_SECRET",
  "CONTROL_SERVICE_LOCAL_SECRET",
  "BOI_ECH_BASE_URL",
  "BOI_ECH_LOCAL_BASE_URL",
  "HEALTH_CARE_BASE_URL",
  "HEALTH_CARE_LOCAL_BASE_URL",
  "HEALTH_CONTROL_SERVICE_SECRET",
  "HEALTH_CONTROL_SERVICE_LOCAL_SECRET",
  "RU_LIFE_BASE_URL",
  "RU_LIFE_LOCAL_BASE_URL",
  "RU_LIFE_CONTROL_SERVICE_SECRET",
  "RU_LIFE_CONTROL_SERVICE_LOCAL_SECRET",
  "BAUMAN_CONTROL_BASE_URL",
  "BAUMAN_CONTROL_LOCAL_BASE_URL",
  "BAUMAN_APP_ORIGIN",
  "BAUMAN_APP_LOCAL_ORIGIN",
  "BAUMAN_CONTROL_SERVICE_SECRET",
  "BAUMAN_CONTROL_SERVICE_LOCAL_SECRET",
  "GROWUP_BASE_URL",
  "GROWUP_CONTROL_BASE_URL",
  "GROWUP_CONTROL_LOCAL_BASE_URL",
  "GROWUP_CONTROL_SERVICE_SECRET",
  "PRICE_REPORT_BASE_URL",
  "PRICE_REPORT_CONTROL_BASE_URL",
  "PRICE_REPORT_CONTROL_LOCAL_BASE_URL",
  "PRICE_REPORT_CONTROL_SERVICE_SECRET",
  "PRICE_REPORT_CONTROL_SERVICE_LOCAL_SECRET",
] as const;

const { d1 } = hostingConfig;
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const cloudflareConfigPath = process.env.CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH?.trim();

function localRuntimeVars(command: string) {
  if (command !== "serve") return undefined;
  const entries = LOCAL_RUNTIME_KEYS
    .map((key) => [key, process.env[key]] as const)
    .filter((entry): entry is readonly [typeof LOCAL_RUNTIME_KEYS[number], string] => typeof entry[1] === "string" && entry[1].length > 0);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export default defineConfig(async ({ command }) => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");
  const vars = localRuntimeVars(command);
  const localBindingConfig = {
    name: "application-management-local",
    main: "./worker/index.ts",
    compatibility_flags: ["nodejs_compat"],
    ...(vars ? { vars } : {}),
    d1_databases: d1
      ? [
          {
            binding: d1,
            database_name: "learning-management-db",
            database_id: LOCAL_ONLY_DATABASE_ID,
          },
        ]
      : [],
  };
  const cloudflareOptions = cloudflareConfigPath
    ? {
        configPath: cloudflareConfigPath,
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false as const,
      }
    : {
        config: localBindingConfig,
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false as const,
      };

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local", "localhost", "127.0.0.1"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare(cloudflareOptions),
    ],
  };
});
