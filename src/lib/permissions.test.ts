import test from "node:test";
import assert from "node:assert/strict";
import {
  can,
  canAccessRoute,
  canUser,
  canViewServicePrices,
  canManageTicketDepartments,
  firstAccessibleRoute,
  routePermissions,
} from "./permissions.ts";
import type { UserProfile } from "@/types";
import { visibleServiceData } from "./service-visibility.ts";

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
});
