import { issueBoiBrowserBridge } from "../../../../boi-ech.server";
import { controlErrorResponse, verifyControlProof } from "../../../../control-device.server";

export const dynamic = "force-dynamic";
const TIMEOUT_MS = 8_000;
const mutations = new Set(["set-account","set-policy"]);
const allowed = new Set(["list","manager-inbox","policy","read-account",...mutations]);
function json(data: unknown,status=200) {
  return Response.json(data,{status,headers:{"cache-control":"no-store, private","x-content-type-options":"nosniff"}});
}
function record(value: unknown): Record<string,unknown> {
  return value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
}
async function upstream(bridge: Awaited<ReturnType<typeof issueBoiBrowserBridge>>, input: Record<string,unknown>) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try {
    const response=await fetch(`${bridge.baseUrl}/api/control/accounts`,{
      method:"POST",headers:{authorization:`Bearer ${bridge.token}`,"content-type":"application/json"},
      body:JSON.stringify(input),cache:"no-store",redirect:"manual",signal:controller.signal
    });
    if (response.status>=300 && response.status<400) return {status:502,data:{error:"Bridge Bơi ếch không được chuyển hướng."}};
    const data=record(await response.json().catch(()=>({})));
    return {status:response.status,data};
  } catch {
    return {status:controller.signal.aborted?504:502,data:{error:"Không đọc được quyền tài khoản từ Bơi ếch."}};
  } finally {clearTimeout(timer);}
}
export async function POST(request: Request) {
  try {
    if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({error:"Content type không hợp lệ."},415);
    const raw=await request.text();
    if(raw.length>4096) return json({error:"Yêu cầu quá lớn."},413);
    let input:Record<string,unknown>;
    try {input=record(JSON.parse(raw));} catch {return json({error:"JSON không hợp lệ."},400);}
    const action=input.action;
    if(typeof action!=="string"||!allowed.has(action)) return json({error:"Lệnh quản lý tài khoản không hợp lệ."},400);
    const proofDeviceId=typeof input.controlDeviceId==="string"?input.controlDeviceId:undefined;
    const actor=await verifyControlProof(proofDeviceId?{...input,deviceId:proofDeviceId}:input);
    if(actor.role!=="owner") return json({error:"Chỉ Owner được quản lý thời hạn tài khoản.",code:"OWNER_REQUIRED"},403);
    const bridge=await issueBoiBrowserBridge(actor.email,actor.role);
    const cmd:Record<string,unknown>=action==="manager-inbox"?{action:"manager-inbox-v2"}
      :action==="list"?{action:"list-entitlements"}
      :action==="policy"?{action:"entitlement-policy"}
      :action==="read-account"?{action:"read-entitlement",accountId:input.accountId}
      :action==="set-policy"?{action:"set-entitlement-policy",role:input.role,defaultDays:input.defaultDays,expectedRevision:input.expectedRevision,reason:input.reason}
      :{action:"set-entitlement",accountId:input.accountId,operation:input.operation,expiresAt:input.expiresAt,expectedRevision:input.expectedRevision,reason:input.reason};
    const changed=await upstream(bridge,cmd);
    if(changed.status!==200) return json(changed.data,changed.status);
    if(action==="manager-inbox"){
      const rows=changed.data.managers;
      if(changed.data.contract!=="boi-manager-intake.v2"||changed.data.verified!==true
        ||!Array.isArray(rows)||rows.length>100||rows.some(row=>{
        const a=record(row);
        return a.role!=="manager"||typeof a.accountId!=="string"
          ||typeof a.status!=="string"||typeof a.onboardingStage!=="string"&&a.onboardingStage!==null
          ||typeof a.onboardingRevision!=="number"&&a.onboardingRevision!==null;
      })) return json({error:"Dữ liệu hàng chờ quản lý chưa được xác minh.",code:"BOI_MANAGER_INBOX_UNVERIFIED"},502);
      // Expose only the explicit Owner review fields, not credentials, devices or payment proofs.
      return json({ok:true,verified:true,managers:rows.map(row=>{
        const a=record(row);
        return {accountId:a.accountId,status:a.status,onboardingStage:a.onboardingStage,
          onboardingRevision:a.onboardingRevision,name:typeof a.name==="string"?a.name:null};
      })});
    }
    if(!mutations.has(action)) return json({...changed.data,ok:true});
    const verifyCmd=action==="set-policy"?{action:"entitlement-policy"}:{action:"read-entitlement",accountId:input.accountId};
    const verified=await upstream(bridge,verifyCmd);
    if(verified.status!==200) return json({error:"Đã gửi lệnh nhưng chưa đọc lại được Bơi ếch.",code:"ACCOUNT_READBACK_UNVERIFIED",applied:true,verified:false},502);
    if(action==="set-account"){
      const before=record(changed.data.entitlement),after=record(verified.data.entitlement);
      if(!after.accountId || before.accountId!==after.accountId || before.revision!==after.revision || before.expiresAt!==after.expiresAt || before.state!==after.state)
        return json({error:"Dữ liệu tài khoản đọc lại không khớp.",code:"ACCOUNT_READBACK_MISMATCH",applied:true,verified:false},502);
    }else{
      const row=record(changed.data.policy);
      const actual=Array.isArray(verified.data.policies)?verified.data.policies.map(record).find(p=>p.role===row.role):null;
      if(!actual||actual.revision!==row.revision||actual.defaultDays!==row.defaultDays)
        return json({error:"Chính sách thời hạn đọc lại không khớp.",code:"ACCOUNT_READBACK_MISMATCH",applied:true,verified:false},502);
    }
    return json({...changed.data,ok:true,verified:true});
  }catch(error){return controlErrorResponse(error);}
}
