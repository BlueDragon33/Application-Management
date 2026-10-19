// Fixed standalone frontend descriptions only. Managed D1 controls remain locked.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
const WEB_APPS=Object.freeze({
  "boi-ech":{dir:"BOIECH_AI",sub:"boi-ech",port:3004,kind:"vite"},
  "health-care":{dir:"Health_Care",port:3001,kind:"vite"},
  "ru-life":{dir:"RU_LIFE",port:3002,kind:"vite"},
  "bauman-master-ai":{dir:"Bauman-master-ai-system",port:3005,kind:"bauman"},
  "math-bauman":{dir:"Math_Bauman",port:3022,kind:"math-qa-static",qaWorktree:"_qa/Math_Bauman_PR72",qaSha:"2d96583f034ff3c61456d52a0ef550d2c371d248"},
  "growup-mychildren":{dir:"GrowUP_MyChildren",port:3006,kind:"growup"},
  "price-report-tunggiabao":{dir:"PriceReport_Tunggiabao",port:3008,kind:"vite"},
  "nc03-modem":{dir:"NC03_Modem",port:3010,kind:"nc03"}
});
export function webSupported(app){
  const known=WEB_APPS[app?.id];
  return Boolean(known && app.directory===known.dir && app.port===known.port &&
    (known.kind!=="math-qa-static" || (app.qaWorktree===known.qaWorktree && app.qaSha===known.qaSha && app.path==="/index.html")));
}
export function webSupportedIds(apps){return apps.filter(webSupported).map(app=>app.id);}
export function webRuntimeSpec({app,workspace,managerRoot,node=process.execPath}={}){
  if(!webSupported(app))throw Error("WEB_FRONTEND_UNSUPPORTED_OR_MANIFEST_MISMATCH");
  const known=WEB_APPS[app.id];
  const cwd=resolve(workspace,...(known.kind==="math-qa-static"?known.qaWorktree.split("/"):[known.dir,...(known.sub?[known.sub]:[])]));
  const env={LOCAL_CONTROL_PLANE:"true",CONTROL_PLANE_NETWORK_MODE:"local",
    APPLICATION_MANAGEMENT_ORIGIN:"http://127.0.0.1:3000"};
  let entry,args;
  if(known.kind==="vite"){
    entry=join(cwd,"node_modules","vite","bin","vite.js");
    args=[entry,"--host","127.0.0.1","--port",String(app.port),"--strictPort"];
  }else if(known.kind==="bauman"){
    entry=join(cwd,"scripts","serve-local-runtime.mjs");
    args=[entry,"--host","127.0.0.1","--port",String(app.port)];
  }else if(known.kind==="math-qa-static"){
    entry=join(resolve(managerRoot),"scripts","local-ops-math-qa-static.mjs");
    if(!existsSync(join(cwd,"index.html")) || !existsSync(join(cwd,"service-worker.js")))
      throw Error("MATH_QA_STATIC_ENTRY_MISSING");
    args=[entry,cwd,String(app.port),known.qaSha];
  }else if(known.kind==="nc03"){
    entry=join(cwd,"scripts","serve-local.mjs");
    env.NC03_HOST="127.0.0.1";env.NC03_PORT=String(app.port);
    args=[entry];
  }else{
    entry=join(resolve(managerRoot),"scripts","local-ops-growup-static.mjs");
    if(!existsSync(join(cwd,"index.html")))throw Error("GROWUP_STATIC_ENTRY_MISSING");
    args=[entry,cwd,String(app.port)];
  }
  if(!existsSync(entry))throw Error("WEB_FRONTEND_DEPENDENCIES_OR_ENTRY_MISSING: "+app.id);
  return {name:app.id,file:node,args,cwd,env,port:app.port};
}
