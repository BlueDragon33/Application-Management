"use client";
import {useEffect,useId,useRef,useState,type KeyboardEvent} from "react";
import Link from "next/link";
import {composePrompt,promptKey,validatePrompt,type PromptInput} from "./client-developer-prompt.mjs";
import styles from "./client-admin-shell.module.css";
type Role="owner"|"reviewer"|"publisher"|"viewer";
export type BuilderTaskContext={activeView:string;workTitle:string;observation:string;sourceNote:string};
type Props={appId:string;appName:string;role:Role;roleLabel:string;connection:{state:"online"|"warning";label:string};task:BuilderTaskContext};
export function ClientDeveloperSupport({appId,appName,role,roleLabel,connection,task}:Props){
 const panelId=useId(),triggerRef=useRef<HTMLButtonElement>(null),panelRef=useRef<HTMLElement>(null),closeRef=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false),[draft,setDraft]=useState<PromptInput|null>(null),[sourceKey,setSourceKey]=useState("");
 const [approvedPrompt,setApprovedPrompt]=useState<string|null>(null),[notice,setNotice]=useState("");
 const latest:PromptInput={appId,appName,role,activeView:task.activeView,connectionState:connection.state,
  observation:task.observation,workTitle:task.workTitle,sourceNote:task.sourceNote,extraRequirements:""};
 const latestKey=promptKey(latest),stale=Boolean(draft)&&sourceKey!==latestKey;
 const error=draft?validatePrompt(draft):"Chưa tạo prompt.";
 const prompt=draft&&!error?composePrompt(draft):"";
 const approved=Boolean(prompt&&approvedPrompt===prompt&&!stale&&role==="owner");
 const editable=role!=="viewer";
 function regenerate(){setDraft({...latest});setSourceKey(latestKey);setApprovedPrompt(null);setNotice("Đã tạo đề xuất theo trạng thái UI. HEAD/WorkPackage chưa được chứng thực.");}
 function show(){regenerate();setOpen(true);}
 function close(){setOpen(false);setNotice("");triggerRef.current?.focus();}
 function edit(field:"workTitle"|"extraRequirements",value:string){setDraft(old=>old?{...old,[field]:value}:old);setApprovedPrompt(null);setNotice("Đã thay đổi nội dung; cần duyệt lại.");}
 function approve(){
  if(role!=="owner")return setNotice("Chỉ Owner được phê duyệt prompt.");
  if(stale||error||!prompt)return setNotice(stale?"Nguồn thay đổi — hãy tạo lại prompt.":error);
  setApprovedPrompt(prompt);setNotice("Owner đã duyệt nội dung để sử dụng trong phiên này; không cấp quyền merge/Production.");
 }
 async function copy(){
  if(!approved)return setNotice("Cần duyệt bản hiện tại trước khi sao chép.");
  try{if(!navigator.clipboard?.writeText)throw Error("No clipboard");await navigator.clipboard.writeText(prompt);setNotice("Đã sao chép prompt đã duyệt. Dán vào ChatGPT để giao việc.");}
  catch{setNotice("Clipboard bị chặn. Chọn và sao chép tại ô xem trước.");const el=panelRef.current?.querySelector<HTMLTextAreaElement>("[data-prompt-preview]");el?.focus();el?.select();}
 }
 function exportMarkdown(){
  if(!approved)return setNotice("Chưa duyệt prompt.");
  const url=URL.createObjectURL(new Blob([prompt+"\n"],{type:"text/markdown;charset=utf-8"}));
  try{const a=document.createElement("a");a.href=url;a.download="app-builder-"+appId+"-approved-prompt.md";document.body.append(a);a.click();a.remove();setNotice("Đã yêu cầu tải file Markdown. Không gửi lên server.");}
  finally{window.setTimeout(()=>URL.revokeObjectURL(url),0);}
 }
 function keyboard(e:KeyboardEvent<HTMLElement>){
  if(e.key==="Escape"){e.preventDefault();close();return;}
  if(e.key!=="Tab")return;
  const els=Array.from(panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]),a[href],textarea:not([disabled])")??[]).filter(el=>el.getClientRects().length>0);
  const first=els[0],last=els[els.length-1];
  if(e.shiftKey&&document.activeElement===first&&last){e.preventDefault();last.focus();}
  if(!e.shiftKey&&document.activeElement===last&&first){e.preventDefault();first.focus();}
 }
 useEffect(()=>{if(open)closeRef.current?.focus();},[open]);
 return <>
  <section className={styles.developerSupport} data-client-developer-support="prompt-review-v2" data-app-id={appId}>
   <button type="button" ref={triggerRef} className={styles.developerSupportTrigger} aria-expanded={open} aria-haspopup="dialog" aria-controls={panelId} onClick={open?close:show}>
    <span aria-hidden="true">🛠</span><span><strong>Hỗ trợ lập trình PRO</strong><small>Tạo prompt · bổ sung · Owner duyệt</small></span><span aria-hidden="true">↗</span>
   </button>
  </section>
  {open?<div className={styles.developerSupportBackdrop} aria-hidden="true" onClick={close}/>:null}
  <section ref={panelRef} id={panelId} role="dialog" aria-modal="true" aria-label="Tạo và duyệt prompt lập trình"
   className={styles.developerSupportPanel} hidden={!open} onKeyDown={keyboard}>
   <header className={styles.developerSupportHeader}>
    <div><small>BLUEPRINT OS 1.3.0 · APP BUILDER</small><h2>Hỗ trợ người lập trình</h2></div>
    <button type="button" ref={closeRef} onClick={close}>Đóng ×</button>
   </header>
   <div className={styles.developerSupportContent}>
    <p>Đã chọn <strong>{appName}</strong>. Khi mở nút, ứng dụng tạo prompt dựa trên các tín hiệu quản trị hiện có. Không có AI backend tự gọi.</p>
    <dl><div><dt>Vai trò</dt><dd>{roleLabel} ({role})</dd></div>
     <div><dt>Kết nối</dt><dd>{connection.label}</dd></div>
     <div><dt>HEAD/WorkPackage</dt><dd>UNVERIFIED — xác minh live trước thực thi</dd></div></dl>
    <button type="button" className={styles.developerSupportCopy} onClick={regenerate}>↻ Tạo lại prompt công việc tiếp theo</button>
    {stale?<p role="alert" className={styles.developerSupportWarning}>Trạng thái nguồn thay đổi. Phải tạo lại trước khi duyệt.</p>:null}
    <label htmlFor={panelId+"-goal"}>Đầu việc tiếp theo — có thể sửa</label>
    <textarea id={panelId+"-goal"} rows={3} maxLength={500} value={draft?.workTitle??""}
     onChange={e=>edit("workTitle",e.target.value)} disabled={!editable}/>
    <label htmlFor={panelId+"-extra"}>Bổ sung yêu cầu riêng của bạn</label>
    <textarea id={panelId+"-extra"} rows={4} maxLength={2000} placeholder="Ví dụ: ưu tiên giao diện 390px; không chạy GitHub Actions..."
     value={draft?.extraRequirements??""} onChange={e=>edit("extraRequirements",e.target.value)} disabled={!editable}/>
    {error?<p role="alert" className={styles.developerSupportWarning}>{error}</p>:null}
    <label htmlFor={panelId+"-preview"}>Prompt tự động được tạo — xem trước</label>
    <textarea id={panelId+"-preview"} data-prompt-preview value={prompt} rows={14} readOnly/>
    <p className={styles.developerSupportWarning}>Chỉ duyệt nội dung prompt, KHÔNG phải duyệt reviewer, Quality Gate, merge hay Production. Nguồn hiện là projection UI, chưa phải Prompt Workspace chuẩn từ Hub.</p>
    <div className={styles.developerSupportActions}>
     <button type="button" onClick={approve} disabled={role!=="owner"||stale||Boolean(error)||!prompt}>✓ Duyệt prompt (Owner)</button>
     <button type="button" disabled={!approved} onClick={()=>{void copy();}}>Sao chép prompt đã duyệt</button>
     <button type="button" disabled={!approved} onClick={exportMarkdown}>Xuất .md</button>
    </div>
    {role!=="owner"?<p className={styles.developerSupportWarning}>Vai trò {roleLabel} chỉ được xem/chỉnh nháp; cần Owner duyệt trước khi dùng.</p>:null}
    {approved?<a className={styles.developerSupportChatLink} href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Mở ChatGPT để dán prompt đã duyệt</a>:null}
    <nav className={styles.developerSupportLinks} aria-label="Công cụ hỗ trợ">
     <Link href="/tools/contract-diagnostics">Chẩn đoán contract</Link>
     <a target="_blank" rel="noopener noreferrer" href="https://github.com/BlueDragon33/Software-Blueprint-Hub/blob/main/docs/UNIVERSAL-CONSTITUTION.md">Hiến pháp ACTIVE</a>
    </nav>
   </div>
   <footer className={styles.developerSupportFooter} aria-live="polite" role="status">
    <strong>{stale?"STALE":approved?"APPROVED_FOR_COPY_ONLY":"DRAFT · CHƯA DUYỆT"}</strong><span>{notice}</span>
   </footer>
  </section>
 </>;
}
