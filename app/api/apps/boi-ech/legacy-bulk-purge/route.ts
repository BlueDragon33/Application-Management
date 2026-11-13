import {issueBoiBrowserBridge} from "../../../../boi-ech.server";
import {controlErrorResponse,verifyControlProof} from "../../../../control-device.server";
export const dynamic="force-dynamic";
type Payload=Record<string,unknown>;
const json=(data:unknown,status=200)=>Response.json(data,{status,
 headers:{"cache-control":"no-store,private","x-content-type-options":"nosniff"}});
const obj=(v:unknown):Payload=>v&&typeof v==="object"&&!Array.isArray(v)?v as Payload:{};
const SNAP=/^[a-f0-9]{64}$/;
async function boi(bridge:Awaited<ReturnType<typeof issueBoiBrowserBridge>>,body:Payload){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20_000);
 try{
  const r=await fetch(bridge.baseUrl+"/api/control/v2/legacy-bulk-purge",{
   method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+bridge.token},
   body:JSON.stringify(body),cache:"no-store",redirect:"manual",signal:controller.signal});
  if(r.status>=300&&r.status<400)return{status:502,data:{code:"LEGACY_BRIDGE_REDIRECT_FORBIDDEN"}};
  return{status:r.status,data:obj(await r.json().catch(()=>null))};
 }catch{return {status:controller.signal.aborted?504:502,data:{
  code:"LEGACY_BRIDGE_UNAVAILABLE",applied:"unknown",
  error:"Chưa xác minh được kết quả trên D1. Hãy quét lại, không tự lặp lệnh xóa."}};}
 finally{clearTimeout(timer);}
}
export async function POST(request:Request){
 try{
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
   return json({code:"LEGACY_CLEANUP_INPUT",error:"Yêu cầu JSON không hợp lệ."},415);
  const raw=await request.text();
  if(raw.length>2500)return json({code:"LEGACY_CLEANUP_INPUT",error:"Yêu cầu quá dài."},413);
  let input:Payload;
  try{input=obj(JSON.parse(raw));}catch{return json({code:"LEGACY_CLEANUP_INPUT",error:"Dữ liệu không hợp lệ."},400);}
  if(!["preview","purge-batch"].includes(String(input.action)))
   return json({code:"LEGACY_CLEANUP_INPUT",error:"Thao tác không được hỗ trợ."},400);
  const controlDeviceId=typeof input.controlDeviceId==="string"?input.controlDeviceId:undefined;
  const actor=await verifyControlProof(controlDeviceId?{...input,deviceId:controlDeviceId}:input);
  if(actor.role!=="owner")return json({code:"OWNER_REQUIRED",error:"Chỉ Owner được dọn hồ sơ cũ."},403);
  if(input.action==="purge-batch"&&(
    typeof input.snapshot!=="string"||!SNAP.test(input.snapshot)
    ||input.confirmation!=="XOA TAI KHOAN CU TREN 5 NGAY"
    ||typeof input.reason!=="string"||input.reason.trim().length<10||input.reason.length>300))
   return json({code:"LEGACY_CLEANUP_CONFIRMATION_REQUIRED",applied:false,
    error:"Cần ảnh chụp trạng thái, xác nhận và lý do hợp lệ."},400);
  const bridge=await issueBoiBrowserBridge(actor.email,actor.role,"account-owner");
  const forward:Payload={action:input.action};
  if(input.action==="purge-batch")Object.assign(forward,{
   snapshot:input.snapshot,reason:(input.reason as string).trim(),
   confirmation:"XOA TAI KHOAN CU TREN 5 NGAY"});
  const response=await boi(bridge,forward);
  if(response.status!==200)return json(response.data,response.status);
  const data=response.data;
  if(data.verified!==true||data.contract!=="boi-owner-legacy-five-day-purge.v1")
   return json({code:"LEGACY_CLEANUP_UNVERIFIED",applied:"unknown",
    error:"Bơi Ếch chưa xác minh kết quả; không tiếp tục xóa."},502);
  if(input.action==="preview"){
   if(data.applied!==false||typeof data.snapshot!=="string"||!SNAP.test(data.snapshot)||
    !Number.isSafeInteger(data.totalMatched)||!Number.isSafeInteger(data.eligible)||
    !Number.isSafeInteger(data.protected)||Number(data.eligible)<0||Number(data.protected)<0||
    data.totalMatched!==Number(data.eligible)+Number(data.protected))
    return json({code:"LEGACY_CLEANUP_UNVERIFIED",applied:false,
     error:"Dữ liệu quét D1 không hợp lệ."},502);
   return json({ok:true,...data});
  }
  if(data.applied!==true&&data.applied!==false)
   return json({code:"LEGACY_CLEANUP_UNVERIFIED",applied:"unknown"},502);
  if(!Number.isSafeInteger(data.deleted)||!Number.isSafeInteger(data.remaining)||
   !Number.isSafeInteger(data.protected)||Number(data.deleted)<0||Number(data.deleted)>10)
   return json({code:"LEGACY_CLEANUP_UNVERIFIED",applied:"unknown"},502);
  if(data.applied===true){
   // Independent no-mutation readback: never report final success from POST alone.
   const verify=await boi(bridge,{action:"preview"});
   if(verify.status!==200||verify.data.verified!==true||
      verify.data.contract!=="boi-owner-legacy-five-day-purge.v1"||
      verify.data.eligible!==data.remaining)
    return json({code:"LEGACY_CLEANUP_READBACK_FAILED",applied:"unknown",
     error:"Đã gửi lệnh nhưng kết quả đọc lại chưa khớp. Dừng và quét lại."},502);
  }
  return json({ok:true,...data});
 }catch(error){return controlErrorResponse(error);}
}
