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
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8_000);
 try{
  const r=await fetch(bridge.baseUrl+"/api/control/v2/account-cleanup",{
   method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+bridge.token},
   body:JSON.stringify(body),cache:"no-store",redirect:"manual",signal:controller.signal
  });
  if(r.status>=300&&r.status<400)return {status:502,data:{code:"BRIDGE_REDIRECT_FORBIDDEN"}};
  return {status:r.status,data:obj(await r.json().catch(()=>null))};
 }catch{
  return {status:controller.signal.aborted?504:502,data:{code:"CLEANUP_BRIDGE_UNAVAILABLE",
   error:"Chưa xác nhận được phản hồi Bơi Ếch; kiểm tra lại danh sách, không tự gửi lại lệnh xóa.",applied:"unknown"}};
 }finally{clearTimeout(timer);}
}
const opts=(v:Payload)=>[3,5,7,8].includes(Number(v.days))&&
 ["pending","inactive","both"].includes(String(v.mode));
function validList(d:Payload){
 if(d.contract!=="boi-owner-account-cleanup.v1"||d.ok!==true||d.verified!==true||
 !Array.isArray(d.records)||d.records.length>100||typeof d.scanned!=="number"||d.scanned>100)
  return false;
 return d.records.every(v=>{
  const r=obj(v);return typeof r.accountId==="string"&&ID.test(r.accountId)&&
    typeof r.eligible==="boolean"&&typeof r.snapshot==="string"&&SNAP.test(r.snapshot)
    &&typeof r.inactiveDays==="number"&&Number.isSafeInteger(r.inactiveDays)
    &&Array.isArray(r.blockers)&&r.blockers.every(x=>typeof x==="string")
    &&["pending","inactive"].includes(String(r.category));
 });
}
export async function POST(request:Request){
 try{
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
   return json({code:"CLEANUP_INPUT",error:"Yêu cầu JSON hợp lệ."},415);
  const raw=await request.text();if(raw.length>4100)return json({code:"CLEANUP_INPUT",error:"Yêu cầu quá dài."},413);
  let input:Payload;try{input=obj(JSON.parse(raw));}catch{return json({code:"CLEANUP_INPUT",error:"Dữ liệu không hợp lệ."},400);}
  if(!["preview","purge"].includes(String(input.action))||!opts(input))
   return json({code:"CLEANUP_INPUT",error:"Chọn một mốc 3, 5, 7 hoặc trên 7 ngày."},400);
  const controlDeviceId=typeof input.controlDeviceId==="string"?input.controlDeviceId:undefined;
  const actor=await verifyControlProof(controlDeviceId?{...input,deviceId:controlDeviceId}:input);
  if(actor.role!=="owner")return json({code:"OWNER_REQUIRED",error:"Chỉ Owner được dọn tài khoản."},403);
  if(input.action==="purge"){
   if(typeof input.accountId!=="string"||!ID.test(input.accountId)||
    typeof input.snapshot!=="string"||!SNAP.test(input.snapshot)||
    input.confirmation!=="XOA TAI KHOAN"||
    typeof input.reason!=="string"||input.reason.trim().length<10||input.reason.length>300)
    return json({code:"CLEANUP_CONFIRMATION_REQUIRED",error:"Xác nhận rõ từng tài khoản và lý do xóa."},400);
  }
  const bridge=await issueBoiBrowserBridge(actor.email,actor.role,"account-owner");
  const forward:Payload={action:input.action,mode:input.mode,days:Number(input.days)};
  if(input.action==="preview"){
   if(input.cursor!==undefined){
    if(typeof input.cursor!=="string"||(input.cursor!==""&&!ID.test(input.cursor)))
     return json({code:"CLEANUP_INPUT",error:"Con trỏ trang không hợp lệ."},400);
    forward.cursor=input.cursor;
   }
  }else Object.assign(forward,{accountId:input.accountId,snapshot:input.snapshot,
   confirmation:"XOA TAI KHOAN",reason:(input.reason as string).trim()});
  const result=await boi(bridge,forward);
  if(result.status!==200)return json(result.data,result.status);
  if(input.action==="preview"){
   if(!validList(result.data))return json({code:"CLEANUP_UNVERIFIED",
     error:"Bản xem trước chưa xác minh. Không cho phép xóa."},502);
   return json(result.data);
  }
  if(result.data.contract!=="boi-owner-account-cleanup.v1"||
   result.data.ok!==true||result.data.verified!==true||result.data.deleted!==true||
   result.data.action!=="purge")
   return json({code:"CLEANUP_UNVERIFIED",applied:"unknown",
    error:"Kết quả xóa chưa xác minh. Vui lòng đọc lại danh sách."},502);
  const check=await boi(bridge,{action:"inspect",accountId:input.accountId});
  if(check.status!==200||check.data.contract!=="boi-owner-account-cleanup.v1"||
    check.data.verified!==true||check.data.exists!==false)
   return json({code:"CLEANUP_READBACK_FAILED",applied:"unknown",
    error:"D1 chưa xác nhận tài khoản đã biến mất. Không tự gửi lại."},502);
  return json({ok:true,verified:true,deleted:true,accountHash:result.data.accountHash,auditPreserved:true});
 }catch(e){return controlErrorResponse(e);}
}
