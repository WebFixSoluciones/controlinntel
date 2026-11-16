import test from "node:test";
import assert from "node:assert/strict";
import type { UserProfile } from "@/types";
import { completePermissions, setPermission } from "./permission-catalog.ts";
import { canViewClientServicePart, canViewServicePrices, editableModulePermissions } from "./permissions.ts";
import { visibleServiceData } from "./service-visibility.ts";
import { canReadCollection } from "./persistence-contracts.ts";

test("Servicios: ocultar tarifas no oculta nombres ni habilita importes en otras pantallas", () => {
  let matrix = completePermissions();
  for (const key of ["abonados.enabled", "abonados.submodules.contratos", "abonados.submodules.servicios_contratados", "abonados.submodules.servicios_facturados", "abonados.submodules.servicios_tarifas", "visibility.canViewServicePrices", "visibility.canViewFinancialAmounts"]) matrix = setPermission(matrix, key, true);
  const user: UserProfile = { uid: "qa", email: "qa@example.test", displayName: "QA", role: "admin", status: "activo", permissionModelVersion: 2, modulePermissions: matrix, permissions: [] };
  assert.equal(canViewClientServicePart(user, "tarifas"), true);
  user.modulePermissions = setPermission(matrix, "abonados.submodules.servicios_tarifas", false);
  assert.equal(canViewServicePrices(user), true, "El control local no cambia la visibilidad del catálogo");
  assert.equal(canViewClientServicePart(user, "tarifas"), false);
  const visible = visibleServiceData(user, "clientServices", { planName: "Soporte", customPrice: 150, basePrice: 100, priceConIva: 172.5, ivaRate: 15 });
  assert.deepEqual(visible, { planName: "Soporte" });
  assert.equal(canReadCollection(user, "clientServices"), true);
  assert.equal(editableModulePermissions(user).abonados?.submodules?.servicios_tarifas, false);
  user.modulePermissions = setPermission(user.modulePermissions!, "abonados.submodules.servicios_contratados", false);
  assert.equal(canReadCollection(user, "clientServices"), false);
  assert.equal(canViewClientServicePart(user, "facturados"), true);
  user.modulePermissions = setPermission(user.modulePermissions!, "abonados.submodules.servicios_facturados", false);
  assert.equal(canViewClientServicePart(user, "facturados"), false);
});

test("Servicios: perfiles anteriores conservan acceso y una denegación global de tarifas prevalece", () => {
  const old: UserProfile = { uid: "old", email: "qa@example.test", displayName: "QA", role: "admin", status: "activo", permissionModelVersion: 2, permissions: [], modulePermissions: { abonados: { enabled: true, submodules: { contratos: true } }, visibility: { canViewServicePrices: true } } };
  const migrated = completePermissions(editableModulePermissions(old));
  assert.equal(migrated.abonados?.submodules?.servicios_contratados, true);
  assert.equal(migrated.abonados?.submodules?.servicios_tarifas, true);
  old.modulePermissions = setPermission(migrated, "visibility.canViewServicePrices", false);
  assert.equal(canViewClientServicePart(old, "tarifas"), false);
});
