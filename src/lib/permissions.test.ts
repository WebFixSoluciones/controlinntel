import test from "node:test";
import assert from "node:assert/strict";
import {
  can,
  canAccessRoute,
  canAccessSubmodule,
  canUser,
  canViewServicePrices,
  canManageTicketDepartments,
  firstAccessibleRoute,
  routePermissions,
} from "./permissions.ts";
import type { UserProfile } from "@/types";
import { visibleServiceData } from "./service-visibility.ts";
import { completePermissions, setPermission, permissionSections } from "./permission-catalog.ts";

test("QA: Clientes aparece por sus vistas autorizadas sin exigir un permiso inexistente de listado", () => {
  let matrix = setPermission(completePermissions(), "abonados.enabled", true);
  const profile = (modulePermissions = matrix): UserProfile => ({ uid: "qa", email: "qa@example.test", displayName: "QA", role: "tecnico", status: "activo", permissionModelVersion: 2, modulePermissions });
  assert.equal(canAccessSubmodule(profile(), "abonados", "listado"), false);
  for (const tab of ["fiscal", "contratos", "red", "boveda", "archivos", "tickets", "facturacion"]) {
    const allowed = setPermission(matrix, `abonados.submodules.${tab}`, true);
    assert.equal(canAccessRoute(profile(allowed), "/clientes"), true);
    assert.equal(canAccessSubmodule(profile(allowed), "abonados", "listado"), true);
    assert.equal(canAccessSubmodule(profile(allowed), "abonados", tab), true);
    assert.equal(canAccessRoute(profile(allowed), "/ventas"), false);
    assert.equal(canAccessSubmodule(profile(setPermission(allowed, "abonados.enabled", false)), "abonados", "listado"), false);
  }
});

test("QA: las pantallas de cada módulo respetan su interruptor y el resto de rutas permanece cerrado", () => {
  const routes = Object.entries(routePermissions).filter(([path]) => path !== "/abonados" && path !== "/tramites");
  for (const [path, moduleKey] of routes) {
    let matrix = completePermissions();
    matrix = setPermission(matrix, "visibility.canViewFinancialAmounts", true);
    matrix = setPermission(matrix, `${moduleKey}.enabled`, true);
    const profile: UserProfile = { uid: "qa", email: "qa@example.test", displayName: "QA", role: "admin", status: "activo", permissionModelVersion: 2, modulePermissions: matrix };
    assert.equal(canAccessRoute(profile, path), true, path);
    for (const [otherPath, otherModule] of routes) if (otherModule !== moduleKey) assert.equal(canAccessRoute(profile, otherPath), false, `${path} no habilita ${otherPath}`);
    const section = permissionSections().find(item => item.key === moduleKey);
    for (const item of section?.items || []) {
      if (!item.path.includes(".submodules.")) continue;
      const sub = item.path.split(".").at(-1)!;
      const selected = { ...profile, modulePermissions: setPermission(matrix, item.path, true) };
      assert.equal(canAccessSubmodule(selected, moduleKey, sub), !item.reserved, item.path);
      assert.equal(canAccessSubmodule({ ...selected, modulePermissions: setPermission(selected.modulePermissions!, `${moduleKey}.enabled`, false) }, moduleKey, sub), false, `Módulo apagado: ${item.path}`);
    }
    assert.equal(canAccessRoute({ ...profile, status: "inactivo" }, path), false);
  }
});

test("QA: cada acción publicada por el editor se habilita y revoca sin desbloquear su módulo apagado", () => {
  for (const section of permissionSections()) {
    if (section.key === "visibility") continue;
    const enabled = setPermission(setPermission(completePermissions(), "visibility.canViewFinancialAmounts", true), `${section.key}.enabled`, true);
    for (const item of section.items.filter(item => item.path.includes(".actions."))) {
      const [moduleKey, , action] = item.path.split(".");
      const profile: UserProfile = { uid: "qa", email: "qa@example.test", displayName: "QA", role: "admin", status: "activo", permissionModelVersion: 2,
        modulePermissions: setPermission(enabled, item.path, true) };
      assert.equal(canUser(profile, moduleKey as any, action), true, item.path);
      assert.equal(canUser({ ...profile, modulePermissions: setPermission(enabled, item.path, false) }, moduleKey as any, action), false, `Revocada: ${item.path}`);
      assert.equal(canUser({ ...profile, modulePermissions: setPermission(profile.modulePermissions!, `${section.key}.enabled`, false) }, moduleKey as any, action), false, `Módulo apagado: ${item.path}`);
    }
  }
});

