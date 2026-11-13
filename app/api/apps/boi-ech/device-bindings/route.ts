import {issueBoiBrowserBridge} from "../../../../boi-ech.server";
import {controlErrorResponse,verifyControlProof} from "../../../../control-device.server";

export const dynamic="force-dynamic";
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"cache-control":"no-store, private","x-content-type-options":"nosniff"}});
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
const HEX=/^[a-f0-9]{64}$/;
type Bridge=Awaited<ReturnType<typeof issueBoiBrowserBridge>>;
async function upstream(bridge:Bridge,body:Record<string,unknown>){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8_000);
 try{
  const response=await fetch(bridge.baseUrl+"/api/control/v2/device-bindings",{
   method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+bridge.token},
   body:JSON.stringify(body),cache:"no-store",redirect:"manual",signal:controller.signal
  });
  if(response.status>=300&&response.status<400)return {status:502,data:{code:"BRIDGE_REDIRECT_FORBIDDEN"}};
  return {status:response.status,data:record(await response.json().catch(()=>null))};
 }catch{return {status:controller.signal.aborted?504:502,data:{code:"BOI_DEVICE_BINDING_UNAVAILABLE",
  error:"Không thể kết nối máy chủ quản lý liên kết Bơi Ếch."}};}
 finally{clearTimeout(timer);}
}
function validDetail(value:Record<string,unknown>,bindingId:string){
 const account=record(value.account),dep=record(value.dependencies);
 return value.contract==="boi-owner-device-binding.v1"&&value.verified===true
  &&value.bindingId===bindingId&&["pending","approved","blocked"].includes(String(value.status))
  &&typeof value.createdAt==="string"&&Number.isFinite(Date.parse(value.createdAt))
  &&typeof account.accountId==="string"&&/^acc_[a-f0-9]{64}$/.test(account.accountId)
  &&typeof account.createdAt==="string"&&Number.isFinite(Date.parse(account.createdAt))
  &&["manager","teacher","learner"].includes(String(account.role))
  &&["sessions","activeSessions","syncGrants","syncEvents","otherTrustedDevices"].every(k=>
    typeof dep[k]==="number"&&Number.isSafeInteger(dep[k])&&(dep[k] as number)>=0)
  &&value.preservesAccount===true&&value.preservesLearning===true&&value.preservesAudit===true;
}
export async function POST(request:Request){
 try{
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
   return json({error:"Chỉ nhận dữ liệu JSON.",code:"CONTENT_TYPE_REQUIRED"},415);
  const raw=await request.text();if(raw.length>4096)return json({error:"Yêu cầu quá dài.",code:"INVALID_REQUEST"},413);
  let input:Record<string,unknown>;
  try{input=record(JSON.parse(raw));}catch{return json({error:"JSON không hợp lệ.",code:"INVALID_REQUEST"},400);}
  const action=input.action,bindingId=input.bindingId;
  if(!["inspect","revoke","purge"].includes(String(action)) || typeof bindingId!=="string"||!HEX.test(bindingId))
   return json({error:"Mã liên kết hoặc thao tác không hợp lệ.",code:"DEVICE_BINDING_INPUT"},400);
  const proofDeviceId=typeof input.controlDeviceId==="string"?input.controlDeviceId:undefined;
  const actor=await verifyControlProof(proofDeviceId?{...input,deviceId:proofDeviceId}:input);
  if(actor.role!=="owner")return json({error:"Chỉ Chủ hệ thống được xem và xử lý liên kết thiết bị.",code:"OWNER_REQUIRED"},403);
  if(action!=="inspect"){
   const status=input.expectedStatus;
   if(input.confirmation!==bindingId || typeof input.typedSuffix!=="string"
     || input.typedSuffix!==bindingId.slice(-6)||typeof input.reason!=="string"
     || input.reason.trim().length<10||input.reason.length>300
     ||!["pending","approved","blocked"].includes(String(status))
     ||typeof input.expectedCreatedAt!=="string"||!Number.isFinite(Date.parse(input.expectedCreatedAt)))
    return json({error:"Phải nhập đúng 6 ký tự cuối, lý do và trạng thái mới nhất.",code:"DEVICE_BINDING_INPUT"},400);
   if(action==="purge"&&status!=="blocked")
    return json({error:"Thu hồi quyền thiết bị trước khi xóa vĩnh viễn.",code:"DEVICE_BINDING_REVOKE_FIRST"},409);
  }
  const bridge=await issueBoiBrowserBridge(actor.email,actor.role,"account-owner");
  const inspect=()=>upstream(bridge,{action:"inspect",bindingId});
  const before=await inspect();
  if(before.status!==200)return json(before.data,before.status);
  if(!validDetail(before.data,bindingId))
   return json({error:"Chi tiết liên kết chưa được xác minh.",code:"DEVICE_BINDING_UNVERIFIED"},502);
  if(action==="inspect")return json(before.data);
  if(before.data.createdAt!==input.expectedCreatedAt || before.data.status!==input.expectedStatus)
   return json({error:"Thẻ đã thay đổi, mở lại để đối chiếu trước khi xóa.",code:"DEVICE_BINDING_CAS_CONFLICT"},409);
  const result=await upstream(bridge,{action,bindingId,confirmation:bindingId,
   expectedCreatedAt:input.expectedCreatedAt,expectedStatus:input.expectedStatus,reason:input.reason});
  if(result.status!==200)return json(result.data,result.status);
  if(result.data.contract!=="boi-owner-device-binding.v1"||result.data.ok!==true||
    result.data.verified!==true||result.data.bindingId!==bindingId)
   return json({error:"Máy chủ chưa xác nhận lệnh đã thực hiện.",code:"DEVICE_BINDING_UNVERIFIED",applied:true},502);
  const after=await inspect();
  if(action==="revoke"){
   if(after.status!==200||!validDetail(after.data,bindingId)||after.data.status!=="blocked"
      ||record(after.data.dependencies).activeSessions!==0)
    return json({error:"Đã gửi thu hồi nhưng đọc lại chưa khớp.",code:"DEVICE_BINDING_READBACK_FAILED",applied:true},502);
   return json({ok:true,verified:true,detail:after.data});
  }
  if(after.status!==404||after.data.code!=="DEVICE_BINDING_NOT_FOUND"||result.data.deleted!==true)
   return json({error:"Đã gửi xóa nhưng chưa xác nhận liên kết biến mất.",code:"DEVICE_BINDING_READBACK_FAILED",applied:true},502);
  return json({ok:true,verified:true,deleted:true,bindingId,
   preservesAccount:true,preservesLearning:true,preservesAudit:true});
 }catch(error){return controlErrorResponse(error);}
}
