import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
export function loadTs(entry, overrides = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: file,
    }).outputText;
    const require = name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (!name.startsWith(".")) return nativeRequire(name);
      const base = path.resolve(path.dirname(file), name);
      const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!target) throw new Error(`Missing import ${name} from ${file}`);
      return target.endsWith(".json") ? JSON.parse(fs.readFileSync(target, "utf8")) : load(target);
    };
    new Function("require", "module", "exports", ...Object.keys(globals), output)(require, loaded, loaded.exports, ...Object.values(globals));
    return loaded.exports;
  }
  return load(path.resolve(entry));
}
