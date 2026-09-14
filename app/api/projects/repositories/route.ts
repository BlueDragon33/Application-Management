import { projectRepositories } from "../../../project-registry";

export const dynamic = "force-dynamic";

const GITHUB_OWNER = "BlueDragon33";

type GitHubRepository = {
  name?: unknown;
  full_name?: unknown;
  html_url?: unknown;
  default_branch?: unknown;
  archived?: unknown;
  fork?: unknown;
  visibility?: unknown;
  updated_at?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function GET() {
  try {
    const response = await fetch(`https://api.github.com/users/${GITHUB_OWNER}/repos?per_page=100&sort=updated`, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "Application-Management",
        "x-github-api-version": "2022-11-28",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json({ ok: false, error: `GitHub trả về HTTP ${response.status}.` }, { status: 502, headers: { "cache-control": "no-store" } });
    }

    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload as GitHubRepository[] : [];
    const repositories = rows
      .map((repo) => ({
        name: text(repo.name),
        repository: text(repo.full_name),
        url: text(repo.html_url),
        defaultBranch: text(repo.default_branch),
        archived: repo.archived === true,
        fork: repo.fork === true,
        visibility: text(repo.visibility) || "public",
        updatedAt: text(repo.updated_at) || null,
      }))
      .filter((repo) => repo.repository.startsWith(`${GITHUB_OWNER}/`));

    const liveNames = new Set(repositories.map((repo) => repo.repository));
    const managedNames = new Set(projectRepositories.map((repo) => repo.repository));
    const unmanaged = repositories.filter((repo) => !managedNames.has(repo.repository));
    const notVisiblePublicly = projectRepositories.filter((repo) => !liveNames.has(repo.repository)).map((repo) => ({
      id: repo.id,
      name: repo.name,
      repository: repo.repository,
    }));

    return Response.json({
      ok: true,
      owner: GITHUB_OWNER,
      checkedAt: new Date().toISOString(),
      totalPublicRepositories: repositories.length,
      registeredRepositories: projectRepositories.length,
      repositories,
      unmanaged,
      notVisiblePublicly,
    }, { headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Không thể kiểm tra GitHub." }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
