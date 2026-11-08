// Offline, bounded update of the existing Worker. Never uploads or deploys.
// Usage: node scripts/prepare-google-session-artifact.mjs BASE BUILD OUTPUT REPORT
import fs from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import { transformSync, version as esbuildVersion } from "esbuild";

const [basePath, buildPath, outputPath, reportPath] = process.argv.slice(2);
if (![basePath, buildPath, outputPath, reportPath].every(Boolean)) throw new Error("Provide BASE BUILD OUTPUT REPORT paths");
const base = fs.readFileSync(basePath, "utf8");
const built = fs.readFileSync(buildPath, "utf8");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
if (sha(base) !== "46d56833e71a130d9733d399bb91ba8c21a2331d76dc9b569e05c6fcb9becb48") throw new Error("Expected released PR378 baseline");
function region(source, name) {
  const marker = `//#region ${name}`, start = source.indexOf(marker);
  if (start < 0 || source.indexOf(marker, start + 1) >= 0) throw new Error(`Missing/ambiguous region ${name}`);
  return source.slice(start, source.indexOf("//#endregion", start) + 12);
}
const compiledRegions = ["worker/production-auth.ts", "\\0virtual:cloudflare/worker-entry"];
let candidate = base, oldOutside = base;
for (const name of compiledRegions) {
  const old = region(base, name);
  candidate = candidate.replace(old, region(built, name));
  oldOutside = oldOutside.replace(old, `<${name}>`);
}
let newOutside = candidate;
for (const name of compiledRegions) newOutside = newOutside.replace(region(candidate, name), `<${name}>`);
if (oldOutside !== newOutside) throw new Error("An unrelated Production byte changed");
if (region(base, "worker/index.ts") !== region(built, "worker/index.ts")) throw new Error("Unplanned Worker helper change");

function shim(source, name) {
  const marker = [...source.matchAll(/^\/\/#region (.+)$/gm)].find(match => match[1].endsWith(`/shims/${name}.js`));
  if (!marker) throw new Error(`Missing shim ${name}`);
  return source.slice(marker.index, source.indexOf("//#endregion", marker.index) + 12);
}
function reference(source) {
  const ast = ts.createSourceFile("shim.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const ids = new Set(); let count = 0;
  function walk(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "registerClientReference" && node.arguments[1] && ts.isStringLiteral(node.arguments[1])) {
      ids.add(node.arguments[1].text); count += 1;
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  if (ids.size !== 1) throw new Error("Unexpected public client reference shape");
  return { id: [...ids][0], count };
}
const references = ["error-boundary", "layout-segment-context", "slot"].map(name => {
  const production = reference(shim(base, name)), fresh = reference(shim(built, name));
  if (production.count !== fresh.count || built.split(JSON.stringify(fresh.id)).length - 1 !== fresh.count) throw new Error("Unbounded client ID substitution");
  return { module: name, production: production.id, fresh: fresh.id, occurrences: fresh.count };
});
const lazy = source => JSON.parse(source.match(/^globalThis\.__VINEXT_LAZY_CHUNKS__\s*=\s*(\[[^\n]*\]);/m)[1]);
const oldList = lazy(base), newList = lazy(built);
if (![...oldList, ...newList].every(value => /^assets\/[A-Za-z0-9_./-]+\.js$/.test(value))) throw new Error("Unexpected client asset reference");
const uuid = /[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/g;
if ([...base.matchAll(uuid)].length !== 4 || [...built.matchAll(uuid)].length !== 4) throw new Error("Unexpected generated UUID count");
function normalize(source) {
  let result = source.replace(uuid, "<compiler-generated-uuid>");
  for (const mapping of references) result = result.replaceAll(JSON.stringify(mapping.fresh), JSON.stringify(mapping.production));
  return result.replace(/^globalThis\.__VINEXT_LAZY_CHUNKS__\s*=\s*\[[^\n]*\];/m, "globalThis.__VINEXT_LAZY_CHUNKS__=" + JSON.stringify(oldList) + ";");
}
// Parsing/minification removes trivia, including 111 dependency region labels
// with the local node_modules symlink path, and harmless provider formatting.
const transformOptions = { loader: "js", minify: true, treeShaking: false, legalComments: "none", target: "es2022" };
function canonical(source) {
  const result = transformSync(normalize(source), transformOptions);
  if (result.warnings.length) throw new Error("Unexpected compiled artifact warning");
  return result.code;
}
if (canonical(candidate) !== canonical(built)) throw new Error("Undocumented executable-code mismatch");
const report = {
  state: "PREPARED_NOT_DEPLOYED", baseRevision: "d4e1b27cb7ff78d9de74292a29ad0fcbc997eb48", baseVersion: "b2e8ebbc",
  baselineSha256Lf: sha(base), candidateSha256Lf: sha(candidate),
  changedSourceFiles: ["worker/production-auth.ts", "worker/index.ts"], changedCompiledRegions: compiledRegions,
  outsideRegionsUnchanged: true, compilerGeneratedValuesPreserved: true,
  existingProductionClientAssetsAndReferenceIdsPreserved: true, lazyClientReferenceCount: oldList.length,
  publicClientReferenceMapping: references,
  freshOnlyAssetReferences: newList.filter(value => !oldList.includes(value)),
  productionOnlyAssetReferences: oldList.filter(value => !newList.includes(value)),
  canonicalProcedure: "scripts/prepare-google-session-artifact.mjs: normalize only4 compiler UUID occurrences, the sole lazy-list assignment and3 explicitly bounded public client IDs; esbuild removes comments/whitespace and canonicalizes syntax/identifiers",
  canonicalToolVersions: { esbuild: esbuildVersion, typescript: ts.version }, transformOptions,
  matchesFreshBuildAfterDocumentedCompatibilityNormalization: true, canonicalSha256: sha(canonical(candidate)),
  encoding: "UTF-8; CRLF normalized to LF; no added terminator", productionDeployed: false,
};
fs.writeFileSync(outputPath, candidate);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ candidateSha256Lf: report.candidateSha256Lf, canonicalSha256: report.canonicalSha256, state: report.state }));
