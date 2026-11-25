import test from "node:test";
import assert from "node:assert/strict";
import { buildRegistryNeuralGraph, centerNeuralViewport } from "../app/blueprint-neural-registry-graph.mjs";

const examples = [
  {id:"hub",name:"Blueprint Hub",repository:"BlueDragon33/Software-Blueprint-Hub",group:"core",state:"developing",summary:"core"},
  {id:"manager",name:"Application Management",repository:"BlueDragon33/Application-Management",group:"core",state:"operational",summary:"owner"},
  {id:"swim",name:"Bơi ếch AI",repository:"BlueDragon33/BOIECH_AI",group:"learning",state:"operational",summary:"learning"},
];

test("five visual lanes contain only real registered source, group, project, repo and state facts", () => {
  const g=buildRegistryNeuralGraph(examples,"hub");
  assert.equal(g.width,1660);
  assert.equal(g.projects.length,3);
  assert.equal(g.groups.length,2);
  assert.equal(g.states.length,2);
  assert.equal(g.links.length,2+3*3);
  assert.deepEqual([...new Set(g.links.map(e=>e.kind))].sort(),
    ["group-project","project-repository","registry-group","repository-state"]);
  assert.ok(g.links.every(e=>e.source==="project-registry.ts"));
  assert.equal(g.provenance,"application-management:app/project-registry.ts");
});

test("selected project focus highlights exactly its four real registry links", () => {
  const g=buildRegistryNeuralGraph(examples,"hub");
  const selected=g.links.filter(e=>e.selected);
  assert.equal(selected.length,4);
  assert.deepEqual(selected.map(e=>e.kind).sort(),
    ["group-project","project-repository","registry-group","repository-state"]);
  assert.equal(g.projects.filter(p=>p.selected).length,1);
  assert.equal(g.projects.find(p=>p.id==="hub").selected,true);
});

test("graph topology, visual geometry and link count are independent of input order", () => {
  const a=buildRegistryNeuralGraph(examples,"swim");
  const b=buildRegistryNeuralGraph([...examples].reverse(),"swim");
  assert.deepEqual(a,b);
  assert.ok(a.links.every(e=>[e.fromX,e.fromY,e.toX,e.toY].every(Number.isFinite)));
  assert.ok(a.links.every(e=>e.fromY>=0&&e.toY>=0&&e.fromY<=a.height&&e.toY<=a.height));
});

test("unregistered selection cannot claim a selected or operating project", () => {
  const g=buildRegistryNeuralGraph(examples,"fake-private");
  assert.equal(g.selectedProjectId,null);
  assert.ok(g.links.every(e=>e.selected===false));
  assert.equal(g.telemetry,"NOT_CONNECTED");
  assert.equal(g.qaPassed,false);
  assert.equal(g.productionAuthorized,false);
});

test("invalid projects and duplicate identifiers cannot inject fake nodes or edges", () => {
  const g=buildRegistryNeuralGraph([
    ...examples,
    {...examples[0],repository:"OtherOwner/private"},
    {...examples[0],id:"<script>"},
    {...examples[0],id:"hub",name:"spoof"},
    {...examples[0],id:"broken",state:"PASS"},
    null,
  ],"hub");
  assert.equal(g.projects.length,3);
  assert.equal(g.links.length,11);
  assert.equal(g.projects.filter(p=>p.id==="hub").length,1);
});

test("empty or malformed input yields no simulated network or telemetry", () => {
  for(const input of [null,undefined,{},[],5,"fake"]) {
    const g=buildRegistryNeuralGraph(input,"hub");
    assert.equal(g.projects.length,0);
    assert.equal(g.groups.length,0);
    assert.equal(g.states.length,0);
    assert.equal(g.links.length,0);
    assert.equal(g.telemetry,"NOT_CONNECTED");
  }
});

test("large catalog stays bounded and geometry remains readable", () => {
  const entries=Array.from({length:70},(_,i)=>({
    id:"p-"+i,name:"Project "+i,repository:"BlueDragon33/Repo"+i,
    group:"core",state:"developing",summary:"",
  }));
  const g=buildRegistryNeuralGraph(entries);
  assert.equal(g.projects.length,50);
  assert.equal(g.links.length,1+50*3);
  assert.ok(g.height>=50*48+150);
  assert.equal(g.qaPassed,false);
});


test("atlas focus centers the selected node on desktop, tablet and mobile", () => {
  for (const [viewportWidth, viewportHeight, left, top] of [
    [1440, 600, 26, 1000], [800, 480, 346, 1060], [390, 320, 551, 1140],
  ]) {
    assert.deepEqual(centerNeuralViewport(746, 1300, 1660, 2550, viewportWidth, viewportHeight), { left, top });
  }
});

test("atlas focus clamps both axes at content boundaries and when content fits", () => {
  assert.deepEqual(centerNeuralViewport(10, 10, 1660, 2550, 390, 320), { left: 0, top: 0 });
  assert.deepEqual(centerNeuralViewport(1650, 2540, 1660, 2550, 390, 320), { left: 1270, top: 2230 });
  assert.deepEqual(centerNeuralViewport(80, 70, 160, 140, 800, 600), { left: 0, top: 0 });
});

test("atlas focus refuses unselected or invalid geometry without scrolling", () => {
  for (const args of [
    [NaN, 100, 1660, 2550, 390, 320],
    [100, Infinity, 1660, 2550, 390, 320],
    [100, 100, 1660, 2550, 0, 320],
    [100, 100, 1660, -1, 390, 320],
    [1661, 100, 1660, 2550, 390, 320],
    [100, -1, 1660, 2550, 390, 320],
  ]) assert.equal(centerNeuralViewport(...args), null);
});

const cappedEntries = Array.from({ length: 100 }, (_, i) => ({ id: `p-${i}`, name: `Project ${String(i).padStart(3, "0")}`, repository: `BlueDragon33/Repo${i}`, group: "core", state: "developing", summary: "" }));
test("bounded topology is independent of order for a unique catalog", () => {
  const a = buildRegistryNeuralGraph(cappedEntries), b = buildRegistryNeuralGraph([...cappedEntries].reverse());
  assert.equal(a.projects.length, 50);
  assert.deepEqual(a.projects.map(p => p.id), b.projects.map(p => p.id));
  assert.deepEqual(a.links, b.links);
});
test("selected registered project remains visible beyond the display cap", () => {
  const g = buildRegistryNeuralGraph(cappedEntries, "p-99");
  assert.equal(g.projects.length, 50);
  assert.equal(g.selectedProjectId, "p-99");
  assert.equal(g.projects.filter(p => p.selected).length, 1);
  assert.equal(g.links.filter(e => e.selected).length, 4);
  assert.deepEqual(g, buildRegistryNeuralGraph([...cappedEntries].reverse(), "p-99"));
});
test("invalid selection cannot displace registered projects or confer authority", () => {
  const g = buildRegistryNeuralGraph(cappedEntries, "unregistered");
  assert.equal(g.selectedProjectId, null);
  assert.equal(g.projects.length, 50);
  assert.equal(g.links.filter(e => e.selected).length, 0);
  assert.equal(g.telemetry, "NOT_CONNECTED");
  assert.equal(g.qaPassed, false);
  assert.equal(g.productionAuthorized, false);
});
