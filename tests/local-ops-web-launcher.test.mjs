import assert from "node:assert/strict";
import test from "node:test";
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {webRuntimeSpec,webSupported,webSupportedIds} from "../scripts/local-ops-web-launcher.mjs";
const apps=JSON.parse(readFileSync(new URL("../control/local-ops-apps.json",import.meta.url),"utf8")).apps;
test("standalone web frontends have fixed manifest names and ports including Math QA",()=>{
  assert.deepEqual(webSupportedIds(apps).sort(),["bauman-master-ai","boi-ech","growup-mychildren","health-care","math-bauman","nc03-modem","price-report-tunggiabao","ru-life"].sort());
  assert.equal(webSupported({id:"boi-ech",directory:"../evil",port:3004}),false);
  assert.equal(webSupported({id:"boi-ech",directory:"BOIECH_AI",port:9999}),false);
  const math=apps.find(a=>a.id==="math-bauman");
  assert.equal(math.port,3022);
  assert.equal(webSupported({...math,qaSha:"361d597334eb2511f68abb5df41d3236e137d457"}),false);
  assert.equal(webSupported({...math,qaWorktree:"../Math_Bauman"}),false);
});
test("commands are Node and loopback-only without npm download or Wrangler admin worker",()=>{
  const top=mkdtempSync(join(tmpdir(),"am-web-"));
  try{
    const manager=join(top,"Application-Management");
    for(const app of apps.filter(webSupported)){
      const cwd=join(top,app.directory,...(app.id==="boi-ech"?["boi-ech"]:[]));
      mkdirSync(join(cwd,"node_modules","vite","bin"),{recursive:true});
      mkdirSync(join(cwd,"scripts"),{recursive:true});
      writeFileSync(join(cwd,"index.html"),"QA");
      for(const name of ["serve-local-runtime.mjs","serve-local.mjs"])writeFileSync(join(cwd,"scripts",name),"");
      writeFileSync(join(cwd,"node_modules","vite","bin","vite.js"),"");
    }
    mkdirSync(join(manager,"scripts"),{recursive:true});
    mkdirSync(join(top,"_qa","Math_Bauman_PR72"),{recursive:true});
    writeFileSync(join(top,"_qa","Math_Bauman_PR72","index.html"),"Math QA");
    writeFileSync(join(top,"_qa","Math_Bauman_PR72","service-worker.js"),"self.addEventListener(\'fetch\',()=>{});");
    writeFileSync(join(manager,"scripts","local-ops-growup-static.mjs"),"");
    writeFileSync(join(manager,"scripts","local-ops-math-qa-static.mjs"),"");
    for(const app of apps.filter(webSupported)){
      const cmd=webRuntimeSpec({app,workspace:top,managerRoot:manager});
      assert.equal(cmd.file,process.execPath);
      assert.equal(cmd.port,app.port);
      assert.equal(cmd.env.APPLICATION_MANAGEMENT_ORIGIN,"http://127.0.0.1:3000");
      assert.ok(!cmd.args.some(x=>/wrangler|taskkill|powershell|npm|npx|--var|--yes/.test(x)));
      assert.ok(cmd.args.includes("127.0.0.1")||cmd.env.NC03_HOST==="127.0.0.1"||app.id==="growup-mychildren"||app.id==="math-bauman");
      if(app.id==="math-bauman"){
        assert.equal(cmd.cwd,join(top,"_qa","Math_Bauman_PR72"));
        assert.deepEqual(cmd.args.slice(1),[cmd.cwd,"3022",app.qaSha]);
      }
    }
  }finally{rmSync(top,{recursive:true,force:true});}
});
