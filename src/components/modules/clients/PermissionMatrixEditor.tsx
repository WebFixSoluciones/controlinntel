"use client";
import {useState} from "react";
import type {UserModulePermissions} from "@/types";
import {completePermissions,permissionSections,permissionValue,setPermission} from "@/lib/permission-catalog";
import {RotateCcw,ChevronDown,Search} from "lucide-react";

const sections=permissionSections();
const clean=(text:string)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es");
export function PermissionMatrixEditor({value,onChange,overrides={},onRestore,disabled=false}:{value:UserModulePermissions;onChange:(value:UserModulePermissions,explicitPaths?:string[])=>void;overrides?:Record<string,boolean>;onRestore?:(path:string)=>void;disabled?:boolean}){
 const[search,setSearch]=useState(""),[onlyOverrides,setOnlyOverrides]=useState(false),[open,setOpen]=useState<Record<string,boolean>>({visibility:true,abonados:true,ventas:true});
 const filtered=sections.map(section=>({...section,items:section.items.filter(item=>(!onlyOverrides||item.path in overrides)&&(!search||clean(section.label+" "+item.label).includes(clean(search))))})).filter(section=>section.items.length);
 const setAll=(enabled:boolean)=>{let matrix=completePermissions();if(enabled)for(const section of sections)for(const item of section.items)if(!item.reserved)matrix=setPermission(matrix,item.path,true);onChange(matrix,sections.flatMap(section=>section.items.filter(item=>!item.reserved).map(item=>item.path)));};
 return <section className="min-w-0 space-y-3" aria-label="Matriz de permisos">
  <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
   <label className="flex min-w-0 flex-1 basis-60 items-center gap-2"><Search className="size-4 text-slate-400"/><input aria-label="Buscar permiso" className="min-w-0 w-full rounded-lg border p-2 text-sm" placeholder="Buscar pantalla, módulo o función…" value={search} onChange={event=>setSearch(event.target.value)}/></label>
   <button type="button" disabled={disabled} className="rounded-lg border px-3 py-2 text-xs text-blue-700 disabled:opacity-40" onClick={()=>setAll(true)}>Todos</button><button type="button" disabled={disabled} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40" onClick={()=>setAll(false)}>Ninguno</button>
   <button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={()=>setOpen(Object.fromEntries(sections.map(section=>[section.key,true])))}>Expandir todo</button>
   {onRestore&&<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyOverrides} onChange={event=>setOnlyOverrides(event.target.checked)}/>Solo excepciones ({Object.keys(overrides).length})</label>}
  </div>
  <p className="text-xs text-slate-500">Desactivar un módulo bloquea sus pantallas y acciones. Sin pantallas habilitadas, el usuario no tendrá una sección accesible. Usuarios y Roles permanecen reservados al superadministrador. Las opciones corresponden a controles reales del sistema.</p>
  {!permissionValue(value,"visibility.canViewFinancialAmounts")&&["ventas","compras","finanzas","facturacion"].some(key=>permissionValue(value,key+".enabled"))&&<p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Hay módulos financieros activados, pero «Ver importes comerciales y financieros» está desactivado. Sus pantallas financieras permanecerán bloqueadas.</p>}
  {permissionValue(value,"ventas.enabled")&&(!permissionValue(value,"abonados.enabled")||!permissionValue(value,"inventarios.enabled"))&&<p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">Para registrar ventas de catálogo necesitas acceso a los datos de Clientes e Inventarios. Puedes activar esos módulos y limitar sus pantallas y acciones por separado.</p>}
  {permissionValue(value,"tickets.actions.canCreateTicket")&&!permissionValue(value,"abonados.enabled")&&<p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">Para crear tickets seleccionando un cliente, habilita también el acceso a Clientes.</p>}
  {filtered.map(section=>{
   const expanded=!!search||onlyOverrides||open[section.key];const enabled=section.key==="visibility"||permissionValue(value,section.key+".enabled");
   return <section key={section.key} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <button type="button" aria-expanded={!!expanded} className="flex w-full items-center justify-between gap-3 bg-slate-50 p-4 text-left text-sm font-semibold" onClick={()=>setOpen(previous=>({...previous,[section.key]:!previous[section.key]}))}><span>{section.label}<span className="ml-2 text-xs font-normal text-slate-500">{section.items.filter(item=>permissionValue(value,item.path)).length}/{section.items.length}</span></span><ChevronDown className={"size-4 shrink-0 transition-transform "+(expanded?"rotate-180":"")}/></button>
    {expanded&&<div className="grid min-w-0 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">{section.items.map(item=>{
     const custom=item.path in overrides,parentDisabled=!enabled&&!item.path.endsWith(".enabled");
     return <div key={item.path} className={"flex min-w-0 items-start gap-2 rounded-lg border p-3 "+(custom?"border-blue-200 bg-blue-50/40":"border-slate-100") }>
      <label className="flex min-w-0 flex-1 items-start gap-2 text-xs"><input data-permission-path={item.path} type="checkbox" className="mt-0.5 shrink-0 accent-blue-700" checked={item.reserved?false:permissionValue(value,item.path)} disabled={disabled||item.reserved||parentDisabled} onChange={event=>onChange(setPermission(value,item.path,event.target.checked),[item.path])}/><span className="min-w-0 break-words">{item.label}{custom&&<span className="mt-1 block text-[11px] font-semibold text-blue-700">Excepción del usuario: {overrides[item.path]?"habilitado":"denegado"}</span>}</span></label>
      {custom&&onRestore&&<button type="button" disabled={disabled} className="shrink-0 text-blue-700" aria-label={"Volver al rol: "+item.label} title="Usar el permiso del rol" onClick={()=>onRestore(item.path)}><RotateCcw className="size-3.5"/></button>}
     </div>;
    })}</div>}
   </section>;
  })}
  {!filtered.length&&<p className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">No hay permisos con estos filtros.</p>}
 </section>;
}
