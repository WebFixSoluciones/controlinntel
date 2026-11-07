import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { executeCommercial, runScheduledRecurringBilling, type CommercialCommand } from "./commercial.ts";
import { schemas } from "./schemas.ts";
import { save } from "./operations.ts";
import { numberHistoricalTickets } from "./ticket-sequence.ts";
import { requiresPublicTicketReply } from "../ticket-status.ts";
import { expenseCategoriesWithDefaults } from "../expense-categories.ts";
import { collectionPermissions } from "../permissions.ts";
import { planSnapshotRecovery } from "../recovery-plan.ts";
import { planServicePeriod, calculateLines, scheduledServicePeriods, previewScheduledService, initialServicePeriod, serviceBillingStart } from "../commercial-core.ts";
import { activeReceivables, summarizeOperatingExpenses, summarizeReceivables, summarizeCash } from "../financial-summary.ts";
import type { Firestore } from "firebase-admin/firestore";
import type { UserProfile } from "@/types";

// Transactional adapter: runs the production command, stages writes, commits atomically.
// This is not evidence of deployed Firestore rules; emulator coverage is separate.
class Database {
  rows = new Map<string,any>(); tail=Promise.resolve(); failCommit=false;
  constructor(initial:Record<string,any[]>) {for(const [name,rows] of Object.entries(initial))for(const row of rows)this.rows.set(name+"/"+row.id,structuredClone(row));}
  doc(path:string):any {return {path,id:path.split("/").pop(),parent:{id:path.split("/")[0]}};}
  collection(name:string):any {const query=(field?:string,value?:unknown):any=>({name,field,value,doc:(id:string)=>this.doc(name+"/"+id),where:(f:string,_op:string,v:unknown)=>query(f,v),select:()=>query(field,value),
    get:async()=>({docs:this.list(name).filter(row=>!field||row[field]===value).map(row=>({get:(key:string)=>row[key]}))})});return query();}
  async runTransaction(fn:(tx:any)=>Promise<any>) {
    let release!:()=>void;const prior=this.tail;this.tail=new Promise<void>(r=>release=r);await prior;
    const pending=new Map<string,any>();
    const snap=(path:string)=>({id:path.split("/").pop(),ref:this.doc(path),exists:this.rows.has(path),data:()=>structuredClone(this.rows.get(path))});
    const tx={get:async(ref:any)=>ref.path?snap(ref.path):{docs:[...this.rows].filter(([key,row])=>key.startsWith(ref.name+"/")&&(!ref.field||row[ref.field]===ref.value)).map(([key])=>snap(key))},getAll:async(...refs:any[])=>refs.map(ref=>snap(ref.path)),set:(ref:any,row:any)=>pending.set(ref.path,structuredClone(row)),update:(ref:any,row:any)=>pending.set(ref.path,{...structuredClone(this.rows.get(ref.path)),...structuredClone(row)}),create:(ref:any,row:any)=>{if(this.rows.has(ref.path))throw Error("Already exists");pending.set(ref.path,structuredClone(row));}};
    try {const result=await fn(tx);if(this.failCommit)throw Error("Injected commit failure");pending.forEach((row,key)=>this.rows.set(key,row));return result;} finally{release();}
  }
  list(name:string){return [...this.rows].filter(([key])=>key.startsWith(name+"/")).map(([,row])=>row);}
  row(name:string,id:string){return this.rows.get(name+"/"+id);}
}
const user:UserProfile={uid:"qa",email:"qa@example.test",displayName:"QA",role:"superadmin",status:"activo",permissions:["all"]};
const initial=()=>({clients:[{id:"a",businessName:"PRUEBA CLIENTE",identificationType:"PASAPORTE",identificationNumber:"QA-00001",status:"activo",currentBalance:0},{id:"b",businessName:"PRUEBA CLIENTE B",identificationNumber:"QA-00002",status:"activo",currentBalance:0}],inventoryProducts:[{id:"srv",name:"Servicio QA",sku:"QA",type:"servicio",salePrice:100,ivaRate:15,stock:0,tracksStock:false,status:"activo"}],bankAccounts:[{id:"bank",bankName:"Banco QA",currentBalance:1000,initialBalance:1000,status:"activa"},{id:"bank2",bankName:"Banco QA 2",currentBalance:0,initialBalance:0,status:"activa"}],suppliers:[{id:"supplier",razonSocial:"PROVEEDOR QA",ruc:"QA-111",status:"activo"}]});
const run=(db:Database,action:CommercialCommand["action"],data:Record<string,any>,operationId=randomUUID())=>executeCommercial(user,{action,data,operationId},db as unknown as Firestore);
const sale=(clientId="a",extra={})=>({clientId,documentType:"nota_venta",status:"registrado",date:"2026-10-01",items:[{id:"line",productId:"srv",name:"Servicio QA",quantity:1,unitPrice:100,ivaRate:15,discount:0}],paymentMethod:"credito",...extra});

