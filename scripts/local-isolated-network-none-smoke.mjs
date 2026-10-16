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
 console.log(JSON.stringify({result:"LOCAL_NETWORK_NONE_COLD_START_PASS",
  isolation:"Docker --network none",verifiedRoutes:["/"],
  integrationWithOtherApps:"UNVERIFIED",saveAndRestore:"UNVERIFIED",
  authenticationUX:"UNVERIFIED",productionAuthorized:false}));
}catch(e){
 console.error("APP_MANAGEMENT_NETWORK_DENIED_FAIL: "+(e instanceof Error?e.message:String(e)));
 console.error("Trimmed runtime diagnostics:\n"+logs.slice(-8000));
 process.exitCode=1;
}finally{
 app.kill("SIGTERM");
 await Promise.race([new Promise(r=>app.once("exit",r)),pause(3500)]);
}
