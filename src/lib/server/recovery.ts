import { adminServices } from "./admin";
import { HttpError } from "./security";
import { digest, recordOperation } from "./operation-log";
import { planSnapshotRecovery } from "../recovery-plan.ts";
import { schemas } from "./schemas";
import { seal } from "./vault";
import { simpleDecrypt } from "../crypto-vault";
import type { UserProfile } from "@/types";

// Every import is reviewed by digest. Existing rows are never overwritten.
export async function recoverSnapshot(user:UserProfile, payload:Record<string,any>, commit=false) {
  if(user.role!=="superadmin") throw new HttpError(403,"Solo administración puede revisar recuperaciones.");
  const {db}=adminServices(), hash=digest(payload.snapshot), importId="snapshot-"+digest([hash,[...(payload.approvedIds||[])].sort()]);
  return db.runTransaction(async tx=>{
    const imported=await tx.get(db.collection("operationLog").doc(importId));
    if(imported.exists) return {digest:hash,alreadyImported:true,items:[]};
    const current:Record<string,any[]>={};
    // Includes references and uniqueness comparisons, not just collections in the input.
    for(const collection of Object.keys(schemas)) {
      if(["systemUsers","auditLogs"].includes(collection))continue;
      const rows=await tx.get(db.collection(collection)); current[collection]=rows.docs.map(d=>({...d.data(),id:d.id}));
    }
    const items=planSnapshotRecovery(payload.snapshot,current), missing=items.filter(i=>i.state==="missing");
    if(!commit) return {digest:hash,items:items.map(({data,...item})=>item),counts:items.reduce((s:any,i)=>(s[i.state]=(s[i.state]||0)+1,s),{})};
    if(payload.approvedDigest!==hash || !payload.sourceName || !Array.isArray(payload.approvedIds)) throw new HttpError(400,"Falta aprobar el snapshot y la selección revisada.");
    const selected=missing.filter(i=>payload.approvedIds.includes(i.collection+"/"+i.id));
    if(!selected.length || selected.length!==payload.approvedIds.length || selected.length>100) throw new HttpError(409,"Selección vacía, cambió o supera 100 registros. Vuelve a previsualizar.");
    // All required parents must already exist or belong to this same atomic selection.
    const selection:Record<string,any[]>={}; selected.forEach(i=>(selection[i.collection]??=[]).push(i.data));
    const scoped=planSnapshotRecovery(selection,current);
    if(scoped.some(i=>i.state!=="missing")) throw new HttpError(409,"La selección no incluye las dependencias necesarias.");
    const effects=selected.map(item=>{
      const data:Record<string,any>={...item.data,id:item.id,version:1,_recovery:{sourceName:String(payload.sourceName),snapshotDigest:hash,importedBy:user.uid}};
      if(["vault","clientVaultItems"].includes(item.collection)) {
        const secret=String(data.encryptedPassword||"");if(!secret)throw new HttpError(400,"Credencial sin secreto recuperable.");
        data.secret=seal(simpleDecrypt(secret),item.collection+"/"+item.id);delete data.encryptedPassword;
      }
      return {collection:item.collection,id:item.id,beforeVersion:null,after:data};
    });
    if(Buffer.byteLength(JSON.stringify(effects))>800000) throw new HttpError(413,"Divide la importación en snapshots menores.");
    // A missing row can have a tombstone in operationLog: the operator must resolve it first.
    const logs=await tx.get(db.collection("operationLog"));
    for(const effect of effects) if(logs.docs.some(d=>(d.data().effects||[]).some((e:any)=>e.collection===effect.collection&&e.id===effect.id&&e.after===null))) throw new HttpError(409,"Existe una eliminación registrada. Revisa el historial antes de recuperar ese ID.");
    effects.forEach(e=>tx.create(db.collection(e.collection).doc(e.id),e.after));
    recordOperation(tx,db,user,"IMPORT_SNAPSHOT",effects,importId,{snapshotDigest:hash,sourceName:String(payload.sourceName),origin:"legacy-snapshot",verifiedHistoricalOrder:false});
    return {digest:hash,imported:effects.length};
  });
}

export async function rebuildFromLog(user:UserProfile,payload:Record<string,any>,commit=false) {
  if(user.role!=="superadmin")throw new HttpError(403,"Solo administración puede reconstruir proyecciones.");
  const refs=payload.references;
  if(!Array.isArray(refs)||!refs.length||refs.length>100||refs.some((r:any)=>typeof r!=="string"||!/^\w+\/[a-zA-Z0-9_-]{1,150}$/.test(r)))throw new HttpError(400,"Selecciona entre 1 y 100 referencias válidas.");
  const {db}=adminServices();
  return db.runTransaction(async tx=>{
    const logs=await tx.get(db.collection("operationLog"));
    const effects=[];
    for(const reference of refs) {
      const [collection,id]=reference.split("/");
      if(!schemas[collection]||["systemUsers","auditLogs"].includes(collection))throw new HttpError(400,"Colección protegida.");
      const existing=await tx.get(db.doc(reference));
      if(existing.exists)throw new HttpError(409,`${reference} ya existe; no se sobrescribe.`);
      const candidates:any[]=[];
      for(const log of logs.docs) {
        const event=log.data();
        if(event.status!=="committed"||digest(event.effects)!==event.digest)throw new HttpError(409,"El historial contiene un evento sin integridad verificable.");
        for(const effect of event.effects)if(effect.collection===collection&&effect.id===id)candidates.push({...effect,eventId:log.id,eventTime:event.timestamp,effectiveVersion:effect.after?.version??Number(effect.beforeVersion||0)+1});
      }
      candidates.sort((a,b)=>b.effectiveVersion-a.effectiveVersion||String(b.eventTime).localeCompare(String(a.eventTime)));
      const latest=candidates[0];
      if(!latest)throw new HttpError(409,`No existe evidencia de ${reference} en operationLog; utiliza revisión de snapshots.`);
      if(latest.after===null)throw new HttpError(409,`${reference} tiene una eliminación confirmada.`);
      if(candidates.some(e=>e.effectiveVersion===latest.effectiveVersion&&digest(e.after)!==digest(latest.after)))throw new HttpError(409,`Hay versiones ambiguas de ${reference}.`);
      effects.push({collection,id,beforeVersion:null,after:latest.after,sourceEventId:latest.eventId});
    }
    const hash=digest(effects);
    if(!commit)return {digest:hash,references:effects.map(e=>({reference:e.collection+"/"+e.id,sourceEventId:e.sourceEventId}))};
    if(payload.approvedDigest!==hash)throw new HttpError(409,"El historial cambió; vuelve a revisar la reconstrucción.");
    effects.forEach(e=>tx.create(db.collection(e.collection).doc(e.id),e.after));
    recordOperation(tx,db,user,"REBUILD_PROJECTION",effects,"rebuild-"+hash,{origin:"operationLog",sourceEventIds:effects.map(e=>e.sourceEventId)});
    return {rebuilt:effects.length,digest:hash};
  });
}