test("El gasto vincula al proveedor, conserva la referencia y usa solo categorías activas", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-06T17:00:00Z") });
  const db = new Database({ ...initial(), suppliers: [{ id: "supplier-qa", razonSocial: "Proveedor guardado", ruc: "1700000000001", status: "activo" }] });
  const firestore = db as unknown as Firestore;
  await save(user, "expenseCategories", { name: "Movilización", active: true }, "travel", undefined, firestore);
  const expense = await run(db, "expense", { supplierId: "supplier-qa", supplierName: "Texto no canónico", expenseDate: "2026-11-06",
    description: "Visita técnica", invoiceNumber: "REF-12", category: "travel", amount: 30, bankAccountId: "bank", paymentMethod: "transferencia" });
  assert.equal(expense.supplierName, "Proveedor guardado");
  assert.equal(expense.supplierRuc, "1700000000001");
  assert.equal(db.row("financialMovements", expense.movementId).referenceNumber, "REF-12");
  await save(user, "expenseCategories", { name: "Movilización técnica", active: false }, "travel", undefined, firestore);
  assert.equal(expenseCategoriesWithDefaults(db.list("expenseCategories")).find(item => item.id === "travel")?.name, "Movilización técnica");
  assert.equal(db.row("expenses", expense.id).category, "travel");
  await assert.rejects(run(db, "expense", { ...expense, amount: 5 }), /categoría de gasto activa/);
  assert.equal(db.list("financialMovements").length, 1);
});

test("Numeración de soporte asigna TK correlativos sin cambiar las referencias del historial", async () => {
  const ticket = { clientId: "a", title: "Ticket QA", description: "Incidencia de prueba", status: "abierto", priority: "media", department: "soporte_tecnico" };
  const database = new Database({ ...initial(), tickets: [
    { ...ticket, id: "old-2", ticketNumber: "TCK-old-2", createdAt: "2026-11-05T10:00:00Z", messages: [{ id: "m" }] },
    { ...ticket, id: "old-1", ticketNumber: "TCK-old-1", createdAt: "2026-11-05T09:00:00Z" },
  ] });
  const db = database as unknown as Firestore;
  assert.deepEqual(await numberHistoricalTickets(db, user), { updated: 2, remaining: 0 });
  assert.deepEqual(await numberHistoricalTickets(db, user), { updated: 0, remaining: 0 });
  assert.equal(database.row("tickets", "old-1").ticketNumber, "TK-001");
  assert.equal(database.row("tickets", "old-2").previousTicketNumber, "TCK-old-2");
  assert.equal(database.row("tickets", "old-2").messages[0].id, "m");
  const created = await Promise.all(["new-1", "new-2"].map(id => save(user, "tickets", { ...ticket, ticketNumber: "TK-001" }, id, undefined, db)));
  assert.deepEqual(created.map(row => row.ticketNumber).sort(), ["TK-003", "TK-004"]);
  await assert.rejects(save(user, "tickets", { status: "resuelto", messages: [{ body: "Falsa", isInternal: false }] }, "new-1", undefined, db), /formulario de respuesta/);
  assert.equal(requiresPublicTicketReply("abierto", "resuelto", { body: " ", isInternal: false }), true);
  assert.equal(requiresPublicTicketReply("abierto", "resuelto", { body: "Nota", isInternal: true }), true);
  assert.equal(requiresPublicTicketReply("abierto", "resuelto", { body: "Respuesta al cliente", isInternal: false }), false);
});

test("Los departamentos de soporte se archivan conservando los tickets y sus permisos de gestión", async () => {
  const database = new Database(initial());
  const db = database as unknown as Firestore;
  const technician: UserProfile = { ...user, role: "tecnico", permissions: ["manage_tickets"] };
  await assert.rejects(save(technician, "ticketDepartments", { name: "Red", active: true }, "dept-red", undefined, db), /administrar departamentos/);
  await save(user, "ticketDepartments", { name: "Red", active: true }, "dept-red", undefined, db);
  const ticket = { clientId: "a", title: "Ticket QA", description: "Incidencia de prueba", status: "abierto", priority: "media", department: "dept-red" };
  await save(technician, "tickets", ticket, "first", undefined, db);
  await save(user, "ticketDepartments", { active: false }, "dept-red", undefined, db);
  await assert.rejects(save(technician, "tickets", ticket, "second", undefined, db), /departamento de soporte activo/);
  await save(technician, "tickets", { priority: "alta" }, "first", undefined, db);
  assert.equal(database.row("tickets", "first").department, "dept-red");
});

test("catalog creation persists the chosen category, product type and initial stock atomically", async () => {
  const db = new Database({ ...initial(), inventoryCategories: [
    { id: "equipment", name: "Equipos QA", itemType: "producto" }, { id: "technical", name: "Servicios QA", itemType: "servicio" },
  ], inventoryWarehouses: [{ id: "warehouse", name: "Bodega QA", status: "activo" }] });
  const product = await run(db, "createProduct", { name: "Producto QA", sku: "PRD-QA", type: "producto", categoryId: "equipment", categoryName: "Nombre no canónico",
    unit: "unidad", salePrice: 50, baseCost: 0, ivaRate: 15, tracksStock: true, stockByWarehouse: { warehouse: 3 }, status: "activo" });
  const saved = db.row("inventoryProducts", product.id);
  assert.equal(saved.type, "producto"); assert.equal(saved.categoryId, "equipment"); assert.equal(saved.categoryName, "Equipos QA");
  assert.equal(saved.stock, 3); assert.equal(saved.stockByWarehouse.warehouse, 3); assert.equal(saved.baseCost, 0);
  assert.equal(db.list("inventoryKardex").length, 1); assert.equal(db.list("inventoryKardex")[0].entryQuantity, 3);
  assert.equal(db.list("operationLog").length, 1);
});

