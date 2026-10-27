import { randomUUID } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import type { UserProfile } from "@/types";
import { adminServices } from "./admin.ts";
import { HttpError, requirePermission } from "./security.ts";
import { digest, recordOperation, type Effect } from "./operation-log.ts";
import { calculateLines, cents, money, chargeBalance, planServicePeriod, validDate, type RecordData as Row } from "../commercial-core.ts";
import { getEcuadorDate } from "../date-utils.ts";
import { schemas } from "./schemas.ts";
import { canUser, canPerformAction } from "../permissions.ts";

export const commercialActions = ["createClient", "assignService", "editService", "issueSale", "editSale", "recur", "payCharge", "advance", "applyAdvance", "cancelSale", "cancelCharge", "retireClient", "retireService", "bankMovement", "transfer", "purchase", "paySupplier", "cancelAdvance", "createProduct", "editProduct", "inventoryTransfer", "inventoryAdjustment", "supplierCredit", "supplierDebit", "createBank", "editBank", "adjustBank", "manualCharge", "startRun", "processRun", "expense", "reverseApplication"] as const;
export type CommercialCommand = { action: typeof commercialActions[number]; operationId: string; data: Row };

class Context {
  original = new Map<string, Row | null>();
  writes = new Map<string, Row>();
  db: Firestore; tx: Transaction; user: UserProfile; operationId: string;
  constructor(db: Firestore, tx: Transaction, user: UserProfile, operationId: string) {this.db=db;this.tx=tx;this.user=user;this.operationId=operationId;}
  async get(collection: string, id: string, required = true): Promise<Row> {
    if (!id || id.includes("/")) throw new HttpError(400,"Referencia inválida.");
    const key = collection + "/" + id;
    if (!this.original.has(key)) { const snap = await this.tx.get(this.db.doc(key)); this.original.set(key, snap.exists ? { ...snap.data(), id: snap.id } : null); }
    const row = this.writes.get(key) || this.original.get(key);
    if (!row && required) throw new HttpError(404,`Registro inexistente: ${collection}.`);
    return row || {};
  }
  async list(collection: string, field?: string, value?: unknown): Promise<Row[]> {
    const query = field ? this.db.collection(collection).where(field,"==",value) : this.db.collection(collection);
    const snap = await this.tx.get(query);
    const rows = snap.docs.map(d => { const row = { ...d.data(), id:d.id }; const key=collection+"/"+d.id; if(!this.original.has(key)) this.original.set(key,row); return this.writes.get(key) || row; });
    for (const [key,row] of this.writes) if (key.startsWith(collection+"/") && !rows.some(r=>r.id===row.id) && (!field || row[field]===value)) rows.push(row);
    return rows;
  }
  put(collection: string, row: Row) {
    const key=collection+"/"+row.id, old=this.original.get(key);
    this.writes.set(key, JSON.parse(JSON.stringify({ ...row, version:Number(old?.version || 0)+1, createdAt:old?.createdAt || row.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString() })));
  }
  async clientBalance(clientId: string) {
    if (clientId === "cf-9999999999999") return;
    const client=await this.get("clients",clientId), charges=await this.list("monthlyCharges","clientId",clientId);
    this.put("clients",{...client,currentBalance:money(charges.reduce((s,c)=>s+chargeBalance(c),0))});
  }
  async bank(amount: number, bankId: string, originId: string, data: Row) {
    const bank=await this.get("bankAccounts",bankId);
    if(bank.status!=="activa") throw new HttpError(400,"La cuenta está inactiva.");
    if(!amount) throw new HttpError(400,"El movimiento debe ser mayor que cero.");
    if(amount<0&&cents(bank.currentBalance)+amount<0&&!bank.allowOverdraft)throw new HttpError(409,"Saldo insuficiente en la cuenta de salida.");
    const id=randomUUID();
    const movement={...data,id,bankAccountId:bankId,bankAccountName:bank.bankName,amount:money(Math.abs(amount)),type:amount>0?"ingreso":"egreso",relatedEntityId:originId,operationId:this.operationId};
    this.put("financialMovements",movement);
    this.put("bankAccounts",{...bank,currentBalance:money(cents(bank.currentBalance)+amount)});
    return id;
  }
  async stock(productId:string,warehouseId:string,delta:number,unitCost:number,type:string,referenceId:string,referenceDocNumber:string,concept:string) {
    if(!Number.isFinite(delta)||!delta||Math.abs(delta)>1_000_000||!Number.isFinite(unitCost)||unitCost<0)throw new HttpError(400,"Cantidad o costo inválido.");
    const product=await this.get("inventoryProducts",productId),wh=await this.get("inventoryWarehouses",warehouseId);
    if(!product.tracksStock||product.type==="servicio")throw new HttpError(400,"El servicio no tiene existencias físicas.");
    const current=Number(product.stockByWarehouse?.[warehouseId]||0),stock=Number(product.stock)+delta;
    if(current+delta<0||stock<0)throw new HttpError(409,"Stock insuficiente.");
    const average=stock===0?0:delta>0||type==="SUPPLIER_RETURN"?(Number(product.stock)*Number(product.baseCost)+delta*unitCost)/stock:Number(product.baseCost);
    if(average<0)throw new HttpError(409,"La valoración histórica requiere conciliación antes del ajuste.");
    this.put("inventoryProducts",{...product,stock,stockByWarehouse:{...product.stockByWarehouse,[warehouseId]:current+delta},baseCost:average});
    const movement={id:randomUUID(),date:getEcuadorDate(),productId,productName:product.name,warehouseId,warehouseName:wh.name,type,referenceId,referenceDocNumber,concept,
      ...(delta>0?{entryQuantity:delta,entryUnitCost:unitCost,entryTotalCost:money(cents(delta*unitCost))}:{exitQuantity:-delta,exitUnitCost:unitCost,exitTotalCost:money(cents(-delta*unitCost))}),
      balanceQuantity:current+delta,balanceAverageCost:average,balanceTotalCost:money(cents((current+delta)*average))};
    this.put("inventoryKardex",movement);return movement;
  }
  commit(type: string, result: unknown, requestHash: string) {
    if(this.writes.size>180) throw new HttpError(400,"La operación supera 180 registros; divide el trabajo en unidades menores.");
    const effects:Effect[]=[];
    for(const [key,after] of this.writes) { const split=key.indexOf("/"); effects.push({collection:key.slice(0,split),id:key.slice(split+1),beforeVersion:this.original.get(key)?.version??null,after}); }
    if(Buffer.byteLength(JSON.stringify({effects,result}))>850000) throw new HttpError(413,"Operación demasiado grande para su registro atómico.");
    for(const [key,row] of this.writes) this.tx.set(this.db.doc(key),row);
    recordOperation(this.tx,this.db,this.user,type,effects,this.operationId,JSON.parse(JSON.stringify({requestHash,result:result ?? null})));
  }
}

