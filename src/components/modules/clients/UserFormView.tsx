"use client";
import {useState} from "react";
import Link from "next/link";
import {Save,RotateCcw,Eye,EyeOff} from "lucide-react";
import type {SystemUser,UserModulePermissions,UserRoleTemplate} from "@/types";
import {useApp} from "@/lib/state";
import {useToast} from "@/lib/toast-context";
import {editableModulePermissions} from "@/lib/permissions";
import {completePermissions,permissionValue,setPermission} from "@/lib/permission-catalog";
import {normalizedRole,applyRoleOverrides,permissionDifferences} from "@/lib/role-access";
import {BackButton} from "@/components/ui/BackButton";
import {PermissionMatrixEditor} from "./PermissionMatrixEditor";

type FormData=Partial<SystemUser>&{expectedRoleVersion?:number};
interface Props{user:SystemUser|null;onSave:(data:FormData,permissions:UserModulePermissions)=>Promise<void>;onCancel:()=>void;}
export function UserFormView({user,onSave,onCancel}:Props){
 const{currentUser,userRoleTemplates,refresh}=useApp(),{showConfirm}=useToast();
 const initialDefinition=user?.accessRoleId?userRoleTemplates.find(role=>role.id===user.accessRoleId):undefined;
 const initialRole=initialDefinition?normalizedRole(initialDefinition):undefined;
 const[roleId,setRoleId]=useState(user?.role==="superadmin"?"__superadmin__":user?.accessRoleId||(user?"__legacy__":""));
 const[definition,setDefinition]=useState<UserRoleTemplate|undefined>(initialRole);
 const[base,setBase]=useState<UserModulePermissions>(()=>initialRole?.modulePermissions||completePermissions(user?editableModulePermissions({...user,status:"activo"}):{}));
 const[permissions,setPermissions]=useState<UserModulePermissions>(()=>initialRole?applyRoleOverrides(initialRole.modulePermissions,user?.permissionOverrides):completePermissions(user?editableModulePermissions({...user,status:"activo"}):{}));
 const[keptOverrides,setKeptOverrides]=useState<Record<string,boolean>>(user?.permissionOverrides||{});
 const[name,setName]=useState(user?.displayName||""),[email,setEmail]=useState(user?.email||""),[password,setPassword]=useState(""),[showPassword,setShowPassword]=useState(false),[phone,setPhone]=useState(user?.phone||""),[department,setDepartment]=useState(user?.department||""),[status,setStatus]=useState<"activo"|"inactivo">(user?.status||"activo"),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const currentDefinition=definition?userRoleTemplates.find(role=>role.id===definition.id):undefined;
 const roleChanged=!!definition&&(!currentDefinition||Number(currentDefinition.version||0)!==Number(definition.version||0)||currentDefinition.status!==definition.status||currentDefinition.name!==definition.name);
 const reloadRole=()=>{if(!currentDefinition)return;const latest=normalizedRole(currentDefinition),pending=permissionDifferences(base,permissions,keptOverrides);setDefinition(latest);setBase(latest.modulePermissions);setPermissions(applyRoleOverrides(latest.modulePermissions,pending));setKeptOverrides(pending);setError("");};
 const overrides=definition?permissionDifferences(base,permissions,keptOverrides):{};
 const changeRole=(id:string)=>{
  const apply=()=>{if(id==="__superadmin__"){setRoleId(id);setDefinition(undefined);setKeptOverrides({});return;}const found=userRoleTemplates.find(role=>role.id===id);if(!found)return;const selected=normalizedRole(found);setDefinition(selected);setRoleId(id);setBase(selected.modulePermissions);setPermissions(selected.modulePermissions);setKeptOverrides({});};
  if(id===roleId)return;if(user||Object.keys(overrides).length)showConfirm("Cambiar rol del usuario","Se aplicarán los permisos del nuevo rol y se quitarán las excepciones de este formulario. Los demás usuarios no cambiarán. Se aplicará al guardar.",apply);else apply();
 };
 const restore=(path:string)=>{setPermissions(previous=>setPermission(previous,path,permissionValue(base,path)));setKeptOverrides(previous=>{const next={...previous};delete next[path];return next;});};
 const save=async()=>{
  setError("");if(roleChanged){setError("El rol cambió. Actualiza sus permisos heredados antes de guardar.");return;}if(name.trim().length<3){setError("Escribe el nombre completo del usuario.");return;}if(!email.trim().includes("@")){setError("Escribe un correo válido.");return;}
  if((!user||password)&&password.length<12){setError("La contraseña debe tener al menos 12 caracteres.");return;}
  if(!roleId||(!definition&&roleId!=="__superadmin__"&&roleId!=="__legacy__")){setError("Selecciona un rol activo.");return;}
  if(definition?.status==="inactivo"&&status==="activo"){setError("El rol está inactivo. Selecciona otro rol o deja la cuenta inactiva.");return;}
  setBusy(true);try{
   const data:FormData={version:user?.version??0,displayName:name.trim(),email:email.trim().toLocaleLowerCase(),phone:phone.trim(),department:department.trim(),status,
    role:roleId==="__superadmin__"?"superadmin":definition?"admin":user?.role||"admin",accessRoleId:definition?.id||null,
    ...(definition?{permissionOverrides:overrides,expectedRoleVersion:definition.version||0}:{permissionOverrides:{}}),...(password?{passwordHash:password}:{})};
   await onSave(data,permissions);
  }catch(error){setError(error instanceof Error?error.message:"No se pudo guardar el usuario.");if(error instanceof Error&&/\brol\b/i.test(error.message)){try{await refresh();}catch{}}}finally{setBusy(false);}
 };
 return <div className="min-w-0 space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"><div className="flex items-center gap-3"><BackButton onClick={onCancel} disabled={busy}/><h1 className="text-sm font-semibold">{user?user.displayName:"Nuevo usuario"}</h1></div><div className="flex gap-2"><button disabled={busy} onClick={onCancel} className="rounded-lg border px-4 py-2 text-xs">Cancelar</button><button disabled={busy} onClick={()=>void save()} className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Save className="size-4"/>{busy?"Guardando…":"Guardar"}</button></div></div>
  {roleChanged&&<div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">El rol fue actualizado mientras editabas. Puedes cargar sus cambios conservando las excepciones de este formulario.<button type="button" onClick={reloadRole} disabled={!currentDefinition} className="ml-2 font-semibold underline">Actualizar permisos heredados</button></div>}
  {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
   <div className="min-w-0 space-y-4 rounded-xl border bg-white p-4"><h2 className="text-xs font-semibold uppercase text-blue-700">Datos del usuario</h2>
    <label className="block text-xs font-semibold">Nombre completo *<input aria-label="Nombre completo" value={name} onChange={event=>setName(event.target.value)} maxLength={150} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label>
    <label className="block text-xs font-semibold">Correo de acceso *<input aria-label="Correo de acceso" type="email" value={email} readOnly={!!user} onChange={event=>setEmail(event.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm read-only:bg-slate-50"/></label>
    <label className="block text-xs font-semibold">{user?"Nueva contraseña (opcional)":"Contraseña inicial *"}<span className="mt-1 flex items-center gap-2 rounded-lg border p-2"><input aria-label="Contraseña del usuario" autoComplete="new-password" type={showPassword?"text":"password"} value={password} onChange={event=>setPassword(event.target.value)} className="min-w-0 flex-1 text-sm"/><button type="button" aria-label="Mostrar u ocultar contraseña" onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff className="size-4"/>:<Eye className="size-4"/>}</button></span></label>
    <label className="block text-xs">Teléfono<input aria-label="Teléfono del usuario" value={phone} onChange={event=>setPhone(event.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label>
    <label className="block text-xs">Departamento<input aria-label="Departamento del usuario" value={department} onChange={event=>setDepartment(event.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label>
    <label className="block text-xs">Estado de la cuenta<select aria-label="Estado de la cuenta" value={status} onChange={event=>setStatus(event.target.value as "activo"|"inactivo")} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="activo">Activa</option><option value="inactivo">Inactiva</option></select></label>
    <label className="block border-t pt-4 text-xs font-semibold">Rol asignado *<select aria-label="Rol asignado" value={roleId} onChange={event=>changeRole(event.target.value)} disabled={busy} className="mt-1 w-full rounded-lg border border-blue-200 p-2 text-sm"><option value="" disabled>Selecciona un rol creado…</option>{roleId==="__legacy__"&&<option value="__legacy__">Permisos individuales anteriores</option>}{userRoleTemplates.filter(role=>role.status!=="inactivo"||role.id===roleId).sort((a,b)=>a.name.localeCompare(b.name,"es")).map(role=><option key={role.id} value={role.id} disabled={role.status==="inactivo"}>{role.name}{role.status==="inactivo"?" (inactivo)":""}</option>)}{currentUser.role==="superadmin"&&<option value="__superadmin__">Superadministrador (perfil protegido)</option>}</select></label>
    <Link href="/personas?sub=roles_permisos" className="block text-xs font-semibold text-blue-700">Crear o administrar roles y permisos</Link>
    {!userRoleTemplates.some(role=>role.status!=="inactivo")&&<p className="text-xs text-amber-800">Primero crea un rol en «Roles y permisos». Después podrás asignarlo aquí.</p>}
    {definition&&<div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900"><strong>Heredado de: {definition.name}</strong><p className="mt-1">{Object.keys(overrides).length} excepciones individuales. Los cambios del rol actualizarán sus permisos heredados; las excepciones se conservan.</p><button type="button" disabled={busy} className="mt-3 flex items-center gap-2 underline" onClick={()=>showConfirm("Quitar excepciones del usuario","Se volverá a los permisos del rol. Los demás usuarios y el rol se conservan. Se aplicará al guardar.",()=>{setPermissions(base);setKeptOverrides({});})}><RotateCcw className="size-3.5"/>Usar solo permisos del rol</button></div>}
   </div>
   <div className="min-w-0 space-y-3">{roleId==="__superadmin__"?<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">El superadministrador tiene acceso completo y administra usuarios y roles. Este perfil no admite restricciones individuales. Otro superadministrador debe editar su cuenta.</p>:<><div className="rounded-xl border bg-white p-4"><h2 className="text-sm font-semibold">{definition?"Permisos efectivos y excepciones del usuario":"Permisos individuales"}</h2><p className="mt-1 text-xs text-slate-500">{definition?"Las opciones sin marca de excepción se heredan del rol. Cada cambio que hagas aquí afectará únicamente a este usuario. Usa la flecha de restablecer para volver a heredar una opción.":"Este usuario conserva su configuración anterior. Asigna un rol para vincularlo al nuevo catálogo."}</p></div><PermissionMatrixEditor value={permissions} overrides={overrides} disabled={busy||!roleId} onRestore={definition?restore:undefined} onChange={(next,paths)=>{setPermissions(next);if(definition&&paths)setKeptOverrides(previous=>({...previous,...Object.fromEntries(paths.map(path=>[path,permissionValue(next,path)]))}));}}/></>}</div>
  </div>
 </div>;
}