test("service and untracked product preserve distinct types without creating stock movements", async () => {
  const db = new Database({ ...initial(), inventoryCategories: [{ id: "technical", name: "Servicios QA", itemType: "servicio" }, { id: "both", name: "General QA", itemType: "ambos" }] });
  const service = await run(db, "createProduct", { name: "Servicio QA nuevo", sku: "SRV-NEW", type: "servicio", categoryId: "technical", unit: "servicio",
    salePrice: 20, baseCost: 0, ivaRate: 0, tracksStock: false, stockByWarehouse: {}, status: "activo" });
  const product = await run(db, "createProduct", { name: "Producto sin control", sku: "PRD-UNTRACKED", type: "producto", categoryId: "both", unit: "unidad",
    salePrice: 30, baseCost: 0, ivaRate: 0, tracksStock: false, stockByWarehouse: {}, status: "activo" });
  assert.equal(db.row("inventoryProducts", service.id).type, "servicio"); assert.equal(db.row("inventoryProducts", service.id).categoryId, "technical");
  assert.equal(db.row("inventoryProducts", service.id).stock, 0); assert.equal(db.row("inventoryProducts", service.id).unit, "servicio");
  assert.equal(db.row("inventoryProducts", product.id).type, "producto"); assert.equal(db.row("inventoryProducts", product.id).categoryId, "both");
  assert.equal(db.list("inventoryKardex").length, 0);
});

test("incompatible category fails without catalog records, stock or operation log writes", async () => {
  const db = new Database({ ...initial(), inventoryCategories: [{ id: "equipment", name: "Equipos QA", itemType: "producto" }] });
  const before = JSON.stringify([...db.rows]);
  await assert.rejects(run(db, "createProduct", { name: "Servicio incompatible", sku: "SRV-INVALID", type: "servicio", categoryId: "equipment", salePrice: 20, baseCost: 0, ivaRate: 0, tracksStock: false }), /Categoría incompatible/);
  assert.equal(JSON.stringify([...db.rows]), before);
});

test("R03: every registered operational collection has a persistence schema; operationLog is read-only",()=>{
  const names=Object.keys(collectionPermissions);assert.ok(names.length>=47);
  for(const name of names.filter(n=>n!=="operationLog"))assert.ok(schemas[name],`Missing schema: ${name}`);
  assert.ok(schemas.suppliers.safeParse({ruc:"1790000000001",razonSocial:"QA",email:"",status:"activo"}).success);
  assert.ok(schemas.purchaseInvoices.safeParse({supplierId:"s",documentNumber:"QA",date:"2026-10-01",total:115,paymentStatus:"pendiente"}).success);
  assert.ok(schemas.inventoryProducts.safeParse({name:"QA",sku:"QA",stock:0,salePrice:0}).success);
});
test("R08/R09/R11: concurrent emission uses unique series, one debt each, and no implicit subscriptions",async()=>{
  const db=new Database(initial());
  const invoices=await Promise.all([run(db,"issueSale",sale()),run(db,"issueSale",sale("b"))]);
  assert.equal(new Set(invoices.map(i=>i.documentNumber)).size,2);assert.equal(db.list("monthlyCharges").length,2);assert.equal(db.list("clientServices").length,0);
  assert.equal(db.row("clients","a").currentBalance,115);assert.equal(db.list("operationLog").length,2);
});
test("R04: a lost response retried with the same operation returns the committed result",async()=>{
  const db=new Database(initial()), operation=randomUUID();const first=await run(db,"issueSale",sale(),operation),retry=await run(db,"issueSale",sale(),operation);
  assert.equal(first.id,retry.id);assert.equal(db.list("billingInvoices").length,1);
  await assert.rejects(run(db,"issueSale",sale("b"),operation),/otros datos/);
});
test("R12/R14: partial payment and cancellation preserve cash, release credit, and isolate another client",async()=>{
  const db=new Database(initial());const a=await run(db,"issueSale",sale()), b=await run(db,"issueSale",sale("b"));
  await run(db,"payCharge",{chargeId:`chg-inv-${a.id}`,amount:50,method:"efectivo",bankAccountId:"bank"});
  assert.equal(db.row("clients","a").currentBalance,65);assert.equal(db.row("bankAccounts","bank").currentBalance,1050);
  await run(db,"cancelSale",{id:a.id});
  assert.equal(db.row("clients","a").currentBalance,0);assert.equal(db.row("clients","b").currentBalance,115);
  assert.equal(db.row("monthlyCharges",`chg-inv-${b.id}`).status,"pendiente");assert.equal(db.row("bankAccounts","bank").currentBalance,1050);
  assert.equal(db.list("clientAdvances")[0].remaining,50);
});
test("R12: overpayment fails without changing debt, bank, or operationLog",async()=>{
  const db=new Database(initial()), invoice=await run(db,"issueSale",sale());const before=JSON.stringify([...db.rows]);
  await assert.rejects(run(db,"payCharge",{chargeId:`chg-inv-${invoice.id}`,amount:200,bankAccountId:"bank"}),/excede/);
  assert.equal(JSON.stringify([...db.rows]),before);
});

