/** Synthetic transport for the exported review only. Never imported by app/. */
type Item={accountId:string;name:string;role:string;deviceStatus:string;status:string;onboardingStage:string;accountRevision:number;onboardingRevision:number;entitlement:null|{state:string;expiresAt:string;activatedAt:string;revision:number;active:boolean}};
type Policy={role:string;defaultDays:number;revision:number;updatedAt:string};
type Audit={at:string;action:string;target:string;revision:number};
type State={version:1;accounts:Item[];policies:Policy[];audit:Audit[]};
const key='boi-owner-offline-review:v1';
const iso=(days=0)=>new Date(Date.now()+days*86400000).toISOString();
function initial():State{
 const roles=['manager','manager','manager','manager','teacher','teacher','learner','learner','learner'];
 const names=['Cán bộ đang chờ duyệt','Cán bộ cần hoàn thiện hồ sơ','Cán bộ quản lý mẫu','Hồ sơ cũ cần đối soát','Giảng viên đang tiếp nhận','Giảng viên mẫu','Học viên đang tiếp nhận','Học viên mẫu A','Học viên mẫu B'];
 const stages=['requested','profile_required','active','profile_review','requested','active','profile_required','active','active'];
 return{version:1,accounts:roles.map((role,i)=>({accountId:'acc_'+(i+1).toString(16).repeat(64),name:names[i],role,deviceStatus:stages[i]==='active'?'approved':'pending',status:stages[i]==='active'?'active':'pending',onboardingStage:stages[i],accountRevision:1,onboardingRevision:1,entitlement:stages[i]==='active'?{state:'active',expiresAt:iso(26),activatedAt:iso(-4),revision:1,active:true}:null})),policies:['manager','teacher','learner'].map(role=>({role,defaultDays:30,revision:1,updatedAt:iso()})),audit:[]};
}
function restore():State{
 try{const value=JSON.parse(localStorage.getItem(key)||'null')as State|null;
  if(value?.version===1&&Array.isArray(value.accounts)&&Array.isArray(value.policies)&&Array.isArray(value.audit)
   &&value.accounts.every(a=>/^acc_[a-f0-9]{64}$/.test(a.accountId)&&typeof a.name==='string'&&Number.isSafeInteger(a.onboardingRevision))
   &&value.policies.length===3&&value.policies.every(p=>Number.isInteger(p.defaultDays)&&p.defaultDays>=1&&p.defaultDays<=365))return value;
 }catch{/* Local review state is optional. */}return initial();
}
let state=restore(),connected=true,conflict=false,uncertain=false,mfaUntil=0,role='owner';
export const requests:{path:string;action:string}[]=[];
const reply=(body:unknown,status=200)=>Response.json(body,{status});
const owner=()=>({deviceId:'production-session:offline-review',deviceCode:'QT-0000-AAAA-BBBB-CCCC',displayName:'Owner · dữ liệu mẫu',email:'owner@example.invalid',status:'approved',role,owner:role==='owner',label:'Bản xem offline'});
function persist(){try{localStorage.setItem(key,JSON.stringify(state));}catch{/* File-mode storage may be disabled. */}}
function audit(action:string,target:string,revision:number){state.audit.unshift({at:iso(),action,target,revision});state.audit=state.audit.slice(0,60);persist();window.dispatchEvent(new Event('offline-audit'));}
const application={id:'boi-ech',name:'Bơi Ếch AI',shortName:'Bơi Ếch'};
const automation={enabled:false,defaultAccessDays:30,defaultDeviceLimit:10,activeAutoFreeDeviceCount:0,remainingAutoFreeDeviceSlots:10,updatedBy:null,updatedAt:null};
function devices(){return state.accounts.filter(a=>a.entitlement).slice(0,3).map((a,i)=>({
 deviceId:(i+10).toString(16).repeat(64),deviceCode:`BE-000${i+1}-AAAA-BBBB-CCCC`,status:'approved',label:'Thiết bị mẫu',learnerName:a.name,learnerFamilyName:'Hồ sơ',learnerGivenName:'mẫu',personRole:a.role,personCode:null,className:'Nhóm thử nghiệm',phone:null,registrationComplete:true,accessGroup:'free',paymentStatus:'free_approved',paymentAmount:0,paymentProofAvailable:false,paymentSubmittedAt:null,paymentVerifiedAt:null,paymentRejectedAt:null,paymentReviewNote:null,accessExpiresAt:a.entitlement?.expiresAt,accessExpired:false,accessExpiringSoon:false,accessDaysRemaining:26,personalEditConfigured:false,autoConfirmedAt:null,managementConfigured:a.role==='manager',managementEnabled:a.role==='manager',active:i===0,lastPresenceAt:iso(),lastLearningActivityAt:iso(-1),offlineSinceAt:iso(-1),lastSeenAt:iso(),completionPercent:25+i*10,masteryPercent:60+i*8,completedLessons:5,totalActiveSeconds:1800,loginCount:4,activityTimeline:[],lessonProgress:[],learningEvents:[],blockedReason:null
 }));}
