import test from "node:test";
import assert from "node:assert/strict";
import type { UserProfile } from "@/types";
import { userAccessSnapshot, modulePermissionsSchema } from "./user-access.ts";
import { can, canUser, canAccessModule, disabledModulePermissions } from "./permissions.ts";
import { actor } from "./server/security.ts";
import { syncUserIdentity } from "./server/user-identity.ts";
import { save, remove } from "./server/operations.ts";
import { visibleServiceData } from "./service-visibility.ts";
import { requireDocumentAccess } from "./server/document-access.ts";
import { requireSettingsAccess } from "./server/settings-access.ts";

const technician: UserProfile = { uid: "qa", email: "qa@example.test", displayName: "QA", role: "tecnico", status: "activo", permissions: [] };
test("La matriz permite delegar una operación sin permisos generales contradictorios", () => {
  const user = { ...technician, ...userAccessSnapshot({ ...technician, permissionModelVersion: 2, modulePermissions: { visibility: { canViewFinancialAmounts: true }, finanzas: { enabled: true, actions: { canRegisterReceipts: true } as any, submodules: { cobranzas: true } as any } } }) };
  assert.equal(can(user, "manage_finance"), true); assert.equal(canUser(user, "finanzas", "canRegisterReceipts"), true);
  const denied = { ...user, modulePermissions: { ...user.modulePermissions, finanzas: { ...user.modulePermissions.finanzas!, enabled: false } } };
  assert.equal(canUser(denied, "finanzas", "canRegisterReceipts"), false);
  assert.equal(can(denied, "manage_finance"), false); assert.equal(can(user, "manage_users"), false);
});
test("Los perfiles guardados no heredan módulos ni acciones ausentes y Ninguno limpia todos los niveles", () => {
  const user: UserProfile = { ...technician, role: "admin", permissionModelVersion: 2, permissions: ["all"], modulePermissions: { ventas: { enabled: true, submodules: {} as any } } };
  assert.equal(canAccessModule(user, "compras"), false); assert.equal(canUser(user, "ventas", "canCreateInvoice"), false);
  const snapshot = userAccessSnapshot(technician), disabled = disabledModulePermissions(snapshot.modulePermissions);
  const visit = (value: any) => Object.values(value).forEach(child => typeof child === "boolean" ? assert.equal(child, false) : visit(child));
  visit(disabled); assert.equal(snapshot.modulePermissions.abonados?.enabled, true);
  assert.equal(modulePermissionsSchema.safeParse({ ventas: { enabled: "false" } }).success, false);
  assert.equal(modulePermissionsSchema.safeParse({ invented: { enabled: true } }).success, false);
});
test("No existe acceso de respaldo sin perfil y los tokens revocados no tienen una segunda verificación permisiva", async () => {
  const request = { headers: { get: () => "Bearer qa" } } as any;
  const calls: boolean[] = [];
  const services = (exists: boolean, revoked = false, unavailable = false) => (() => ({ auth: { verifyIdToken: async (_token: string, check: boolean) => { calls.push(check); if (revoked) throw Error("Revoked"); return { uid: "usr-superadmin-00", email: "superadmin@inntelcorp.com" }; } }, db: { collection: () => ({ doc: () => ({ get: async () => { if (unavailable) throw Error("Offline"); return { exists, data: () => technician }; } }) }) } })) as any;
  await assert.rejects(actor(request, services(false)), { status: 403 });
  calls.length = 0; await assert.rejects(actor(request, services(true, true)), { status: 401 }); assert.deepEqual(calls, [true]);
  await assert.rejects(actor(request, services(true, false, true)), { status: 503 });
});
test("Editar un perfil inactivo conserva el bloqueo y solo cambios sensibles revocan la sesión", async () => {
  const updates: any[] = [], revoked: string[] = [];
  const auth = { updateUser: async (uid: string, change: any) => { updates.push({ uid, ...change }); }, revokeRefreshTokens: async (uid: string) => { revoked.push(uid); } } as any;
  await syncUserIdentity(auth, "qa", { status: "inactivo", displayName: "Nombre corregido" });
  assert.equal(updates[0].disabled, true); assert.deepEqual(revoked, ["qa"]);
  revoked.length = 0; await syncUserIdentity(auth, "qa", { status: "activo", displayName: "QA" });
  assert.equal(updates[1].disabled, false); assert.deepEqual(revoked, []);
  await syncUserIdentity(auth, "qa", { status: "activo", displayName: "QA" }, "synthetic-password-for-unit-test"); assert.deepEqual(revoked, ["qa"]);
});
test("Los formularios genéricos respetan módulo y acción, aunque otro módulo conceda el permiso general", async () => {
  const user = { ...technician, role: "admin" as const, permissionModelVersion: 2 as const,
    modulePermissions: { proyectos: { enabled: true }, abonados: { enabled: true }, clientes: { enabled: true, actions: { canEditClient: false } as any }, red: { enabled: false, actions: { canManageNodes: true } as any, submodules: {nodos:true,pools_ip:false} } } };
  await assert.rejects(save(user,"clients",{},"a"),{status:403});
  await assert.rejects(save(user,"nodes",{},"a"),{status:403});
  await assert.rejects(remove(user,"nodes","a"),{status:403});
  assert.equal(can({...user,modulePermissions:undefined,permissions:["all"]},"manage_network"),false);
});
test("Saldos y datos bancarios se ocultan desde el servidor, y una denegación de borrar archivos se respeta",()=>{
  const user: UserProfile = { ...technician, role:"admin", permissionModelVersion:2, modulePermissions:{finanzas:{enabled:true,actions:{canViewBankBalances:false} as any,submodules:{} as any},compras:{enabled:true,actions:{canViewSupplierBank:false} as any,submodules:{} as any},abonados:{enabled:true},clientes:{enabled:true,actions:{canDeleteContracts:true} as any},actions:{canDeleteFiles:false}} };
  assert.deepEqual(visibleServiceData(user,"bankAccounts",{id:"b",bankName:"QA",currentBalance:123,initialBalance:100}),{id:"b",bankName:"QA"});
  assert.deepEqual(visibleServiceData(user,"suppliers",{id:"s",bankName:"QA",bankAccountNumber:"999",razonSocial:"Proveedor"}),{id:"s",razonSocial:"Proveedor"});
  requireDocumentAccess(user,"clients/a/documents/a.xlsx","delete");
  assert.throws(()=>requireDocumentAccess({...user,modulePermissions:{...user.modulePermissions,arcotel:{enabled:true}}},"arcotel/global/bdh/a.xlsx","delete"),{status:403});
});
test("Guardar un perfil fija las opciones especiales y separa acciones de Ventas de SRI",()=>{
  const admin: UserProfile={...technician,role:"admin",permissions:["manage_tickets"]};
  const saved=userAccessSnapshot(admin);
  assert.equal(saved.modulePermissions.plantillas?.actions?.canManageTemplates,true);
  assert.equal(saved.modulePermissions.tickets?.actions?.canManageDepartments,true);
  assert.equal(saved.modulePermissions.abonados?.submodules?.fiscal,true);
  const user:UserProfile={...admin,permissionModelVersion:2,modulePermissions:{ventas:{enabled:true,submodules:{} as any},facturacion:{enabled:true,actions:{canEditPrices:true} as any,submodules:{} as any}}};
  assert.equal(editableSalesPrice(user),false);
  function editableSalesPrice(profile:UserProfile){return userAccessSnapshot(profile).modulePermissions.ventas?.actions?.canEditPrices;}
});
test("Configurar certificado o correo depende de Configuración, no de tener acceso general a importes",()=>{
  const finance:UserProfile={...technician,role:"finanzas",modulePermissions:{configuracion:{enabled:false},finanzas:{enabled:true,submodules:{} as any}}};
  assert.throws(()=>requireSettingsAccess(finance,"sri"),{status:403});
  assert.throws(()=>requireSettingsAccess(finance,"email",true),{status:403});
  const settings:UserProfile={...technician,permissionModelVersion:2,modulePermissions:{configuracion:{enabled:true,submodules:{general:false,sri:true}}}};
  requireSettingsAccess(settings,"sri",true);requireSettingsAccess(settings,"email",true);
  assert.equal(can(settings,"manage_finance"),false);
  assert.throws(()=>requireSettingsAccess({...settings,role:"consulta"},"sri",true),{status:403});
});
