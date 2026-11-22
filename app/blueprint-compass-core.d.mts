export interface CompassRow {
  number: number;
  title: string;
  url: string;
  draft: boolean;
  headSha: string | null;
  labels: string[];
}
export interface CompassVerdict {
  status: string;
  priority: string;
  title: string;
  description: string;
  nextStep: string;
  qaPassed: false;
  productionAuthorized: false;
}
export function compassAssessment(input: {
  head?: string | null;
  pullRequests?: readonly CompassRow[];
  issues?: readonly CompassRow[];
}): CompassVerdict;
export function normalizeGitHubListing(rows: unknown, kind: "issue" | "pull", limit?: number, repository?: string | null): CompassRow[];
export function isAllowedRepository(value: unknown, registered: readonly string[]): boolean;
