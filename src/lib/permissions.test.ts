import test from "node:test";
import assert from "node:assert/strict";
import {
  can,
  canAccessRoute,
  canUser,
  routePermissions,
} from "./permissions.ts";
import type { UserProfile } from "@/types";

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