test("the server rejects sales for retired customers without recording debt or advancing the sequence", async () => {
  const seed = initial(); seed.clients[0].status = "retirado";
  const db = new Database(seed), before = JSON.stringify([...db.rows]);
  await assert.rejects(run(db, "issueSale", sale()), /Cliente retirado/);
  assert.equal(JSON.stringify([...db.rows]), before);
});
test("R13: an advance is received once, applied once, and cannot cross clients",async()=>{
  const db=new Database(initial()),invoice=await run(db,"issueSale",sale()), advance=await run(db,"advance",{clientId:"a",amount:300,bankAccountId:"bank",method:"efectivo"});
  await run(db,"applyAdvance",{advanceId:advance.id,chargeId:`chg-inv-${invoice.id}`,amount:115});
  assert.equal(db.row("bankAccounts","bank").currentBalance,1300);assert.equal(db.row("clientAdvances",advance.id).remaining,185);assert.equal(db.list("financialMovements").length,1);
  const other=await run(db,"issueSale",sale("b"));await assert.rejects(run(db,"applyAdvance",{advanceId:advance.id,chargeId:`chg-inv-${other.id}`,amount:100}),/otro cliente/);
});

test("advance reversal restores debt and available credit atomically without receiving cash twice", async () => {
  const db = new Database(initial());
  const invoice = await run(db, "issueSale", sale("a", { items: [{ productId: "srv", name: "Servicio QA", quantity: 1, unitPrice: 150, ivaRate: 0 }] }));
  const chargeId = `chg-inv-${invoice.id}`;
  const advance = await run(db, "advance", { clientId: "a", amount: 575, bankAccountId: "bank", method: "transferencia" });
  const payment = await run(db, "applyAdvance", { advanceId: advance.id, chargeId, amount: 100 });
  assert.equal(db.row("clientAdvances", advance.id).remaining, 475);
  assert.equal(db.row("monthlyCharges", chargeId).balanceRemaining, 50);
  const before = JSON.stringify([...db.rows]);
  db.failCommit = true;
  await assert.rejects(run(db, "reverseApplication", { chargeId, paymentId: payment.id }), /Injected/);
  assert.equal(JSON.stringify([...db.rows]), before);
  db.failCommit = false;
  await run(db, "reverseApplication", { chargeId, paymentId: payment.id });
  assert.equal(db.row("monthlyCharges", chargeId).paidAmount, 0);
  assert.equal(db.row("monthlyCharges", chargeId).balanceRemaining, 150);
  assert.equal(db.row("monthlyCharges", chargeId).status, "pendiente");
  assert.equal(db.row("clients", "a").currentBalance, 150);
  assert.equal(db.row("clientAdvances", advance.id).remaining, 575);
  assert.equal(db.row("clientAdvances", advance.id).status, "vigente");
  assert.equal(db.row("paymentApplications", payment.id).status, "reversed");
  await run(db, "reverseApplication", { chargeId, paymentId: payment.id });
  assert.equal(db.row("clientAdvances", advance.id).remaining, 575);
  assert.equal(db.row("bankAccounts", "bank").currentBalance, 1575);
  assert.equal(db.list("financialMovements").length, 1);
});

test("refunding unused advance preserves its already applied payment and can be retried safely", async () => {
  const db = new Database(initial()), invoice = await run(db, "issueSale", sale());
  const advance = await run(db, "advance", { clientId: "a", amount: 575, bankAccountId: "bank", method: "transferencia" });
  await run(db, "applyAdvance", { advanceId: advance.id, chargeId: `chg-inv-${invoice.id}`, amount: 100 });
  const operation = randomUUID();
  await run(db, "cancelAdvance", { id: advance.id }, operation);
  await run(db, "cancelAdvance", { id: advance.id }, operation);
  assert.equal(db.row("clientAdvances", advance.id).refundedAmount, 475);
  assert.equal(db.row("clientAdvances", advance.id).remaining, 0);
  assert.equal(db.row("monthlyCharges", `chg-inv-${invoice.id}`).paidAmount, 100);
  assert.equal(db.row("clients", "a").currentBalance, 15);
  assert.equal(db.row("bankAccounts", "bank").currentBalance, 1100);
});

