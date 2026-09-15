import { randomUUID } from "node:crypto";
import { adminServices } from "./admin";
import { audit, HttpError, requirePermission } from "./security";
import { can, collectionPermissions, type Entity } from "../permissions";
import { schemas } from "./schemas";
import { seal, unseal } from "./vault";
import type { UserProfile } from "@/types";
import type { DocumentData } from "firebase-admin/firestore";

const now = () => new Date().toISOString();
export async function snapshot(user: UserProfile) {
  const {db} = adminServices();
  const result: Record<string, unknown> = {currentUser:user};
  await Promise.all(Object.entries(collectionPermissions).map(async ([entity,permission]) => {
    if (!can(user,permission)) { result[entity]=[]; return; }
    const name = entity === "systemUsers" ? "users" : entity;
    const query = db.collection(name).limit(2000);
    const docs = await (entity==="auditLogs" ? query.orderBy("timestamp","desc").limit(100) : query).get();
    result[entity] = docs.docs.map(d => {
      const value = {...d.data(),id:d.id} as DocumentData;
      delete value.passwordHash; delete value.secret; delete value.totpSecret; delete value.pppoePassword;
      if (entity==="systemUsers") value.uid=d.id;
      if (entity==="vault" || entity==="clientVaultItems") delete value.encryptedPassword;
      if (entity==="policies") {
        value.daysUntilExpiration=Math.ceil((Date.parse(value.expirationDate)-Date.now())/86400000);
        value.status=value.daysUntilExpiration<0?"vencida":value.daysUntilExpiration<=30?"por_vencer":"vigente";
      }
      return value;
    });
  }));
  return result;
}
export async function save(user:UserProfile, entity:Entity, input:DocumentData, id?:string, version?:number) {
  const permission=collectionPermissions[entity];
  if (!permission || !schemas[entity]) throw new HttpError(400,"Colección no editable.");
  requirePermission(user,permission);
  const {db}=adminServices();
  const reference=db.collection(entity).doc(id || randomUUID());
  return db.runTransaction(async tx=>{
    const old=await tx.get(reference);
    if (id && !old.exists) throw new HttpError(404,"Registro inexistente.");
    if (old.exists && old.data()?.version!==version) throw new HttpError(409,"El registro cambió. Actualiza y vuelve a intentarlo.");
    const data=schemas[entity].parse({...old.data(),...input});
    if(entity==="clients" && old.exists && (data.identificationNumber!==old.data()?.identificationNumber || data.identificationType!==old.data()?.identificationType)) throw new HttpError(400,"La identificación registrada no puede cambiarse desde este formulario.");
    if(entity==="clientServices") {
      const plan=(await tx.get(db.collection("plans").doc(String(data.planId)))).data();
      const node=(await tx.get(db.collection("nodes").doc(String(data.nodeId)))).data();
      if(!plan || !node) throw new HttpError(400,"Plan o nodo inexistente.");
      Object.assign(data,{planName:plan.name,downloadMbps:plan.downloadMbps,uploadMbps:plan.uploadMbps,basePrice:plan.defaultPrice,nodeName:node.name});
    }
    delete data.id; delete data.uid; delete data.passwordHash; delete data.pppoePassword; delete data.totpSecret;
    if (data.clientId) {
      const parent=await tx.get(db.collection("clients").doc(data.clientId));
      if (!parent.exists) throw new HttpError(400,"Cliente inexistente.");
    }
    if (entity==="vault" || entity==="clientVaultItems") {
      data.secret=old.data()?.secret;
      if (entity==="vault" && old.exists && user.role!=="superadmin" && !old.data()?.allowedRoles?.includes(user.role)) throw new HttpError(403,"Credencial restringida.");
      if (typeof input.encryptedPassword==="string" && input.encryptedPassword) data.secret=seal(input.encryptedPassword,entity+"/"+reference.id);
      if (!data.secret) throw new HttpError(400,"Contraseña requerida.");
      delete data.encryptedPassword;
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
    const updated={...data,id:reference.id,version:(old.data()?.version||0)+1,createdAt:old.data()?.createdAt||now(),updatedAt:now()};
    tx.set(reference,updated);
    const log=audit(user,old.exists?"UPDATE":"CREATE",entity+"/"+reference.id);
    tx.create(db.collection("auditLogs").doc(log.id),log);
    return reference.id;
  });
}
export async function remove(user:UserProfile,entity:Entity,id:string,version:number) {
  if (!schemas[entity]) throw new HttpError(400,"Eliminación no permitida.");
  requirePermission(user,collectionPermissions[entity]);
  const {db}=adminServices();
  await db.runTransaction(async tx=>{
    const ref=db.collection(entity).doc(id),record=await tx.get(ref);
    if (!record.exists) throw new HttpError(404,"Registro inexistente.");
    if (record.data()?.version!==version) throw new HttpError(409,"El registro fue modificado.");
    // Preserve historical links; client retirement is explicit instead of cascading deletion.
    if (entity==="clients") throw new HttpError(400,"Retira el cliente editando su estado para conservar su historial.");
    if (entity==="vault" && user.role!=="superadmin" && !record.data()?.allowedRoles?.includes(user.role)) throw new HttpError(403,"Credencial restringida.");
    tx.delete(ref);
    const log=audit(user,"DELETE",entity+"/"+id);tx.create(db.collection("auditLogs").doc(log.id),log);
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
export async function billing(user:UserProfile,month:number,year:number) {
  requirePermission(user,"manage_finance");
  if (!Number.isInteger(month)||month<1||month>12||!Number.isInteger(year)||year<2020||year>2100) throw new HttpError(400,"Periodo inválido.");
  const {db}=adminServices();
  const clients=await db.collection("clients").where("status","==","activo").get();
  let created=0;
  for(const client of clients.docs) {
    created+=await db.runTransaction(async tx=>{
      const reference=db.collection("monthlyCharges").doc("chg-"+client.id+"-"+month+"-"+year);
      if ((await tx.get(reference)).exists) return 0;
      const fresh=await tx.get(client.ref);
      if(fresh.data()?.status!=="activo") return 0;
      const services=await tx.get(db.collection("clientServices").where("clientId","==",client.id));
      const cents=services.docs.filter(s=>s.data().status==="activo").reduce((sum,s)=>sum+Math.round(s.data().customPrice*100),0);
      if(!Number.isSafeInteger(cents)||cents<=0) return 0;
      const rate=Number(process.env.INTERNAL_TAX_RATE||"0.15");
      const subtotal=Math.round(cents/(1+rate)),data=fresh.data()!;
      tx.create(reference,{id:reference.id,clientId:client.id,clientName:data.businessName,clientRuc:data.identificationNumber,
        month,year,serviceDescription:"Servicio Internet - "+month+"/"+year,subtotal:subtotal/100,
        ivaAmount:(cents-subtotal)/100,total:cents/100,status:"pendiente",invoiceNumber:"INT-"+year+"-"+month+"-"+client.id,
        createdAt:now(),updatedAt:now(),version:1});
      const log=audit(user,"EXPORT_BILLING",reference.path);tx.create(db.collection("auditLogs").doc(log.id),log);
      return 1;
    });
  }
  return created;
}
export async function createClient(user:UserProfile,input:DocumentData,service?:DocumentData) {
  requirePermission(user,"manage_clients");
  const data=schemas.clients.parse(input),{db}=adminServices();
  const clientRef=db.collection("clients").doc();
  const key=db.collection("identifications").doc(data.identificationType+"-"+data.identificationNumber);
  return db.runTransaction(async tx=>{
    if((await tx.get(key)).exists) throw new HttpError(409,"Ya existe un cliente con esa identificación.");
    let serviceData:DocumentData|undefined;
    if(service) {
      const plan=(await tx.get(db.collection("plans").doc(String(service.planId)))).data();
      const node=(await tx.get(db.collection("nodes").doc(String(service.nodeId)))).data();
      if(!plan||!node) throw new HttpError(400,"Selecciona un plan y un nodo existentes.");
      serviceData=schemas.clientServices.parse({
        clientId:clientRef.id,planId:service.planId,planName:plan.name,downloadMbps:plan.downloadMbps,uploadMbps:plan.uploadMbps,
        basePrice:plan.defaultPrice,customPrice:service.customPrice??plan.defaultPrice,billingType:service.billingType||plan.billingType,
        cutoffDay:service.cutoffDay||1,nodeId:service.nodeId,nodeName:node.name,ipv4Address:service.ipv4Address||"",
        pppoeUser:service.pppoeUser||data.identificationNumber,status:"en_instalacion",installationDate:now().slice(0,10),
      });
    }
    tx.create(clientRef,{...data,id:clientRef.id,totalActiveServices:0,currentBalance:0,version:1,createdAt:now(),updatedAt:now()});
    tx.create(key,{clientId:clientRef.id});
    if(serviceData) {
      const ref=db.collection("clientServices").doc();
      tx.create(ref,{...serviceData,id:ref.id,version:1,createdAt:now(),updatedAt:now()});
      const task=db.collection("clientProjects").doc();
      tx.create(task,{id:task.id,clientId:clientRef.id,clientName:data.businessName,title:"Instalación: "+serviceData.planName,
        description:"Instalación en "+data.address,column:"factibilidad",priority:"alta",assignedTo:"",
        dueDate:new Date(Date.now()+3*86400000).toISOString().slice(0,10),checklist:[],version:1,createdAt:now(),updatedAt:now()});
    }
    const log=audit(user,"CREATE_CLIENT",clientRef.path);tx.create(db.collection("auditLogs").doc(log.id),log);
    return clientRef.id;
  });
}

export async function pay(user:UserProfile,id:string,method:string) {
  requirePermission(user,"manage_finance"); const {db}=adminServices();
  if(!method.trim()) throw new HttpError(400,"Método de pago requerido.");
  await db.runTransaction(async tx=>{
    const ref=db.collection("monthlyCharges").doc(id),doc=await tx.get(ref),data=doc.data();
    if(!data) throw new HttpError(404,"Cobro inexistente.");
    if(data.status==="pagado") return;
    if(data.status!=="pendiente") throw new HttpError(409,"El cobro no está pendiente.");
    tx.update(ref,{status:"pagado",paymentDate:now().slice(0,10),paymentMethod:method,paidBy:user.uid,version:data.version+1,updatedAt:now()});
    const log=audit(user,"PAYMENT",ref.path);tx.create(db.collection("auditLogs").doc(log.id),log);
  });
}
