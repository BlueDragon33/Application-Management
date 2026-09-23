import fs from "node:fs/promises";

const OWNER = "BlueDragon33";
const REGISTRY_PATH = new URL("../app/project-registry.ts", import.meta.url);

function registeredRepositories(source) {
  return new Set([...source.matchAll(/repository:\s*"(BlueDragon33\/[^"]+)"/g)].map((match) => match[1]));
}

async function fetchPublicRepositories() {
  const response = await fetch(`https://api.github.com/users/${OWNER}/repos?per_page=100&sort=updated`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "Application-Management-Repository-Watch",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GitHub repository inventory failed: HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("GitHub repository inventory returned an invalid payload.");
  return payload
    .map((repo) => typeof repo?.full_name === "string" ? repo.full_name : "")
    .filter((name) => name.startsWith(`${OWNER}/`));
}

const source = await fs.readFile(REGISTRY_PATH, "utf8");
const registered = registeredRepositories(source);
if (!registered.size) throw new Error("No project repositories were found in app/project-registry.ts.");

const live = await fetchPublicRepositories();
const liveSet = new Set(live);
const unmanaged = live.filter((repository) => !registered.has(repository)).sort();
const notPubliclyVisible = [...registered].filter((repository) => !liveSet.has(repository)).sort();

console.log(`Registered repositories: ${registered.size}`);
console.log(`Public GitHub repositories: ${live.length}`);

if (notPubliclyVisible.length) {
  console.warn("Registered repositories not visible in the public GitHub listing:");
  for (const repository of notPubliclyVisible) console.warn(`  - ${repository}`);
  console.warn("These may be private, renamed, transferred or deleted; this is a warning, not an automatic removal.");
}

if (unmanaged.length) {
  console.error("New public repositories are not registered in Application Management:");
  for (const repository of unmanaged) console.error(`  - ${repository}`);
  console.error("Add every real project repository to app/project-registry.ts before treating the inventory as complete.");
  process.exitCode = 1;
} else {
  console.log("Repository inventory is complete: every visible public repository is registered.");
}
