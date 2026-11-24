export type NeuralRegistryProject = {
  id: string;
  name: string;
  repository: string;
  group: string;
  state: string;
  summary: string;
};
export type NeuralRegistryLink = {
  readonly id: string;
  readonly kind: "registry-group" | "group-project" | "project-repository" | "repository-state";
  readonly source: "project-registry.ts";
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly selected: boolean;
  readonly recordId: string;
};
export type NeuralRegistryGraph = {
  readonly width: number;
  readonly height: number;
  readonly sourceY: number;
  readonly sourceName: "Application Management project registry";
  readonly selectedProjectId: string | null;
  readonly groups: ReadonlyArray<{ readonly id: string; readonly y: number }>;
  readonly states: ReadonlyArray<{ readonly id: string; readonly y: number }>;
  readonly projects: ReadonlyArray<NeuralRegistryProject & { readonly y: number; readonly selected: boolean }>;
  readonly links: ReadonlyArray<NeuralRegistryLink>;
  readonly provenance: "application-management:app/project-registry.ts";
  readonly telemetry: "NOT_CONNECTED";
  readonly qaPassed: false;
  readonly productionAuthorized: false;
};
export function buildRegistryNeuralGraph(
  projects: readonly NeuralRegistryProject[] | unknown,
  selectedProjectId?: string,
): NeuralRegistryGraph;
export function centerNeuralViewport(
  targetX: number, targetY: number, contentWidth: number, contentHeight: number,
  viewportWidth: number, viewportHeight: number,
): { left: number; top: number } | null;
