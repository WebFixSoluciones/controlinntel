import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

for (const failOnPage of [1, 2]) {
  test(`document snapshot rejects failed page ${failOnPage} instead of reporting missing or partial files`, async () => {
    const source = fs.readFileSync(new URL("./operations.ts", import.meta.url), "utf8");
    const start = source.indexOf("export async function snapshot(");
    const end = source.indexOf("export async function save(", start);
    let reads = 0;
    const query: any = {
      orderBy: () => query, limit: () => query, startAfter: () => query,
      get: async () => {
        if (++reads === failOnPage) throw Error("Firestore unavailable");
        return { empty: false, size: 500, docs: Array.from({ length: 500 }, (_, i) => ({ id: String(i), data: () => ({ fileName: "document.pdf" }) })) };
      },
    };
    class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
    const context = {
      collectionPermissions: { arcotelFiles: "manage_policies" },
      canReadCollection: () => true, storageName: (x: string) => x,
      canUseSalesWorkspace: () => false, normalizedRole: (x: unknown) => x,
      canAccessModule: () => false, visibleServiceData: (_u: unknown, _e: unknown, x: unknown) => x,
      redact: (x: unknown) => x, HttpError, console: { warn: () => {} },
      fiscalCollections: new Set(),
    };
    const code = source.slice(start, end).replace("export async", "async") + "\nsnapshot;";
    const snapshot = vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context);
    await assert.rejects(snapshot({ uid: "advisor" }, { collection: () => query }), { status: 503 });
  });
}
