import { randomUUID } from "node:crypto";
import { adminServices } from "./admin.ts";
import { audit, HttpError, requirePermission } from "./security.ts";
import { can, canAccessModule, canAccessSubmodule, canManageTicketDepartments, canUser, canViewServicePrices, collectionPermissions, type Entity } from "../permissions.ts";
import { schemas } from "./schemas.ts";
import { seal, unseal, initializeVaultKey } from "./vault.ts";
import { requireVaultAccess } from "./vault-access.ts";
import type { UserProfile } from "@/types";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { recordOperation, redact, digest } from "./operation-log.ts";
import { simpleDecrypt } from "../crypto-vault.ts";
import { canReadCollection,storageName } from "../persistence-contracts.ts";
import { quoteCompanyDetails } from "../quote-company.ts";
import { canManageExpenseCategories, expenseCategoriesWithDefaults, expenseCategoryKey, type ExpenseCategory } from "../expense-categories.ts";
import { fiscalMetadata } from "./sri-metadata.ts";
import { servicePriceFields, visibleServiceData } from "../service-visibility.ts";
import { resolveTicketDepartments } from "../ticket-departments.ts";
import { nextTicketNumber } from "./ticket-sequence.ts";
import { isClosedTicketStatus, requiresPublicTicketReply } from "../ticket-status.ts";
import type { TicketDepartmentRecord } from "@/types";

