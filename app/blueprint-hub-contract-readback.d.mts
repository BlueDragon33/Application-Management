export interface HubContractReadback {
  readonly ok: boolean;
  readonly status: "UNAUTHORIZED" | "UNVERIFIED" | "HUB_GRAPH_NOT_EXPOSED" | "HUB_GRAPH_AUTH_NOT_ESTABLISHED";
  readonly canReadGraph: false;
  readonly note: string;
  readonly repository?: string;
  readonly hubHead?: string;
  readonly contractBlobSha?: string;
  readonly contractSchema?: "application-management.contract/v1";
  readonly checkedAt?: string;
}
export function validateHubContractReadback(input: unknown, httpStatus: number): HubContractReadback;
