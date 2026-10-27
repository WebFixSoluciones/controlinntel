import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { executeCommercial, type CommercialCommand } from "./commercial.ts";
import { schemas } from "./schemas.ts";
import { collectionPermissions } from "../permissions.ts";
import { planSnapshotRecovery } from "../recovery-plan.ts";
import { planServicePeriod, calculateLines } from "../commercial-core.ts";
import type { Firestore } from "firebase-admin/firestore";
import type { UserProfile } from "@/types";

// Transactional adapter: runs the production command, stages writes, commits atomically.
// This is not evidence of deployed Firestore rules; emulator coverage is separate.
class Database {
  rows = new Map<string,any>(); tail=Promise.resolve(); failCommit=false;
  constructor(initial:Record<string,any[]>) {for(const [name,rows] of Object.entries(initial))for(const row of rows)this.rows.set(name+"/"+row.id,structuredClone(row));}
  doc(path:string):any {return {path,id:path.split("/").pop(),parent:{id:path.split("/")[0]}};}
  collection(name:string):any {const query=(field?:string,value?:unknown):any=>({name,field,value,doc:(id:string)=>this.doc(name+"/"+id),where:(f:string,_op:string,v:unknown)=>query(f,v)});return query();}
  async runTransaction(fn:(tx:any)=>Promise<any>) {
    let release!:()=>void;const prior=this.tail;this.tail=new Promise<void>(r=>release=r);await prior;
    const pending=new Map<string,any>();
    const snap=(path:string)=>({id:path.split("/").pop(),exists:this.rows.has(path),data:()=>structuredClone(this.rows.get(path))});
    const tx={get:async(ref:any)=>ref.path?snap(ref.path):{docs:[...this.rows].filter(([key,row])=>key.startsWith(ref.name+"/")&&(!ref.field||row[ref.field]===ref.value)).map(([key])=>snap(key))},set:(ref:any,row:any)=>pending.set(ref.path,structuredClone(row)),create:(ref:any,row:any)=>{if(this.rows.has(ref.path))throw Error("Already exists");pending.set(ref.path,structuredClone(row));}};
    try {const result=await fn(tx);if(this.failCommit)throw Error("Injected commit failure");pending.forEach((row,key)=>this.rows.set(key,row));return result;} finally{release();}
  }
  list(name:string){return [...this.rows].filter(([key])=>key.startsWith(name+"/")).map(([,row])=>row);}
  row(name:string,id:string){return this.rows.get(name+"/"+id);}
}
const user:UserProfile={uid:"qa",email:"qa@example.test",displayName:"QA",role:"superadmin",status:"activo",permissions:["all"]};
const initial=()=>({clients:[{id:"a",businessName:"PRUEBA CLIENTE",identificationType:"PASAPORTE",identificationNumber:"QA-00001",status:"activo",currentBalance:0},{id:"b",businessName:"PRUEBA CLIENTE B",identificationNumber:"QA-00002",status:"activo",currentBalance:0}],inventoryProducts:[{id:"srv",name:"Servicio QA",sku:"QA",type:"servicio",salePrice:100,ivaRate:15,stock:0,tracksStock:false,status:"activo"}],bankAccounts:[{id:"bank",bankName:"Banco QA",currentBalance:1000,initialBalance:1000,status:"activa"},{id:"bank2",bankName:"Banco QA 2",currentBalance:0,initialBalance:0,status:"activa"}],suppliers:[{id:"supplier",razonSocial:"PROVEEDOR QA",ruc:"QA-111",status:"activo"}]});
const run=(db:Database,action:CommercialCommand["action"],data:Record<string,any>,operationId=randomUUID())=>executeCommercial(user,{action,data,operationId},db as unknown as Firestore);
const sale=(clientId="a",extra={})=>({clientId,documentType:"nota_venta",status:"registrado",date:"2026-10-01",items:[{id:"line",productId:"srv",name:"Servicio QA",quantity:1,unitPrice:100,ivaRate:15,discount:0}],paymentMethod:"credito",...extra});

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
test("R13: an advance is received once, applied once, and cannot cross clients",async()=>{
  const db=new Database(initial()),invoice=await run(db,"issueSale",sale()), advance=await run(db,"advance",{clientId:"a",amount:300,bankAccountId:"bank",method:"efectivo"});
  await run(db,"applyAdvance",{advanceId:advance.id,chargeId:`chg-inv-${invoice.id}`,amount:115});
  assert.equal(db.row("bankAccounts","bank").currentBalance,1300);assert.equal(db.row("clientAdvances",advance.id).remaining,185);assert.equal(db.list("financialMovements").length,1);
  const other=await run(db,"issueSale",sale("b"));await assert.rejects(run(db,"applyAdvance",{advanceId:advance.id,chargeId:`chg-inv-${other.id}`,amount:100}),/otro cliente/);
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

test("R28: assigning a service issues its first note dated by the configured cycle and books it to receivables",async()=>{
  const db=new Database(initial());
  const result=await run(db,"assignService",servicePayload());
  assert.ok(result.invoice,"el alta debe emitir la nota de venta del primer período");
  assert.match(result.invoice.documentNumber,/^010-001-\d{9}$/);
  assert.equal(result.invoice.date,"2026-11-01");
  assert.equal(result.invoice.total,115);
  const charge=db.row("monthlyCharges",`chg-inv-${result.invoice.id}`);
  assert.equal(charge.month,11);assert.equal(charge.year,2026);
  assert.equal(charge.balanceRemaining,115);assert.equal(charge.status,"pendiente");
  assert.equal(db.row("clients","a").currentBalance,115);
  assert.equal(db.list("billingPeriods").length,1);
  assert.equal(db.row("clientServices",result.id).lastBilledPeriod,"2026-11");
  assert.equal(db.row("sequences","nota_venta_010-001").lastDate,"2026-11-01");
});

test("R28: editing the assigned service never issues a second note for the same period",async()=>{
  const db=new Database(initial()), first=await run(db,"assignService",servicePayload());
  const edited=await run(db,"editService",servicePayload({id:first.id,customPrice:120}));
  assert.equal(db.list("billingInvoices").length,1);
  assert.equal(edited.invoice,undefined);
  assert.equal(db.list("monthlyCharges").length,1);
});

test("R28: a post-dated note blocks any earlier date in the same series",async()=>{
  const db=new Database(initial());
  await run(db,"assignService",servicePayload());
  await assert.rejects(run(db,"issueSale",sale("b",{date:"2026-10-01"})),/anterior al último comprobante/);
  assert.equal(db.list("billingInvoices").length,1);
});

test("R28: a non-billable service is saved without a note and reports the reason",async()=>{
  const db=new Database(initial());
  const result=await run(db,"assignService",servicePayload({isBillableInCurrentCycle:false}));
  assert.equal(db.list("billingInvoices").length,0);
  assert.equal(db.list("clientServices").length,1);
  assert.equal(result.firstInvoiceSkipped,"Servicio no activo o no facturable.");
});

test("R28: consecutive assignments take sequential numbers and keep the agreed payment method",async()=>{
  const db=new Database(initial());
  const first=await run(db,"assignService",servicePayload({paymentMethod:"efectivo"}));
  const second=await run(db,"assignService",servicePayload({clientId:"b",paymentMethod:"tarjeta"}));
  assert.equal(first.invoice.documentNumber,"010-001-000000001");
  assert.equal(second.invoice.documentNumber,"010-001-000000002");
  assert.equal(db.row("clientServices",first.id).paymentMethod,"efectivo");
  assert.equal(db.row("monthlyCharges",`chg-inv-${first.invoice.id}`).expectedPaymentMethod,"efectivo");
  assert.equal(db.row("monthlyCharges",`chg-inv-${second.invoice.id}`).expectedPaymentMethod,"tarjeta");
  // La nota nace pendiente: la forma de pago es una preferencia, no un cobro aplicado.
  assert.equal(db.row("monthlyCharges",`chg-inv-${first.invoice.id}`).paidAmount,0);
  assert.equal(db.list("financialMovements").length,0);
});

test("R29: counter sales and service billing share one series by default, each keeping its channel",async()=>{
  const db=new Database(initial());
  const counter=await run(db,"issueSale",sale());
  const service=await run(db,"assignService",servicePayload());
  assert.equal(counter.documentNumber,"010-001-000000001");
  assert.equal(service.invoice.documentNumber,"010-001-000000002");
  assert.equal(counter.saleChannel,"mostrador");
  assert.equal(service.invoice.saleChannel,"servicio");
});

test("R29: a configured service emission point gives each channel its own sequential",async()=>{
  const db=new Database({...initial(),sriCompanyConfig:[{id:"cfg",establecimiento:"001",puntoEmision:"001",puntoEmisionServicios:"002"}]});
  const counter=await run(db,"issueSale",sale());
  const service=await run(db,"assignService",servicePayload());
  assert.equal(counter.documentNumber,"001-001-000000001");
  assert.equal(service.invoice.documentNumber,"001-002-000000001");
  assert.equal(db.row("sequences","nota_venta_001-001").value,1);
  assert.equal(db.row("sequences","nota_venta_001-002").value,1);
});

test("R29: the series honours the establishment chosen at the point of sale",async()=>{
  const db=new Database(initial());
  const custom=await run(db,"issueSale",sale("a",{establishment:"007"}));
  assert.equal(custom.documentNumber,"007-001-000000001");
  assert.equal(db.row("sequences","nota_venta_007-001").value,1);
});
