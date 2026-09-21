// Render the actual components with representative records, without a live database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
const clients = [{ id: "a", businessName: "Cliente Alfa", identificationNumber: "111" }, { id: "b", businessName: "Cliente Beta", identificationNumber: "222" }];
const state = {
  clients,
  clientContracts: [{ id: "c", clientId: "a", contractNumber: "CON-001", planName: "Fibra dedicada", arcotelHomologationCode: "H-1", signedDate: "2026-01-01", expirationDate: "2027-01-01", monthlyPrice: 20, status: "vigente" }],
  clientVaultItems: [{ id: "v1", clientId: "a", serviceName: "Router", username: "operator", notes: "Sucursal norte" }, { id: "v2", clientId: "a", serviceName: "WiFi", username: "wifi" }],
  vault: [],
  nodes: [{ id: "n", name: "Nodo único", clientIds: ["a"], address: "Quito", totalCapacityMbps: 100, usedCapacityMbps: 10, upstreamProvider: "ISP", status: "online" }],
  clientServices: [{ id: "s1", clientId: "a", nodeId: "n" }, { id: "s2", clientId: "a", nodeId: "n" }],
  tickets: [
    { id: "old", ticketNumber: "TCK-OLD", clientId: "a", clientName: "Cliente Alfa", title: "Anterior", description: "Solicitud inicial", createdAt: "2026-01-01T10:00:00Z", status: "abierto", priority: "media", messages: [{ id: "m", authorName: "Operador", body: "Respuesta guardada", createdAt: "2026-01-02T10:00:00Z" }] },
    { id: "new", ticketNumber: "TCK-NEW", clientId: "b", clientName: "Cliente Beta", title: "Reciente", createdAt: "2026-02-01T10:00:00Z", status: "cerrado", priority: "alta" }
  ]
};
function render(file, name, props = {}, seeds = []) {
  let index = 0;
  const mockedReact = { ...React, useState(initial) { const value = index < seeds.length ? seeds[index] : initial; index++; return [value, () => {}]; } };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", code)((id) => {
    if (id === "react") return mockedReact;
    if (id === "@/lib/state") return { useApp: () => state };
    if (id === "@/lib/toast-context") return { useToast: () => ({}) };
    if (id.startsWith(".") || id.startsWith("@/")) return new Proxy({}, { get: () => () => null });
    return require(id);
  }, mod, mod.exports);
  return renderToStaticMarkup(React.createElement(mod.exports[name], props));
}
let html = render("src/components/modules/clients/ContractsManager.tsx", "ContractsManager");
assert.match(html, /Cliente Alfa/); assert.match(html, /CON-001/); assert.doesNotMatch(html, /Aseguradora/);
html = render("src/components/modules/clients/ContractsManager.tsx", "ContractsManager", { clientId: "b" });
assert.doesNotMatch(html, /CON-001/);
html = render("src/components/modules/vault/VaultManager.tsx", "VaultManager");
assert.match(html, /Sucursal norte/); assert.match(html, />2<\/td>/); assert.match(html, />0<\/td>/);
html = render("src/components/modules/vault/SecureVault.tsx", "SecureVault", { clientId: "a" }, [{}, false, false, null, "Router", ""]);
assert.match(html, /Router/); assert.doesNotMatch(html, />WiFi</);
html = render("src/components/modules/network/ClientNodesManager.tsx", "ClientNodesManager");
assert.match(html, />1<\/td>/); assert.doesNotMatch(html, />2<\/td>/);
html = render("src/components/modules/tickets/TicketsBoard.tsx", "TicketsBoard", { onOpenNewModal() {} });
assert.ok(html.indexOf("TCK-NEW") < html.indexOf("TCK-OLD"));
html = render("src/components/modules/tickets/TicketDetail.tsx", "TicketDetail", { id: "old", onBack() {} });
assert.match(html, /Solicitud inicial/); assert.match(html, /Respuesta guardada/); assert.match(html, /Operador/);
console.log("OK: contratos por cliente, conteos, filtros de credenciales, nodos únicos, tickets recientes e historial.");

async function checkReplies() {
  const source = fs.readFileSync(path.join(root, "src/lib/state.tsx"), "utf8");
  const ast = ts.createSourceFile("state.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "replyToTicket") initializer = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(initializer);
  const compiled = ts.transpileModule("const reply = " + initializer, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  let records = [{ id: "t", messages: [] }];
  let writes = 0;
  let fail = false;
  let permitted = true;
  const reply = new Function("auth", "can", "currentUser", "tickets", "crypto", "updateDoc", "doc", "db", "arrayUnion", "setTickets", compiled + "; return reply;")(
    { currentUser: { uid: "u" } }, () => permitted, { displayName: "Operador" }, records,
    require("node:crypto"), async (ref, data) => { if (fail) throw Error("Offline"); writes++; assert.equal(data.messages.operation, "arrayUnion"); },
    () => "tickets/t", {}, message => ({ operation: "arrayUnion", message }), updater => { records = updater(records); }
  );
  await Promise.all([reply("t", "Primera"), reply("t", "Segunda")]);
  assert.equal(writes, 2); assert.equal(records[0].messages.length, 2);
  assert.equal(records[0].messages[0].authorId, "u");
  fail = true;
  await assert.rejects(reply("t", "No guardada"), /Offline/);
  assert.equal(records[0].messages.length, 2);
  fail = false; permitted = false;
  await assert.rejects(reply("t", "Sin permiso"), /permiso/);
  assert.equal(writes, 2);
  console.log("OK: respuestas simultáneas, autor, fallo de guardado y permiso de soporte.");
}
checkReplies().catch(error => { console.error(error); process.exitCode = 1; });
