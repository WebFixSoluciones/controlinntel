import { schemas } from "./server/schemas.ts";
import type { RecordData } from "./commercial-core.ts";

const aliases:Record<string,string>={users:"systemUsers",charges:"monthlyCharges",inventoryItems:"inventoryProducts",warehouses:"inventoryWarehouses"};
const protectedCollections=new Set(["systemUsers","auditLogs","operationLog","sequences","documentNumbers"]);
export type RecoveryItem={collection:string;id:string;state:"missing"|"identical"|"conflict"|"invalid"|"blocked";reason:string;data?:RecordData};
export function normalizeLegacy(collection:string,row:RecordData) {
  const data={...row};
  if(collection==="billingInvoices") { data.documentNumber??=data.invoiceNumber; data.date??=data.issueDate; }
  if(collection==="purchaseInvoices") data.date??=data.issueDate;
  if(collection==="inventoryProducts") data.stock??=data.currentStock;
  if(collection==="inventoryTransfers") data.destWarehouseId??=data.destinationWarehouseId;
  if(collection==="suppliers") { data.ruc??=data.identificationNumber; data.razonSocial??=data.businessName; }
  if(collection==="hostingDomains") { data.domainOrService??=data.domainName; data.annualCost??=data.annualCostUsd; }
  return data;
}
function businessValue(row:RecordData) {
  const ignored=new Set(["version","updatedAt","createdAt","_recovery"]);
  const normalize=(v:any):any=>Array.isArray(v)?v.map(normalize):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().filter(k=>!ignored.has(k)).map(k=>[k,normalize(v[k])])):v;
  return JSON.stringify(normalize(row));
}
export function planSnapshotRecovery(snapshot:RecordData,current:Record<string,RecordData[]>):RecoveryItem[] {
  const items:RecoveryItem[]=[];
  for(const [source,rows] of Object.entries(snapshot.state||snapshot)) {
    if(!Array.isArray(rows)) continue;
    const collection=aliases[source]||source;
    for(const row of rows) {
      const id=String(row?.id||row?.uid||"");
      if(protectedCollections.has(collection)||!schemas[collection]) { items.push({collection,id,state:"blocked",reason:"Colección protegida o sin contrato de recuperación."}); continue; }
      if(!/^[a-zA-Z0-9_-]{1,150}$/.test(id)) {items.push({collection,id,state:"invalid",reason:"Identificador ausente o inválido; no se inventará uno."});continue;}
      const data=normalizeLegacy(collection,row), validation=schemas[collection].safeParse(data);
      if(!validation.success) {items.push({collection,id,state:"invalid",reason:validation.error.issues.map(i=>i.path.join(".")+": "+i.message).join("; ")});continue;}
      if(items.some(i=>i.collection===collection&&i.id===id)) {items.push({collection,id,state:"conflict",reason:"ID repetido dentro del snapshot."});continue;}
      const existing=(current[collection]||[]).find(r=>r.id===id);
      items.push({collection,id,state:existing?(businessValue(existing)===businessValue(data)?"identical":"conflict"):"missing",reason:existing?"Comparado con el registro persistido.":"Ausente en la base; candidato de importación, pendiente de validar relaciones.",data:validation.data});
    }
  }
  const relationships:Record<string,string>={clientId:"clients",supplierId:"suppliers",bankAccountId:"bankAccounts",invoiceId:"billingInvoices",purchaseInvoiceId:"purchaseInvoices",productId:"inventoryProducts",warehouseId:"inventoryWarehouses"};
  let changed=true;
  while(changed) {
    changed=false;
    for(const item of items.filter(i=>i.state==="missing"&&i.data)) {
      for(const [field,parent] of Object.entries(relationships)) {
        const id=item.data![field]; if(!id||id==="cf-9999999999999")continue;
        if(!(current[parent]||[]).some(r=>r.id===id)&&!items.some(i=>i.collection===parent&&i.id===id&&(i.state==="missing"||i.state==="identical"))) {
          item.state="blocked";item.reason=`Falta relación verificable ${field}: ${id}.`;changed=true;break;
        }
      }
      if(item.collection==="billingInvoices" && items.some(i=>i!==item&&i.collection==="billingInvoices"&&i.data?.documentNumber===item.data?.documentNumber&&i.id!==item.id) || item.collection==="billingInvoices" && (current.billingInvoices||[]).some(i=>i.id!==item.id&&i.documentType===item.data?.documentType&&i.documentNumber===item.data?.documentNumber)) {
        item.state="conflict";item.reason="Numeración comercial duplicada; requiere resolución administrativa.";changed=true;
      }
    }
  }
  return items;
}