test("reports remove a cancelled paid sale from collections, retain its credit, and reflect the subsequent refund", async () => {
  const db = new Database(initial());
  const first = await run(db, "issueSale", sale("a", { items: [{ productId: "srv", name: "Servicio QA", quantity: 1, unitPrice: 500, ivaRate: 15 }] }));
  await run(db, "payCharge", { chargeId: `chg-inv-${first.id}`, amount: 575, bankAccountId: "bank" });
  const second = await run(db, "issueSale", sale("a", { items: [{ productId: "srv", name: "Servicio QA", quantity: 1, unitPrice: 150, ivaRate: 0 }] }));
  await run(db, "payCharge", { chargeId: `chg-inv-${second.id}`, amount: 100, bankAccountId: "bank" });
  assert.equal(summarizeReceivables(db.list("monthlyCharges")).totalRecaudado, 675);
  await run(db, "cancelSale", { id: first.id });
  const report = summarizeReceivables(db.list("monthlyCharges"));
  assert.equal(report.totalRecaudado, 100); assert.equal(report.totalFacturado, 150);
  assert.equal(report.totalPendiente, 50); assert.equal(report.pendientesCount, 1);
  assert.equal(report.pagadosCount, 0); assert.equal(report.anuladosCount, 1);
  assert.deepEqual(activeReceivables(db.list("monthlyCharges")).map(charge => charge.invoiceId), [second.id]);
  assert.equal(summarizeCash(db.list("financialMovements")).saldoNeto, 675);
  const credit = db.list("clientAdvances")[0];
  assert.equal(credit.remaining, 575);
  await run(db, "cancelAdvance", { id: credit.id });
  assert.equal(db.row("clientAdvances", credit.id).status, "anulado");
  assert.deepEqual(summarizeCash(db.list("financialMovements")), { totalIngresos: 675, totalEgresos: 575, devoluciones: 575, saldoNeto: 100 });
  assert.deepEqual(summarizeOperatingExpenses(db.list("expenses")), { total: 0, byCategory: {} });
  assert.equal(summarizeReceivables(db.list("monthlyCharges")).totalRecaudado, 100);
  assert.equal(db.row("monthlyCharges", `chg-inv-${second.id}`).paidAmount, 100);
  await run(db, "expense", { supplierName: "Proveedor QA", expenseDate: "2026-11-06", description: "Mantenimiento",
    category: "mantenimiento", amount: 20.25, bankAccountId: "bank", paymentMethod: "transferencia" });
  assert.deepEqual(summarizeOperatingExpenses(db.list("expenses")), { total: 20.25, byCategory: { mantenimiento: 20.25 } });
  assert.equal(summarizeCash(db.list("financialMovements")).totalEgresos, 595.25);
});
test("R17: transfer commits both legs, and an injected commit failure commits neither",async()=>{
  const db=new Database(initial());db.failCommit=true;await assert.rejects(run(db,"transfer",{fromId:"bank",toId:"bank2",amount:100}),/Injected/);
  assert.equal(db.row("bankAccounts","bank").currentBalance,1000);assert.equal(db.list("financialMovements").length,0);
  db.failCommit=false;await run(db,"transfer",{fromId:"bank",toId:"bank2",amount:100});assert.equal(db.row("bankAccounts","bank").currentBalance,900);assert.equal(db.row("bankAccounts","bank2").currentBalance,100);
});
test("R07/R08: pre/post periods, long frequencies, zero tariffs and duplicate billing",async()=>{
  const service={id:"svc",clientId:"a",planId:"srv",inventoryProductId:"srv",planName:"QA",status:"activo",contractStartDate:"2026-01-01",billingFrequency:"mensual",customPrice:100,ivaRate:15,billingType:"prepago",cycleAnchor:"calendario"};
  const pre=planServicePeriod(service,10,2026,"2026-10-27"),post=planServicePeriod({...service,billingType:"postpago"},10,2026,"2026-10-27");
  assert.equal(pre.eligible,true);assert.equal(post.eligible,false);assert.equal(planServicePeriod({...service,billingFrequency:"anual"},10,2026,"2026-10-27").eligible,false);
  const db=new Database({...initial(),clientServices:[service]});await run(db,"recur",{clientId:"a",serviceIds:["svc"],month:10,year:2026,expectedTotal:115});
  await assert.rejects(run(db,"recur",{clientId:"a",serviceIds:["svc"],month:10,year:2026,expectedTotal:115}),/ya fue emitido/);
  assert.equal(db.list("clientServices").length,1);assert.equal(db.list("monthlyCharges").length,1);
});
test("R18/R19: purchase, partial supplier payment, and stock valuation reconcile",async()=>{
  const db=new Database({...initial(),inventoryProducts:[{id:"p",name:"Router",sku:"P",type:"producto",stock:10,stockByWarehouse:{wh:10},baseCost:50,tracksStock:true,status:"activo"}],inventoryWarehouses:[{id:"wh",name:"QA"}]});
  const invoice=await run(db,"purchase",{supplierId:"supplier",documentNumber:"QA-1",date:"2026-10-01",paymentCondition:"credito",paidAmount:100,bankAccountId:"bank",items:[{productId:"p",name:"Router",warehouseId:"wh",quantity:5,unitCost:40,ivaRate:15,discount:0}]});
  assert.equal(invoice.total,230);assert.equal(invoice.balanceRemaining,130);assert.equal(db.row("bankAccounts","bank").currentBalance,900);assert.equal(db.row("inventoryProducts","p").stock,15);assert.ok(Math.abs(db.row("inventoryProducts","p").baseCost-46.6666667)<0.00001);
});
test("R26: missing legacy data is proposed for import, conflicting existing data is never overwritten",()=>{
  const snapshot={inventoryCategories:[{id:"cat",name:"Servicios"}],clients:[{id:"a",identificationType:"PASAPORTE",identificationNumber:"QA-00001",businessName:"PRUEBA CLIENTE",email:"qa@example.test",phone:"0990000000",address:"QA",status:"activo"}]};
  const plan=planSnapshotRecovery(snapshot,{clients:[{...snapshot.clients[0],businessName:"Nombre persistido"}]});
  assert.equal(plan.find(p=>p.id==="cat")?.state,"missing");assert.equal(plan.find(p=>p.id==="a")?.state,"conflict");
});
test("R05: one calculation preserves zero and supports mixed configured tax rates",()=>{
  const sum=calculateLines([{quantity:1,unitPrice:50,ivaRate:15},{quantity:2,unitPrice:10,ivaRate:0},{quantity:1,unitPrice:0,ivaRate:0}]);
  assert.equal(sum.total,77.5);assert.equal(sum.ivaTotal,7.5);assert.equal(sum.items[2].unitPrice,0);
});

