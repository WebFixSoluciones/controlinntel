import { cents, money, chargeBalance, type RecordData as Row } from "./commercial-core.ts";
export type ReconciliationIssue={code:string;collection:string;id:string;reason:string;expected?:number;actual?:number};
export function reconcileCommercial(data:Record<string,Row[]>):ReconciliationIssue[] {
  const issues:ReconciliationIssue[]=[],rows=(name:string)=>data[name]||[];
  const add=(code:string,collection:string,row:Row,reason:string,expected?:number,actual?:number)=>issues.push({code,collection,id:row.id,reason,...(expected!==undefined?{expected}:{}),...(actual!==undefined?{actual}:{})});
  const clientIds=new Set(rows("clients").map(r=>r.id)),bankIds=new Set(rows("bankAccounts").map(r=>r.id));
  const invoiceIds=new Set(rows("billingInvoices").map(r=>r.id)),numbers=new Map<string,string>();
  for(const invoice of rows("billingInvoices")) {
    const key=`${invoice.documentType}:${invoice.documentNumber}`;
    if(invoice.status!=="borrador"&&numbers.has(key))add("DUPLICATE_NUMBER","billingInvoices",invoice,"Numeración repetida con "+numbers.get(key));
    numbers.set(key,invoice.id);
    if(!clientIds.has(invoice.clientId)&&invoice.clientId!=="cf-9999999999999")add("MISSING_CLIENT","billingInvoices",invoice,"Documento sin cliente persistido.");
    if(invoice.documentType==="nota_venta"&&!["borrador","anulada"].includes(invoice.status)&&!rows("monthlyCharges").some(c=>c.invoiceId===invoice.id))add("MISSING_RECEIVABLE","billingInvoices",invoice,"Falta la cuenta por cobrar de origen; no se reconstruye en la pantalla.");
  }
  const chargeOrigins=new Map<string,string>();
  for(const charge of rows("monthlyCharges")) {
    if(charge.invoiceId){if(!invoiceIds.has(charge.invoiceId))add("MISSING_INVOICE","monthlyCharges",charge,"Deuda sin documento de origen.");if(chargeOrigins.has(charge.invoiceId))add("DUPLICATE_RECEIVABLE","monthlyCharges",charge,"Más de una deuda del mismo documento.");chargeOrigins.set(charge.invoiceId,charge.id);}
    const paid=(charge.payments||[]).filter((p:Row)=>p.status!=="reversed").reduce((sum:number,p:Row)=>sum+cents(p.amount),0);
    if(paid!==cents(charge.paidAmount||0))add("PAYMENT_DETAIL_MISMATCH","monthlyCharges",charge,"El historial de aplicaciones no explica el importe aplicado.",money(paid),Number(charge.paidAmount||0));
    if(charge.status!=="anulado"&&chargeBalance(charge)!==Math.max(0,cents(charge.total)-cents(charge.paidAmount||0)))add("RECEIVABLE_BALANCE","monthlyCharges",charge,"Saldo pendiente distinto del documento y sus aplicaciones.");
    if(!clientIds.has(charge.clientId)&&charge.clientId!=="cf-9999999999999")add("MISSING_CLIENT","monthlyCharges",charge,"Deuda sin cliente.");
  }
  for(const client of rows("clients")) {
    const expected=rows("monthlyCharges").filter(c=>c.clientId===client.id).reduce((sum,c)=>sum+chargeBalance(c),0);
    if(expected!==cents(client.currentBalance||0))add("CLIENT_PROJECTION","clients",client,"La cartera no coincide con el saldo mostrado.",money(expected),Number(client.currentBalance||0));
    const count=rows("clientServices").filter(s=>s.clientId===client.id&&s.status==="activo").length;
    if(client.totalActiveServices!==undefined&&Number(client.totalActiveServices)!==count)add("SERVICE_COUNTER","clients",client,"El contador no coincide con sus servicios activos.",count,Number(client.totalActiveServices));
  }
  for(const service of rows("clientServices"))if(!clientIds.has(service.clientId))add("MISSING_CLIENT","clientServices",service,"Servicio sin cliente.");
  for(const advance of rows("clientAdvances")) {
    if(advance.status==="anulado")continue;
    const applied=(advance.applications||[]).filter((p:Row)=>p.status!=="reversed").reduce((sum:number,p:Row)=>sum+cents(p.amount),0),expected=cents(advance.amount)-applied-cents(advance.refundedAmount||0);
    if(expected!==cents(advance.remaining))add("ADVANCE_BALANCE","clientAdvances",advance,"El remanente no coincide con el ingreso y sus aplicaciones.",money(expected),Number(advance.remaining));
  }
  for(const movement of rows("financialMovements"))if(!bankIds.has(movement.bankAccountId))add("MISSING_BANK","financialMovements",movement,"Movimiento sin cuenta persistida.");
  for(const bank of rows("bankAccounts")) {
    const movements=rows("financialMovements").filter(m=>m.bankAccountId===bank.id);
    if(bank.initialBalance===undefined){add("MISSING_OPENING","bankAccounts",bank,"Falta apertura verificable; no se presume saldo cero.");continue;}
    const expected=cents(bank.initialBalance)+movements.filter(m=>m.category!=="apertura").reduce((sum,m)=>sum+(m.type==="ingreso"?1:-1)*cents(m.amount),0);
    if(expected!==cents(bank.currentBalance))add("BANK_PROJECTION","bankAccounts",bank,"Apertura y movimientos no explican el saldo.",money(expected),Number(bank.currentBalance));
  }
  for(const product of rows("inventoryProducts").filter(p=>p.tracksStock&&p.type!=="servicio")) {
    const warehouses=Object.values(product.stockByWarehouse||{}).reduce((sum:number,qty)=>sum+Number(qty),0);
    if(Math.abs(warehouses-Number(product.stock))>0.000001)add("WAREHOUSE_STOCK","inventoryProducts",product,"El total no coincide con las bodegas.",warehouses,Number(product.stock));
    const ledger=rows("inventoryKardex").filter(k=>k.productId===product.id);
    if(!ledger.length&&Number(product.stock)!==0){add("MISSING_STOCK_OPENING","inventoryProducts",product,"Existencias sin kardex/apertura verificable.");continue;}
    const quantity=ledger.reduce((sum,k)=>sum+Number(k.entryQuantity||0)-Number(k.exitQuantity||0),0);
    if(Math.abs(quantity-Number(product.stock))>0.000001)add("KARDEX_QUANTITY","inventoryProducts",product,"El kardex no explica las existencias.",quantity,Number(product.stock));
    const value=ledger.reduce((sum,k)=>sum+cents(k.entryTotalCost||0)-cents(k.exitTotalCost||0),0),current=cents(Number(product.stock)*Number(product.baseCost));
    if(Math.abs(value-current)>1)add("KARDEX_VALUE","inventoryProducts",product,"El kardex no explica la valoración.",money(value),money(current));
  }
  return issues;
}
