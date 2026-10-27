const fs = require("fs"), ts = require("typescript"), path = require("path");
const src = fs.readFileSync(path.join(process.cwd(), "src/lib/state.tsx"), "utf8");
const ast = ts.createSourceFile("state.tsx", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let body;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "addPaymentToCharge") body = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
const compiled = ts.transpileModule("const processPayment = " + body, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText + "; return processPayment;";
(async () => {
  let charge = { id:"qa-charge", total:100, balanceRemaining:30, paidAmount:70, status:"parcial", clientId:"qa", clientName:"PRUEBA CLIENTE", invoiceNumber:"NV-QA", invoiceId:"invoice-qa", payments:[] };
  let client = { id:"qa", currentBalance:200 }, movement;
  const fn = new Function("monthlyCharges", "bankAccounts", "clients", "syncToFirestore", "setMonthlyCharges", "addFinancialMovement", "setClients", "addAuditLog", "getEcuadorDate", compiled)(
    [charge], [{id:"bank", bankName:"Banco QA"}], [client], async()=>{}, f => { [charge] = f([charge]); },
    async mov => { movement = mov; }, f => { [client] = f([client]); }, ()=>{}, ()=>"2026-10-26"
  );
  await fn("qa-charge",{amount:100,method:"transferencia",bankAccountId:"bank"});
  console.log(JSON.stringify({scenario:"pago-de-100-con-saldo-30", paid:charge.paidAmount, balance:charge.balanceRemaining, recordedPayment:charge.payments[0].amount, bankMovement:movement.amount, clientBalance:client.currentBalance}));
})().catch(e => {console.error(e);process.exitCode=1;});