const servicePayload=(extra={})=>({clientId:"a",inventoryProductId:"srv",planId:"srv",planName:"Servicio QA",
  customPrice:100,ivaRate:15,billingType:"prepago",billingFrequency:"mensual",cycleAnchor:"calendario",
  contractStartDate:"2026-11-01",billingDay:1,advanceNoticeDay:26,status:"activo",...extra});

const runSchedule = (db: Database, date: string) => runScheduledRecurringBilling(db as unknown as Firestore, date);

test("El inicio de período es independiente del contrato y la modalidad cambia la exigibilidad", () => {
  const service = { id: "separate-dates", ...servicePayload({ contractStartDate: "2026-11-01", billingPeriodStartDate: "2026-12-07", cycleAnchor: "aniversario" }) };
  const prepaid = initialServicePeriod(service);
  assert.ok(prepaid.eligible);
  assert.equal(prepaid.billingStart, "2026-12-07");
  assert.equal(prepaid.periodEnd, "2027-01-07");
  assert.equal(prepaid.issueDate, "2026-12-07");
  assert.equal(prepaid.line.description, "Período del 07/12/2026 al 06/01/2027 (PREPAGO)");
  const postpaid = initialServicePeriod({ ...service, billingType: "pospago" });
  assert.ok(postpaid.eligible);
  assert.equal(postpaid.periodEnd, prepaid.periodEnd);
  assert.equal(postpaid.issueDate, "2027-01-07");
  assert.equal(planServicePeriod(service, 12, 2026, "2026-12-06").eligible, false);
  assert.equal(planServicePeriod(service, 12, 2026, "2026-12-07").eligible, true);
  for (const [frequency, end] of [["trimestral", "2027-03-07"], ["semestral", "2027-06-07"], ["anual", "2027-12-07"]]) {
    const period = initialServicePeriod({ ...service, billingFrequency: frequency });
    assert.ok(period.eligible);
    assert.equal(period.periodEnd, end);
  }
  const calendar = initialServicePeriod({ ...service, cycleAnchor: "calendario", firstPeriodPolicy: "prorrateo" });
  assert.ok(calendar.eligible);
  assert.equal(calendar.billingStart, "2026-12-07");
  assert.equal(calendar.periodEnd, "2027-01-01");
  assert.equal(calendar.line.unitPrice, 80.65);
  assert.equal(initialServicePeriod({ ...service, billingPeriodStartDate: "2026-10-31" }).eligible, false);
  assert.equal(initialServicePeriod({ ...service, contractEndDate: "2026-12-31" }).eligible, false);
  assert.equal(initialServicePeriod({ ...service, billingPeriodStartDate: "2026-02-30" }).eligible, false);
});

test("La fecha elegida persiste y la corrida emite el mismo período de la vista previa", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-07T17:00:00Z") });
  const db = new Database(initial());
  const assigned = await run(db, "assignService", servicePayload({ billingPeriodStartDate: "2026-12-07", cycleAnchor: "aniversario" }));
  assert.equal(assigned.contractStartDate, "2026-11-01");
  assert.equal(assigned.billingPeriodStartDate, "2026-12-07");
  assert.equal(assigned.nextRenewalDate, "2027-01-07");
  assert.equal(db.list("billingInvoices").length, 0);
  assert.equal((await runSchedule(db, "2026-12-01")).issued, 0);
  const preview = previewScheduledService(assigned, "2026-11-07");
  assert.equal(preview.emissionDate, "2027-01-01");
  assert.equal((await runSchedule(db, "2027-01-01")).issued, 1);
  const invoice = db.list("billingInvoices")[0];
  assert.equal(invoice.items[0].description, preview.plans?.[0].line.description);
  assert.equal(invoice.items[0].periodStart, "2026-12-07");
  assert.equal(invoice.total, 115);
  assert.equal((await runSchedule(db, "2027-01-01")).issued, 0);
  await assert.rejects(run(db, "editService", { id: assigned.id, billingPeriodStartDate: "2026-12-20" }), /se cruza/);
  await run(db, "editService", { id: assigned.id, billingPeriodStartDate: "2027-01-07" });
  assert.equal(db.row("clientServices", assigned.id).billingPeriodStartDate, "2027-01-07");
  await assert.rejects(run(db, "assignService", servicePayload({ billingPeriodStartDate: "2026-10-31" })), /vigencia/);
  await assert.rejects(run(db, "assignService", servicePayload({ billingPeriodStartDate: "" })));
});

