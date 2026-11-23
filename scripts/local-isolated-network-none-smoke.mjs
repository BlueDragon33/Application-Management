#!/usr/bin/env node
import {spawn} from "node:child_process";
import {setTimeout as pause} from "node:timers/promises";

if(process.env.OFFLINE_NETWORK_ISOLATED!=="1"){
 console.error("BLOCKED: this smoke must run in a Docker --network none container");
 process.exit(2);
}
const address="http://127.0.0.1:4174/";
const app=spawn("npm",["run","dev","--","--host","127.0.0.1","--port","4174"],{
  cwd:process.cwd(),
  env:{...process.env,APPLICATION_MANAGEMENT_ACCESS_MODE:"standalone",LOCAL_CONTROL_PLANE:"1"},
  detached:true,
 stdio:["ignore","pipe","pipe"]
});
let terminated=false,logs="";
app.once("exit",()=>terminated=true);
for(const out of [app.stdout,app.stderr])out.on("data",x=>logs=(logs+String(x)).slice(-12000));
let got=false;
try{
 const max=Date.now()+140000;
 while(Date.now()<max){
  if(terminated)throw new Error("local Application Management process exited during startup");
  try{
    const resp=await fetch(address,{redirect:"manual",signal:AbortSignal.timeout(2200)});
    if(resp.status===200){
      const html=await resp.text();
      if(html.length<180||!/<html|<!doctype html/i.test(html))
        throw new Error("local app returned invalid HTML shell");
      got=true;break;
    }
  }catch{/* keep bounded retries */}
  await pause(1500);
 }
 if(!got)throw new Error("Local management home did not become available with external network denied");
 // Exercise actual localhost routes in the same physically network-isolated runtime.
 // Do not claim saved-record or authentication proof without real persistence tests.
 async function mustFetch(path){
   const resp=await fetch(new URL(path,address),{redirect:"manual",signal:AbortSignal.timeout(6000)});
   if(resp.status!==200)throw new Error("Offline local route "+path+" returned HTTP "+resp.status);
   return resp;
 }
 const contract=await (await mustFetch("/api/desktop-agent/contract")).json();
 if(contract.transport?.direction!=="client-outbound-only" || contract.transport?.inboundPortRequired!==false)
   throw new Error("Desktop Agent offline transport boundary changed");
 if(!Array.isArray(contract.prohibited) || !contract.prohibited.includes("arbitrary-powershell"))
   throw new Error("Desktop Agent contract no longer prohibits arbitrary remote shell");
 const manifest=await (await mustFetch("/manifest.webmanifest")).json();
 if(manifest.start_url!=="/" || manifest.scope!=="/" || manifest.display!=="standalone")
   throw new Error("Offline PWA entrypoint/scope invalid");
 const sw=await (await mustFetch("/sw.js")).text();
 if(!/self|serviceWorker|cache|addEventListener/i.test(sw) || sw.length<100)
   throw new Error("Offline Service Worker response is not a usable script");
 const second=await mustFetch("/");
 const markup=await second.text();
 if(!/<html|<!doctype html/i.test(markup))
   throw new Error("Local app failed repeat navigation with internet disconnected");
 console.log(JSON.stringify({result:"LOCAL_NETWORK_NONE_COLD_START_AND_CONTRACT_PASS",
  isolation:"Docker --network none",
  verifiedRoutes:["/","/api/desktop-agent/contract","/manifest.webmanifest","/sw.js","/ (repeat)"],
  transport:"client-outbound-only",
  sourceRevision:process.env.GITHUB_SHA||"unknown",
  integrationWithOtherApps:"UNVERIFIED",saveAndRestore:"UNVERIFIED",
  authenticationUX:"UNVERIFIED",productionAuthorized:false}));
}catch(e){
 console.error("APP_MANAGEMENT_NETWORK_DENIED_FAIL: "+(e instanceof Error?e.message:String(e)));
 console.error("Trimmed runtime diagnostics:\n"+logs.slice(-8000));
 process.exitCode=1;
}finally{
 try{if(app.pid)process.kill(-app.pid,"SIGTERM")}catch{app.kill("SIGTERM")}
 app.stdout.destroy();
 app.stderr.destroy();
 await Promise.race([new Promise(r=>app.once("exit",r)),pause(3500)]);
}
