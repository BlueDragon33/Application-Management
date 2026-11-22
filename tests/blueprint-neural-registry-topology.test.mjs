import test from "node:test";
import assert from "node:assert/strict";
import { buildRegistryNeuralGraph } from "../app/blueprint-neural-registry-graph.mjs";

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


