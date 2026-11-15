import type {BoiDeviceBinding} from "../../boi-device-registry";
export type DeviceKind="all"|"phone"|"tablet"|"desktop";
export type KnownDeviceKind=Exclude<DeviceKind,"all">;
export type RegistryDeviceKind=KnownDeviceKind|"unknown";
export const deviceCategoryMeta=[
 {kind:"phone",title:"Điện thoại",detail:"Trình duyệt trên điện thoại"},
 {kind:"tablet",title:"iPad / Tablet",detail:"Máy tính bảng / iPad"},
 {kind:"desktop",title:"Laptop / máy tính",detail:"Nhận diện trình duyệt máy tính"}
] as const;
export function classifyBinding(row:BoiDeviceBinding):RegistryDeviceKind{
 switch(row.clientClass){
  case "phone":return "phone";
  case "tablet":return "tablet";
  case "desktop":return "desktop";
  default:return "unknown";
 }
}
export function deviceSummary(devices:BoiDeviceBinding[]){
 const count=(test:(r:BoiDeviceBinding)=>boolean)=>devices.filter(test).length;
 const categories=deviceCategoryMeta.map(x=>{
  const records=devices.filter(d=>classifyBinding(d)===x.kind);
  return {...x,total:records.length,approved:records.filter(d=>d.status==="approved").length,
   pending:records.filter(d=>d.status==="pending").length,
   blocked:records.filter(d=>d.status==="blocked").length};
 });
 // A signed-in learner's account may have multiple browser keys.
 // The verified progress is once per account (not per device).
 const unique=new Map<string,number>();
 for(const item of devices){
  if(item.account?.role!=="learner"||!item.account.accountId||!item.progress||
    !Number.isSafeInteger(item.progress.completed)||!Number.isSafeInteger(item.progress.total)||
    item.progress.total<=0||item.progress.completed<0||item.progress.completed>item.progress.total)continue;
  const n=Math.round(item.progress.completed/item.progress.total*100);
  if(!unique.has(item.account.accountId))unique.set(item.account.accountId,n);
 }
 const progress=[...unique.values()];
 const learning=progress.length?{
  total:progress.length,average:Math.round(progress.reduce((a,b)=>a+b,0)/progress.length),
  low:progress.filter(n=>n<30).length,
  medium:progress.filter(n=>n>=30&&n<70).length,
  high:progress.filter(n=>n>=70).length
 }:null;
 return {total:devices.length,unclassified:count(d=>classifyBinding(d)==="unknown"),
  approved:count(d=>d.status==="approved"),pending:count(d=>d.status==="pending"),
  blocked:count(d=>d.status==="blocked"),categories,learning};
}
