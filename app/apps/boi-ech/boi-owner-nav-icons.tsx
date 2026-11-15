export type OwnerNavIconKind="overview"|"devices"|"accounts"|"oversight"|"policies"|"ai"|"roles"|"reports"|"content";
export function OwnerNavIcon({name}:{name:OwnerNavIconKind}){
 return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
 strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
 {name==="overview"?<><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/></>:null}
 {name==="devices"?<><rect x="2.5" y="4" width="14.5" height="12" rx="2"/><path d="M7 20h10M12 16v4"/><rect x="18" y="9" width="4" height="11" rx="1"/></>:null}
 {name==="accounts"?<><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 7h5m-2.5-2.5v5"/></>:null}
 {name==="oversight"?<><circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M1 20v-2a6 6 0 0 1 12 0v2M12 20v-2a6 6 0 0 1 11 0v2"/></>:null}
 {name==="policies"?<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2M17 3l4 4"/></>:null}
 {name==="ai"?<><path d="m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5z"/><path d="M19 19v4M17 21h4"/></>:null}
 {name==="roles"?<><path d="M4 8 12 3l8 5-8 5zM6 12v7l6 3 6-3v-7M2 12v5M22 12v5"/></>:null}
 {name==="reports"?<><path d="M4 20V12M10 20V7M16 20V10M22 20V3"/><path d="M2 21h21"/></>:null}
 {name==="content"?<><path d="M4 3h16v18H4zM8 7h8M8 11h8M8 15h5"/></>:null}
 </svg>;
}
