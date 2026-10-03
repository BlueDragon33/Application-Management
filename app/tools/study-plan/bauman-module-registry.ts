import { applicationRegistry } from "../../application-registry";

export type BaumanStudyModule = {
  id: string;
  kind: "subject-site" | "module" | "workflow";
  labelVi: string;
  labelEn: string;
  courseIds: string[];
  href: string;
  sourcePath: string;
  manifestTitle: string;
};

export type BaumanRegistryStatus = "live" | "unavailable";

type BaumanContract = {
  subclients?: Array<{
    id?: string;
    kind?: string;
    sourcePath?: string;
  }>;
  policy?: {
    applicationManagementMayOpenLearningRuntimeDirectly?: boolean;
  };
};

type SubjectManifest = {
  id?: string;
  title?: string;
  studyPlan?: {
    version?: number;
    relation?: string;
    runtimePath?: string;
    labelVi?: string;
    labelEn?: string;
    courseIds?: string[];
  };
};

const repositoryBase =
  "https://raw.githubusercontent.com/BlueDragon33/Bauman-master-ai-system/main";

function cleanRuntimeOrigin() {
  return (
    applicationRegistry
      .find((app) => app.id === "bauman-master-ai")
      ?.publicUrl?.replace(/\/+$/, "") ?? ""
  );
}

function safeSubjectId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/i.test(value);
}

function normalizeRuntimePath(id: string, studyPlanPath?: string) {
  if (studyPlanPath && /^subjects\/[a-z0-9-]+\/?$/i.test(studyPlanPath)) {
    return studyPlanPath.replace(/^\/+/, "").replace(/\/+$/, "");
  }
  return `subjects/${id}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Bauman registry fetch failed: ${response.status} ${url}`);
  }
  return (await response.json()) as T;
}

export async function loadBaumanStudyModules(): Promise<{
  status: BaumanRegistryStatus;
  modules: BaumanStudyModule[];
  mayOpenLearningRuntimeDirectly: boolean;
}> {
  try {
    const contract = await fetchJson<BaumanContract>(
      `${repositoryBase}/control/application-management.contract.json`,
    );

    const clients = Array.from(
      new Map(
        (contract.subclients ?? [])
          .filter((client) => safeSubjectId(client.id))
          .map((client) => [client.id as string, client] as const),
      ).values(),
    ).filter((client) =>
      client.kind === "subject-site" || client.kind === "module" || client.kind === "workflow",
    );

    if (clients.length === 0) {
      return { status: "unavailable", modules: [], mayOpenLearningRuntimeDirectly: false };
    }

    const mayOpenLearningRuntimeDirectly =
      contract.policy?.applicationManagementMayOpenLearningRuntimeDirectly === true;
    const runtimeOrigin = mayOpenLearningRuntimeDirectly ? cleanRuntimeOrigin() : "";
    const results = await Promise.allSettled(
      clients.map(async (client) => {
        const id = client.id as string;
        const manifest = await fetchJson<SubjectManifest>(
          `${repositoryBase}/subjects/${id}/subject-manifest.json`,
        );
        const studyPlan = manifest.studyPlan;
        if (
          !studyPlan ||
          studyPlan.version !== 1 ||
          studyPlan.relation !== "related" ||
          !Array.isArray(studyPlan.courseIds) ||
          studyPlan.courseIds.length === 0
        ) {
          return null;
        }

        const courseIds = studyPlan.courseIds.filter(
          (courseId): courseId is string =>
            typeof courseId === "string" && courseId.length > 0,
        );
        if (courseIds.length === 0) return null;

        const sourcePath = normalizeRuntimePath(id, studyPlan.runtimePath);
        return {
          id,
          kind: client.kind as "subject-site" | "module" | "workflow",
          labelVi: studyPlan.labelVi || manifest.title || id,
          labelEn: studyPlan.labelEn || manifest.title || id,
          courseIds,
          href: runtimeOrigin ? `${runtimeOrigin}/${sourcePath}/` : "",
          sourcePath,
          manifestTitle: manifest.title || id,
        } satisfies BaumanStudyModule;
      }),
    );

    const modules = results
      .flatMap((result) =>
        result.status === "fulfilled" && result.value ? [result.value] : [],
      )
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      status: modules.length > 0 ? "live" : "unavailable",
      modules,
      mayOpenLearningRuntimeDirectly,
    };
  } catch {
    return { status: "unavailable", modules: [], mayOpenLearningRuntimeDirectly: false };
  }
}