function checkedAmount(value: unknown) { const amount=cents(value); if(amount<=0) throw new HttpError(400,"El importe debe ser mayor que cero."); return amount; }
function checkedDate(value: string | undefined) { const date=value || getEcuadorDate(); if(!validDate(date)) throw new HttpError(400,"Fecha inválida."); return date; }

async function payCharge(c: Context, data: Row) {
  const charge=await c.get("monthlyCharges",data.chargeId), amount=checkedAmount(data.amount);
  if(charge.status==="anulado" || amount>chargeBalance(charge)) throw new HttpError(409,"El abono excede el saldo pendiente o la deuda está anulada.");
  const date=checkedDate(data.date), id=randomUUID();
  let movementId:string|undefined;
  if(data.advanceId) {
    const advance=await c.get("clientAdvances",data.advanceId);
    if(advance.clientId!==charge.clientId || advance.status==="anulado" || amount>cents(advance.remaining)) throw new HttpError(409,"Anticipo insuficiente o de otro cliente.");
    const remaining=cents(advance.remaining)-amount;
    c.put("clientAdvances",{...advance,remaining:money(remaining),status:remaining?"vigente":"aplicado",applications:[...(advance.applications||[]),{id,chargeId:charge.id,invoiceNumber:charge.invoiceNumber,amount:money(amount),date}]});
  } else {
    if(!data.bankAccountId) throw new HttpError(400,"Selecciona la cuenta de recepción, incluida caja para efectivo.");
    movementId=await c.bank(amount,data.bankAccountId,id,{date,category:"cobro_cliente",description:`Abono ${charge.invoiceNumber}`,paymentMethod:data.method||"transferencia",referenceNumber:data.reference||"",invoiceId:charge.invoiceId||null,chargeId:charge.id});
  }
  const payment={id,date,amount:money(amount),method:data.method||"transferencia",reference:data.reference||"",...(data.bankAccountId?{bankAccountId:data.bankAccountId}:{}),...(movementId?{movementId}:{}),...(data.advanceId?{advanceId:data.advanceId}:{})};
  const remaining=chargeBalance(charge)-amount;
  c.put("monthlyCharges",{...charge,paidAmount:money(cents(charge.paidAmount??(charge.status==="pagado"?charge.total:0))+amount),balanceRemaining:money(remaining),status:remaining?"parcial":"pagado",paymentDate:date,payments:[...(charge.payments||[]),payment]});
  c.put("payments",{...payment,clientId:charge.clientId,status:"confirmed",operationId:c.operationId});
  c.put("paymentApplications",{id,paymentId:id,chargeId:charge.id,clientId:charge.clientId,amount:money(amount),status:"applied",date});
  await c.clientBalance(charge.clientId);
  return payment;
}

