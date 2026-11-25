export interface HubGraphContractAssessment {
  readonly ok: boolean;
  readonly status: "UNVERIFIED" | "HUB_GRAPH_NOT_EXPOSED" | "HUB_GRAPH_AUTH_NOT_ESTABLISHED";
  readonly repository: string;
  readonly hubHead?: string;
  readonly contractBlobSha?: string;
  readonly contractSchema?: string;
  readonly contractVersion?: number;
  readonly source?: string;
  readonly checkedAt?: string | null;
  readonly canReadGraph: false;
  readonly canWriteWorkPackages: false;
  readonly qaPassed: false;
  readonly productionAuthorized: false;
  readonly note: string;
}
export function assessHubGraphContract(
  contract: unknown, hubHead: string, contractBlobSha: string, checkedAt: string,
): HubGraphContractAssessment;
