import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
function effect(){const text=fs.readFileSync(new URL('../app/management-modern-overview.tsx',import.meta.url),'utf8');const sf=ts.createSourceFile('view.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let body;
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='useEffect'&&n.arguments[0]?.body?.getText(sf).includes('setClock(new Date())')&&n.arguments[0].body.getText(sf).includes('initialize()'))body=n.arguments[0].body.getText(sf);ts.forEachChild(n,visit)}visit(sf);assert.ok(body);assert.match(body,/initialTimer/,'startup must be bounded and cancellable');
 let next=0,started=0,refreshed=0,clock=0;const timers=new Map(),intervals=new Map(),listeners=new Map();const window={setTimeout:fn=>{timers.set(++next,fn);return next},clearTimeout:id=>timers.delete(id),setInterval:fn=>{intervals.set(++next,fn);return next},clearInterval:id=>intervals.delete(id),addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)};
 const loaded={};new Function('window','setClock','initialize','refreshOperations','exports',ts.transpileModule('exports.effect=()=>'+body,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(window,()=>clock++,()=>started++,()=>refreshed++,loaded);
 return {run:loaded.effect,timers,intervals,listeners,flush(){for(const [id,fn]of [...timers]){timers.delete(id);fn()}},counts:()=>({started,refreshed,clock})};}
test('cleanup before client initialization prevents work; active cleanup releases timers and subscriptions',()=>{const f=effect();const cancel=f.run();assert.equal(f.timers.size,1);assert.equal(f.counts().started,0);cancel();f.flush();assert.equal(f.counts().started,0);const dispose=f.run();f.flush();assert.equal(f.counts().started,1);assert.equal(f.intervals.size,1);f.listeners.get('focus')();assert.equal(f.counts().refreshed,1);dispose();assert.equal(f.listeners.size,0);assert.equal(f.intervals.size,0);assert.equal(f.timers.size,0)});

test('deferred font hydration preserves the stored accessibility preference before persistence',()=>{
 const text=fs.readFileSync(new URL('../app/tools/study-plan/study-plan.tsx',import.meta.url),'utf8');
 const sf=ts.createSourceFile('study.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const effects=[];
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='useEffect'&&n.arguments[0]?.body?.getText(sf).includes('study-plan-font-scale:v1'))effects.push(n.arguments[0].body.getText(sf));ts.forEachChild(n,visit)}visit(sf);assert.equal(effects.length,2);
 let fontScale='normal',fontScaleLoaded=false,saved='xlarge';const timers=new Map();let next=0;
 const window={setTimeout:fn=>{timers.set(++next,fn);return next},clearTimeout:id=>timers.delete(id),localStorage:{getItem:()=>saved,setItem:(_,v)=>{saved=v}}};
 const run=body=>{const out=ts.transpileModule('exports.run=()=>'+body,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const loaded={};new Function('window','fontScale','fontScaleLoaded','setFontScale','setFontScaleLoaded','exports',out)(window,fontScale,fontScaleLoaded,v=>{fontScale=v},v=>{fontScaleLoaded=v},loaded);return loaded.run()};
 const dispose=run(effects[0]);run(effects[1]);assert.equal(saved,'xlarge','initial render must not overwrite saved preference');
 for(const[id,fn]of[...timers]){timers.delete(id);fn()}
 assert.equal(fontScale,'xlarge');run(effects[1]);assert.equal(saved,'xlarge');dispose();
});
