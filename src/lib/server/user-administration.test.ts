import test from "node:test";
import assert from "node:assert/strict";
import type { UserProfile } from "@/types";
import { administerUser } from "./user-administration.ts";

const admin: UserProfile = {uid:"owner",email:"owner@example.test",displayName:"QA Owner",role:"superadmin",status:"activo",permissions:["all"]};
const employee = {uid:"staff",email:"staff@example.test",displayName:"QA Staff",role:"tecnico",status:"activo",permissions:[],version:1,createdAt:"2026-01-01T00:00:00Z"};

// Stages writes atomically, including the operation journal, and serializes conflicting transactions.
function fixture(records: Record<string, unknown>[] = [employee]) {
  const rows = new Map(records.map(row => ["users/"+row.uid,structuredClone(row)]));
  const updates: any[] = [], revoked: string[] = [], deleted: string[] = [];
  const identities = new Map<string, any>();
  let failCommit = false, failActivation = false, created = 0, tail = Promise.resolve();
  const db: any = {collection:(name:string) => ({doc:(id:string) => ({path:name+"/"+id,id}),where:(_field:string,_op:string,value:unknown) => ({name,value})}),
    batch:() => {const pending=new Map<string,any>();return {create:(ref:any,data:any)=>pending.set(ref.path,structuredClone(data)),commit:async()=>{if(failCommit)throw Error("Commit failed");pending.forEach((data,key)=>rows.set(key,data));}};},
    runTransaction:async(fn:any)=>{let release!:()=>void;const prior=tail;tail=new Promise<void>(resolve=>release=resolve);await prior;const pending=new Map<string,any>();
      const snap=(key:string)=>({exists:rows.has(key),data:()=>structuredClone(rows.get(key))});
      try {const result=await fn({get:async(ref:any)=>ref.path?snap(ref.path):{docs:[...rows].filter(([key,value])=>key.startsWith(ref.name+"/")&&value.role===ref.value).map(([key])=>snap(key))},set:(ref:any,data:any)=>pending.set(ref.path,structuredClone(data)),create:(ref:any,data:any)=>pending.set(ref.path,structuredClone(data))});if(failCommit)throw Error("Commit failed");pending.forEach((data,key)=>rows.set(key,data));return result;}finally{release();}}
  };
  const auth: any = {createUser:async(data:any)=>{created++;identities.set("new-user",{disabled:data.disabled});return {uid:"new-user"};},
    updateUser:async(uid:string,data:any)=>{if(failActivation&&data.disabled===false)throw Error("Activation failed");updates.push({uid,...data});identities.set(uid,{...identities.get(uid),...data});},
    revokeRefreshTokens:async(uid:string)=>{revoked.push(uid);},deleteUser:async(uid:string)=>{deleted.push(uid);identities.delete(uid);}};
  return {rows,updates,revoked,deleted,identities,services:{db,auth},get created(){return created;},failCommit:()=>{failCommit=true;},failActivation:()=>{failActivation=true;}};
}
const createData = {...employee,permissions:["all"],passwordHash:"Synthetic-QA-password-123"};

test("Crear una cuenta activa valida y fija su matriz, sin guardar la contraseña en perfil ni auditoría", async()=>{
  const f=fixture();await administerUser(admin,{action:"create",data:createData},f.services);
  const saved:any=f.rows.get("users/new-user");
  assert.equal(f.created,1);assert.equal(saved.permissionModelVersion,2);assert.equal(saved.version,1);
  assert.equal(saved.permissions.includes("all"),false);assert.equal(saved.modulePermissions.personas.submodules.usuarios_equipo,false);
  assert.equal(f.identities.get("new-user").disabled,false);
  assert.equal(JSON.stringify([...f.rows.values()]).includes(createData.passwordHash),false);
  assert.equal([...f.rows.keys()].filter(key=>key.startsWith("operationLog/")).length,1);
});
test("Un alta fallida elimina la identidad sin perfil o la conserva bloqueada si falló la activación", async()=>{
  const f=fixture();f.failCommit();await assert.rejects(administerUser(admin,{action:"create",data:createData},f.services));
  assert.deepEqual(f.deleted,["new-user"]);assert.equal(f.rows.has("users/new-user"),false);
  const g=fixture();g.failActivation();await assert.rejects(administerUser(admin,{action:"create",data:createData},g.services));
  assert.equal(g.rows.has("users/new-user"),true);assert.equal(g.identities.get("new-user").disabled,true);
});
test("Desactivar, editar una cuenta inactiva y reactivarla sincroniza identidad y conserva la fecha de alta", async()=>{
  const f=fixture();await administerUser(admin,{action:"disable",uid:"staff",expectedVersion:1},f.services);
  assert.equal(f.rows.get("users/staff")?.status,"inactivo");assert.equal(f.identities.get("staff").disabled,true);assert.deepEqual(f.revoked,["staff"]);
  await administerUser(admin,{action:"update",uid:"staff",expectedVersion:2,data:{displayName:"QA Corregido"}},f.services);
  assert.equal(f.identities.get("staff").disabled,true);assert.equal(f.rows.get("users/staff")?.createdAt,employee.createdAt);
  await administerUser(admin,{action:"update",uid:"staff",expectedVersion:3,data:{status:"activo"}},f.services);
  assert.equal(f.identities.get("staff").disabled,false);assert.equal(f.rows.get("users/staff")?.version,4);
});
test("Las ediciones simultáneas rechazan la versión anterior sin sobrescribir al otro administrador", async()=>{
  const f=fixture();const results=await Promise.allSettled(["Cambio Uno","Cambio Dos"].map(displayName=>administerUser(admin,{action:"update",uid:"staff",expectedVersion:1,data:{displayName}},f.services)));
  assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
  const rejected=results.find(result=>result.status==="rejected") as PromiseRejectedResult;assert.equal(rejected.reason.status,409);
  assert.equal(f.rows.get("users/staff")?.version,2);
});
test("No se permite autoeditar acceso, perder el último superadministrador ni cambiar el correo de identidad", async()=>{
  const f=fixture([{...employee,uid:"last",role:"superadmin"}]);
  await assert.rejects(administerUser(admin,{action:"disable",uid:"owner",expectedVersion:1},f.services),{status:400});
  await assert.rejects(administerUser(admin,{action:"disable",uid:"last",expectedVersion:1},f.services),{status:409});
  await assert.rejects(administerUser(admin,{action:"update",uid:"last",expectedVersion:1,data:{email:"other@example.test"}},f.services),{status:400});
  await assert.rejects(administerUser(admin,{action:"update",uid:"last",data:{displayName:"Sin versión"}},f.services),{status:400});
  await assert.rejects(administerUser({...admin,role:"admin"},{action:"create",data:createData},f.services),{status:403});
  await assert.rejects(administerUser(admin,{action:"create",data:{...createData,passwordHash:"short"}},f.services));
  assert.equal(f.created,0);assert.equal(f.updates.length,0);
});
