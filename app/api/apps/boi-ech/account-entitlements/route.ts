import { issueBoiBrowserBridge } from "../../../../boi-ech.server";
import { controlErrorResponse, verifyControlProof } from "../../../../control-device.server";

export const dynamic = "force-dynamic";
const TIMEOUT_MS = 8_000;
const mutations = new Set(["set-account","set-policy","issue-manager-invite","manager-review-first","manager-review-final","manager-review-changes"]);
const allowed = new Set(["list","manager-inbox","manager-policy","policy","read-account",...mutations]);
function json(data: unknown,status=200) {
  return Response.json(data,{status,headers:{"cache-control":"no-store, private","x-content-type-options":"nosniff"}});
}
function record(value: unknown): Record<string,unknown> {
  return value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
}
const validId = (value: unknown) => typeof value==="string" && /^acc_[a-f0-9]{64}$/.test(value);
const validRoles = new Set(["manager","teacher","learner"]);
function verifiedAccountRows(value: unknown): value is Record<string,unknown>[] {
  return Array.isArray(value) && value.length<=500 && value.every(item=>{
    const row=record(item), entitlement=row.entitlement;
    return validId(row.accountId) && validRoles.has(String(row.role))
      && (row.name===null || typeof row.name==="string")
      && typeof row.deviceStatus==="string"
      && (row.onboardingStage===null || typeof row.onboardingStage==="string")
      && (entitlement===null || (typeof entitlement==="object" && !Array.isArray(entitlement)
        && ["active","suspended"].includes(String(record(entitlement).state))
        && typeof record(entitlement).expiresAt==="string"
        && typeof record(entitlement).activatedAt==="string"
        && Number.isSafeInteger(record(entitlement).revision)
        && typeof record(entitlement).active==="boolean"));
  });
}
function verifiedDurationPolicies(value: unknown): value is Record<string,unknown>[] {
  return Array.isArray(value) && value.length===3
    && new Set(value.map(row=>record(row).role)).size===3
    && value.every(item=>{
      const row=record(item);
      return validRoles.has(String(row.role)) && Number.isSafeInteger(row.defaultDays)
        && Number(row.defaultDays)>=1 && Number(row.defaultDays)<=365
        && Number.isSafeInteger(row.revision) && typeof row.updatedAt==="string";
    });
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
    const cmd:Record<string,unknown>=action==="manager-inbox"
      ?{action:"manager-inbox-v2",after:input.after??"",limit:40}
      :action==="manager-policy"?{action:"capacity"}
      :action==="issue-manager-invite"?{action:"create-manager-invite",expectedRevision:input.expectedRevision}
      :action==="manager-review-first"?{action:"review-first",accountId:input.accountId,expectedRevision:input.expectedRevision}
      :action==="manager-review-final"?{action:"command",operation:"approve-manager",accountId:input.accountId,expectedRevision:input.expectedRevision}
      :action==="manager-review-changes"?{action:"review-changes",accountId:input.accountId,expectedRevision:input.expectedRevision,reason:input.reason}
      :action==="list"?{action:"list-entitlements"}
      :action==="policy"?{action:"entitlement-policy"}
      :action==="read-account"?{action:"read-entitlement",accountId:input.accountId}
      :action==="set-policy"?{action:"set-entitlement-policy",role:input.role,defaultDays:input.defaultDays,expectedRevision:input.expectedRevision,reason:input.reason}
      :{action:"set-entitlement",accountId:input.accountId,operation:input.operation,expiresAt:input.expiresAt,expectedRevision:input.expectedRevision,reason:input.reason};
    const changed=await upstream(bridge,cmd);
    if(changed.status!==200) return json(changed.data,changed.status);
    if(action==="manager-inbox"){
      const rows=changed.data.managers,next=changed.data.nextCursor;
      if(changed.data.contract!=="boi-manager-intake.v2"||changed.data.verified!==true
        ||!Array.isArray(rows)||rows.length>40
        ||(next!==null && (typeof next!=="string"||!/^acc_[a-f0-9]{64}$/.test(next)))
        ||rows.some(row=>{
          const a=record(row);
          return a.role!=="manager"||typeof a.accountId!=="string"||!/^acc_[a-f0-9]{64}$/.test(a.accountId)
            ||typeof a.accountRevision!=="number"||!Number.isSafeInteger(a.accountRevision)
            ||typeof a.status!=="string"||typeof a.onboardingStage!=="string"
            ||typeof a.onboardingRevision!=="number"||!Number.isSafeInteger(a.onboardingRevision);
        })) return json({error:"Dữ liệu hàng chờ quản lý chưa được xác minh.",code:"BOI_MANAGER_INBOX_UNVERIFIED"},502);
      return json({ok:true,verified:true,managers:rows.map(row=>{
        const a=record(row);
        return {accountId:a.accountId,accountRevision:a.accountRevision,status:a.status,
          onboardingStage:a.onboardingStage,onboardingRevision:a.onboardingRevision,
          name:typeof a.name==="string"?a.name:null};
      }),nextCursor:next});
    }
    if(action==="manager-policy"){
      const limits=changed.data.limits;
      const manager=Array.isArray(limits)?limits.map(record).find(x=>x.role==="manager"):null;
      if(!manager||!Number.isSafeInteger(manager.revision)||!Number.isSafeInteger(manager.accountLimit)
        ||!Number.isSafeInteger(manager.used)) return json({error:"Chưa xác minh được chính sách giới hạn quản lý.",code:"MANAGER_POLICY_UNVERIFIED"},502);
      return json({ok:true,verified:true,policy:{revision:manager.revision,accountLimit:manager.accountLimit,used:manager.used}});
    }
    if(action==="issue-manager-invite"){
      if(changed.data.verified!==true||typeof changed.data.inviteToken!=="string"
        ||! /^[a-f0-9]{64}$/.test(changed.data.inviteToken)
        ||typeof changed.data.expiresAt!=="string")
        return json({error:"Chưa xác minh được thư mời quản lý.",code:"MANAGER_INVITE_UNVERIFIED"},502);
      const inviteUrl=new URL(bridge.baseUrl);
      inviteUrl.pathname="/";
      inviteUrl.search="";
      inviteUrl.hash="manager-invite="+changed.data.inviteToken;
      return json({ok:true,verified:true,inviteUrl:inviteUrl.toString(),expiresAt:changed.data.expiresAt});
    }
    if(action==="manager-review-first" || action==="manager-review-final" || action==="manager-review-changes"){
      const checked=await upstream(bridge,{action:"read",accountId:input.accountId});
      if(checked.status!==200) return json({error:"Đã gửi lệnh duyệt nhưng chưa đọc lại trạng thái.",
        code:"ACCOUNT_READBACK_UNVERIFIED",applied:true,verified:false},502);
      const a=record(checked.data),onboarding=record(changed.data.onboarding);
      const expectedStage=action==="manager-review-first"?"profile_required"
        :action==="manager-review-changes"?"changes_requested":"active";
      const verified= a.accountId===input.accountId && a.role==="manager"
        && a.onboardingStage===expectedStage
        && (action==="manager-review-final"
          ? a.status==="approved" && record(a.entitlement).active===true
            && Number(a.revision)===(Number(input.expectedRevision)+1)
          : a.status==="pending" && onboarding.stage===expectedStage
            && Number(a.onboardingRevision)===(Number(input.expectedRevision)+1));
      if(!verified)return json({error:"Đọc lại lần duyệt chưa khớp máy chủ.",
        code:"ACCOUNT_READBACK_MISMATCH",applied:true,verified:false},502);
      return json({ok:true,verified:true,account:{accountId:a.accountId,status:a.status,
        onboardingStage:a.onboardingStage,onboardingRevision:a.onboardingRevision,
        accountRevision:a.revision}});
    }
    if(action==="list" || action==="policy"){
      const valid=action==="list"?verifiedAccountRows(changed.data.accounts)
        :verifiedDurationPolicies(changed.data.policies);
      if(!valid)return json({error:"Danh sách tài khoản/chính sách Bơi ếch chưa được xác minh.",
        code:"BOI_ACCOUNT_DURATION_UNVERIFIED",verified:false},502);
      return json({...changed.data,ok:true,verified:true});
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
