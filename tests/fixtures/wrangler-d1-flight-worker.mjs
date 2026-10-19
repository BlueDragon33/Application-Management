// Disposable e2e probe worker ONLY; not imported by user applications.
export default {
  async fetch(request, env, ctx) {
    if (env.LOCAL_OPS_GATEWAY_REQUIRED === "1" &&
      request.headers.get("x-local-ops-ingress-proof") !== env.LOCAL_OPS_INGRESS_PROOF)
      return new Response("Direct backend denied", { status: 403 });
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, fixture: true });
    if (url.pathname === "/write" && request.method === "POST") {
      const id = url.searchParams.get("id") || "";
      if (!/^[a-f0-9]{32}$/.test(id)) return new Response("invalid", { status: 400 });
      await new Promise(resolve => setTimeout(resolve, 1000)); // real in-flight HTTP
      await env.DB.prepare("INSERT INTO flight_qa(id,val) VALUES(?,?)").bind(id, "COMMITTED").run();
      return Response.json({ id, committed: true });
    }
    if (url.pathname === "/background-write" && request.method === "POST") {
      const id = url.searchParams.get("id") || "";
      if (!/^[a-f0-9]{32}$/.test(id)) return new Response("invalid",{status:400});
      // This write is awaited by the HTTP response. The second write is NOT.
      await env.DB.prepare("INSERT INTO flight_qa(id,val) VALUES(?,?)")
        .bind(id,"PENDING").run();
      ctx.waitUntil((async () => {
        // The release gate is persisted in disposable D1, not a shared JS timer.
        // This keeps the waitUntil promise active until QA has observed PENDING.
        for(let i=0;i<120;i++){
          const row=await env.DB.prepare("SELECT val FROM flight_qa WHERE id=?")
            .bind(id).first();
          if(row?.val==="RELEASED"){
            const result=await env.DB.prepare("UPDATE flight_qa SET val=? WHERE id=? AND val=?")
              .bind("BACKGROUND_COMMITTED",id,"RELEASED").run();
            if(result.meta.changes!==1)throw Error("BACKGROUND_D1_NOT_UPDATED");
            return;
          }
          if(row?.val!=="PENDING")throw Error("BACKGROUND_D1_GATE_INVALID");
          await new Promise(resolve=>setTimeout(resolve,100));
        }
        throw Error("BACKGROUND_D1_GATE_TIMEOUT");
      })());
      return Response.json({id,accepted:true,backgroundWriteCompleted:false},{status:202});
    }
    if (url.pathname === "/background-release" && request.method === "POST") {
      const id = url.searchParams.get("id") || "";
      if (!/^[a-f0-9]{32}$/.test(id)) return new Response("invalid",{status:400});
      const result=await env.DB.prepare("UPDATE flight_qa SET val=? WHERE id=? AND val=?")
        .bind("RELEASED",id,"PENDING").run();
      if(result.meta.changes!==1)return new Response("not pending",{status:409});
      return Response.json({id,released:true});
    }
    if (url.pathname === "/read") {
      const id = url.searchParams.get("id");
      const row = await env.DB.prepare("SELECT val FROM flight_qa WHERE id=?").bind(id).first();
      return Response.json(row || {});
    }
    return new Response("not found",{status:404});
  }
};
