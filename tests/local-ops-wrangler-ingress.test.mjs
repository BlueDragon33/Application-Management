import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { createWranglerIngress } from "../scripts/local-ops-wrangler-ingress.mjs";

async function start(server) {
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  return server.address().port;
}
test("real HTTP ingress counts in-flight request, blocks after drain and never approves Wrangler stop",async()=>{
  let finish;
  const blocker = new Promise(resolve => { finish=resolve; });
  const upstream=createServer(async(req,res)=>{
    if(req.url==="/hold") { await blocker; res.end("stored"); }
    else res.end("ok");
  });
  const target=await start(upstream);
  const ingress=createWranglerIngress({upstreamPort:target});
  const front=await ingress.listen();
  try {
    const first=fetch("http://127.0.0.1:"+front+"/hold");
    for(let i=0;i<50&&ingress.status().pending!==1;i++)await delay(20);
    assert.equal(ingress.status().pending,1);
    const drain=ingress.drainIngress({timeoutMs:6000});
    assert.equal(ingress.status().state,"draining");
    assert.equal(ingress.status().safeToStopWrangler,false);
    finish();
    assert.equal((await first).status,200);
    const receipt=await drain;
    assert.equal(receipt.ingressClosed,true);
    assert.equal(receipt.admittedRequestsCompleted,true);
    assert.equal(receipt.safeToStopWrangler,false);
    assert.equal(receipt.d1CommitReadbackVerified,false);
    assert.equal(receipt.allWorkerIsolatesDrained,false);
    assert.equal(ingress.status().pending,0);
    await assert.rejects(fetch("http://127.0.0.1:"+front+"/hold"));
  }finally {finish();await ingress.close();await new Promise(resolve=>upstream.close(resolve));}
});
test("upstream failure and HTTP client abort invalidate drain evidence",async()=>{
  const upstream=createServer((req,res)=>{res.destroy();});
  const target=await start(upstream);
  const ingress=createWranglerIngress({upstreamPort:target});
  const front=await ingress.listen();
  try {
    const response=await fetch("http://127.0.0.1:"+front+"/write");
    assert.equal(response.status,502);
    // 502 means the real upstream may already have written data: fail closed.
    await assert.rejects(ingress.drainIngress({timeoutMs:4000}),
      /INGRESS_DRAIN_UNCERTAIN_OR_PENDING/);
    assert.equal(ingress.status().uncertain,true);
    assert.equal(ingress.status().safeToStopWrangler,false);
  }finally {await ingress.close();await new Promise(resolve=>upstream.close(resolve));}
});
test("never connects to user-selected host or arbitrary port",()=>{
  assert.throws(()=>createWranglerIngress({upstreamPort:80}),/PORT_INVALID/);
  assert.throws(()=>createWranglerIngress({upstreamPort:NaN}),/PORT_INVALID/);
});
