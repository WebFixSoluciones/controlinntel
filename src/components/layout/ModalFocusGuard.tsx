"use client";
import {useEffect} from "react";

export function ModalFocusGuard(){
  useEffect(()=>{
    let active:HTMLElement|null=null,returnFocus:HTMLElement|null=null;
    const modified=new WeakSet<HTMLElement>();
    const controls=(dialog:HTMLElement)=>Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(element=>element.getClientRects().length>0);
    function observe(){
      const candidates=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"],.fixed.inset-0')).filter(element=>element.getClientRects().length>0&&element.querySelector("form,h2,h3"));
      const next=candidates[candidates.length-1]||null;
      if(next===active)return;
      if(!next){if(returnFocus?.isConnected)returnFocus.focus();active=null;returnFocus=null;return;}
      if(!active)returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
      active=next;next.setAttribute("role","dialog");next.setAttribute("aria-modal","true");
      if(!next.hasAttribute("aria-label")&&!next.hasAttribute("aria-labelledby"))next.setAttribute("aria-label",next.querySelector("h2,h3")?.textContent?.trim()||"Formulario");
      if(!next.contains(document.activeElement)){const first=controls(next)[0];if(first)first.focus();else{next.tabIndex=-1;next.focus();}}
    }
    const observer=new MutationObserver(observe);observer.observe(document.body,{childList:true,subtree:true});observe();
    function input(event:Event){if(active&&active.contains(event.target as Node)&&!(event.target instanceof HTMLInputElement&&["search","file"].includes(event.target.type)))modified.add(active);}
    function close(event:MouseEvent){
      const button=event.target instanceof Element?event.target.closest("button"):null;
      if(!active||!button||!active.contains(button)||!modified.has(active))return;
      const label=button.getAttribute("aria-label")||button.textContent?.trim();
      if(!["Cerrar","Cancelar"].includes(label||""))return;
      if(!window.confirm("Hay cambios sin guardar. ¿Deseas descartarlos y cerrar?")){event.preventDefault();event.stopPropagation();}
      else modified.delete(active);
    }
    function keyboard(event:KeyboardEvent){
      if(!active||event.key!=="Tab")return;
      const fields=controls(active);if(!fields.length){event.preventDefault();active.focus();return;}
      const first=fields[0],last=fields[fields.length-1];
      if(event.shiftKey&&(document.activeElement===first||!active.contains(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!active.contains(document.activeElement))){event.preventDefault();first.focus();}
    }
    function unload(event:BeforeUnloadEvent){if(active&&modified.has(active)){event.preventDefault();event.returnValue="";}}
    document.addEventListener("keydown",keyboard,true);document.addEventListener("input",input,true);document.addEventListener("click",close,true);window.addEventListener("beforeunload",unload);
    return()=>{observer.disconnect();document.removeEventListener("keydown",keyboard,true);document.removeEventListener("input",input,true);document.removeEventListener("click",close,true);window.removeEventListener("beforeunload",unload);};
  },[]);
  return null;
}
