/**
 * Five visual lanes, two ontology levels: source -> group -> project ->
 * repository metadata -> registry state. All edges are registry facts,
 * never dependency evidence, live Agent events or canonical QA results.
 */
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const REPO = /^BlueDragon33\/[A-Za-z0-9_.-]{1,100}$/;
const TAG = /^[a-z][a-z0-9-]{0,39}$/;
const STATES = new Set(["operational", "developing", "prototype", "scaffold"]);
const WIDTH = 1660;

const average = values => values.reduce((total, value) => total + value, 0) / values.length;
const distribute = (i, size, height) => size < 2 ? height / 2
  : 110 + i * (height - 220) / (size - 1);

export function buildRegistryNeuralGraph(projects, selectedProjectId = "") {
  const seen = new Set();
  const sorted = (Array.isArray(projects) ? projects : []).filter(project => {
    if (!project || typeof project !== "object" || typeof project.id !== "string" || !ID.test(project.id)
      || seen.has(project.id) || typeof project.name !== "string"
      || project.name.trim().length === 0 || project.name.length > 160
      || typeof project.repository !== "string" || !REPO.test(project.repository)
      || typeof project.group !== "string" || !TAG.test(project.group)
      || typeof project.state !== "string" || !STATES.has(project.state)) return false;
    seen.add(project.id);
    return true;
  }).slice(0, 50).sort((a, b) => a.group.localeCompare(b.group)
    || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  const height = Math.max(720, sorted.length * 48 + 150);
  const groups = [...new Set(sorted.map(project => project.group))].sort();
  const states = [...new Set(sorted.map(project => project.state))].sort();
  const selected = sorted.some(project => project.id === selectedProjectId) ? selectedProjectId : null;
  const projectY = new Map(sorted.map((project, i) => [project.id, distribute(i, sorted.length, height)]));
  const groupY = new Map(groups.map(group => [
    group, average(sorted.filter(project => project.group === group).map(project => projectY.get(project.id))),
  ]));
  const stateY = new Map(states.map((state, i) => [state, distribute(i, states.length, height)]));
  const sourceY = height / 2;

  const links = [];
  for (const group of groups) {
    const selectedGroup = sorted.some(project => project.id === selected && project.group === group);
    links.push({
      id: "source:" + group, kind: "registry-group", source: "project-registry.ts",
      fromX: 120, fromY: sourceY, toX: 235, toY: groupY.get(group),
      selected: selectedGroup, recordId: group,
    });
  }
  for (const project of sorted) {
    const y = projectY.get(project.id);
    const active = project.id === selected;
    links.push({
      id: "group:" + project.id, kind: "group-project", source: "project-registry.ts",
      fromX: 258, fromY: groupY.get(project.group), toX: 605, toY: y,
      selected: active, recordId: project.id,
    }, {
      id: "repo:" + project.id, kind: "project-repository", source: "project-registry.ts",
      fromX: 895, fromY: y, toX: 1005, toY: y,
      selected: active, recordId: project.id,
    }, {
      id: "state:" + project.id, kind: "repository-state", source: "project-registry.ts",
      fromX: 1260, fromY: y, toX: 1415, toY: stateY.get(project.state),
      selected: active, recordId: project.id,
    });
  }

  return {
    width: WIDTH, height, sourceY, selectedProjectId: selected,
    sourceName: "Application Management project registry",
    groups: groups.map(group => ({ id: group, y: groupY.get(group) })),
    states: states.map(state => ({ id: state, y: stateY.get(state) })),
    projects: sorted.map(project => ({ ...project, y: projectY.get(project.id),
      selected: project.id === selected })),
    links,
    provenance: "application-management:app/project-registry.ts",
    telemetry: "NOT_CONNECTED",
    qaPassed: false,
    productionAuthorized: false,
  };
}
