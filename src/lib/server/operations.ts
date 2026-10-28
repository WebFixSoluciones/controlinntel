import { randomUUID } from "node:crypto";
import { adminServices } from "./admin";
import { audit, HttpError, requirePermission } from "./security";
import { can, canAccessModule, canUser, collectionPermissions, type Entity } from "../permissions";
import { schemas } from "./schemas";
import { seal, unseal } from "./vault";
import type { UserProfile } from "@/types";
import type { DocumentData } from "firebase-admin/firestore";
import { recordOperation, redact, digest } from "./operation-log";
import { simpleDecrypt } from "../crypto-vault";
import { canReadCollection,storageName } from "../persistence-contracts.ts";

const now = () => new Date().toISOString();
export async function snapshot(user: UserProfile) {
  const {db} = adminServices();
  const result: Record<string, unknown> = {currentUser:user};
  await Promise.all(Object.entries(collectionPermissions).map(async ([entity,permission]) => {
    if(entity==="operationLog") {result[entity]=[];return;}
    const readable=canReadCollection(user,entity as Entity);
    if (!readable) { result[entity]=[]; return; }
    const name = storageName(entity as Entity);
    const query = db.collection(name).orderBy("__name__").limit(500);
    const documents = [];
    try {
      let page = await query.get();
      while (!page.empty) {
        documents.push(...page.docs);
        if (page.size < 500) break;
        page = await query.startAfter(page.docs[page.docs.length - 1]).get();
      }
    } catch (queryErr: any) {
      console.warn(`No se pudo consultar la colección ${name} en Firestore:`, queryErr?.message || queryErr);
    }
    result[entity] = documents.filter(d=>entity!=="vault"||user.role==="superadmin"||d.data().allowedRoles?.includes(user.role)).map(d => {
      const value = {...d.data(),id:d.id} as DocumentData;
      delete value.passwordHash; delete value.secret; delete value.totpSecret; delete value.pppoePassword;
      if (entity==="systemUsers") value.uid=d.id;
      if (entity==="vault" || entity==="clientVaultItems") delete value.encryptedPassword;
      if (entity==="nodes" && Array.isArray(value.services)) {
        // El secreto está sellado en el documento. Solo se descifra para quien puede
        // revelar credenciales de router; para el resto se enmascara por completo.
        const canReveal = canUser(user,"red","canEditRouterCredentials");
        value.services = value.services.map((service:DocumentData, index:number) => {
          const { passwordSealed, password, credentials, ...rest } = service;
          const sealed = passwordSealed;
          if (!canReveal) return { ...rest, hasPassword: Boolean(sealed) };
          if (typeof sealed!=="string" || !sealed) return { ...rest, hasPassword: false };
          try {
            rest.password = unseal(sealed, `nodes/${d.id}/${rest.id ?? index}`);
          } catch {
            // Secreto ilegible: se informa sin filtrar el contenido.
            return { ...rest, hasPassword: false, secretUnreadable: true };
          }
          return { ...rest, hasPassword: true };
        });
      }
      if (entity==="inventoryProducts"&&!canUser(user,"inventarios","canViewCosts")) delete value.baseCost;
      if (entity==="clientProjects"&&!can(user,"manage_finance")) {delete value.estimatedBudget;delete value.executedCost;}
      if (entity==="policies") {
        value.daysUntilExpiration=Math.ceil((Date.parse(value.expirationDate)-Date.now())/86400000);
        value.status=value.daysUntilExpiration<0?"vencida":value.daysUntilExpiration<=30?"por_vencer":"vigente";
      }
      return redact(value);
    });
  }));
  return result;
}
export async function save(user:UserProfile, entity:Entity, input:DocumentData, id?:string, version?:number) {
  const permission=collectionPermissions[entity];
  if (!permission || !schemas[entity]) throw new HttpError(400,"Colección no editable.");
  requirePermission(user,permission);
  if(user.role==="consulta") throw new HttpError(403,"Perfil de consulta.");
  if(entity==="systemUsers")throw new HttpError(400,"Utiliza la administración de cuentas autenticadas.");
  if(entity==="auditLogs")throw new HttpError(400,"La auditoría es generada por el servidor.");
  const {db}=adminServices();
  const reference=db.collection(entity).doc(id || randomUUID());
  return db.runTransaction(async tx=>{
    const old=await tx.get(reference);
    if (["clientServices","inventoryProducts","inventoryKardex","inventoryTransfers","inventoryAdjustments","bankAccounts","financialMovements","clientAdvances","supplierPayments","supplierCreditNotes","supplierDebitNotes","supplierCredits","expenses"].includes(entity)) throw new HttpError(400,"Utiliza la operación comercial para preservar sus relaciones e historial.");
    if(entity==="clients"&&!old.exists)throw new HttpError(400,"Utiliza el alta de cliente con reserva de identificación.");
    if(entity==="billingInvoices"&&input.documentType==="nota_venta"&&!old.exists)throw new HttpError(400,"Utiliza la emisión comercial.");
    if(entity==="billingInvoices"&&old.data()?.documentType==="nota_venta") {
      const permitted=new Set(["id","version","updatedAt","sriStatus","sriInvoiceId","sriDocumentNumber"]);
      if(Object.keys(input).some(key=>!permitted.has(key)&&digest(input[key])!==digest(old.data()?.[key]??null)))throw new HttpError(400,"Utiliza edición o anulación comercial para cambiar esta venta.");
    }
    if(entity==="monthlyCharges") {
      if(!old.exists||Object.keys(input).some(key=>!["id","version","maxPaymentDate","notes","updatedAt"].includes(key)))throw new HttpError(400,"Solo fecha de vencimiento y notas se editan desde este formulario.");
    }
    if(entity==="purchaseInvoices"&&(!old.exists||Object.keys(input).some(key=>!["id","version","notes","dueDate","updatedAt"].includes(key))))throw new HttpError(400,"Utiliza compras y pagos para modificar importes o partidas.");
    if (old.exists && version !== undefined && old.data()?.version !== version) throw new HttpError(409,"El registro cambió. Actualiza y vuelve a intentarlo.");
    const merged={...old.data(),...input};
    for(const [key,value] of Object.entries(merged)) if(value===null) delete merged[key];
    const data=schemas[entity].parse(merged);
    if(entity==="clients") {data.currentBalance=old.data()?.currentBalance??0;data.totalActiveServices=old.data()?.totalActiveServices??0;}
    if(entity==="clients" && old.exists && (data.identificationNumber!==old.data()?.identificationNumber || data.identificationType!==old.data()?.identificationType)) throw new HttpError(400,"La identificación registrada no puede cambiarse desde este formulario.");
    if(entity==="clientServices") {
      const plan=(await tx.get(db.collection("plans").doc(String(data.planId)))).data();
      const product=(await tx.get(db.collection("inventoryProducts").doc(String(data.inventoryProductId || data.planId)))).data();
      if(!plan && (!product || product.type !== "servicio")) throw new HttpError(400,"Servicio o plan inexistente.");
      if (data.nodeId) {
        const node=(await tx.get(db.collection("nodes").doc(String(data.nodeId)))).data();
        if (!node) throw new HttpError(400,"Nodo inexistente.");
      }
    }
    delete data.id; delete data.uid; delete data.passwordHash; delete data.pppoePassword; delete data.totpSecret;
    if (data.clientId) {
      const parent=await tx.get(db.collection("clients").doc(data.clientId));
      if (!parent.exists && data.clientId !== "cf-9999999999999") throw new HttpError(400,"Cliente inexistente.");
    }
    if (entity==="vault" || entity==="clientVaultItems") {
      data.secret=old.data()?.secret;
      if (entity==="vault" && old.exists && user.role!=="superadmin" && !old.data()?.allowedRoles?.includes(user.role)) throw new HttpError(403,"Credencial restringida.");
      // La contraseña llega en claro por HTTPS y se sella aquí. `encryptedPassword` se
      // mantiene solo como compatibilidad para clientes antiguos.
      const incoming = typeof input.password==="string" && input.password
        ? input.password
        : typeof input.encryptedPassword==="string" && input.encryptedPassword
        ? simpleDecrypt(input.encryptedPassword)
        : "";
      if (incoming) data.secret=seal(incoming,entity+"/"+reference.id);
      if (!data.secret) throw new HttpError(400,"Contraseña requerida.");
      delete data.encryptedPassword; delete data.password;
    }
    if (entity==="nodes" && Array.isArray(data.services)) {
      // Las credenciales de los equipos se sellan aquí: nunca vuelven a viajar en claro
      // al navegador ni quedan legibles en Firestore. El AAD las ata al nodo y al servicio.
      // Al editar, si el formulario no trae contraseña nueva se conserva la sellada previa.
      const previousServices:DocumentData[] = old.data()?.services || [];
      data.services = data.services.map((service:DocumentData, index:number) => {
        const { password, credentials, passwordSealed, ...rest } = service;
        const plain = typeof password==="string" && password
          ? password
          : typeof credentials==="string" && credentials.includes("/")
          ? credentials.split("/").slice(1).join("/").trim()
          : "";
        const context = `nodes/${reference.id}/${rest.id ?? index}`;
        const previous = previousServices.find((item)=>String(item.id)===String(rest.id));
        if (plain) rest.passwordSealed = seal(plain, context);
        else if (typeof passwordSealed==="string" && passwordSealed) rest.passwordSealed = passwordSealed;
        else if (previous?.passwordSealed) rest.passwordSealed = previous.passwordSealed;
        return rest;
      });
    }
    if (entity==="clientQuotes") {
      data.items=data.items.map((item:DocumentData)=>({...item,total:Math.round(item.quantity*item.unitPrice*100)/100}));
      data.subtotal=Math.round(data.items.reduce((sum:number,item:DocumentData)=>sum+item.total,0)*100)/100;
      data.ivaAmount=Math.round(data.subtotal*Number(process.env.INTERNAL_TAX_RATE || "0.15")*100)/100;
      data.total=data.subtotal+data.ivaAmount;
      if (!old.exists) data.quoteNumber="ORD-"+reference.id;
    }
    if (entity==="tickets") {
      if (!old.exists) {
        data.ticketNumber="TCK-"+reference.id;
        const hours:Record<string,number>={critica:4,alta:8,media:24,baja:72};
        data.slaDueAt=new Date(Date.now()+hours[data.priority]*3600000).toISOString();
      }
      if (data.status==="resuelto" || data.status==="cerrado") data.resolvedAt=old.data()?.resolvedAt || now();
    }
    if (entity==="purchaseInvoices" && !old.exists) {
      const rucClean = String(data.supplierRuc || "").replace(/\D/g, "");
      const docClean = String(data.documentNumber || "").trim();
      if (rucClean && docClean) {
        const dupRef = db.collection("purchaseUniqueness").doc(`${rucClean}_${docClean}`);
        const dupSnap = await tx.get(dupRef);
        if (dupSnap.exists) {
          throw new HttpError(409, `Factura de compra ${docClean} ya fue registrada para el RUC ${rucClean}.`);
        }
        tx.create(dupRef, { createdAt: now(), invoiceId: reference.id });
      }
    }
    if (entity==="billingInvoices" && !old.exists && data.claveAcceso) {
      const claveClean = String(data.claveAcceso).trim();
      const dupClave = db.collection("claveAccesoUniqueness").doc(claveClean);
      const snap = await tx.get(dupClave);
      if (snap.exists) {
        throw new HttpError(409, `La clave de acceso SRI ${claveClean} ya fue registrada previamente.`);
      }
      tx.create(dupClave, { createdAt: now(), invoiceId: reference.id });
    }
    const updated={...data,id:reference.id,version:(old.data()?.version||0)+1,createdAt:old.data()?.createdAt||now(),updatedAt:now()};
    tx.set(reference,updated);
    recordOperation(tx,db,user,old.exists?"UPDATE":"CREATE",[{collection:reference.parent.id,id:reference.id,beforeVersion:old.data()?.version ?? null,after:updated}]);
    return redact(updated);
  });
}
export async function remove(user:UserProfile,entity:Entity,id:string,version?:number) {
  if (!schemas[entity]) throw new HttpError(400,"Eliminación no permitida.");
  requirePermission(user,collectionPermissions[entity]);
  if(user.role==="consulta")throw new HttpError(403,"Perfil de consulta.");
  if(entity==="systemUsers")throw new HttpError(400,"Desactiva la cuenta desde administración de usuarios.");
  if(["monthlyCharges","clientServices","billingInvoices","purchaseInvoices","clientAdvances","bankAccounts","financialMovements","inventoryProducts","inventoryKardex","inventoryTransfers","inventoryAdjustments","supplierPayments"].includes(entity))throw new HttpError(400,"Conserva el historial mediante retiro, ajuste o anulación comercial.");
  const {db}=adminServices();
  await db.runTransaction(async tx=>{
    const ref=db.collection(entity).doc(id),record=await tx.get(ref);
    if (!record.exists) throw new HttpError(404,"Registro inexistente.");
    if (version !== undefined && record.data()?.version !== version) throw new HttpError(409,"El registro fue modificado.");
    // Preserve historical links; client retirement is explicit instead of cascading deletion.
    if (entity==="clients") throw new HttpError(400,"Retira el cliente editando su estado para conservar su historial.");
    if (entity==="vault" && user.role!=="superadmin" && !record.data()?.allowedRoles?.includes(user.role)) throw new HttpError(403,"Credencial restringida.");
    if (["auditLogs", "operationLog"].includes(entity)) throw new HttpError(400,"Registro inmutable.");
    tx.delete(ref);
    recordOperation(tx,db,user,"DELETE",[{collection:entity,id,beforeVersion:record.data()?.version ?? null,after:null}]);
  });
}
export async function reveal(user:UserProfile,entity:string,id:string) {
  requirePermission(user,"manage_vault");
  if (!["vault","clientVaultItems"].includes(entity)) throw new HttpError(400,"Bóveda inválida.");
  const {db}=adminServices();
  const doc=await db.collection(entity).doc(id).get(),data=doc.data();
  if (!data) throw new HttpError(404,"Credencial inexistente.");
  if (entity==="vault" && user.role!=="superadmin" && !data.allowedRoles?.includes(user.role)) throw new HttpError(403,"Credencial restringida.");
  const value=unseal(data.secret,entity+"/"+id);
  const log=audit(user,"VIEW_VAULT_PASSWORD",entity+"/"+id);
  await db.collection("auditLogs").doc(log.id).create(log);
  return value;
}