function accountAction(body:Record<string,unknown>){
 if(!connected)return reply({ok:false,code:'OFFLINE_SAMPLE_CONNECTION_FAILED',error:'Lỗi kết nối mẫu. Dữ liệu chưa được xác minh.'},503);
 if(role!=='owner')return reply({ok:false,code:'OWNER_REQUIRED',error:'Chỉ Owner được quản lý tài khoản cán bộ.'},403);
 const action=String(body.action),a=state.accounts.find(a=>a.accountId===body.accountId),p=state.policies.find(p=>p.role===body.role);
 if(action==='list')return reply({ok:true,verified:true,accounts:state.accounts});
 if(action==='policy')return reply({ok:true,verified:true,policies:state.policies});
 if(action==='manager-inbox')return reply({ok:true,verified:true,managers:state.accounts.filter(a=>a.role==='manager'),nextCursor:null});
 if(action==='manager-policy')return reply({ok:true,verified:true,policy:{revision:state.policies[0].revision,accountLimit:5,used:state.accounts.filter(a=>a.role==='manager').length}});
 if(mfaUntil<Date.now())return reply({ok:false,code:'STEP_UP_REQUIRED',applied:false,error:'Xác minh Authenticator mẫu trước khi lưu.'},403);
 if(action==='issue-manager-invite'){
  if(body.expectedRevision!==state.policies[0].revision)return reply({ok:false,code:'CAS_CONFLICT',error:'Chính sách đã thay đổi. Đọc lại trước khi tạo mời.'},409);
  audit('Tạo thư mời mẫu (không dùng trên máy chủ)','manager',state.policies[0].revision);
  return reply({ok:true,verified:true,inviteUrl:'https://offline.example.invalid/invite/SAMPLE-ONLY',expiresAt:iso(1)});
 }
 if(action==='manager-review-first'&&a){
  if(body.expectedRevision!==a.onboardingRevision||a.onboardingStage!=='requested')return reply({ok:false,code:'CAS_CONFLICT',error:'Hồ sơ đã thay đổi. Đồng bộ hàng chờ rồi kiểm tra lại.'},409);
  if(conflict){conflict=false;a.onboardingRevision++;persist();return reply({ok:false,code:'CAS_CONFLICT',error:'Mô phỏng phiên khác đã cập nhật hồ sơ. Đồng bộ để đọc revision mới.'},409);}
  a.onboardingStage='profile_required';a.onboardingRevision++;audit('Owner duyệt một lần · chờ hồ sơ',a.accountId,a.onboardingRevision);
  return reply({ok:true,verified:true,account:a});
 }
 if(action==='set-policy'&&p){
  if(body.expectedRevision!==p.revision||conflict){if(conflict){conflict=false;p.revision++;persist();}return reply({ok:false,code:'CAS_CONFLICT',error:'Chính sách đã đổi. Đọc lại trước khi lưu.'},409);}
  const days=Number(body.defaultDays);if(!Number.isInteger(days)||days<1||days>365)return reply({ok:false,error:'Thời hạn phải từ 1–365 ngày.'},400);
  p.defaultDays=days;p.revision++;p.updatedAt=iso();audit('Lưu chính sách mẫu',p.role,p.revision);
  return reply({ok:true,verified:true,policy:p});
 }
 if(action==='set-account'&&a?.role==='manager'&&a.entitlement){
  if(body.expectedRevision!==a.entitlement.revision||conflict){if(conflict){conflict=false;a.entitlement.revision++;persist();}return reply({ok:false,code:'CAS_CONFLICT',error:'Tài khoản đã thay đổi. Đọc lại dữ liệu trước khi lưu.'},409);}
  if(body.operation==='set-expiry'){
   if(!Number.isFinite(Date.parse(String(body.expiresAt))))return reply({ok:false,error:'Ngày hết hạn không hợp lệ.'},400);
   a.entitlement.expiresAt=String(body.expiresAt);
  }else if(body.operation==='suspend')a.entitlement.state='suspended';
  else if(body.operation==='resume'&&Date.parse(a.entitlement.expiresAt)>Date.now())a.entitlement.state='active';
  else return reply({ok:false,error:'Không thể thực hiện thay đổi này.'},409);
  a.entitlement.revision++;a.entitlement.active=a.entitlement.state==='active'&&Date.parse(a.entitlement.expiresAt)>Date.now();audit('Thời hạn/quyền cán bộ mẫu',a.accountId,a.entitlement.revision);
  if(uncertain){uncertain=false;return reply({ok:false,code:'ACCOUNT_READBACK_UNVERIFIED',applied:true,verified:false,error:'Đã gửi lệnh mẫu nhưng chưa xác minh kết quả. Đọc lại trạng thái trước khi thử tiếp.'},502);}
  return reply({ok:true,verified:true,entitlement:a.entitlement});
 }
 return reply({ok:false,error:'Thao tác này không được mô phỏng trong bản xem Owner.',code:'OFFLINE_REVIEW_ONLY'},403);
}
export function installOfflineTransport(){
 // Isolate the actual component's device keys from any APP identity on the
 // same origin. Only this QA entry installs the namespace adapter.
 const storage=window.indexedDB;
 Object.defineProperty(window,'indexedDB',{configurable:true,value:{open:(_name:string,version?:number)=>storage.open('boi-owner-offline-identity-v1',version)}});
 // Deliberately do not retain or call native fetch. The exported file cannot
 // access any real backend, even if an unhandled application URL is requested.
 window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const raw=input instanceof Request?input.url:String(input),url=new URL(raw,'https://offline-app.invalid');
  let body:Record<string,unknown>={};try{body=JSON.parse(String(init?.body||'{}'))as Record<string,unknown>;}catch{/* MFA form uses URLSearchParams. */}
  requests.push({path:url.pathname,action:String(body.action??init?.method??'GET')});if(requests.length>500)requests.shift();
  if(!['offline-app.invalid','offline-boi.invalid'].includes(url.hostname))return reply({ok:false,error:'Bản xem offline không truy cập địa chỉ bên ngoài.'},403);
  if(url.pathname==='/__account/mfa/step-up'){
   const code=new URLSearchParams(String(init?.body)).get('code');
   if(code!=='000000')return reply({ok:false,error:'Bản xem mẫu: dùng 000000. Không nhập mã thật.'},403);
   mfaUntil=Date.now()+30*60_000;return reply({ok:true});
  }
  if(url.pathname==='/api/device')return reply(body.action==='challenge'?{challenge:'offline-challenge'}:{device:owner()});
  if(url.pathname==='/api/center')return reply({ok:true,actor:owner(),applications:[],members:[],devices:[]});
  if(url.pathname==='/api/dashboard')return reply({ok:true,actor:owner(),application,learningDevices:[],boiBridge:{baseUrl:'https://offline-boi.invalid',token:'v1.offline-sample-not-a-real-token',expiresAt:Date.now()+3600000},automation,deletedDevices:[]});
  if(url.pathname==='/api/apps/boi-ech/account-entitlements')return accountAction(body);
  if(url.pathname==='/api/control/overview'||url.pathname==='/api/apps/boi-ech/browser-proxy'){
   if(body.method==='POST')return reply({error:'Bản xem Owner không mô phỏng thay đổi nội dung, AI hoặc quyền thiết bị.'},403);
   if(!connected)return reply({error:'Lỗi kết nối mẫu; chưa xác minh registry thiết bị.'},503);
   return reply({application,devices:devices(),automation,deletedDevices:[]});
  }
  if(url.pathname==='/api/control/ai')return init?.method==='POST'?reply({error:'Thay đổi AI không thuộc bản xem này.'},403):reply({engine:{name:'Bản xem offline',version:'sample',sourceVersion:1,visionEnabled:false,externalProvider:false,privacy:'Dữ liệu mẫu, không gọi AI'},metrics:{interactions30Days:0,learners30Days:0,averageResponseMs:0,inputUnits:0,outputUnits:0,costMicros:0,adaptiveAttempts30Days:0,adaptivePassRate:0,openReports:0,learnersAtRisk:0},learners:[],feedback:[],interactions:[]});
  if(url.pathname==='/api/control/content')return reply({versions:[],reviewQueue:[],audit:[]});
  return reply({ok:false,code:'OFFLINE_REVIEW_ONLY',error:'Bản xem giao diện không thực hiện thao tác này.'},403);
 };
 document.addEventListener('click',event=>{
  const link=(event.target as Element).closest('a');if(link&&!link.download){event.preventDefault();window.dispatchEvent(new CustomEvent('offline-link',{detail:'Đây là bản xem offline; liên kết ngoài ứng dụng không được mở.'}));}
 },true);
}
export const lab={reset(){state=initial();mfaUntil=0;connected=true;conflict=false;uncertain=false;role='owner';persist();},setConnection(value:boolean){connected=value;},conflict(){conflict=true;},uncertain(){uncertain=true;},resetMfa(){mfaUntil=0;},setRole(value:string){role=value;mfaUntil=0;},audit:()=>state.audit,requests:()=>requests,connected:()=>connected};
