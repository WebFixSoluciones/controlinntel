"use client";
import React, { useState } from "react";
import { api } from "@/lib/api-client";
import { useApp } from "@/lib/state";

type Item={collection:string;id:string;state:string;reason:string};
type Preview={digest:string;items:Item[];counts?:Record<string,number>;imported?:number;alreadyImported?:boolean};
export function RecoveryPanel() {
  const {currentUser,refresh}=useApp();
  const [snapshot,setSnapshot]=useState<unknown>(null),[sourceName,setSourceName]=useState("");
  const [preview,setPreview]=useState<Preview|null>(null),[selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [reconciliation,setReconciliation]=useState<{code:string;collection:string;id:string;reason:string;expected?:number;actual?:number}[]|null>(null);
  if(currentUser.role!=="superadmin")return null;
  async function inspect(file:File) {
    setBusy(true);setMessage("");setPreview(null);setSelected([]);
    try { const input=JSON.parse(await file.text());setSnapshot(input);setSourceName(file.name);setPreview(await api<Preview>("/api/recovery",{action:"preview",snapshot:input,sourceName:file.name})); }
    catch(error){setMessage(error instanceof Error?error.message:"Archivo inválido.");}finally{setBusy(false);}
  }
  async function commit() {
    if(!preview||!selected.length)return;
    setBusy(true);setMessage("");
    try {const result=await api<Preview>("/api/recovery",{action:"commit",snapshot,sourceName,approvedDigest:preview.digest,approvedIds:selected});setMessage(result.alreadyImported?"Esta selección ya fue importada.":`${result.imported} registros recuperados con su historial de origen.`);await refresh();setSelected([]);setPreview(null);}
    catch(error){setMessage(error instanceof Error?error.message:"No se pudo importar.");}finally{setBusy(false);}
  }
  function exportLocal() {
    const snapshots:Record<string,unknown>={};
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)!;if(key.startsWith("INNTEL_RECOVERY_")||key.startsWith("INNTEL_CORP_STATE_")){try{snapshots[key]=JSON.parse(localStorage.getItem(key)!);}catch{}}}
    const url=URL.createObjectURL(new Blob([JSON.stringify(snapshots,null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download="INNTEL-snapshots-locales.json";link.click();URL.revokeObjectURL(url);setMessage("Copias locales exportadas. Selecciona un snapshot individual para su revisión.");
  }
  return <section className="mt-6 bg-white border rounded-xl p-5 space-y-4">
    <h2 className="font-bold">Recuperación de datos pendientes</h2>
    <p className="text-sm text-slate-600">Compara un snapshot con los datos guardados. Los registros existentes con diferencias requieren revisión; esta importación conserva su contenido actual.</p>
    <div className="flex flex-wrap gap-3 items-center">
      <button disabled={busy} className="border rounded px-3 py-2 text-sm" onClick={async()=>{setBusy(true);try{const result=await api<{issues:NonNullable<typeof reconciliation>}>("/api/reconciliation");setReconciliation(result.issues);setMessage(`${result.issues.length} diferencias de conciliación. Revisión de solo lectura.`);}catch(error){setMessage(error instanceof Error?error.message:"No se pudo conciliar.");}finally{setBusy(false);}}}>Diagnosticar conciliación</button>
      <button disabled={busy} className="border rounded px-3 py-2 text-sm" onClick={()=>{const key=Object.keys(localStorage).find(key=>key.startsWith("INNTEL_RECOVERY_"));if(!key){setMessage("Este navegador no tiene una copia preservada.");return;}void inspect(new File([localStorage.getItem(key)!],"copia-preservada.json",{type:"application/json"}));}}>Revisar copia preservada</button>
      <button className="border rounded px-3 py-2 text-sm" onClick={exportLocal}>Exportar copias de este navegador</button>
      <label className="text-sm">Snapshot individual (JSON)<input aria-label="Seleccionar snapshot para revisar" disabled={busy} type="file" accept=".json,application/json" onChange={e=>{if(e.target.files?.[0])void inspect(e.target.files[0]);}} className="block mt-1"/></label>
    </div>
    {busy&&<p role="status">Procesando recuperación…</p>}
    {message&&<p role="status" className="text-sm">{message}</p>}
    {reconciliation&&<div className="overflow-auto max-h-96"><table className="w-full text-sm"><thead><tr><th>Código</th><th>Registro</th><th>Diferencia</th><th>Esperado</th><th>Actual</th></tr></thead><tbody>{reconciliation.map((issue,index)=><tr key={index} className="border-t"><td>{issue.code}</td><td>{issue.collection}/{issue.id}</td><td>{issue.reason}</td><td>{issue.expected??"—"}</td><td>{issue.actual??"—"}</td></tr>)}</tbody></table></div>}
    {preview&&<>
      <p className="text-sm">{preview.items.length} registros revisados. {Object.entries(preview.counts||{}).map(([state,count])=>`${state}: ${count}`).join(" · ")}</p>
      <div className="overflow-auto max-h-96"><table className="w-full text-sm"><thead><tr><th>Seleccionar</th><th>Colección</th><th>Registro</th><th>Resultado</th><th>Detalle</th></tr></thead><tbody>
        {preview.items.map((item,index)=>{const key=item.collection+"/"+item.id;return <tr key={key+index} className="border-t"><td><input type="checkbox" aria-label={`Importar ${key}`} disabled={busy||item.state!=="missing"} checked={selected.includes(key)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,key]:prev.filter(id=>id!==key))}/></td><td>{item.collection}</td><td>{item.id}</td><td>{({missing:"Ausente",identical:"Coincide",conflict:"Conflicto",invalid:"Inválido",blocked:"Revisar dependencia"} as Record<string,string>)[item.state]||item.state}</td><td>{item.reason}</td></tr>;})}
      </tbody></table></div>
      <button className="bg-blue-700 text-white rounded px-4 py-2 disabled:opacity-50" disabled={busy||!selected.length||selected.length>100} onClick={()=>{void commit();}}>Importar {selected.length} registros revisados</button>
      <p className="text-xs text-slate-500">Máximo 100 registros y sus dependencias por operación. Una copia anterior no demuestra por sí sola que deba restaurarse una operación eliminada.</p>
    </>}
  </section>;
}