const now = () => new Date().toISOString();
function nodeServicePassword(service?: DocumentData): string {
  if (typeof service?.password === "string" && service.password) return service.password;
  return typeof service?.credentials === "string" ? service.credentials.split("/").slice(1).join("/").trim() : "";
}
const fiscalCollections: ReadonlySet<string> = new Set(["billingCreditNotes", "billingDebitNotes", "billingWithholdings", "billingRemissionGuides", "purchaseWithholdings"]);
export async function snapshot(user: UserProfile) {
  const {db} = adminServices();
  const result: Record<string, unknown> = {currentUser:user};
  await Promise.all(Object.entries(collectionPermissions).map(async ([entity,permission]) => {
    if(entity==="operationLog") {result[entity]=[];return;}
    const readable=canReadCollection(user,entity as Entity);
    const commercialIssuer = entity === "sriCompanyConfig" && !readable && (canAccessModule(user, "ventas") || canAccessModule(user, "abonados"));
    const expenseSupplierDirectory = entity === "suppliers" && !readable &&
      canAccessSubmodule(user, "finanzas", "gastos") && canUser(user, "finanzas", "canRegisterExpenses");
    if (!readable && !commercialIssuer && !expenseSupplierDirectory) { result[entity]=[]; return; }
    const name = storageName(entity as Entity);
    const collection = db.collection(name);
    const query = (expenseSupplierDirectory ? collection.select("razonSocial", "nombreComercial", "ruc", "status") : collection)
      .orderBy("__name__").limit(500);
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
    result[entity] = documents.filter(d => entity !== "clientAdvances" || !d.data().deletedAt)
      .filter(d => !(entity === "expenses" || entity === "financialMovements") || d.data().status !== "anulado")
      .filter(d=>entity!=="vault"||user.role==="superadmin"||d.data().allowedRoles?.includes(user.role)).map(d => {
      const value = {...d.data(),id:d.id} as DocumentData;
      if (commercialIssuer) return redact(quoteCompanyDetails(value));
      delete value.passwordHash; delete value.secret; delete value.totpSecret; delete value.pppoePassword;
      if (entity==="systemUsers") value.uid=d.id;
      if (entity==="vault" || entity==="clientVaultItems") delete value.encryptedPassword;
      if (entity==="nodes" && Array.isArray(value.services)) {
        value.services = value.services.map((service:DocumentData) => {
          const { passwordSealed, password, credentials, ...rest } = service;
          return {
            ...rest,
            username: rest.username || (typeof credentials === "string" ? credentials.split("/")[0].trim() : ""),
            hasPassword: Boolean(passwordSealed || nodeServicePassword(service)),
          };
        });
      }
      if (entity==="clientProjects"&&!can(user,"manage_finance")) {delete value.estimatedBudget;delete value.executedCost;}
      if (entity==="policies") {
        value.daysUntilExpiration=Math.ceil((Date.parse(value.expirationDate)-Date.now())/86400000);
        value.status=value.daysUntilExpiration<0?"vencida":value.daysUntilExpiration<=30?"por_vencer":"vigente";
      }
      const visible = visibleServiceData(user, entity, value);
      return redact((entity === "billingInvoices" && value.documentType !== "nota_venta") || fiscalCollections.has(entity) ? fiscalMetadata(visible) : visible);
    });
  }));
  if (canAccessModule(user, "tickets") && can(user, "manage_tickets")) {
    const directory = await db.collection("users").where("status", "==", "activo").select("displayName", "role", "permissions", "modulePermissions").get();
    result.ticketAssignees = directory.docs.flatMap(doc => {
      const data = doc.data() as UserProfile;
      return data.displayName && canAccessModule({ ...data, status: "activo" }, "tickets") && can({ ...data, status: "activo" }, "manage_tickets")
        ? [{ uid: doc.id, displayName: data.displayName, role: data.role }] : [];
    });
  } else result.ticketAssignees = [];
  return result;
}
export async function save(user:UserProfile, entity:Entity, input:DocumentData, id?:string, version?:number, database?: Firestore) {
  const permission=collectionPermissions[entity];
  if (!permission || !schemas[entity]) throw new HttpError(400,"Colección no editable.");
  requirePermission(user,permission);
  if (entity === "expenseCategories" && !canManageExpenseCategories(user)) throw new HttpError(403, "No tienes permiso para administrar las categorías de gastos.");
  if (["tickets", "ticketSubjects", "ticketDepartments"].includes(entity) && !canAccessModule(user, "tickets")) throw new HttpError(403,"Acceso restringido a Soporte.");
  if (entity === "userRoleTemplates" && user.role !== "superadmin") throw new HttpError(403,"Solo un superadministrador administra plantillas de rol.");
  if (entity === "ticketDepartments" && !canManageTicketDepartments(user)) throw new HttpError(403,"No tienes permiso para administrar departamentos de soporte.");
  if (entity === "vault" || entity === "clientVaultItems") requireVaultAccess(user, entity, "save");
  if(user.role==="consulta") throw new HttpError(403,"Perfil de consulta.");
  if(entity==="systemUsers")throw new HttpError(400,"Utiliza la administración de cuentas autenticadas.");
  if(entity==="auditLogs")throw new HttpError(400,"La auditoría es generada por el servidor.");
  if(entity==="billingInvoices" || fiscalCollections.has(entity)) throw new HttpError(400,"Utiliza el flujo comercial o de Facturación SRI para este comprobante.");
  const db = database || adminServices().db;
  const reference=db.collection(entity).doc(id || randomUUID());
  return db.runTransaction(async tx=>{
    const old=await tx.get(reference);
    if (!canViewServicePrices(user) && (entity === "plans" || entity === "clientContracts" || entity === "hostingDomains")
      && (!old.exists || servicePriceFields[entity].some(key => key in input && input[key] !== old.data()?.[key]))) {
      throw new HttpError(403, "No tienes permiso para registrar o cambiar los valores del servicio.");
    }
    if (entity === "arcotelFiles" && !old.exists && (!input.fileUrl || input.fileUrl === "#")) {
      throw new HttpError(400, "Carga el archivo original antes de registrar el documento regulatorio.");
    }
    if (["clientServices","inventoryProducts","inventoryKardex","inventoryTransfers","inventoryAdjustments","bankAccounts","financialMovements","clientAdvances","supplierPayments","supplierCreditNotes","supplierDebitNotes","supplierCredits","expenses"].includes(entity)) throw new HttpError(400,"Utiliza la operación comercial para preservar sus relaciones e historial.");
    if(entity==="clients"&&!old.exists)throw new HttpError(400,"Utiliza el alta de cliente con reserva de identificación.");
    if (entity === "sriCompanyConfig") {
      const sensitive = /^(ruc|razonSocial|nombreComercial|direccionMatriz|direccionEstablecimiento|ambiente|establecimiento|puntoEmision.*|secuencial(?!NotaVenta|Cotizacion).*|obligadoContabilidad|tipoContribuyente|resolucionAgenteRetencion|contribuyenteEspecial|rucProveedorFacturacion)$/;
      if (Object.keys(input).some(key => sensitive.test(key) && digest(input[key]) !== digest(old.data()?.[key] ?? null))
        && !canAccessSubmodule(user, "configuracion", "sri")) throw new HttpError(403, "Acceso restringido a Configuración SRI.");
      input = Object.fromEntries(Object.entries(input).filter(([key]) => !key.startsWith("certificado")));
      if (input.rucProveedorFacturacion && !/^\d{13}$/.test(input.rucProveedorFacturacion)) throw new HttpError(400, "El RUC del proveedor debe tener 13 dígitos.");
    }
    if(entity==="monthlyCharges") {
      if(!old.exists||Object.keys(input).some(key=>!["id","version","maxPaymentDate","notes","updatedAt"].includes(key)))throw new HttpError(400,"Solo fecha de vencimiento y notas se editan desde este formulario.");
    }
    if(entity==="purchaseInvoices"&&(!old.exists||Object.keys(input).some(key=>!["id","version","notes","dueDate","updatedAt"].includes(key))))throw new HttpError(400,"Utiliza compras y pagos para modificar importes o partidas.");
    if (old.exists && version !== undefined && old.data()?.version !== version) throw new HttpError(409,"El registro cambió. Actualiza y vuelve a intentarlo.");
    const merged={...old.data(),...input};
    for(const [key,value] of Object.entries(merged)) if(value===null) delete merged[key];
    const data=schemas[entity].parse(merged);
    if (entity === "expenseCategories") {
      const records = await tx.get(db.collection("expenseCategories"));
      const categories = expenseCategoriesWithDefaults(records.docs.map(doc => ({ ...doc.data(), id: doc.id }) as ExpenseCategory));
      if (categories.some(category => category.id !== reference.id && expenseCategoryKey(category.name) === expenseCategoryKey(data.name))) {
        throw new HttpError(409, "Ya existe una categoría de gasto con ese nombre.");
      }
    }
    if (entity === "userRoleTemplates") {
      const templates = await tx.get(db.collection("userRoleTemplates"));
      if (templates.docs.some(doc => doc.id !== reference.id && doc.data().name.toLocaleLowerCase("es") === data.name.toLocaleLowerCase("es"))) {
        throw new HttpError(409, "Ya existe una plantilla de rol con ese nombre.");
      }
    }
    if (entity === "ticketDepartments" || entity === "tickets" || entity === "ticketSubjects") {
      const field = entity === "ticketSubjects" ? "defaultDepartment" : "department";
      if (entity === "ticketDepartments" || !old.exists || data[field] !== old.data()?.[field]) {
        const records = await tx.get(db.collection("ticketDepartments"));
        const departments = resolveTicketDepartments(records.docs.map(doc => ({ ...doc.data(), id: doc.id }) as TicketDepartmentRecord));
        if (entity === "ticketDepartments") {
          const nameKey = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
          if (departments.some(department => department.id !== reference.id && nameKey(department.name) === nameKey(data.name))) {
            throw new HttpError(409, "Ya existe un departamento con ese nombre.");
          }
        } else {
          if (!data[field] && entity === "tickets" && !old.exists) data[field] = departments.find(department => department.active)?.id;
          if (!departments.some(department => department.id === data[field] && department.active)) {
            throw new HttpError(400, "Selecciona un departamento de soporte activo.");
          }
        }
      }
    }
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
      if (["billingQuotes", "clientQuotes"].includes(entity) && parent.data()?.status === "retirado") {
        throw new HttpError(409, "El cliente está retirado y no puede cotizar ni facturar.");
      }
    }
    if (entity==="vault" || entity==="clientVaultItems") {
      if (old.exists && entity === "clientVaultItems" && data.clientId !== old.data()?.clientId) throw new HttpError(400, "La credencial debe permanecer vinculada a su cliente.");
      data.secret=old.data()?.secret;
      if (entity==="vault" && old.exists && user.role!=="superadmin" && !old.data()?.allowedRoles?.includes(user.role)) throw new HttpError(403,"Credencial restringida.");
      // La contraseña llega en claro por HTTPS y se sella aquí. `encryptedPassword` se
      // mantiene solo como compatibilidad para clientes antiguos.
      const incoming = typeof input.password==="string" && input.password
        ? input.password
        : typeof input.encryptedPassword==="string" && input.encryptedPassword
        ? simpleDecrypt(input.encryptedPassword)
        : "";
      if (incoming.length > 4096) throw new HttpError(400, "La contraseña supera el tamaño permitido.");
      if (incoming) {
        await initializeVaultKey();
        data.secret=seal(incoming,entity+"/"+reference.id);
      }
      if (!data.secret) throw new HttpError(400,"Contraseña requerida.");
      delete data.encryptedPassword; delete data.password;
    }
    if (entity==="nodes" && Array.isArray(data.services)) {
      // Las credenciales se sellan en Firestore. Su consulta explícita comprueba permisos.
      // El AAD las ata al nodo y al servicio.
      // Al editar, si el formulario no trae contraseña nueva se conserva la sellada previa.
      const previousServices:DocumentData[] = old.data()?.services || [];
      if (data.services.some((service: DocumentData) => nodeServicePassword(service) ||
        nodeServicePassword(previousServices.find(item => item.id === service.id)))) await initializeVaultKey();
      data.services = data.services.map((service:DocumentData, index:number) => {
        const { password, credentials, passwordSealed, ...rest } = service;
        const context = `nodes/${reference.id}/${rest.id ?? index}`;
        const previous = previousServices.find((item)=>String(item.id)===String(rest.id));
        const plain = nodeServicePassword(service) || (!previous?.passwordSealed ? nodeServicePassword(previous) : "");
        if (plain) rest.passwordSealed = seal(plain, context);
        else if (typeof passwordSealed==="string" && passwordSealed) rest.passwordSealed = passwordSealed;
        else if (previous?.passwordSealed) rest.passwordSealed = previous.passwordSealed;
        rest.hasPassword = Boolean(rest.passwordSealed);
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
      if (requiresPublicTicketReply(old.data()?.status, data.status)) {
        throw new HttpError(400, "Resuelve o cierra el ticket desde el formulario de respuesta al cliente.");
      }
      for (const field of ["messages", "lastReplyAt", "lastReplier", "resolutionNotes", "resolvedAt"]) {
        if (old.data()?.[field] !== undefined) data[field] = old.data()?.[field];
        else delete data[field];
      }
      if (!old.exists) {
        data.ticketNumber=await nextTicketNumber(db, tx);
        delete data.previousTicketNumber;
        const hours:Record<string,number>={critica:4,alta:8,media:24,baja:72};
        data.slaDueAt=new Date(Date.now()+hours[data.priority]*3600000).toISOString();
      }
      if (old.exists) {
        for (const field of ["ticketNumber", "previousTicketNumber"]) {
          if (old.data()?.[field] !== undefined) data[field] = old.data()?.[field];
          else delete data[field];
        }
      }
      if (!isClosedTicketStatus(data.status)) delete data.resolvedAt;
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
    const updated={...data,id:reference.id,version:(old.data()?.version||0)+1,createdAt:old.data()?.createdAt||now(),updatedAt:now()};
    tx.set(reference,updated);
    recordOperation(tx,db,user,old.exists?"UPDATE":"CREATE",[{collection:reference.parent.id,id:reference.id,beforeVersion:old.data()?.version ?? null,after:updated}]);
    return redact(visibleServiceData(user, entity, updated));
  });
}
export async function remove(user:UserProfile,entity:Entity,id:string,version?:number,database?: Firestore) {
  if (!schemas[entity]) throw new HttpError(400,"Eliminación no permitida.");
  if (entity === "expenseCategories") throw new HttpError(400, "Desactiva la categoría para conservar el historial de gastos.");
  if (entity === "expenses") throw new HttpError(400, "El gasto está vinculado a un movimiento de caja y requiere conciliación.");
  requirePermission(user,collectionPermissions[entity]);
  if (entity === "userRoleTemplates" && user.role !== "superadmin") throw new HttpError(403,"Solo un superadministrador administra plantillas de rol.");
  if (entity === "ticketDepartments") throw new HttpError(400,"Desactiva el departamento para conservar los tickets históricos.");
  if (entity === "vault" || entity === "clientVaultItems") requireVaultAccess(user, entity, "delete");
  if(user.role==="consulta")throw new HttpError(403,"Perfil de consulta.");
  if(entity==="systemUsers")throw new HttpError(400,"Desactiva la cuenta desde administración de usuarios.");
  if (fiscalCollections.has(entity) || entity === "sriCompanyConfig") throw new HttpError(400,"Conserva el historial fiscal.");
  if(["monthlyCharges","clientServices","billingInvoices","purchaseInvoices","clientAdvances","bankAccounts","financialMovements","inventoryProducts","inventoryKardex","inventoryTransfers","inventoryAdjustments","supplierPayments"].includes(entity))throw new HttpError(400,"Conserva el historial mediante retiro, ajuste o anulación comercial.");
  const db = database || adminServices().db;
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
export async function reveal(user:UserProfile,entity:string,id:string,database?: Firestore) {
  requireVaultAccess(user, entity, "reveal");
  const db = database || adminServices().db;
  const doc=await db.collection(entity).doc(id).get(),data=doc.data();
  if (!data) throw new HttpError(404,"Credencial inexistente.");
  if (entity==="vault" && user.role!=="superadmin" && !data.allowedRoles?.includes(user.role)) throw new HttpError(403,"Credencial restringida.");
  await initializeVaultKey();
  let value: string;
  try { value=unseal(data.secret,entity+"/"+id); }
  catch { throw new HttpError(409, "No se pudo abrir esta credencial con la clave configurada. Revisa su recuperación antes de reemplazarla."); }
  const log=audit(user,"VIEW_VAULT_PASSWORD",entity+"/"+id);
  await db.collection("auditLogs").doc(log.id).create(log);
  return value;
}

export async function revealNodePassword(user: UserProfile, nodeId: string, serviceId: string, database?: Firestore) {
  requirePermission(user, "manage_network");
  if (!canAccessModule(user, "red") || !canUser(user, "red", "canEditRouterCredentials")) {
    throw new HttpError(403, "No tienes permiso para ver las contraseñas de los sistemas.");
  }
  const db = database || adminServices().db;
  const node = await db.collection("nodes").doc(nodeId).get();
  const service = node.data()?.services?.find((item: DocumentData) => item.id === serviceId);
  if (!service) throw new HttpError(404, "El sistema no existe en este nodo.");
  let password: string;
  if (service.passwordSealed) {
    await initializeVaultKey();
    try { password = unseal(service.passwordSealed, `nodes/${nodeId}/${serviceId}`); }
    catch { throw new HttpError(409, "No se pudo abrir la contraseña de este sistema. Revisa su recuperación antes de reemplazarla."); }
  } else {
    password = nodeServicePassword(service);
  }
  if (!password) throw new HttpError(404, "Este sistema no tiene una contraseña guardada.");
  const log = audit(user, "VIEW_NODE_PASSWORD", `nodes/${nodeId}/services/${serviceId}`);
  await db.collection("auditLogs").doc(log.id).create(log);
  return password;
}

