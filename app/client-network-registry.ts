export type ManagedClientId =
  | "health-care"
  | "ru-life"
  | "boi-ech"
  | "bauman-master-ai"
  | "bauman-runtime"
  | "price-report-control"
  | "nc03-runtime";

export type ClientNetworkEndpointKind = "control" | "runtime";

export type ClientNetworkSpec = {
  id: ManagedClientId;
  applicationId:
    | "health-care"
    | "ru-life"
    | "boi-ech"
    | "bauman-master-ai"
    | "price-report-tunggiabao"
    | "nc03-modem";
  label: string;
  endpointKind: ClientNetworkEndpointKind;
  productionEnv: string;
  productionOverrideEnv?: string;
  localEnv: string;
  localDefault: string;
  probePath: string;
  bridgeSecretEnv?: string;
  localBridgeSecretEnv?: string;
  pairedWith?: ManagedClientId;
};

/**
 * Source of truth for Application Management client connectivity.
 *
 * This registry describes transport only. app/application-registry.ts remains
 * the source of truth for product/UI metadata, so network fallback cannot
 * silently change product capabilities.
 */
export const clientNetworkRegistry = {
  "health-care": {
    id: "health-care",
    applicationId: "health-care",
    label: "Sức khỏe Y tế Control",
    endpointKind: "control",
    productionEnv: "HEALTH_CARE_BASE_URL",
    productionOverrideEnv: "HEALTH_CARE_BASE_URL_OVERRIDE",
    localEnv: "HEALTH_CARE_LOCAL_BASE_URL",
    localDefault: "http://127.0.0.1:3001",
    probePath: "/api/control/contract",
    bridgeSecretEnv: "HEALTH_CONTROL_SERVICE_SECRET",
    localBridgeSecretEnv: "HEALTH_CONTROL_SERVICE_LOCAL_SECRET",
  },
  "ru-life": {
    id: "ru-life",
    applicationId: "ru-life",
    label: "Hòa nhập Nga Control",
    endpointKind: "control",
    productionEnv: "RU_LIFE_BASE_URL",
    productionOverrideEnv: "RU_LIFE_BASE_URL_OVERRIDE",
    localEnv: "RU_LIFE_LOCAL_BASE_URL",
    localDefault: "http://127.0.0.1:3002",
    probePath: "/api/control/status",
    bridgeSecretEnv: "RU_LIFE_CONTROL_SERVICE_SECRET",
    localBridgeSecretEnv: "RU_LIFE_CONTROL_SERVICE_LOCAL_SECRET",
  },
  "bauman-master-ai": {
    id: "bauman-master-ai",
    applicationId: "bauman-master-ai",
    label: "Bauman Control",
    endpointKind: "control",
    productionEnv: "BAUMAN_CONTROL_BASE_URL",
    localEnv: "BAUMAN_CONTROL_LOCAL_BASE_URL",
    localDefault: "http://127.0.0.1:3003",
    probePath: "/api/control/status",
    bridgeSecretEnv: "BAUMAN_CONTROL_SERVICE_SECRET",
    localBridgeSecretEnv: "BAUMAN_CONTROL_SERVICE_LOCAL_SECRET",
    pairedWith: "bauman-runtime",
  },
  "bauman-runtime": {
    id: "bauman-runtime",
    applicationId: "bauman-master-ai",
    label: "Bauman Learning Runtime",
    endpointKind: "runtime",
    productionEnv: "BAUMAN_APP_ORIGIN",
    localEnv: "BAUMAN_APP_LOCAL_ORIGIN",
    localDefault: "http://127.0.0.1:3005",
    probePath: "/_local/health",
    pairedWith: "bauman-master-ai",
  },
  "boi-ech": {
    id: "boi-ech",
    applicationId: "boi-ech",
    label: "Bơi ếch Control",
    endpointKind: "control",
    productionEnv: "BOI_ECH_BASE_URL",
    productionOverrideEnv: "BOI_ECH_BASE_URL_OVERRIDE",
    localEnv: "BOI_ECH_LOCAL_BASE_URL",
    localDefault: "http://127.0.0.1:3004",
    probePath: "/api/control/runtime",
    bridgeSecretEnv: "CONTROL_SERVICE_SECRET",
    localBridgeSecretEnv: "CONTROL_SERVICE_LOCAL_SECRET",
  },
  "nc03-runtime": {
    id: "nc03-runtime",
    applicationId: "nc03-modem",
    label: "NC03 Control Center Runtime",
    endpointKind: "runtime",
    productionEnv: "NC03_APP_ORIGIN",
    localEnv: "NC03_LOCAL_BASE_URL",
    localDefault: "http://127.0.0.1:3010",
    probePath: "/_local/health",
  },
  "price-report-control": {
    id: "price-report-control",
    applicationId: "price-report-tunggiabao",
    label: "PriceReport KT Control",
    endpointKind: "control",
    productionEnv: "PRICE_REPORT_CONTROL_BASE_URL",
    productionOverrideEnv: "PRICE_REPORT_CONTROL_BASE_URL_OVERRIDE",
    localEnv: "PRICE_REPORT_CONTROL_LOCAL_BASE_URL",
    localDefault: "http://127.0.0.1:3009",
    probePath: "/api/control/status",
    bridgeSecretEnv: "PRICE_REPORT_CONTROL_SERVICE_SECRET",
    localBridgeSecretEnv: "PRICE_REPORT_CONTROL_SERVICE_LOCAL_SECRET",
  },
} as const satisfies Record<ManagedClientId, ClientNetworkSpec>;

export function getClientNetworkSpec(id: ManagedClientId): ClientNetworkSpec {
  return clientNetworkRegistry[id];
}

export function listClientNetworkSpecs(): readonly ClientNetworkSpec[] {
  return Object.values(clientNetworkRegistry);
}