test("Los servicios anteriores conservan su origen de facturación al editar el contrato", async () => {
  const old = { id: "legacy-origin", ...servicePayload({ installationDate: "2026-11-01" }) };
  assert.equal(serviceBillingStart(old), "2026-11-01");
  assert.deepEqual(initialServicePeriod(old), initialServicePeriod({ ...old, billingPeriodStartDate: "2026-11-01" }));
  const db = new Database({ ...initial(), clientServices: [old] });
  await run(db, "editService", { id: old.id, contractStartDate: "2026-10-01", planName: "Nombre actualizado" });
  assert.equal(db.row("clientServices", old.id).billingPeriodStartDate, "2026-11-01");
  await run(db, "editService", { id: old.id, nextRenewalDate: "2027-02-01" });
  assert.equal(db.row("clientServices", old.id).nextRenewalDate, "2027-02-01");
  assert.equal(db.row("clientServices", old.id).billingPeriodStartDate, "2026-11-01");
});

test("El alta del cliente y del servicio no genera nota, cartera ni reserva de secuencial", async () => {
  const db = new Database(initial());
  const client = await run(db, "createClient", {
    client: { businessName: "CLIENTE QA NUEVO", identificationType: "PASAPORTE", identificationNumber: "NEW-QA-01",
      email: "qa@example.test", phone: "0990000000", address: "Quito", status: "activo" },
    service: servicePayload({ emitFirstInvoice: true }),
  });
  const assigned = db.list("clientServices").find(row => row.clientId === client.id);
  assert.equal(client.totalActiveServices, 1);
  assert.equal(client.currentBalance, 0);
  assert.equal(assigned.saleStatus, "pendiente_venta");
  assert.equal(assigned.emitFirstInvoice, undefined);
  await run(db, "editService", { id: assigned.id, customPrice: 120 });
  for (const collection of ["billingInvoices", "monthlyCharges", "billingPeriods", "sequences", "documentNumbers"]) {
    assert.equal(db.list(collection).length, 0, collection);
  }
});

test("La corrida del día 1 distingue prepago, pospago, servicios excluidos y reintentos", async () => {
  const db = new Database(initial());
  const prepaid = await run(db, "assignService", servicePayload({ paymentMethod: "efectivo" }));
  const postpaid = await run(db, "assignService", servicePayload({ clientId: "b", billingType: "pospago" }));
  await run(db, "assignService", servicePayload({ isBillableInCurrentCycle: false }));
  assert.equal((await runSchedule(db, "2026-11-05")).issued, 0);
  const results = await Promise.all([runSchedule(db, "2026-11-01"), runSchedule(db, "2026-11-01")]);
  assert.equal(results.reduce((sum, result) => sum + result.issued, 0), 1);
  assert.deepEqual(results.flatMap(result => result.failures), []);
  const first = db.list("billingInvoices")[0];
  assert.equal(first.date, "2026-11-01");
  assert.equal(first.total, 115);
  assert.equal(first.items[0].serviceId, prepaid.id);
  const charge = db.row("monthlyCharges", `chg-inv-${first.id}`);
  assert.equal(charge.expectedPaymentMethod, "efectivo");
  assert.equal(charge.paidAmount, 0);
  assert.equal(charge.balanceRemaining, 115);
  assert.equal(db.list("financialMovements").length, 0);
  assert.equal(db.row("clients", "a").currentBalance, 115);
  assert.equal(db.row("clientServices", prepaid.id).nextRenewalDate, "2026-12-01");
  assert.equal((await runSchedule(db, "2026-12-01")).issued, 2);
  const postpaidNote = db.list("billingInvoices").find(invoice => invoice.clientId === "b");
  assert.equal(postpaidNote.date, "2026-12-01");
  assert.equal(postpaidNote.items[0].serviceId, postpaid.id);
  assert.equal(postpaidNote.items[0].periodStart, "2026-11-01");
});

test("Los ciclos aniversario se programan para el primer día disponible y conservan el período anual pospago", () => {
  const service = { id: "anniversary", ...servicePayload({ contractStartDate: "2026-11-05", cycleAnchor: "aniversario" }) };
  assert.deepEqual(scheduledServicePeriods(service, "2026-11-01"), []);
  assert.deepEqual(scheduledServicePeriods(service, "2026-12-01").map(plan => plan.periodStart), ["2026-11-05"]);
  const annual = { ...service, billingType: "pospago", billingFrequency: "anual" };
  assert.deepEqual(scheduledServicePeriods(annual, "2027-11-01"), []);
  assert.deepEqual(scheduledServicePeriods(annual, "2027-12-01").map(plan => plan.periodStart), ["2026-11-05"]);
  const newAfterRun = { ...service, contractStartDate: "2026-11-01", createdAt: "2026-11-01T15:00:00Z" };
  assert.deepEqual(scheduledServicePeriods(newAfterRun, "2026-12-01").map(plan => plan.periodStart), ["2026-11-01", "2026-12-01"]);
});

