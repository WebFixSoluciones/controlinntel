import test from "node:test";
import assert from "node:assert/strict";
import { documentArea, documentFolder, attachmentDisposition } from "./document-path.ts";
import { requireDocumentAccess } from "./document-access.ts";
import type { UserProfile } from "@/types";

test("document routes reject traversal, unexpected namespaces and encoded paths", () => {
  for (const path of ["../a", "/templates/a", "templates/../a", "templates/%2e%2e/a", "templates/a?b", "templates/a\\b", "private/a", "clients/a/secrets/file"]) {
    assert.throws(() => documentArea(path), /Ruta|Carpeta/, path);
  }
  assert.equal(documentArea("clients/customer-1/documents/original.xlsx"), "clients");
  assert.equal(documentArea("arcotel/global/registro_infraestructura/original.xlsx"), "arcotel");
  assert.equal(documentFolder("templates"), "templates");
});

test("download attachment preserves international filename and prevents header injection", () => {
  const header = attachmentDisposition('Análisis (7).xlsx\r\n"');
  assert.ok(header.includes("filename*=UTF-8''An%C3%A1lisis%20%287%29.xlsx"));
  assert.equal(/[\r\n]/.test(header), false);
});

test("document access enforces module scope, mutation permission and deletion privilege", () => {
  const reader: UserProfile = { uid: "qa", email: "qa@example.test", displayName: "QA", role: "consulta", status: "activo", permissions: [],
    modulePermissions: { abonados: { enabled: true }, arcotel: { enabled: false } } };
  requireDocumentAccess(reader, "clients/a/documents/a.xlsx", "read");
  assert.throws(() => requireDocumentAccess(reader, "clients/a/documents/a.xlsx", "write"), { status: 403 });
  assert.throws(() => requireDocumentAccess(reader, "arcotel/global/bdh/a.xlsx", "read"), { status: 403 });
  assert.throws(() => requireDocumentAccess({ ...reader, permissions: ["manage_clients"] }, "clients/a/documents/a.xlsx", "delete"), { status: 403 });
});
