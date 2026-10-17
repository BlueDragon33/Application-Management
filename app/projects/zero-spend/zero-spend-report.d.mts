export type ZeroSpendWorkflow = {
  file: string;
  risk: string;
  events: string[];
  runnerTypes: string[];
};
export type ZeroSpendRow = {
  name: string;
  status: string;
  visibility?: string;
  risk: string;
  workflows: ZeroSpendWorkflow[];
};
export type ZeroSpendSummary = {
  scope: "STATIC_OWNER_SUPPLIED_REPORT_UNVERIFIED";
  inventoryCount: number;
  scanned: number;
  workflowCount: number;
  unchecked: number;
  rows: ZeroSpendRow[];
};
export declare const RISK_ORDER: Readonly<Record<string, number>>;
export declare function parseZeroSpendReport(input: string | object): ZeroSpendSummary;
