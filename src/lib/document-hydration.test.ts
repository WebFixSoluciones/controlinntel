import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual provider refresh callback without mounting the login UI.
// Removing a collection binding must reproduce documents disappearing on reload.
function providerRefresh(snapshot: Record<string, unknown>) {
  const source = fs.readFileSync(new URL("./state.tsx", import.meta.url), "utf8");
  const start = source.indexOf("  const refresh = useCallback(async () => {");
  const end = source.indexOf("  }, []);", start) + "  }, []);".length;
  assert.ok(start > 0 && end > start);
  const values: Record<string, unknown> = {};
  const context: Record<string, any> = {
    useCallback: (fn: unknown) => fn,
    snapshotGeneration: { current: 0 }, auth: { currentUser: { uid: "advisor" } },
    api: async () => snapshot,
    normalizeConcession: (row: unknown) => row,
  };
  for (const name of new Set(source.match(/\bset[A-Z]\w+/g))) context[name] = (value: unknown) => { values[name] = value; };
  for (const name of new Set(source.match(/\bINITIAL_\w+/g))) context[name] = [];
  const callback = ts.transpileModule(source.slice(start, end) + "\nrefresh;", { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return { refresh: vm.runInNewContext(callback, context), values };
}

function serverSnapshot() {
  // Empty unrelated collections are supplied by the server, as for a restricted role.
  return new Proxy<Record<string, unknown>>({}, { get: (target, name: string) => target[name] ?? [] });
}

test("reopening the application restores all saved ARCOTEL documents, including old and newly uploaded files", async () => {
  const data = serverSnapshot();
  data.arcotelFiles = [
    { id: "old", clientId: "client-a", subsystem: "sietel_tarifas", fileName: "octubre.xlsx" },
    { id: "new", clientId: "client-a", subsystem: "fodetel", fileName: "noviembre.pdf" },
    { id: "other", clientId: "client-b", subsystem: "sietel_tarifas", fileName: "otro.xlsx" },
  ];
  const { refresh, values } = providerRefresh(data);
  await refresh();
  assert.deepEqual(values.setArcotelFiles, data.arcotelFiles);
  await refresh();
  assert.deepEqual(values.setArcotelFiles, data.arcotelFiles);
});

test("reopening the application also restores general client documents and clears them when server denies access", async () => {
  const data = serverSnapshot();
  data.clientDocuments = [{ id: "contract", clientId: "client-a", fileName: "contrato.pdf" }];
  const { refresh, values } = providerRefresh(data);
  await refresh();
  assert.deepEqual(values.setClientDocuments, data.clientDocuments);
  data.clientDocuments = [];
  data.arcotelFiles = [];
  await refresh();
  assert.deepEqual(values.setClientDocuments, []);
  assert.deepEqual(values.setArcotelFiles, []);
});