async function issueSale(c: Context, input: Row) {
  if(input.documentType!=="nota_venta") throw new HttpError(400,"Este flujo administra notas comerciales; la emisión SRI se gestiona por separado.");
  const isDraft=input.status==="borrador", date=checkedDate(input.date);
  const client=input.clientId==="cf-9999999999999" ? {id:input.clientId,businessName:"Consumidor Final",identificationNumber:"9999999999999"} : await c.get("clients",input.clientId);
  if(client.status==="retirado") throw new HttpError(400,"Cliente retirado.");
  const calculated=calculateLines(input.items), id=randomUUID();
  if(calculated.items.some(item=>Number(item.unitPrice)===0&&!String(item.zeroPriceReason||input.notes||"").trim()))throw new HttpError(400,"Indica el motivo de la partida gratuita en las notas.");
  const configs=await c.list("sriCompanyConfig"), config=configs[0]||{};
  const series=`${config.establecimiento||"010"}-${config.puntoEmision||"001"}`;
  let documentNumber=`BORRADOR-${id}`;
  if(!isDraft) {
    const sequenceId=`nota_venta_${series}`, counter=await c.get("sequences",sequenceId,false);
    let last=Number(counter.value||0);
    if(!counter.id) { const existing=await c.list("billingInvoices","documentType","nota_venta"); last=Math.max(last,...existing.filter(i=>String(i.documentNumber).startsWith(series+"-")).map(i=>Number(String(i.documentNumber).split("-").pop())||0),Number(config.secuencialNotaVenta||1)-1); }
    const next=last+1;
    if(!Number.isSafeInteger(next) || next>999999999) throw new HttpError(409,"Serie agotada.");
    documentNumber=`${series}-${String(next).padStart(9,"0")}`;
    const reservation=await c.get("documentNumbers",`nota_venta_${documentNumber}`,false);
    if(reservation.id) throw new HttpError(409,"Numeración reservada; revisa la serie.");
    c.put("sequences",{id:sequenceId,value:next});
    c.put("documentNumbers",{id:`nota_venta_${documentNumber}`,invoiceId:id});
  }
  const immediate=input.paymentsBreakdown ? cents(input.paymentsBreakdown.efectivo||0)+cents(input.paymentsBreakdown.transferencia||0)+cents(input.paymentsBreakdown.tarjeta||0) : input.paymentMethod==="credito"?0:cents(calculated.total);
  if(immediate<0 || immediate>cents(calculated.total)) throw new HttpError(400,"Pago inicial inválido.");
  if(input.paymentsBreakdown && immediate+cents(input.paymentsBreakdown.credito||0)!==cents(calculated.total)) throw new HttpError(400,"La distribución del pago no coincide con el total calculado.");
  if(client.id==="cf-9999999999999" && immediate<cents(calculated.total) && !isDraft) throw new HttpError(400,"Identifica al cliente antes de conceder crédito.");
  const invoice={...input,...calculated,id,documentNumber,date,claveAcceso:"",clientId:client.id,clientName:client.businessName,clientRuc:client.identificationNumber,status:isDraft?"borrador":"registrado",emailStatus:"pendiente",kardexRegistered:false};
  for(const item of calculated.items) {
    if(!item.productId) continue;
    const product=await c.get("inventoryProducts",item.productId,false);
    if(!product.id && !item.serviceId) throw new HttpError(400,"Artículo inexistente.");
    if(product.status==="inactivo") throw new HttpError(400,"Artículo inactivo.");
    if(!isDraft&&item.serviceId){
      const service=await c.get("clientServices",item.serviceId);
      if(service.clientId!==client.id||!item.periodStart||!item.periodEnd)throw new HttpError(400,"El período o servicio no pertenece al cliente.");
      const plan=planServicePeriod(service,Number(String(item.periodStart).slice(5,7)),Number(String(item.periodStart).slice(0,4)),getEcuadorDate());
      if(!plan.eligible)throw new HttpError(409,plan.reason);
      if(plan.periodStart!==item.periodStart||plan.periodEnd!==item.periodEnd||item.quantity!==1)throw new HttpError(409,"El período cambió; vuelve a previsualizar el servicio.");
      if((await c.get("billingPeriods",plan.key,false)).id||service.lastBilledPeriod===plan.periodStart.slice(0,7))throw new HttpError(409,"El período ya fue emitido o requiere conciliación histórica.");
      c.put("billingPeriods",{id:plan.key,serviceId:service.id,clientId:client.id,periodStart:plan.periodStart,periodEnd:plan.periodEnd,invoiceId:id,status:"issued"});
      const latest=String(service.lastBilledPeriod||"")<=plan.periodStart.slice(0,7);
      c.put("clientServices",{...service,saleStatus:"emitida",saleInvoiceId:service.saleInvoiceId||id,saleDocNumber:service.saleDocNumber||documentNumber,...(latest?{lastBilledPeriod:plan.periodStart.slice(0,7),lastBilledInvoiceId:id,nextRenewalDate:plan.periodEnd}:{})});
    }else if(!isDraft&&product.type==="servicio"&&client.id!=="cf-9999999999999"){
      const assigned=(await c.list("clientServices","clientId",client.id)).filter(s=>s.status!=="retirado"&&(s.inventoryProductId===product.id||s.planId===product.id));
      if(assigned.length)throw new HttpError(409,"Este servicio ya está asignado. Emite su período desde la ficha del cliente o Ventas recurrentes.");
    }
    if(isDraft || !product.tracksStock || product.type==="servicio") continue;
    const wh=await c.get("inventoryWarehouses",input.warehouseId), qty=Number(item.quantity), available=Number(product.stockByWarehouse?.[wh.id]||0);
    if(qty>available) throw new HttpError(409,`Stock insuficiente para ${product.name}.`);
    const stockByWarehouse={...product.stockByWarehouse,[wh.id]:available-qty}, stock=Object.values(stockByWarehouse).reduce((a:number,b)=>a+Number(b),0);
    c.put("inventoryProducts",{...product,stock,stockByWarehouse});
    c.put("inventoryKardex",{id:randomUUID(),date,productId:product.id,productName:product.name,warehouseId:wh.id,warehouseName:wh.name,type:"SALE",referenceId:id,referenceDocNumber:documentNumber,concept:`Venta ${documentNumber}`,exitQuantity:qty,exitUnitCost:product.baseCost,exitTotalCost:money(cents(qty*product.baseCost)),balanceQuantity:available-qty,balanceAverageCost:product.baseCost,balanceTotalCost:money(cents((available-qty)*product.baseCost))});
    invoice.kardexRegistered=true;
  }
  c.put("billingInvoices",invoice);
  if(!isDraft) {
    const charge={id:`chg-inv-${id}`,clientId:client.id,clientName:client.businessName,clientRuc:client.identificationNumber,invoiceId:id,invoiceNumber:documentNumber,saleDate:date,month:Number(date.slice(5,7)),year:Number(date.slice(0,4)),serviceDescription:calculated.items.map(i=>i.name).join(" + "),subtotal:calculated.subtotal,ivaAmount:calculated.ivaTotal,total:calculated.total,paidAmount:0,balanceRemaining:calculated.total,status:"pendiente",payments:[],maxPaymentDate:input.creditDueDate||date};
    c.put("monthlyCharges",charge);
    if(immediate) {
      let bankId=input.bankAccountId;
      if(!bankId&&input.paymentMethod==="efectivo") {const cash=(await c.list("bankAccounts","accountType","caja_efectivo")).filter(b=>b.status==="activa");if(cash.length===1)bankId=cash[0].id;}
      await payCharge(c,{chargeId:charge.id,amount:money(immediate),method:input.paymentMethod,bankAccountId:bankId,date,reference:documentNumber});
    }
    else await c.clientBalance(client.id);
  }
  return invoice;
}

async function releaseApplication(c:Context,charge:Row,payment:Row) {
  const advance=payment.advanceId?await c.get("clientAdvances",payment.advanceId):null;
  if(advance) {
    if(advance.clientId!==charge.clientId)throw new HttpError(409,"Aplicación histórica de otro cliente.");
    const applications=advance.applications||[],matches=applications.map((a:Row,index:number)=>({a,index})).filter(({a}:Row)=>a.status!=="reversed"&&(a.id===payment.id||!a.id&&a.chargeId===charge.id&&cents(a.amount)===cents(payment.amount)));
    if(matches.length!==1)throw new HttpError(409,"La aplicación histórica requiere conciliación antes de revertirse.");
    c.put("clientAdvances",{...advance,remaining:money(cents(advance.remaining)+cents(payment.amount)),status:"vigente",applications:applications.map((a:Row,index:number)=>index===matches[0].index?{...a,status:"reversed"}:a)});
  } else c.put("clientAdvances",{id:`released-${payment.id}`,clientId:charge.clientId,clientName:charge.clientName,clientRuc:charge.clientRuc,date:getEcuadorDate(),amount:payment.amount,remaining:payment.amount,status:"vigente",method:payment.method,bankAccountId:payment.bankAccountId||null,sourcePaymentId:payment.id,sourceChargeId:charge.id,applications:[],notes:"Aplicación revertida; dinero conservado en banco."});
  const application=await c.get("paymentApplications",payment.id,false);
  c.put("paymentApplications",{...application,id:payment.id,paymentId:payment.id,chargeId:charge.id,clientId:charge.clientId,amount:payment.amount,status:"reversed",reversedAt:new Date().toISOString()});
}

async function cancelCharge(c: Context, id: string) {
  const charge=await c.get("monthlyCharges",id);
  if(charge.status==="anulado") return charge;
  // Preserve all received money. Unapply it into an identified customer credit.
  const payments=(charge.payments||[]).filter((p:Row)=>p.status!=="reversed"), allocated=payments.reduce((s:number,p:Row)=>s+cents(p.amount),0);
  if(allocated!==cents(charge.paidAmount??(charge.status==="pagado"?charge.total:0))) throw new HttpError(409,"Pagos históricos sin detalle; concilia antes de anular.");
  for(const payment of payments) {
    await releaseApplication(c,charge,payment);
  }
  const updated={...charge,status:"anulado",balanceRemaining:0,paidAmount:0,historicalPaidAmount:charge.paidAmount||0,payments:(charge.payments||[]).map((p:Row)=>({...p,status:"reversed"})),cancelledAt:new Date().toISOString()};
  c.put("monthlyCharges",updated); await c.clientBalance(charge.clientId); return updated;
}