const superAdmin: UserProfile = {
  uid: "usr-super",
  email: "super@inntelcorp.com",
  displayName: "Super Admin",
  role: "superadmin",
  status: "activo",
  permissions: ["all"],
};

const operadorActivo: UserProfile = {
  uid: "usr-op",
  email: "operador@inntelcorp.com",
  displayName: "Operador NOC",
  role: "tecnico",
  status: "activo",
  permissions: ["manage_network", "manage_tickets"],
};

const usuarioInactivo: UserProfile = {
  uid: "usr-inactivo",
  email: "bloqueado@inntelcorp.com",
  displayName: "Usuario Inactivo",
  role: "tecnico",
  status: "inactivo",
  permissions: ["manage_network"],
};

test("Permissions - can() function", () => {
  // Superadmin can do anything
  assert.equal(can(superAdmin, "manage_finance"), true);
  assert.equal(can(superAdmin, "any_arbitrary_permission"), true);

  // Operador has network and tickets, not finance
  assert.equal(can(operadorActivo, "manage_network"), true);
  assert.equal(can(operadorActivo, "manage_finance"), false);

  // Inactive user cannot do anything even if permission listed
  assert.equal(can(usuarioInactivo, "manage_network"), false);
});

test("Permissions - canAccessRoute() fail-closed", () => {
  // Superadmin can access any mapped route
  assert.equal(canAccessRoute(superAdmin, "/compras"), true);
  assert.equal(canAccessRoute(superAdmin, "/finanzas"), true);
  assert.equal(canAccessRoute(superAdmin, "/tramites"), true);

  // Unknown route should fail-closed
  assert.equal(canAccessRoute(operadorActivo, "/ruta-inexistente-hack"), false);

  // Inactive user denied route access
  assert.equal(canAccessRoute(usuarioInactivo, "/red"), false);
});

test("Permissions - /tramites mapping", () => {
  assert.equal(routePermissions["/tramites"], "arcotel");
});

test("Técnico legacy con acceso global conserva el trabajo operativo y pierde el acceso implícito a finanzas", () => {
  const legacy: UserProfile = { ...operadorActivo, permissions: ["all"] };
  assert.equal(can(legacy, "manage_tickets"), true);
  assert.equal(can(legacy, "manage_finance"), false);
  assert.equal(canAccessRoute(legacy, "/"), false);
  assert.equal(firstAccessibleRoute(legacy), "/clientes");
  assert.equal(canViewServicePrices(legacy), false);
  assert.equal(canManageTicketDepartments(legacy), false);
  const dashboardOnly = { ...legacy, modulePermissions: { dashboard: { enabled: true } } };
  assert.equal(canAccessRoute(dashboardOnly, "/"), true);
  assert.equal(canViewServicePrices(dashboardOnly), false);
  const amountsOnly = { ...legacy, modulePermissions: { visibility: { canViewServicePrices: true } } };
  assert.equal(canViewServicePrices(amountsOnly), true);
  assert.equal(canAccessRoute(amountsOnly, "/"), false);
  assert.equal(canManageTicketDepartments({ ...legacy, modulePermissions: { tickets: { enabled: true, actions: { canManageDepartments: true } } } }), true);
});

test("La proyección técnica conserva el servicio y omite sus importes del catálogo y del cliente", () => {
  const service = { id: "srv", planName: "Internet QA", basePrice: 100, customPrice: 90, priceConIva: 103.5, ivaRate: 15, status: "activo" };
  assert.deepEqual(visibleServiceData(operadorActivo, "clientServices", service), { id: "srv", planName: "Internet QA", status: "activo" });
  assert.deepEqual(visibleServiceData(superAdmin, "clientServices", service), service);
  assert.deepEqual(visibleServiceData(operadorActivo, "inventoryProducts", { id: "srv", type: "servicio", name: "Internet", salePrice: 30, salePriceConIva: 34.5, baseCost: 10 }),
    { id: "srv", type: "servicio", name: "Internet" });
  assert.deepEqual(visibleServiceData(operadorActivo, "plans", { id: "p", name: "Plan", defaultPrice: 50 }), { id: "p", name: "Plan" });
  assert.equal(service.customPrice, 90);
  const invoice = { id: "invoice", items: [{ name: "Servicio", quantity: 1, costUnitSnapshot: 25, costTotalSnapshot: 25 }] };
  assert.deepEqual(visibleServiceData(operadorActivo, "billingInvoices", invoice), { id: "invoice", items: [{ name: "Servicio", quantity: 1 }] });
  assert.deepEqual(visibleServiceData(superAdmin, "billingInvoices", invoice), invoice);
});
