// A browser-local desired configuration, never an applied/verified client policy.
const KEY = "application-management:automation-draft:v2";
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const AUTOMATION_DRAFT_KEY=KEY;

export function validateAutomationDraft(data) {
  if(!data||typeof data!=="object"||Array.isArray(data)) return null;
  const entries=Object.entries(data.drafts??{});
  if(!entries.length || entries.length>80)return null;
  const drafts={};
  for(const [id,value] of entries){
    if(!ID.test(id)||!value||typeof value!=="object"||Array.isArray(value))return null;
    if(typeof value.autoApprove!=="boolean"||typeof value.autoBlock!=="boolean"||
       ![24,168,720].includes(value.pendingBlockAfterHours))return null;
    drafts[id]={autoApprove:value.autoApprove,autoBlock:value.autoBlock,
      pendingBlockAfterHours:value.pendingBlockAfterHours};
  }
  const days=Number(data.days),limit=Number(data.limit);
  if(!Number.isInteger(days)||days<0||days>365||
     !Number.isInteger(limit)||limit<0||limit>1000)return null;
  return {schema:2,drafts,days,limit,savedAt:
    typeof data.savedAt==="string"&&Number.isFinite(Date.parse(data.savedAt))
      ?data.savedAt:new Date().toISOString()};
}

export function writeAutomationDraft(storage,values) {
  const parsed=validateAutomationDraft(values);
  if(!parsed)return {saved:false,reason:"DRAFT_INVALID"};
  try{
    storage.setItem(KEY,JSON.stringify(parsed));
    const read=readAutomationDraft(storage);
    if(!read||JSON.stringify(read.drafts)!==JSON.stringify(parsed.drafts)||
      read.days!==parsed.days||read.limit!==parsed.limit)
      return {saved:false,reason:"DRAFT_READBACK_MISMATCH"};
    return {saved:true,source:"browser-local-only",appliedToClient:false,read};
  }catch{return {saved:false,reason:"LOCAL_STORAGE_UNAVAILABLE"};}
}
export function readAutomationDraft(storage){
  try{
    const raw=storage.getItem(KEY);
    if(!raw||raw.length>18000)return null;
    const parsed=JSON.parse(raw);
    if(parsed.schema!==2)return null;
    return validateAutomationDraft(parsed);
  }catch{return null;}
}
export function clearAutomationDraft(storage){
  try {storage.removeItem(KEY);return storage.getItem(KEY)===null;}
  catch{return false;}
}