async function execute(c:Context, action:CommercialCommand["action"], data:Row):Promise<any> {
  switch(action) {
    case "reverseApplication": {
      const charge=await c.get("monthlyCharges",data.chargeId),payment=(charge.payments||[]).find((p:Row)=>p.id===data.paymentId);
      if(!payment)throw new HttpError(404,"Abono inexistente.");
      if(payment.status==="reversed"||charge.status==="anulado")return payment.id;
      const paid=cents(charge.paidAmount||0)-cents(payment.amount);
      if(paid<0)throw new HttpError(409,"Historial de abonos inconsistente.");
      await releaseApplication(c,charge,payment);
      c.put("monthlyCharges",{...charge,paidAmount:money(paid),balanceRemaining:money(cents(charge.total)-paid),status:paid?"parcial":"pendiente",payments:charge.payments.map((p:Row)=>p.id===payment.id?{...p,status:"reversed",reversedAt:new Date().toISOString()}:p)});
      await c.clientBalance(charge.clientId);return payment.id;
    }
    case "expense": {
      const input=schemas.expenses.parse(data),id=randomUUID(),amount=checkedAmount(input.amount),date=checkedDate(input.expenseDate);
      const movementId=await c.bank(-amount,input.bankAccountId,id,{date,category:input.category,description:input.description||input.supplierName,paymentMethod:input.paymentMethod,expenseId:id});
      const expense={...input,id,amount:money(amount),expenseDate:date,movementId};c.put("expenses",expense);return expense;
    }
    case "startRun": {
      if(!Array.isArray(data.units)||!data.units.length||data.units.length>100)throw new HttpError(400,"Selecciona entre 1 y 100 clientes por lote.");
      const units=data.units.map((unit:Row,index:number)=>({index,input:unit,status:"pending"})),id=randomUUID();
      const run={id,actorId:c.user.uid,status:"pending",units,createdAt:new Date().toISOString()};c.put("billingRuns",run);return run;
    }
    case "processRun": {
      const run=await c.get("billingRuns",data.id);
      if(run.actorId!==c.user.uid&&c.user.role!=="superadmin")throw new HttpError(403,"Lote de otro operador.");
      if(!Number.isInteger(data.index)||!run.units[data.index])throw new HttpError(400,"Unidad de lote inválida.");
      const unit=run.units[data.index];if(unit.status==="completed")return unit;
      let outcome;
      try { const invoice=await execute(c,"recur",unit.input);outcome={...unit,status:"completed",invoiceId:invoice.id,documentNumber:invoice.documentNumber,total:invoice.total}; }
      catch(error) {
        c.writes.clear();
        outcome={...unit,status:"failed",error:error instanceof Error?error.message:"No se pudo emitir."};
      }
      const units=run.units.map((value:Row,index:number)=>index===data.index?outcome:value);
      c.put("billingRuns",{...run,units,status:units.every((value:Row)=>value.status==="completed")?"completed":units.some((value:Row)=>value.status==="failed")?"needs_attention":"running"});return outcome;
    }
    case "createBank": {
      const id=randomUUID(),balance=cents(data.initialBalance??0);
      const bank=schemas.bankAccounts.parse({...data,id,currentBalance:money(balance),initialBalance:money(balance)});
      c.put("bankAccounts",bank);return bank;
    }
    case "editBank": {
      const bank=await c.get("bankAccounts",data.id),{bankName,accountNumber,accountType,status}=data;
      if(data.currentBalance!==undefined||data.initialBalance!==undefined)throw new HttpError(400,"El saldo se cambia con un ajuste identificado.");
      const changes=Object.fromEntries(Object.entries({bankName,accountNumber,accountType,status}).filter(([,value])=>value!==undefined));
      const updated=schemas.bankAccounts.parse({...bank,...changes});c.put("bankAccounts",updated);return updated;
    }
    case "adjustBank": {
      if(!String(data.reason||"").trim())throw new HttpError(400,"Motivo de ajuste requerido.");
      return c.bank(cents(data.delta),data.bankAccountId,randomUUID(),{date:getEcuadorDate(),category:"ajuste_conciliacion",description:data.reason,paymentMethod:"transferencia"});
    }
    case "manualCharge": {
      const client=await c.get("clients",data.clientId),id=randomUUID();
      if(data.invoiceId)throw new HttpError(400,"La deuda de una venta se genera al emitirla.");
      const amount=checkedAmount(data.total),charge=schemas.monthlyCharges.parse({...data,id,total:money(amount),clientName:client.businessName,clientRuc:client.identificationNumber,paidAmount:0,balanceRemaining:money(amount),status:"pendiente",payments:[],origin:"manual"});
      c.put("monthlyCharges",charge);await c.clientBalance(client.id);return charge;
    }
    case "createProduct": {
      const id=randomUUID(),input=schemas.inventoryProducts.parse({...data,id,stock:0}),stocks=data.stockByWarehouse||{};
      if(!["producto","servicio","combo"].includes(input.type))throw new HttpError(400,"Tipo de artículo inválido.");
      if((await c.list("inventoryProducts","sku",input.sku)).length)throw new HttpError(409,"SKU ya registrado.");
      if(input.categoryId) {const category=await c.get("inventoryCategories",input.categoryId);if(category.itemType!=="ambos"&&category.itemType!==input.type)throw new HttpError(400,"Categoría incompatible.");input.categoryName=category.name;}
      const product={...input,tracksStock:input.type==="servicio"?false:!!input.tracksStock,stock:0,stockByWarehouse:{},salePriceConIva:money(cents(Number(input.salePrice)*(1+Number(input.ivaRate)/100)))};
      c.put("inventoryProducts",product);
      if(product.tracksStock)for(const [whId,value] of Object.entries(stocks)){const qty=Number(value);if(qty<0||!Number.isFinite(qty))throw new HttpError(400,"Stock inicial inválido.");if(qty)await c.stock(id,whId,qty,Number(input.baseCost),"POSITIVE_ADJUSTMENT",id,"APERTURA","Apertura de inventario");}
      return c.writes.get("inventoryProducts/"+id);
    }
    case "editProduct": {
      const old=await c.get("inventoryProducts",data.id),updated=schemas.inventoryProducts.parse({...old,...data});
      if(updated.stock!==old.stock||JSON.stringify(updated.stockByWarehouse)!==JSON.stringify(old.stockByWarehouse)||updated.baseCost!==old.baseCost)throw new HttpError(400,"Utiliza ajustes de inventario para cambiar existencias o valoración.");
      if(updated.type!==old.type||updated.tracksStock!==old.tracksStock)throw new HttpError(400,"No cambies el control de existencias de un artículo registrado; crea otro artículo.");
      if(updated.sku!==old.sku&&(await c.list("inventoryProducts","sku",updated.sku)).length)throw new HttpError(409,"SKU ya registrado.");
      if(updated.categoryId){const category=await c.get("inventoryCategories",updated.categoryId);if(category.itemType!=="ambos"&&category.itemType!==updated.type)throw new HttpError(400,"Categoría incompatible.");updated.categoryName=category.name;}
      updated.salePriceConIva=money(cents(updated.salePrice*(1+Number(updated.ivaRate)/100)));c.put("inventoryProducts",updated);return updated;
    }
    case "inventoryTransfer": {
      if(data.originWarehouseId===data.destWarehouseId)throw new HttpError(400,"Selecciona bodegas distintas.");
      const product=await c.get("inventoryProducts",data.productId),qty=Number(data.quantity),id=randomUUID(),number="TRF-"+id;
      if(qty<=0)throw new HttpError(400,"Cantidad inválida.");
      await c.stock(product.id,data.originWarehouseId,-qty,product.baseCost,"TRANSFER_OUT",id,number,data.reason||"Transferencia");
      await c.stock(product.id,data.destWarehouseId,qty,product.baseCost,"TRANSFER_IN",id,number,data.reason||"Transferencia");
      c.put("inventoryTransfers",{...data,id,transferNumber:number,date:getEcuadorDate(),productName:product.name,unitCost:product.baseCost,totalCost:money(cents(qty*product.baseCost)),status:"completada"});return id;
    }
    case "inventoryAdjustment": {
      if(!String(data.concept||"").trim()||!data.items?.length)throw new HttpError(400,"Motivo y partidas requeridos.");
      const id=randomUUID(),number="ADJ-"+id;
      for(const item of data.items){const product=await c.get("inventoryProducts",item.productId),qty=Number(item.quantity);if(qty<=0)throw new HttpError(400,"Cantidad inválida.");await c.stock(product.id,data.warehouseId,item.type==="egreso"?-qty:qty,item.type==="egreso"?product.baseCost:Number(item.unitCost??product.baseCost),item.type==="egreso"?"NEGATIVE_ADJUSTMENT":"POSITIVE_ADJUSTMENT",id,number,data.concept);}
      c.put("inventoryAdjustments",{...data,id,adjustmentNumber:number,date:getEcuadorDate(),responsibleUser:c.user.uid});return id;
    }
    case "supplierCredit":
    case "supplierDebit": {
      const invoice=await c.get("purchaseInvoices",data.purchaseInvoiceId), amount=checkedAmount(data.total),id=randomUUID();
      if(data.supplierId!==invoice.supplierId)throw new HttpError(400,"El proveedor no corresponde a la compra.");
      const delta=action==="supplierCredit"?-amount:amount,remaining=cents(invoice.balanceRemaining)+delta;
      if(remaining<0)c.put("supplierCredits",{id:`credit-${id}`,supplierId:invoice.supplierId,sourceNoteId:id,amount:money(-remaining),remaining:money(-remaining),status:"available"});
      if(action==="supplierCredit"&&data.reason==="devolucion_mercaderia") {
        if(!data.items?.length)throw new HttpError(400,"Selecciona las partidas devueltas.");
        const receipts=await c.list("inventoryKardex","referenceId",invoice.id);
        const previousNotes=await c.list("supplierCreditNotes","purchaseInvoiceId",invoice.id),currentReturns=new Map<string,number>();
        for(const item of data.items){
          const key=item.productId+"/"+item.warehouseId,matches=receipts.filter(r=>r.type==="PURCHASE_RECEIPT"&&r.productId===item.productId&&r.warehouseId===item.warehouseId),received=matches.reduce((sum,r)=>sum+Number(r.entryQuantity),0),value=matches.reduce((sum,r)=>sum+Number(r.entryTotalCost),0);
          const returned=previousNotes.flatMap(note=>note.items||[]).filter((r:Row)=>r.productId===item.productId&&r.warehouseId===item.warehouseId).reduce((sum:number,r:Row)=>sum+Number(r.quantity),0)+(currentReturns.get(key)||0);
          if(Number(item.quantity)<=0||Number(item.quantity)>received-returned)throw new HttpError(400,"Devolución sin recepción suficiente.");
          currentReturns.set(key,(currentReturns.get(key)||0)+Number(item.quantity));
          await c.stock(item.productId,item.warehouseId,-Number(item.quantity),value/received,"SUPPLIER_RETURN",id,data.documentNumber,data.reason);
        }
      }
      c.put("purchaseInvoices",{...invoice,balanceRemaining:money(Math.max(0,remaining)),adjustmentTotal:money(cents(invoice.adjustmentTotal||0)+delta),paymentStatus:remaining<=0?"pagado":cents(invoice.paidAmount||0)>0?"abono_parcial":"pendiente"});
      const note={...data,id,createdAt:new Date().toISOString()};c.put(action==="supplierCredit"?"supplierCreditNotes":"supplierDebitNotes",note);return note;
    }
    case "createClient": {
      const input=schemas.clients.parse(data.client), id=randomUUID();
      input.identificationNumber=String(input.identificationNumber).replace(/\s/g,"").toUpperCase();
      const key=digest([input.identificationType,String(input.identificationNumber).replace(/\s/g,"").toUpperCase()]);
      if((await c.get("identifications",key,false)).id || (await c.list("clients")).some(client=>client.identificationType===input.identificationType&&String(client.identificationNumber).replace(/\s/g,"").toUpperCase()===input.identificationNumber)) throw new HttpError(409,"Ya existe un cliente con esa identificación.");
      const client={...input,id,currentBalance:0,totalActiveServices:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      c.put("clients",client); c.put("identifications",{id:key,clientId:id});
      if(data.service) await execute(c,"assignService",{...data.service,clientId:id});
      return c.writes.get("clients/"+id);
    }
    case "assignService":
    case "editService": {
      const old=action==="editService"?await c.get("clientServices",data.id):{}, source={...old,...data};
      const client=await c.get("clients",source.clientId);
      if(client.status==="retirado")throw new HttpError(400,"Cliente retirado.");
      const product=await c.get("inventoryProducts",String(source.inventoryProductId||source.planId),false), plan=await c.get("plans",String(source.planId),false);
      if(!plan.id&&(!product.id||product.type!=="servicio"||product.status==="inactivo")) throw new HttpError(400,"Selecciona un servicio o plan vigente del catálogo.");
      if(source.nodeId) await c.get("nodes",source.nodeId);
      const price=source.customPrice??product.salePrice??plan.defaultPrice;
      const rate=source.ivaRate??product.ivaRate;
      if(rate===undefined) throw new HttpError(400,"Configura el impuesto del servicio.");
      const service=schemas.clientServices.parse({...source,id:old.id||randomUUID(),customPrice:price,basePrice:source.basePrice??product.salePrice??plan.defaultPrice,ivaRate:rate,planName:product.name||plan.name,inventoryProductId:product.id||null,
        status:source.status||"activo",billingType:source.billingType||"pospago",billingFrequency:source.billingFrequency||"mensual",cycleAnchor:source.cycleAnchor||"aniversario",
        contractStartDate:source.contractStartDate||source.installationDate||getEcuadorDate(),installationDate:source.installationDate||getEcuadorDate(),nodeId:source.nodeId||"",nodeName:source.nodeName||"Sin configurar",ipv4Address:source.ipv4Address||"",pppoeUser:source.pppoeUser||""});
      if(cents(price)===0&&!source.zeroPriceReason)throw new HttpError(400,"Registra el motivo de gratuidad.");
      if(!validDate(service.contractStartDate)||service.contractEndDate&&!validDate(service.contractEndDate)||service.contractEndDate&&service.contractEndDate<service.contractStartDate)throw new HttpError(400,"Vigencia inválida.");
      if(service.billingDay && (!Number.isInteger(service.billingDay)||service.billingDay<1||service.billingDay>31))throw new HttpError(400,"Día de cobro inválido.");
      const services=await c.list("clientServices","clientId",client.id);
      c.put("clientServices",service);
      c.put("clients",{...client,totalActiveServices:services.filter(s=>s.id!==service.id&&s.status==="activo").length+(service.status==="activo"?1:0)});
      return service;
    }
    case "issueSale": return issueSale(c,data);
    case "editSale": {
      const old=await c.get("billingInvoices",data.id),changes=data.updates||{};
      if(old.documentType!=="nota_venta"||old.status==="anulada")throw new HttpError(409,"Documento no editable.");
      if(changes.documentNumber&&changes.documentNumber!==old.documentNumber)throw new HttpError(400,"La numeración emitida no se modifica.");
      const calculated=calculateLines(changes.items||old.items);
      if(old.status==="borrador") {
        if(changes.status&&changes.status!=="borrador") { const emitted=await issueSale(c,{...old,...changes,...calculated,documentType:"nota_venta",status:"registrado"});c.put("billingInvoices",{...old,status:"anulada",convertedToInvoiceId:emitted.id});return emitted; }
        const updated={...old,...changes,...calculated};c.put("billingInvoices",updated);return updated;
      }
      if(changes.clientId&&changes.clientId!==old.clientId||changes.date&&changes.date!==old.date)throw new HttpError(409,"Cliente y fecha de una venta emitida se conservan. Anula y registra la operación correcta.");
      if(changes.paymentMethod&&changes.paymentMethod!==old.paymentMethod||changes.bankAccountId&&changes.bankAccountId!==old.bankAccountId)throw new HttpError(409,"Administra pagos y cuentas desde Cobranzas.");
      const charges=await c.list("monthlyCharges","invoiceId",old.id);
      if(charges.length!==1||charges[0].clientId!==old.clientId)throw new HttpError(409,"La venta requiere conciliación de cartera.");
      const charge=charges[0],paid=cents(charge.paidAmount||0),remaining=cents(calculated.total)-paid;
      if(remaining<0)throw new HttpError(409,"El total ajustado es menor que lo aplicado; libera el excedente mediante anulación y saldo a favor.");
      const whOld=old.warehouseId,whNew=changes.warehouseId||whOld;
      const ids=[...new Set([...old.items,...calculated.items].map((i:Row)=>i.productId).filter(Boolean))];
      for(const productId of ids) {
        const product=await c.get("inventoryProducts",productId,false);if(!product.id||!product.tracksStock||product.type==="servicio")continue;
        const oldQty=old.items.filter((i:Row)=>i.productId===productId).reduce((sum:number,i:Row)=>sum+Number(i.quantity),0),newQty=calculated.items.filter(i=>i.productId===productId).reduce((sum,i)=>sum+Number(i.quantity),0);
        if(whOld!==whNew){if(oldQty)await c.stock(productId,whOld,oldQty,product.baseCost,"CUSTOMER_RETURN",old.id,old.documentNumber,"Cambio de bodega");if(newQty)await c.stock(productId,whNew,-newQty,product.baseCost,"SALE",old.id,old.documentNumber,"Cambio de bodega");}
        else if(newQty!==oldQty)await c.stock(productId,whOld,oldQty-newQty,product.baseCost,newQty>oldQty?"SALE":"CUSTOMER_RETURN",old.id,old.documentNumber,"Ajuste de partidas");
      }
      const updated={...old,...changes,...calculated,id:old.id,documentNumber:old.documentNumber,status:old.status};
      c.put("billingInvoices",updated);c.put("monthlyCharges",{...charge,total:calculated.total,subtotal:calculated.subtotal,ivaAmount:calculated.ivaTotal,balanceRemaining:money(remaining),status:remaining===0?"pagado":paid?"parcial":"pendiente",serviceDescription:calculated.items.map(i=>i.name).join(" + ")});
      await c.clientBalance(old.clientId);return updated;
    }
    case "recur": {
      if(typeof data.expectedTotal!=="number"||!Number.isFinite(data.expectedTotal))throw new HttpError(400,"Falta el total de la vista previa aprobada.");
      const client=await c.get("clients",data.clientId), services=await c.list("clientServices","clientId",client.id);
      if(client.status!=="activo") throw new HttpError(400,"Cliente no activo.");
      if(!Array.isArray(data.serviceIds)||!data.serviceIds.length) throw new HttpError(400,"Selecciona los servicios a emitir.");
      const selected=services.filter(s=>data.serviceIds.includes(s.id));
      if(selected.length!==new Set(data.serviceIds).size) throw new HttpError(400,"La selección contiene servicios de otro cliente o inexistentes.");
      const plans=selected.map(s=>planServicePeriod(s,data.month,data.year,getEcuadorDate()));
      const eligible=[];
      for(const plan of plans) {
        if(!plan.eligible) throw new HttpError(409,plan.reason);
        const period=await c.get("billingPeriods",plan.key,false);
        if(period.id) throw new HttpError(409,`El período ${plan.periodStart} ya fue emitido; consulta su documento.`);
        // Do not silently re-emit legacy periods that lack a period registry.
        const service=selected.find(s=>s.id===plan.serviceId)!;
        if(service.lastBilledPeriod===`${data.year}-${String(data.month).padStart(2,"0")}`) throw new HttpError(409,"Período histórico ya emitido; requiere conciliación.");
        eligible.push(plan);
      }
      const previewTotal=calculateLines(eligible.map(p=>p.line)).total;
      if(data.expectedTotal!==undefined&&cents(data.expectedTotal)!==cents(previewTotal))throw new HttpError(409,"La tarifa cambió después de la vista previa. Revisa el nuevo importe.");
      const invoice=await issueSale(c,{documentType:"nota_venta",status:"registrado",clientId:client.id,date:getEcuadorDate(),items:eligible.map(p=>p.line),paymentMethod:"credito",creditDueDate:eligible.map(p=>p.dueDate).sort()[0],recurring:true});
      return invoice;
    }
    case "payCharge": return payCharge(c,data);
    case "applyAdvance": return payCharge(c,{...data,method:"Anticipo de Cliente"});
    case "advance": {
      const client=await c.get("clients",data.clientId), amount=checkedAmount(data.amount), id=randomUUID(), date=checkedDate(data.date);
      const movementId=await c.bank(amount,data.bankAccountId,id,{date,category:"anticipo_cliente",description:`Anticipo ${client.businessName}`,paymentMethod:data.method||"transferencia",referenceNumber:data.reference||""});
      const advance={...data,id,date,amount:money(amount),remaining:money(amount),clientName:client.businessName,clientRuc:client.identificationNumber,status:"vigente",applications:[],movementId};
      c.put("clientAdvances",advance); return advance;
    }
    case "cancelAdvance": {
      const advance=await c.get("clientAdvances",data.id);
      if(advance.status==="anulado") return advance;
      if(cents(advance.remaining)<=0)throw new HttpError(409,"El anticipo no tiene saldo disponible para devolver.");
      await c.bank(-cents(advance.remaining),data.bankAccountId||advance.bankAccountId,advance.id,{date:getEcuadorDate(),category:"devolucion_anticipo",description:"Devolución de anticipo",paymentMethod:advance.method});
      c.put("clientAdvances",{...advance,remaining:0,refundedAmount:money(cents(advance.refundedAmount||0)+cents(advance.remaining)),status:(advance.applications||[]).some((a:Row)=>a.status!=="reversed")?"aplicado":"anulado"}); return advance.id;
    }
    case "cancelCharge": { const charge=await c.get("monthlyCharges",data.id); if(charge.invoiceId) throw new HttpError(409,"Esta deuda pertenece a una venta. Anula la venta con sus efectos explícitos."); return cancelCharge(c,data.id); }
    case "cancelSale": {
      const invoice=await c.get("billingInvoices",data.id);
      if(invoice.documentType!=="nota_venta") throw new HttpError(400,"Documento fuera del alcance comercial.");
      if(invoice.status==="anulada") return invoice;
      const charges=await c.list("monthlyCharges","invoiceId",invoice.id);
      if(charges.some(ch=>ch.clientId!==invoice.clientId)) throw new HttpError(409,"Relación histórica inconsistente; concilia antes de anular.");
      for(const charge of charges) await cancelCharge(c,charge.id);
      const movements=await c.list("inventoryKardex","referenceId",invoice.id);
      const stockGroups=new Map<string,Row>();
      for(const movement of movements.filter(m=>["SALE","CUSTOMER_RETURN"].includes(m.type))) {
        const key=movement.productId+"/"+movement.warehouseId,group=stockGroups.get(key)||{...movement,quantity:0,value:0};
        group.quantity+=Number(movement.exitQuantity||0)-Number(movement.entryQuantity||0);
        group.value+=Number(movement.exitTotalCost||0)-Number(movement.entryTotalCost||0);stockGroups.set(key,group);
      }
      for(const group of stockGroups.values()) {
        if(group.quantity<0)throw new HttpError(409,"Kardex de la venta inconsistente; concilia antes de anular.");
        if(group.quantity===0)continue;
        const original:Row={...group,exitQuantity:group.quantity,exitUnitCost:group.value/group.quantity,exitTotalCost:group.value};
        const product=await c.get("inventoryProducts",original.productId), whId=original.warehouseId, qty=Number(original.exitQuantity), current=Number(product.stockByWarehouse?.[whId]||0);
        const stock=Number(product.stock)+qty;
        const cost=stock ? (Number(product.stock)*Number(product.baseCost)+qty*Number(original.exitUnitCost))/stock : 0;
        c.put("inventoryProducts",{...product,stock,baseCost:cost,stockByWarehouse:{...product.stockByWarehouse,[whId]:current+qty}});
        c.put("inventoryKardex",{...original,id:randomUUID(),type:"CUSTOMER_RETURN",reversesId:original.id,exitQuantity:0,exitTotalCost:0,entryQuantity:qty,entryUnitCost:original.exitUnitCost,entryTotalCost:original.exitTotalCost,balanceQuantity:current+qty,balanceAverageCost:cost,balanceTotalCost:money(cents((current+qty)*cost)),date:getEcuadorDate(),concept:`Reversión ${invoice.documentNumber}`});
      }
      c.put("billingInvoices",{...invoice,status:"anulada",cancelReason:data.reason||"Anulación comercial",cancelledAt:new Date().toISOString()});
      return invoice.id;
    }
    case "retireClient": {
      const client=await c.get("clients",data.id), services=await c.list("clientServices","clientId",client.id);
      for(const service of services) c.put("clientServices",{...service,status:"retirado",isBillableInCurrentCycle:false});
      c.put("clients",{...client,status:"retirado",totalActiveServices:0}); return client.id;
    }
    case "retireService": {
      const service=await c.get("clientServices",data.id), client=await c.get("clients",service.clientId), services=await c.list("clientServices","clientId",client.id);
      c.put("clientServices",{...service,status:"retirado",isBillableInCurrentCycle:false});
      c.put("clients",{...client,totalActiveServices:services.filter(s=>s.id!==service.id&&s.status==="activo").length}); return service.id;
    }
    case "bankMovement": {
      if(String(data.category).startsWith("transferencia")) throw new HttpError(400,"Utiliza la operación de transferencia completa.");
      const id=randomUUID(), amount=checkedAmount(data.amount), date=checkedDate(data.date);
      const movementId=await c.bank(data.type==="egreso"?-amount:amount,data.bankAccountId,id,{...data,date});
      return c.writes.get("financialMovements/"+movementId);
    }
    case "transfer": {
      if(data.fromId===data.toId) throw new HttpError(400,"Selecciona dos cuentas distintas.");
      const amount=checkedAmount(data.amount), id=randomUUID(), date=checkedDate(data.date);
      await c.bank(-amount,data.fromId,id,{date,category:"transferencia_interna",transferId:id,description:data.description||"Transferencia interna",paymentMethod:"transferencia"});
      await c.bank(amount,data.toId,id,{date,category:"transferencia_interna",transferId:id,description:data.description||"Transferencia interna",paymentMethod:"transferencia"}); return id;
    }
    case "paySupplier": {
      const invoice=await c.get("purchaseInvoices",data.purchaseInvoiceId), amount=checkedAmount(data.amount), balance=cents(invoice.balanceRemaining);
      if(amount>balance) throw new HttpError(409,"El pago excede la cuenta por pagar.");
      const id=randomUUID(), date=checkedDate(data.date);
      let movementId:string|null=null;
      if(data.supplierCreditId){const credit=await c.get("supplierCredits",data.supplierCreditId);if(credit.supplierId!==invoice.supplierId||amount>cents(credit.remaining))throw new HttpError(409,"Saldo del proveedor insuficiente o de otro proveedor.");c.put("supplierCredits",{...credit,remaining:money(cents(credit.remaining)-amount),status:cents(credit.remaining)===amount?"applied":"available"});}
      else movementId=await c.bank(-amount,data.bankAccountId,id,{date,category:"pago_proveedor",description:`Pago ${invoice.documentNumber}`,paymentMethod:data.paymentMethod||"transferencia",purchaseInvoiceId:invoice.id});
      c.put("purchaseInvoices",{...invoice,paidAmount:money(cents(invoice.paidAmount||0)+amount),balanceRemaining:money(balance-amount),paymentStatus:balance===amount?"pagado":"abono_parcial"});
      const payment={...data,id,date,supplierId:invoice.supplierId,supplierName:invoice.supplierName,amount:money(amount),movementId,registeredBy:c.user.uid,createdAt:new Date().toISOString()};
      c.put("supplierPayments",payment); return payment;
    }
    case "purchase": {
      const supplier=await c.get("suppliers",data.supplierId), id=randomUUID(), date=checkedDate(data.date), key=digest([supplier.id,data.documentNumber]);
      if((await c.get("purchaseUniqueness",key,false)).id) throw new HttpError(409,"Compra ya registrada.");
      const calculation=calculateLines((data.items||[]).map((i:Row)=>({...i,unitPrice:i.unitCost}))); let inventory=false;
      for(const item of calculation.items) {
        if(!item.productId) continue;
        const product=await c.get("inventoryProducts",item.productId); if(!product.tracksStock||product.type==="servicio") continue;
        const wh=await c.get("inventoryWarehouses",item.warehouseId), qty=Number(item.quantity), current=Number(product.stockByWarehouse?.[wh.id]||0), stock=Number(product.stock)+qty;
        const netCost=item.quantity?Number(item.subtotal)/item.quantity:0;
        const cost=(Number(product.stock)*Number(product.baseCost)+Number(item.subtotal))/stock;
        c.put("inventoryProducts",{...product,stock,baseCost:cost,stockByWarehouse:{...product.stockByWarehouse,[wh.id]:current+qty}});
        c.put("inventoryKardex",{id:randomUUID(),date,productId:product.id,productName:product.name,warehouseId:wh.id,warehouseName:wh.name,type:"PURCHASE_RECEIPT",referenceId:id,referenceDocNumber:data.documentNumber,concept:`Compra ${data.documentNumber}`,entryQuantity:qty,entryUnitCost:netCost,entryTotalCost:item.subtotal,balanceQuantity:current+qty,balanceAverageCost:cost,balanceTotalCost:money(cents((current+qty)*cost))}); inventory=true;
      }
      const invoice={...data,...calculation,id,date,supplierName:supplier.razonSocial,supplierRuc:supplier.ruc,ivaAmount:calculation.ivaTotal,paidAmount:0,balanceRemaining:calculation.total,paymentStatus:"pendiente",inventoryStatus:inventory?"ingresado":"no_aplica"};
      c.put("purchaseInvoices",invoice); c.put("purchaseUniqueness",{id:key,purchaseInvoiceId:id});
      const paid=data.paymentCondition==="contado"?calculation.total:Number(data.paidAmount||0);
      if(paid) await execute(c,"paySupplier",{...data,purchaseInvoiceId:id,amount:paid,date});
      return c.writes.get("purchaseInvoices/"+id);
    }
  }
}

export async function executeCommercial(user:UserProfile, command:CommercialCommand, database?:Firestore) {
  const permission=["createClient","assignService","editService","retireClient","retireService"].includes(command.action)?"manage_clients":["createProduct","editProduct","inventoryTransfer","inventoryAdjustment"].includes(command.action)?"manage_network":"manage_finance";
  requirePermission(user,permission);
  if(user.role==="consulta") throw new HttpError(403,"Perfil de consulta.");
  const grants:Partial<Record<CommercialCommand["action"],[Parameters<typeof canUser>[1],string]>>={
    createClient:["clientes","canCreateClient"],assignService:["clientes","canEditClient"],editService:["clientes","canEditClient"],retireClient:["clientes","canDeleteClient"],retireService:["clientes","canEditClient"],
    issueSale:["facturacion","canCreateInvoice"],editSale:["facturacion","canEditPrices"],recur:["facturacion","canCreateInvoice"],
    payCharge:["finanzas","canRegisterReceipts"],advance:["finanzas","canRegisterReceipts"],applyAdvance:["finanzas","canRegisterReceipts"],cancelCharge:["finanzas","canCancelPayments"],cancelAdvance:["finanzas","canCancelPayments"],
    bankMovement:["finanzas",command.data.type==="egreso"?"canRegisterExpenses":"canRegisterReceipts"],adjustBank:["finanzas","canRegisterExpenses"],transfer:["finanzas","canRegisterExpenses"],
    expense:["finanzas","canRegisterExpenses"],startRun:["facturacion","canCreateInvoice"],processRun:["facturacion","canCreateInvoice"],
    reverseApplication:["finanzas","canCancelPayments"],
    purchase:["compras","canRegisterPurchase"],paySupplier:["compras","canApprovePayments"],supplierCredit:["compras","canRegisterPurchase"],supplierDebit:["compras","canRegisterPurchase"],
    createProduct:["inventarios",command.data.type==="servicio"?"canCreateService":"canCreateProduct"],editProduct:["inventarios","canEditProduct"],inventoryTransfer:["inventarios","canTransferWarehouses"],inventoryAdjustment:["inventarios","canAdjustStock"],
  };
  const grant=grants[command.action];
  if(grant&&!canUser(user,grant[0],grant[1])||command.action==="cancelSale"&&!canPerformAction(user,"canDeleteInvoices"))throw new HttpError(403,"No tienes autorización para esta acción comercial.");
  const db=database||adminServices().db, requestHash=digest({action:command.action,data:command.data});
  return db.runTransaction(async tx=>{
    const existing=(await tx.get(db.collection("operationLog").doc(command.operationId))).data();
    if(existing) {
      if(existing.actorId!==user.uid || existing.source?.requestHash!==requestHash) throw new HttpError(409,"Identificador de operación utilizado con otros datos.");
      return existing.source.result;
    }
    const c=new Context(db,tx,user,command.operationId);
    const result=await execute(c,command.action,command.data);
    c.commit(command.action,result,requestHash); return result;
  });
}
