import {issueBoiBrowserBridge} from "../../../../boi-ech.server";
import {controlErrorResponse,verifyControlProof} from "../../../../control-device.server";
export const dynamic="force-dynamic";
type Payload=Record<string,unknown>;
const json=(data:unknown,status=200)=>Response.json(data,{status,
 headers:{"cache-control":"no-store,private","x-content-type-options":"nosniff"}});
const obj=(v:unknown):Payload=>v&&typeof v==="object"&&!Array.isArray(v)?v as Payload:{};
const hash=/^[a-f0-9]{64}$/;
const bookmark=/^([a-f0-9]{8}-){3}[a-f0-9]{32}$/i;
const date=/^20\d\d-\d\d-\d\d \d\d:\d\d:\d\d$/;
async function upstream(bridge:Awaited<ReturnType<typeof issueBoiBrowserBridge>>,body:Payload){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25_000);
 try{
  const result=await fetch(bridge.baseUrl+"/api/control/v2/once-roster-reset",{
   method:"POST",headers:{"content-type":"application/json",
    authorization:"Bearer "+bridge.token},
   body:JSON.stringify(body),cache:"no-store",redirect:"manual",signal:controller.signal
  });
  if(result.status>=300&&result.status<400)return {status:502,data:{code:"ROSTER_RESET_REDIRECT_FORBIDDEN"}};
  return {status:result.status,data:obj(await result.json().catch(()=>null))};
 }catch{return {status:controller.signal.aborted?504:502,data:{
  code:"ROSTER_RESET_UPSTREAM_UNKNOWN",applied:"unknown",
  error:"Chưa rõ lô xóa có thực hiện hay chưa. Dừng, quét D1 trước khi xử lý tiếp."}};}
 finally{clearTimeout(timer);}
}
export async function POST(request:Request){
 try{
  if(!request.headers.get("content-type")?.startsWith("application/json"))
   return json({code:"ROSTER_RESET_INPUT"},415);
  const raw=await request.text();
  if(raw.length>3000)return json({code:"ROSTER_RESET_INPUT"},413);
  let input:Payload;
  try{const value=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))throw Error();
   input=value as Payload;}catch{return json({code:"ROSTER_RESET_INPUT"},400);}
  if(input.action!=="preview"&&input.action!=="execute-batch")
   return json({code:"ROSTER_RESET_INPUT"},400);
  const controlDeviceId=typeof input.controlDeviceId==="string"?input.controlDeviceId:undefined;
  const actor=await verifyControlProof(controlDeviceId?{...input,deviceId:controlDeviceId}:input);
  if(actor.role!=="owner")return json({code:"OWNER_REQUIRED"},403);
  if(input.action==="execute-batch"&&(
   input.confirmation!=="XOA TAT CA TRU QUYNH THIEN SON DONG NGHI"||
   typeof input.cutoff!=="string"||!date.test(input.cutoff)||
   typeof input.snapshot!=="string"||!hash.test(input.snapshot)||
   typeof input.protectSon!=="string"||input.protectSon.length>128||
   typeof input.protectNghi!=="string"||input.protectNghi.length>128||
   typeof input.protectQuynh!=="string"||input.protectQuynh.length>128||
   typeof input.backupBookmark!=="string"||!bookmark.test(input.backupBookmark)||
   typeof input.reason!=="string"||input.reason.trim().length<10||input.reason.length>300
  ))return json({code:"ROSTER_RESET_CONFIRMATION_REQUIRED",applied:false,
   error:"Thiếu xác nhận Owner, bảo vệ hai tài khoản hoặc mốc sao lưu PITR."},400);
  const bridge=await issueBoiBrowserBridge(actor.email,actor.role,"account-owner");
  const forward:Payload={action:input.action};
  if(input.action==="execute-batch")for(const key of [
   "cutoff","snapshot","protectSon","protectNghi","protectQuynh","confirmation","backupBookmark","reason"
  ])forward[key]=input[key];
  const answer=await upstream(bridge,forward);
  if(answer.status!==200)return json(answer.data,answer.status);
  const data=answer.data;
  if(data.verified!==true||data.contract!=="boi-owner-once-roster-reset.v1")
   return json({code:"ROSTER_RESET_UNVERIFIED",applied:"unknown"},502);
  if(input.action==="preview"){
   if(data.applied!==false||typeof data.snapshot!=="string"||!hash.test(data.snapshot)||
    typeof data.cutoff!=="string"||!date.test(data.cutoff)||
    !Array.isArray(data.protectedPeople)||data.protectedPeople.length!==3||
    !Number.isSafeInteger(data.totalLearnersTeachers)||
    !Number.isSafeInteger(data.candidates)||!Number.isSafeInteger(data.eligible)||
    !Number.isSafeInteger(data.retainedForReview)||
    Number(data.candidates)!==Number(data.eligible)+Number(data.retainedForReview))
    return json({code:"ROSTER_RESET_PREVIEW_UNVERIFIED",applied:false},502);
   return json({ok:true,...data});
  }
  if(data.applied!==true||data.readback!==true||!Number.isSafeInteger(data.deleted)||
   !Number.isSafeInteger(data.remaining)||Number(data.deleted)<0||Number(data.deleted)>10)
   return json({code:"ROSTER_RESET_UNVERIFIED",applied:"unknown"},502);
  const check=await upstream(bridge,{action:"preview"});
  if(check.status!==200||check.data.verified!==true||
   check.data.contract!=="boi-owner-once-roster-reset.v1"||
   check.data.eligible!==data.remaining||check.data.removedInSession!==data.totalDeleted)
   return json({code:"ROSTER_RESET_READBACK_UNVERIFIED",applied:"unknown",
    error:"Lô xóa chưa đối chiếu được với kết quả D1 mới. Không gửi tiếp."},502);
  return json({ok:true,...data});
 }catch(error){return controlErrorResponse(error);}
}
