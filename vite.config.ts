import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const LEARNING_MANAGEMENT_DATABASE_ID = "1cf8f6b4-6c23-4479-8751-47703ecac92b";
const LOCAL_RUNTIME_KEYS = [
  "LOCAL_DEV_AUTH",
  "LOCAL_DEV_USER_ID",
  "LOCAL_DEV_USER_EMAIL",
  "LOCAL_DEV_USER_NAME",
  "CONTROL_OWNER_EMAILS",
  "CONTROL_SERVICE_SECRET",
  "BOI_ECH_BASE_URL",
  "HEALTH_CARE_BASE_URL",
  "HEALTH_CONTROL_SERVICE_SECRET",
  "RU_LIFE_BASE_URL",
  "RU_LIFE_CONTROL_SERVICE_SECRET",
  "BAUMAN_CONTROL_BASE_URL",
  "BAUMAN_CONTROL_SERVICE_SECRET",
  "GROWUP_BASE_URL",
] as const;

const { d1 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

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
    name: "learning-management",
    main: "./worker/index.ts",
    compatibility_flags: ["nodejs_compat"],
    ...(vars ? { vars } : {}),
    d1_databases: d1
      ? [
          {
            binding: d1,
            database_name: "learning-management-db",
            database_id: LEARNING_MANAGEMENT_DATABASE_ID,
          },
        ]
      : [],
  };

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
