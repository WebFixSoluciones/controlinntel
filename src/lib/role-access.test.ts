import test from "node:test";
import assert from "node:assert/strict";
import type {UserProfile,UserRoleTemplate} from "@/types";
import {completePermissions,setPermission,permissionSections,permissionPaths} from "./permission-catalog.ts";
import {resolveAssignedRole,permissionDifferences,applyRoleOverrides,normalizedRole,administrationProfile,validOverrides,RoleAccessError} from "./role-access.ts";
import {can,canUser,canAccessModule} from "./permissions.ts";
import {requireSettingsAccess} from "./server/settings-access.ts";
import {save,remove} from "./server/operations.ts";
import {userFixture} from "./server/test-support/user-store.ts";
import {requireDocumentAccess} from "./server/document-access.ts";
import {canManageExpenseCategories} from "./expense-categories.ts";
import {canReadCollection} from "./persistence-contracts.ts";
import {requireVaultAccess} from "./server/vault-access.ts";
const user:UserProfile={uid:"a",email:"a@example.test",displayName:"QA",role:"admin",status:"activo",accessRoleId:"sales",permissionOverrides:{}};
const role:UserRoleTemplate={id:"sales",name:"Ventas",baseRole:"admin",status:"activo",version:1,permissionModelVersion:2,modulePermissions:completePermissions()};

