// Shared measured DOM audit; intentionally excludes ambiguous paint and disabled controls.
export async function auditVisibleText(page, selector = "main") {
  return await page.evaluate(selector=>{
                  const root=document.querySelector(selector);
                  if(!root)throw new Error("Contrast root missing");
                  const parse=s=>{
                    const m=s.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
                    return m?[+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]]:null;
                  };
                  const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[0.2126,0.7152,0.0722][i],0);
                  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
                  let checked=0,unresolved=0;const problems=new Map();
                  for(let node=walker.nextNode();node;node=walker.nextNode()){
                    const text=node.textContent.trim(),el=node.parentElement;
                    if(!text||!el||el.closest("script,style,option,button:disabled,[hidden]"))continue;
                    const range=document.createRange();range.selectNodeContents(node);
                    if(!Array.from(range.getClientRects()).some(r=>r.width>0&&r.height>0))continue;
                    const style=getComputedStyle(el);
                    if(style.visibility!=="visible")continue;
                    let bg=null,ambiguous=false;
                    for(let p=el;p;p=p.parentElement){
                      const s=getComputedStyle(p);
                      if(s.opacity!=="1"||s.backgroundImage!=="none"){ambiguous=true;break;}
                      const v=parse(s.backgroundColor);
                      if(!v||v[3]>0&&v[3]<1){ambiguous=true;break;}
                      if(v[3]===1){bg=v;break;}
                    }
                    const fg=parse(style.color);
                    if(ambiguous||!bg||!fg||fg[3]!==1){unresolved++;continue;}
                    const l1=luminance(fg),l2=luminance(bg),ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
                    const size=parseFloat(style.fontSize),weight=parseInt(style.fontWeight,10);
                    const threshold=size>=24||size>=18.66&&weight>=700?3:4.5;
                    checked++;
                    if(ratio<threshold)problems.set(style.color+"/"+bg.join(",")+"/"+text.slice(0,100),{text:text.slice(0,100),ratio,threshold});
                  }
                  const smallTargets=Array.from(root.querySelectorAll("button:not(:disabled),select")).filter(e=>{
                    const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<44||r.height<44);
                  }).map(e=>({label:(e.getAttribute("aria-label")||e.textContent||"").trim().slice(0,70),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));
                  return {checked,unresolved,possibleContrastFailures:[...problems.values()],targetsBelow44:smallTargets};
                },selector);
}
