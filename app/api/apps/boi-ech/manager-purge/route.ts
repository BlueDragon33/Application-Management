import {issueBoiBrowserBridge} from "../../../../boi-ech.server";
import {controlErrorResponse,verifyControlProof} from "../../../../control-device.server";
export const dynamic="force-dynamic";
type Payload=Record<string,unknown>;
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{
 "cache-control":"no-store,private","x-content-type-options":"nosniff"}});
const obj=(v:unknown):Payload=>v&&typeof v==="object"&&!Array.isArray(v)?v as Payload:{};
const ID=/^acc_[a-f0-9]{64}$/;
const SNAP=/^[a-f0-9]{64}$/;
async function boi(bridge:Awaited<ReturnType<typeof issueBoiBrowserBridge>>,body:Payload){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const r=await fetch(bridge.baseUrl+"/api/control/v2/manager-purge",{
   method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+bridge.token},
   body:JSON.stringify(body),cache:"no-store",redirect:"manual",signal:controller.signal});
  if(r.status>=300&&r.status<400)return {status:502,data:{code:"BOI_MANAGER_PURGE_REDIRECT_FORBIDDEN",applied:"unknown"}};
  return {status:r.status,data:obj(await r.json().catch(()=>null))};
 }catch{return{status:controller.signal.aborted?504:502,
   data:{code:"BOI_MANAGER_PURGE_BRIDGE_UNAVAILABLE",applied:"unknown",
    error:"Chưa xác minh được kết quả D1. Quét lại, không tự lặp lệnh xóa."}};}
 finally{clearTimeout(timer);}
}
function validList(d:Payload){
 if(d.contract!=="boi-owner-manager-purge.v1"||d.ok!==true||d.verified!==true||
  d.mode!=="manager"||d.days!==0||!Array.isArray(d.records)||d.records.length>100||
  !Number.isSafeInteger(d.scanned)||Number(d.scanned)>100||
  !Number.isSafeInteger(d.eligible)||!Number.isSafeInteger(d.protected)||
  Number(d.eligible)+Number(d.protected)!==d.records.length)return false;
 return d.records.every(item=>{
  const r=obj(item);
  return typeof r.accountId==="string"&&ID.test(r.accountId)&&r.role==="manager"&&
   ["pending","blocked","manager"].includes(String(r.category))&&
   typeof r.eligible==="boolean"&&typeof r.snapshot==="string"&&SNAP.test(r.snapshot)&&
   typeof r.name==="string"&&Array.isArray(r.blockers)&&r.blockers.every(x=>typeof x==="string")&&
   Number.isSafeInteger(r.inactiveDays)&&Number(r.inactiveDays)>=0;
 });
}
export async function POST(request:Request){
 try{
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
   return json({code:"MANAGER_PURGE_INPUT",error:"Yêu cầu JSON hợp lệ."},415);
  const raw=await request.text();if(raw.length>4000)return json({code:"MANAGER_PURGE_INPUT",error:"Yêu cầu quá dài."},413);
  let input:Payload;try{const parsed:unknown=JSON.parse(raw);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error();
   input=parsed as Payload;}catch{return json({code:"MANAGER_PURGE_INPUT",error:"Dữ liệu không hợp lệ."},400);}
  const action=input.action;
  if(action!=="preview"&&action!=="purge")return json({code:"MANAGER_PURGE_INPUT",error:"Thao tác không hợp lệ."},400);
  if(action==="purge"&&(
   typeof input.accountId!=="string"||!ID.test(input.accountId)
   ||typeof input.snapshot!=="string"||!SNAP.test(input.snapshot)
   ||input.confirmation!=="XOA VINH VIEN CAN BO"
   ||typeof input.reason!=="string"||input.reason.trim().length<10||input.reason.length>300))
   return json({code:"MANAGER_PURGE_CONFIRMATION_REQUIRED",applied:false,
    error:"Xác nhận đúng tài khoản, trạng thái D1 và lý do xóa."},400);
  if(action==="preview"&&input.cursor!==undefined&&
   (typeof input.cursor!=="string"||(input.cursor!==""&&!ID.test(input.cursor))))
   return json({code:"MANAGER_PURGE_INPUT",error:"Con trỏ trang không hợp lệ."},400);
  const controlDeviceId=typeof input.controlDeviceId==="string"?input.controlDeviceId:undefined;
  const owner=await verifyControlProof(controlDeviceId?{...input,deviceId:controlDeviceId}:input);
  if(owner.role!=="owner")return json({code:"OWNER_REQUIRED",error:"Chỉ Owner được xóa vĩnh viễn cán bộ."},403);
  const bridge=await issueBoiBrowserBridge(owner.email,owner.role,"account-owner");
  const forward:Payload={action};
  if(action==="preview"&&input.cursor!==undefined)forward.cursor=input.cursor;
  if(action==="purge")Object.assign(forward,{accountId:input.accountId,snapshot:input.snapshot,
   confirmation:"XOA TAI KHOAN",reason:(input.reason as string).trim()});
  const response=await boi(bridge,forward);
  if(response.status!==200)return json(response.data,response.status);
  if(action==="preview"){
   if(!validList(response.data))return json({code:"MANAGER_PURGE_UNVERIFIED",
    error:"Bản kiểm kê cán bộ không hợp lệ; không thể xóa."},502);
   return json(response.data);
  }
  if(response.data.ok!==true||response.data.verified!==true||
   response.data.contract!=="boi-owner-manager-purge.v1"||response.data.deleted!==true||
   response.data.action!=="purge"||response.data.auditPreserved!==true)
   return json({code:"MANAGER_PURGE_UNVERIFIED",applied:"unknown",
    error:"Kết quả xóa chưa xác minh, dừng và quét lại."},502);
  const check=await boi(bridge,{action:"inspect",accountId:input.accountId});
  if(check.status!==200||check.data.contract!=="boi-owner-manager-purge.v1"||
   check.data.verified!==true||check.data.exists!==false)
   return json({code:"MANAGER_PURGE_READBACK_FAILED",applied:"unknown",
    error:"D1 chưa xác nhận hồ sơ đã biến mất. Không tự gửi lại lệnh."},502);
  return json({ok:true,verified:true,contract:"boi-owner-manager-purge.v1",
   deleted:true,accountHash:response.data.accountHash,auditPreserved:true});
 }catch(error){return controlErrorResponse(error);}
}