test("Cambiar un rol actualiza usuarios vinculados y conserva altas y denegaciones personales",()=>{
 const definition={...role,modulePermissions:setPermission(role.modulePermissions,"dashboard.enabled",true)};
 const a={...user,permissionOverrides:{"proyectos.enabled":true}},b={...user,uid:"b",permissionOverrides:{"dashboard.enabled":false}};
 const first=resolveAssignedRole(a,definition);assert.equal(canAccessModule(first,"dashboard"),true);assert.equal(canAccessModule(first,"proyectos"),true);
 const changed={...definition,version:2,modulePermissions:setPermission(definition.modulePermissions,"dashboard.enabled",false)};
 assert.equal(canAccessModule(resolveAssignedRole(a,changed),"dashboard"),false);assert.equal(canAccessModule(resolveAssignedRole(a,changed),"proyectos"),true);
 assert.equal(canAccessModule(resolveAssignedRole(b,definition),"dashboard"),false);assert.equal(canAccessModule(resolveAssignedRole({...user,uid:"c"},definition),"proyectos"),false);
 assert.equal(resolveAssignedRole(a,changed).accessRoleVersion,2);
});
test("Una excepción explícita igual al rol sigue siendo personal cuando el rol cambia",()=>{
 const before=JSON.stringify(role),matrix=completePermissions();const overrides=permissionDifferences(matrix,matrix,{"dashboard.enabled":false});
 assert.deepEqual(overrides,{"dashboard.enabled":false});assert.equal(applyRoleOverrides(setPermission(matrix,"dashboard.enabled",true),overrides).dashboard?.enabled,false);
 assert.deepEqual(permissionDifferences(matrix,matrix,{}),{});assert.equal(JSON.stringify(role),before);
});
test("Roles inactivos o ausentes bloquean acceso sin cambiar el estado administrativo de la cuenta",()=>{
 assert.throws(()=>resolveAssignedRole(user,{...role,status:"inactivo"}),RoleAccessError);assert.throws(()=>resolveAssignedRole(user,undefined),RoleAccessError);
 const blocked=administrationProfile(user,{...role,status:"inactivo"});assert.equal(blocked.status,"activo");assert.equal(blocked.accessRoleStatus,"inactivo");assert.deepEqual(blocked.permissions,[]);
 const recovered=resolveAssignedRole(user,{...role,modulePermissions:setPermission(role.modulePermissions,"dashboard.enabled",true)});assert.equal(canAccessModule(recovered,"dashboard"),true);
});
test("Los roles personalizados no crean superadministradores ni aceptan rutas de permisos desconocidas",()=>{
 assert.throws(()=>resolveAssignedRole({...user,role:"superadmin"},role),RoleAccessError);
 const invalid:Record<string,boolean>[]=[{"personas.submodules.usuarios_equipo":true},{"personas.submodules.roles_permisos":true},{"invented.enabled":true},{"__proto__.enabled":true}];for(const overrides of invalid)assert.throws(()=>validOverrides(overrides),RoleAccessError);
 let matrix=completePermissions();for(const section of permissionSections())for(const item of section.items){assert.equal(permissionPaths.has(item.path),true);if(!item.reserved)matrix=setPermission(matrix,item.path,true);}
 const profile=resolveAssignedRole(user,{...role,modulePermissions:matrix});assert.equal(can(profile,"manage_users"),false);assert.equal(profile.modulePermissions?.personas?.submodules.usuarios_equipo,false);
});
test("Consultar configuración no concede escritura; una excepción adicional solo afecta a ese usuario",()=>{
 let matrix=setPermission(role.modulePermissions,"configuracion.enabled",true);matrix=setPermission(matrix,"configuracion.submodules.general",true);
 const definition={...role,modulePermissions:matrix};const reader=resolveAssignedRole(user,definition);
 requireSettingsAccess(reader,"email");assert.throws(()=>requireSettingsAccess(reader,"email",true),{status:403});
 const editor=resolveAssignedRole({...user,permissionOverrides:{"configuracion.actions.canEditGeneralSettings":true}},definition);requireSettingsAccess(editor,"email",true);assert.equal(canUser(reader,"configuracion","canEditGeneralSettings"),false);
});
test("Un rol de consulta de soporte o proyectos no puede crear, editar ni eliminar registros",async()=>{
 let matrix=setPermission(role.modulePermissions,"tickets.enabled",true);matrix=setPermission(matrix,"proyectos.enabled",true);
 const profile=resolveAssignedRole(user,{...role,modulePermissions:matrix});const fixture=userFixture();
 await assert.rejects(save(profile,"tickets",{},"new",undefined,fixture.services.db),{status:403});
 await assert.rejects(save(profile,"projects",{},"new",undefined,fixture.services.db),{status:403});
 await assert.rejects(remove(profile,"projects","new",undefined,fixture.services.db),{status:403});
 await assert.rejects(remove(profile,"tickets","new",undefined,fixture.services.db),{status:403});
 assert.equal(canUser(profile,"tickets","canReplyTicket"),false);assert.equal(fixture.rows.has("tickets/new"),false);
});
test("Las antiguas plantillas de consulta conservan sus denegaciones efectivas al pasar al catálogo",()=>{
 const legacy=normalizedRole({...role,baseRole:"consulta",permissionModelVersion:undefined,modulePermissions:{facturacion:{enabled:true,submodules:{facturas:true,notas_credito:false,retenciones:false,guias_remision:false},actions:{canCreateInvoice:true,canCreateQuotes:true,canAuthorizeSri:true} as any}}});
 const result=resolveAssignedRole(user,legacy);assert.equal(canUser(result,"facturacion","canCreateInvoice"),false);assert.equal(canUser(result,"facturacion","canAuthorizeSri"),false);
});
test("Subir archivos regulatorios y administrar categorías de gastos requieren permisos independientes",()=>{
 let matrix=setPermission(role.modulePermissions,"arcotel.enabled",true);matrix=setPermission(matrix,"visibility.canViewFinancialAmounts",true);matrix=setPermission(matrix,"finanzas.enabled",true);matrix=setPermission(matrix,"finanzas.submodules.gastos",true);matrix=setPermission(matrix,"finanzas.actions.canRegisterExpenses",true);
 const reader=resolveAssignedRole(user,{...role,modulePermissions:matrix});
 assert.throws(()=>requireDocumentAccess(reader,"arcotel/global/bdh/qa.xlsx","write"),{status:403});assert.equal(canManageExpenseCategories(reader),false);
 const granted=resolveAssignedRole({...user,permissionOverrides:{"arcotel.actions.canManageRegulatoryFiles":true,"finanzas.actions.canManageExpenseCategories":true}},{...role,modulePermissions:matrix});requireDocumentAccess(granted,"arcotel/global/bdh/qa.xlsx","write");assert.equal(canManageExpenseCategories(granted),true);
});
test("Editar un proyecto no autoriza enviarlo a papelera",async()=>{
 let matrix=setPermission(role.modulePermissions,"proyectos.enabled",true);matrix=setPermission(matrix,"proyectos.actions.canEditProject",true);
 const profile=resolveAssignedRole(user,{...role,modulePermissions:matrix});const fixture=userFixture();fixture.rows.set("projects/project",{id:"project",name:"Proyecto QA",isDeleted:false});
 await assert.rejects(save(profile,"projects",{isDeleted:true},"project",undefined,fixture.services.db),{status:403});assert.equal(fixture.rows.get("projects/project").isDeleted,false);
});
test("Acceder a Configuración no concede los documentos de ARCOTEL a un rol que lo tiene desactivado",()=>{
 let matrix=setPermission(role.modulePermissions,"configuracion.enabled",true);matrix=setPermission(matrix,"configuracion.submodules.general",true);
 const profile=resolveAssignedRole(user,{...role,modulePermissions:matrix});for(const entity of ["policies","arcotelFiles","regulatoryTramites"] as const)assert.equal(canReadCollection(profile,entity),false);
});
test("Consultar o revelar una credencial no permite crearla ni editarla sin su permiso propio",()=>{
 let matrix=setPermission(role.modulePermissions,"boveda.enabled",true);matrix=setPermission(matrix,"boveda.actions.canViewClientVault",true);matrix=setPermission(matrix,"boveda.actions.canRevealPasswords",true);
 const viewer=resolveAssignedRole(user,{...role,modulePermissions:matrix});requireVaultAccess(viewer,"clientVaultItems","reveal");assert.throws(()=>requireVaultAccess(viewer,"clientVaultItems","save"),{status:403});assert.throws(()=>requireVaultAccess(viewer,"clientVaultItems","delete"),{status:403});
 const editor=resolveAssignedRole({...user,permissionOverrides:{"boveda.actions.canManageCredentials":true}},{...role,modulePermissions:matrix});requireVaultAccess(editor,"clientVaultItems","save");assert.equal(canUser(viewer,"boveda","canManageCredentials"),false);
});
