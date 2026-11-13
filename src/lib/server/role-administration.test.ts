import test from "node:test";
import assert from "node:assert/strict";
import type {UserProfile,UserRoleTemplate} from "@/types";
import {administerRole} from "./role-administration.ts";
import {administerUser} from "./user-administration.ts";
import {actor} from "./security.ts";
import {userFixture,testEmployee} from "./test-support/user-store.ts";
import {completePermissions,setPermission} from "../permission-catalog.ts";
import {resolveAssignedRole} from "../role-access.ts";
import {canAccessModule,canUser} from "../permissions.ts";
const admin:UserProfile={uid:"owner",email:"owner@example.test",displayName:"QA Owner",role:"superadmin",status:"activo",permissions:["all"]};
const data={name:"Ventas",description:"Vendedores QA",status:"activo",modulePermissions:completePermissions()};

test("Crear, editar y eliminar roles sin usuarios registra versiones y auditoría",async()=>{
 const f=userFixture();const role=await administerRole(admin,{action:"create",data},f.services.db) as UserRoleTemplate;
 assert.equal(role.name,"Ventas");assert.equal(role.version,1);assert.equal(role.baseRole,"admin");
 const saved=await administerRole(admin,{action:"update",id:role.id,expectedVersion:1,data:{...data,name:"Ventas regional"}},f.services.db) as UserRoleTemplate;assert.equal(saved.version,2);
 await administerRole(admin,{action:"delete",id:role.id,expectedVersion:2},f.services.db);assert.equal(f.rows.has("userRoleTemplates/"+role.id),false);
 assert.equal([...f.rows.keys()].filter(key=>key.startsWith("operationLog/")).length,3);
});
test("Los nombres de roles son únicos sin importar espacios, mayúsculas o acentos y no reservan superadmin",async()=>{
 const f=userFixture();await administerRole(admin,{action:"create",data},f.services.db);
 await assert.rejects(administerRole(admin,{action:"create",data:{...data,name:"  VÉNTAS  "}},f.services.db),{status:409});
 await assert.rejects(administerRole(admin,{action:"create",data:{...data,name:"Superadministrador"}},f.services.db),{status:400});
 await assert.rejects(administerRole({...admin,role:"admin"},{action:"create",data},f.services.db),{status:403});
});
test("Dos ediciones simultáneas de un rol no se sobrescriben",async()=>{
 const f=userFixture();const results=await Promise.allSettled(["Uno","Dos"].map(name=>administerRole(admin,{action:"update",id:"role-qa",expectedVersion:1,data:{...data,name}},f.services.db)));
 assert.equal(results.filter(result=>result.status==="fulfilled").length,1);assert.equal((results.find(result=>result.status==="rejected") as PromiseRejectedResult).reason.status,409);
});
test("No se elimina un rol con usuarios; desactivarlo bloquea acceso y reactivarlo recupera excepciones",async()=>{
 const f=userFixture([{...testEmployee,role:"admin",accessRoleId:"role-qa",permissionOverrides:{"proyectos.enabled":true}}]);
 await assert.rejects(administerRole(admin,{action:"delete",id:"role-qa",expectedVersion:1},f.services.db),{status:409});
 const disabled=await administerRole(admin,{action:"update",id:"role-qa",expectedVersion:1,data:{...data,status:"inactivo"}},f.services.db) as UserRoleTemplate;
 assert.equal(f.rows.get("users/staff").status,"activo");assert.throws(()=>resolveAssignedRole(f.rows.get("users/staff"),disabled));
 const active=await administerRole(admin,{action:"update",id:"role-qa",expectedVersion:2,data},f.services.db) as UserRoleTemplate;assert.equal(canAccessModule(resolveAssignedRole(f.rows.get("users/staff"),active),"proyectos"),true);
});
test("Asignar un rol usa su matriz del servidor y no una copia manipulada del navegador",async()=>{
 const f=userFixture();await administerUser(admin,{action:"create",data:{...testEmployee,email:"new@example.test",role:"admin",passwordHash:"Synthetic-password-for-QA",accessRoleId:"role-qa",expectedRoleVersion:1,permissionOverrides:{"dashboard.enabled":true},modulePermissions:{ventas:{enabled:true}}}},f.services);
 const saved=f.rows.get("users/new-user");assert.equal(saved.accessRoleId,"role-qa");assert.equal(canAccessModule(saved,"ventas"),false);assert.equal(canAccessModule(saved,"dashboard"),true);
 assert.equal(f.rows.get("userRoleTemplates/role-qa").modulePermissions.dashboard.enabled,false);
 await assert.rejects(administerUser(admin,{action:"update",uid:"new-user",expectedVersion:1,data:{permissionOverrides:{"proyectos.enabled":true},expectedRoleVersion:0}},f.services),{status:409});
 assert.equal(f.rows.get("users/new-user").version,1);
});
test("Cada solicitud obtiene permisos actuales del rol, ignorando la copia antigua del perfil",async()=>{
 const f=userFixture([{...testEmployee,role:"admin",accessRoleId:"role-qa",permissionOverrides:{"dashboard.enabled":false},modulePermissions:{ventas:{enabled:true}}}]);
 f.services.auth.verifyIdToken=async()=>({uid:"staff"});const services=()=>f.services as any;const request={headers:{get:()=>"Bearer synthetic"}} as any;
 const before=await actor(request,services);assert.equal(canAccessModule(before,"ventas"),false);
 let matrix=setPermission(completePermissions(),"tickets.enabled",true);matrix=setPermission(matrix,"tickets.actions.canReplyTicket",true);matrix=setPermission(matrix,"dashboard.enabled",true);
 await administerRole(admin,{action:"update",id:"role-qa",expectedVersion:1,data:{...data,modulePermissions:matrix}},f.services.db);
 const after=await actor(request,services);assert.equal(after.accessRoleName,"Ventas");assert.equal(after.accessRoleVersion,2);assert.equal(canUser(after,"tickets","canReplyTicket"),true);assert.equal(canAccessModule(after,"dashboard"),false);
 await administerRole(admin,{action:"update",id:"role-qa",expectedVersion:2,data:{...data,status:"inactivo",modulePermissions:matrix}},f.services.db);
 await assert.rejects(actor(request,services),{status:403});
});