test("La vista previa comparte fechas, descripción y cálculo con la emisión programada", () => {
  const service = { id: "qa", ...servicePayload({ contractStartDate: "2026-11-05", cycleAnchor: "aniversario", createdAt: "2026-11-05T18:00:00Z" }) };
  const prepaid = previewScheduledService(service, "2026-11-06");
  assert.equal(prepaid.emissionDate, "2026-12-01");
  assert.equal(prepaid.dueDate, "2026-12-01");
  assert.equal(prepaid.plans?.[0].line.description, "Período del 05/11/2026 al 04/12/2026 (PREPAGO)");
  assert.deepEqual(prepaid.plans, scheduledServicePeriods(service, "2026-12-01"));

  const postpaid = previewScheduledService({ ...service, billingType: "pospago" }, "2026-11-06");
  assert.equal(postpaid.emissionDate, "2027-01-01");
  assert.equal(postpaid.plans?.[0].line.description, "Período del 05/11/2026 al 04/12/2026 (POSPAGO)");

  const calendar = previewScheduledService({ ...service, cycleAnchor: "calendario", firstPeriodPolicy: "prorrateo" }, "2026-11-06");
  assert.equal(calendar.plans?.[0].line.description, "Período del 05/11/2026 al 30/11/2026 (PREPAGO)");
  assert.equal(calendar.plans?.[0].line.unitPrice, 86.67);
  assert.equal(previewScheduledService({ ...service, contractEndDate: "2026-11-09" }, "2026-11-06").reason, "El ciclo excede el contrato; requiere ajuste o renovación.");
});

test("Editar un servicio conserva su nombre elegido y permite quitar la vigencia al pasar a indefinido", async () => {
  const db = new Database(initial());
  const service = await run(db, "assignService", servicePayload({ planName: "Servicio acordado", contractEndDate: "2027-10-31" }));
  assert.equal(db.row("clientServices", service.id).planName, "Servicio acordado");
  await run(db, "editService", { id: service.id, planName: "Servicio actualizado", contractDuration: "indefinido", contractEndDate: "", paymentMethod: "transferencia" });
  const edited = db.row("clientServices", service.id);
  assert.equal(edited.planName, "Servicio actualizado");
  assert.equal(edited.contractEndDate, undefined);
  assert.equal(edited.paymentMethod, "transferencia");
});

test("Anular cancela el cobro y permite reemitir manualmente con otro número, una sola vez", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-01T16:00:00Z") });
  const db = new Database(initial());
  const service = await run(db, "assignService", servicePayload());
  await runSchedule(db, "2026-11-01");
  const first = db.list("billingInvoices")[0];
  await run(db, "cancelSale", { id: first.id });
  assert.equal(db.row("billingInvoices", first.id).status, "anulada");
  assert.equal(db.row("monthlyCharges", `chg-inv-${first.id}`).status, "anulado");
  assert.equal(db.row("monthlyCharges", `chg-inv-${first.id}`).balanceRemaining, 0);
  assert.equal(db.row("clients", "a").currentBalance, 0);
  assert.equal(db.row("clientServices", service.id).lastBilledPeriod, undefined);
  assert.equal(db.list("billingPeriods")[0].status, "cancelled");
  assert.equal((await runSchedule(db, "2026-11-01")).issued, 0);
  const selection = { clientId: "a", month: 11, year: 2026, serviceIds: [service.id], expectedTotal: 115 };
  const replacement = await run(db, "recur", selection);
  assert.equal(replacement.documentNumber, "010-001-000000002");
  assert.equal(db.row("clients", "a").currentBalance, 115);
  assert.equal(db.list("billingPeriods")[0].invoiceId, replacement.id);
  assert.deepEqual(db.list("billingPeriods")[0].previousInvoiceIds, [first.id]);
  await assert.rejects(run(db, "recur", selection), /ya fue emitido/);
});

test("Un período histórico se puede recuperar aunque la anulación antigua dejara sus marcas de emisión", async t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-06T16:00:00Z") });
  const db = new Database(initial());
  const service = await run(db, "assignService", servicePayload());
  const selection = { clientId: "a", month: 11, year: 2026, serviceIds: [service.id], expectedTotal: 115 };
  const first = await run(db, "recur", selection);
  db.rows.set("billingInvoices/" + first.id, { ...first, status: "anulada" });
  db.rows.delete("billingPeriods/" + db.list("billingPeriods")[0].id);
  const replacement = await run(db, "recur", selection);
  assert.equal(db.row("clientServices", service.id).saleInvoiceId, replacement.id);
  assert.deepEqual(db.list("billingPeriods")[0].previousInvoiceIds, [first.id]);
});

test("R29: mostrador y recurrencia comparten serie salvo si se configura un punto de servicios", async () => {
  const shared = new Database(initial());
  const counter = await run(shared, "issueSale", sale());
  await run(shared, "assignService", servicePayload());
  await runSchedule(shared, "2026-11-01");
  const recurring = shared.list("billingInvoices").find(invoice => invoice.saleChannel === "servicio");
  assert.equal(counter.documentNumber, "010-001-000000001");
  assert.equal(recurring.documentNumber, "010-001-000000002");

  const separate = new Database({ ...initial(), sriCompanyConfig: [{ id: "cfg", establecimiento: "001", puntoEmision: "001", puntoEmisionServicios: "002" }] });
  await run(separate, "issueSale", sale());
  await run(separate, "assignService", servicePayload());
  await runSchedule(separate, "2026-11-01");
  assert.deepEqual(separate.list("billingInvoices").map(invoice => invoice.documentNumber), ["001-001-000000001", "001-002-000000001"]);
});
test("R29: the series honours the establishment chosen at the point of sale",async()=>{
  const db=new Database(initial());
  const custom=await run(db,"issueSale",sale("a",{establishment:"007"}));
  assert.equal(custom.documentNumber,"007-001-000000001");
  assert.equal(db.row("sequences","nota_venta_007-001").value,1);
});
