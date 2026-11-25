import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createServer as reserveServer } from "node:net";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
const qaRequire = createRequire(path.join(process.env.RTT_QA_TOOL_ROOT ?? "", "package.json"));
const { chromium } = qaRequire("playwright");

const base = "e97df96427cbc03ba5a62cf03cd6cc214340cf90";
const [kind, output, expected] = process.argv.slice(2);
assert.ok(output);
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
};
if (kind === "compare") {
  const files = await Promise.all(["baseline-1","candidate-1","candidate-2","baseline-2"].map(name =>
    readFile(path.join(output, name + ".json"), "utf8").then(JSON.parse)));
  assert.equal(files[0].sha, base);
  assert.equal(files[3].sha, base);
  assert.equal(files[1].sha, expected);
  assert.equal(files[2].sha, expected);
  assert.equal(new Set(files.map(file => file.browser)).size, 1);
  const result = [];
  for (const width of [390, 1440]) {
    const a = files.filter(file => file.sha === base).flatMap(file => file.samples.filter(s => s.width === width));
    const b = files.filter(file => file.sha === expected).flatMap(file => file.samples.filter(s => s.width === width));
    assert.equal(a.length, 6);
    assert.equal(b.length, 6);
    for (const key of ["readyMs","domInteractiveMs","transferBytes","learnMs","practiceMs","progressMs","audioMs"]) {
      const av = median(a.map(s => s[key])), bv = median(b.map(s => s[key]));
      result.push({ width, metric: key, baselineMedian: av, candidateMedian: bv, delta: bv-av,
        ratio: av > 0 ? bv/av : null, baselineRange: [Math.min(...a.map(s => s[key])),Math.max(...a.map(s => s[key]))],
        candidateRange: [Math.min(...b.map(s => s[key])),Math.max(...b.map(s => s[key]))] });
    }
    assert.ok([...a,...b].every(s => s.trainingAssetRequests === 0), "Trainer unexpectedly preloads learning media");
  }
  const report = { baseline: base, candidate: expected, browser: files[0].browser, samplesPerRevisionPerViewport: 6,
    order: ["baseline","candidate","candidate","baseline"], runtime: "same runner, isolated local Vite development servers; warmed server and fresh browser contexts", metrics: result,
    performanceAcceptance: "MEASURED_NOT_RATIFIED", limits: "Descriptive medians/ranges, no production or statistical significance claim.",
    accessibilityObservations: files.filter(f => f.sha === expected).flatMap(f => f.audits) };
  await writeFile(path.join(output,"comparison.json"), JSON.stringify(report,null,2)+"\n");
  console.log("RTT_PERFORMANCE_COMPARISON "+JSON.stringify(report.metrics));
  console.log("RTT_ACCESSIBILITY_OBSERVATIONS "+JSON.stringify(report.accessibilityObservations));
} else {
  assert.ok(kind === "baseline" || kind === "candidate");
  const sha = execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
  assert.equal(sha,expected);
  assert.ok(!existsSync(".env") && !existsSync(".dev.vars"), "Use isolated QA fixture");
  Object.assign(process.env,{APP_RUNTIME:"local",CONTROL_PLANE_NETWORK_MODE:"local",LOCAL_DEV_AUTH:"1",
    LOCAL_DEV_USER_ID:"russian-time-trainer-performance-qa",LOCAL_DEV_USER_EMAIL:"russian-time-trainer-perf@example.test",
    LOCAL_DEV_USER_NAME:"Trainer performance QA",WRANGLER_SEND_METRICS:"false",WRANGLER_WRITE_LOGS:"false"});
  delete process.env.CONTROL_OWNER_EMAILS;
  const requireFromCheckout = createRequire(path.resolve("package.json"));
  const { createServer } = await import(pathToFileURL(requireFromCheckout.resolve("vite")).href);
  const port = await new Promise((resolve,reject) => {
    const reservation = reserveServer();
    reservation.once("error",reject);
    reservation.listen(0,"127.0.0.1",() => {const p=reservation.address().port;reservation.close(error=>error?reject(error):resolve(p));});
  });
  const server = await createServer({logLevel:"warn",clearScreen:false,server:{host:"127.0.0.1",port,strictPort:true,hmr:false}});
  let browser;
  const samples=[],audits=[];
  try {
    await server.listen();
    assert.equal(server.httpServer.address().address,"127.0.0.1");
    const origin="http://127.0.0.1:"+port;
    browser=await chromium.launch({channel:"chrome",headless:true});
    for(const width of [390,1440]) {
      // One warm-up (excluded), then three fresh isolated contexts per block.
      for(let sample=-1;sample<3;sample++) {
        const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce",serviceWorkers:"block"});
        await context.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
        const page=await context.newPage();
        try {
          assert.equal((await page.goto(origin+"/tools/russian-time-trainer",{waitUntil:"domcontentloaded"})).status(),200);
          await page.getByRole("heading",{name:"Russian Time Trainer",exact:true}).waitFor();
          await page.waitForFunction(() => document.documentElement.lang === "en");
          await page.getByRole("combobox",{name:/Training mode/}).waitFor();
          const nav=page.getByRole("navigation",{name:"Trainer sections"});
          const timing=await page.evaluate(()=>{
            const entry=performance.getEntriesByType("navigation")[0];
            const resources=performance.getEntriesByType("resource");
            return {readyMs:performance.now(),domInteractiveMs:entry.domInteractive,
              transferBytes:entry.transferSize+resources.reduce((n,r)=>n+r.transferSize,0),
              trainingAssetRequests:resources.filter(r=>/russian-time-trainer\/.*\.(mp3|ttf|ogg)(?:$|\?)/.test(r.name)).length};
          });
          const timeView=async (label, ready)=>{
            const start=performance.now();
            const target = nav.getByRole("button",{name:label,exact:true});
            await target.click();
            await target.and(page.locator("[aria-pressed=true]")).waitFor();
            await ready.waitFor();
            return performance.now()-start;
          };
          const learnMs=await timeView("Learn Уроки",page.getByRole("region",{name:/Worked examples/}));
          const practiceMs=await timeView("Practice Практика",page.getByRole("group",{name:"Answer choices"}));
          const progressMs=await timeView("Progress Прогресс",page.getByText("Calendar skills",{exact:false}));
          const audioMs=await timeView("Audio practice Аудиотренировка",page.getByRole("combobox",{name:/Training mode/}));
          if(sample>=0)samples.push({width,sample,...timing,learnMs,practiceMs,progressMs,audioMs});
          if(kind==="candidate"&&sample===-1) {
            for(const theme of ["light","dark"]) {
              if(theme==="dark")await page.getByRole("button",{name:/Dark mode/}).click();
              for(const label of ["Audio practice Аудиотренировка","14-day plan План на 14 дней","Learn Уроки","Practice Практика","Progress Прогресс"]) {
                await nav.getByRole("button",{name:label,exact:true}).click();
                const evidence=await page.evaluate(()=>{
                  const root=document.querySelector("main");
                  const parse=s=>{
                    const m=s.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
                    return m?[+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]]:null;
                  };
                  const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[0.2126,0.7152,0.0722][i],0);
                  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
                  let checked=0,unresolved=0;const problems=new Map();
                  for(let node=walker.nextNode();node;node=walker.nextNode()){
                    const text=node.textContent.trim(),el=node.parentElement;
                    if(!text||!el||el.closest("script,style,option,button:disabled,[hidden]"))continue;
                    const range=document.createRange();range.selectNodeContents(node);
                    if(!Array.from(range.getClientRects()).some(r=>r.width>0&&r.height>0))continue;
                    const style=getComputedStyle(el);
                    if(style.visibility!=="visible")continue;
                    let bg=null,ambiguous=false;
                    for(let p=el;p;p=p.parentElement){
                      const s=getComputedStyle(p);
                      if(s.opacity!=="1"||s.backgroundImage!=="none"){ambiguous=true;break;}
                      const v=parse(s.backgroundColor);
                      if(!v||v[3]>0&&v[3]<1){ambiguous=true;break;}
                      if(v[3]===1){bg=v;break;}
                    }
                    const fg=parse(style.color);
                    if(ambiguous||!bg||!fg||fg[3]!==1){unresolved++;continue;}
                    const l1=luminance(fg),l2=luminance(bg),ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
                    const size=parseFloat(style.fontSize),weight=parseInt(style.fontWeight,10);
                    const threshold=size>=24||size>=18.66&&weight>=700?3:4.5;
                    checked++;
                    if(ratio<threshold)problems.set(style.color+"/"+bg.join(",")+"/"+text.slice(0,100),{text:text.slice(0,100),ratio,threshold});
                  }
                  const smallTargets=Array.from(root.querySelectorAll("button:not(:disabled),select")).filter(e=>{
                    const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<44||r.height<44);
                  }).map(e=>({label:(e.getAttribute("aria-label")||e.textContent||"").trim().slice(0,70),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));
                  return {checked,unresolved,possibleContrastFailures:[...problems.values()],targetsBelow44:smallTargets};
                });
                audits.push({width,theme,view:label,...evidence,scope:"visible DOM text with opaque backgrounds; gradients/opacity unresolved; not screen-reader certification"});
              }
            }
          }
        } catch (error) {
          await page.screenshot({path:output+".failure.png"}).catch(()=>{});
          await writeFile(output+".failure.json",JSON.stringify({sha,width,sample,error:String(error),url:page.url(),body:(await page.locator("main").innerText().catch(()=> "")).slice(0,4000)},null,2));
          throw error;
        } finally {await context.close();}
      }
    }
    await writeFile(output,JSON.stringify({sha,browser:browser.version(),samples,audits},null,2)+"\n");
  } finally {await browser?.close();await server.close();}
}
