"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import AuthenticatorStepUp from "./authenticator-step-up";
export function useInlineOwnerStepUp() {
  const [open,setOpen]=useState(false);
  const opener=useRef<HTMLElement|null>(null);
  const mounted=useRef(false);
  const pending=useRef<{promise:Promise<boolean>;resolve:(ok:boolean)=>void}|null>(null);
  const authenticate=useCallback(()=>{
    if(!mounted.current)return Promise.resolve(false);
    if(pending.current)return pending.current.promise;
    opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    let resolve!:(ok:boolean)=>void;
    const promise=new Promise<boolean>(done=>{resolve=done});
    pending.current={promise,resolve};setOpen(true);return promise;
  },[]);
  const finish=useCallback((verified:boolean)=>{
    const request=pending.current;pending.current=null;setOpen(false);request?.resolve(verified);
    window.setTimeout(()=>{const target=opener.current;if(target?.isConnected){if(!target.hasAttribute("disabled"))target.focus();else target.closest<HTMLElement>("[tabindex=\"-1\"]")?.focus()}},0);
  },[]);
  useEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;pending.current?.resolve(false);pending.current=null};
  },[]);
  return {authenticate,dialog:open?<AuthenticatorStepUp finish={finish}/>:null};
}
