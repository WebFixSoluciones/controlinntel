const fs = require("fs");
const ts = require("typescript");
const path = require("path");
const src = fs.readFileSync(path.join(process.cwd(), "src/lib/state.tsx"), "utf8");
const ast = ts.createSourceFile("state.tsx", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let code;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "emitRecurringInvoiceForClient") code = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
if (!code) throw Error("Function missing");
const compiled = ts.transpileModule("const emit = " + code, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText + "; return emit;";
const clients = [{ id: "qa", businessName: "PRUEBA CLIENTE", identificationNumber: "000", email: "qa@example.test", phone: "000", address: "QA", identificationType: "CEDULA" }];
let charges = [], invoices = [], services = [];
const make = () => new Function("clients", "clientServices", "createInvoice", "inventoryWarehouses", "setMonthlyCharges", "syncToFirestore", "getEcuadorDate", "addMonthsSafely", "updateClientService", compiled)(
 clients, services,
 async data => { const inv = { ...data, id: "invoice-" + (invoices.length + 1), documentNumber: "NV-00" + (invoices.length + 1) }; invoices.push(inv); return inv; },
 [], updater => { charges = updater(charges); }, async () => {}, () => "2026-10-26",
 (d, n) => `${d}+ ${n} months`, async (id, updates) => { Object.assign(services.find(s => s.id === id), updates); }
);
async function scenario(label, fixtures, year, month) {
  services = structuredClone(fixtures); charges = []; invoices = [];
  const invoke = make();
  const result = await invoke("qa", month, year);
  console.log(JSON.stringify({ scenario: label, items: result.items.map(i => ({name:i.name, price:i.unitPrice, rate:i.ivaRate, total:i.total})), total: result.total, notes:result.notes, advances:services.map(s=>({id:s.id,last:s.lastBilledPeriod,next:s.nextRenewalDate})) }));
  return invoke;
}
const base = { clientId:"qa", status:"activo", isBillableInCurrentCycle:true, planId:"svc", planName:"Internet QA", customPrice:100, basePrice:100, downloadMbps:100, uploadMbps:100, nextRenewalDate:"2026-10-01" };
(async () => {
  const emit = await scenario("cero-precio-iva-cero", [{...base,id:"zero",customPrice:0,ivaRate:0}], 2026, 10);
  await emit("qa",10,2026);
  console.log(JSON.stringify({scenario:"mismo-periodo-dos-veces", invoices:invoices.length, charges:charges.length}));
  await scenario("anual-vencimiento-2027-mes-2026", [{...base,id:"annual", billingFrequency:"anual", nextRenewalDate:"2027-10-01"}], 2026, 11);
  await scenario("prepago-postpago", [{...base,id:"pre",planName:"Prepago",billingType:"prepago"}, {...base,id:"post",planName:"Postpago",billingType:"postpago"}], 2026, 11);
  await scenario("trimestral", [{...base,id:"tri",billingFrequency:"trimestral"}], 2026, 10);
})().catch(e => { console.error(e); process.exitCode = 1; });
