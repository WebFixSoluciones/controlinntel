import {completePermissions} from "../../permission-catalog.ts";
export const testEmployee={uid:"staff",email:"staff@example.test",displayName:"QA Staff",role:"tecnico",status:"activo",permissions:[],version:1,createdAt:"2026-01-01T00:00:00Z"};
export function userFixture(records:Record<string,any>[]=[testEmployee]){
 const rows=new Map<string,any>(records.map(row=>["users/"+row.uid,structuredClone(row)]));
 rows.set("userRoleTemplates/role-qa",{id:"role-qa",name:"Rol QA",baseRole:"admin",status:"activo",version:1,permissionModelVersion:2,modulePermissions:completePermissions()});
 const updates:any[]=[],revoked:string[]=[],deleted:string[]=[],identities=new Map<string,any>();let failCommit=false,failActivation=false,created=0,tail=Promise.resolve();
 const reference=(name:string,filters:any[]=[]):any=>({name,filters,doc:(id:string)=>({path:name+"/"+id,id,parent:{id:name},get:async()=>snap(name+"/"+id)}),where:(field:string,_operator:string,value:unknown)=>reference(name,[...filters,{field,value}])});
 const snap=(key:string)=>({id:key.split("/").at(-1)!,exists:rows.has(key),data:()=>structuredClone(rows.get(key))});
 const db:any={collection:reference,runTransaction:async(fn:any)=>{let release!:()=>void;const prior=tail;tail=new Promise<void>(resolve=>release=resolve);await prior;const pending=new Map<string,any>(),removed=new Set<string>();try{
  const tx={get:async(ref:any)=>ref.path?snap(ref.path):{docs:[...rows].filter(([key,value])=>key.startsWith(ref.name+"/")&&ref.filters.every((filter:any)=>value[filter.field]===filter.value)).map(([key])=>snap(key))},set:(ref:any,data:any)=>pending.set(ref.path,structuredClone(data)),create:(ref:any,data:any)=>{if(rows.has(ref.path))throw Error("Already exists");pending.set(ref.path,structuredClone(data));},delete:(ref:any)=>removed.add(ref.path)};
  const result=await fn(tx);if(failCommit)throw Error("Commit failed");pending.forEach((data,key)=>rows.set(key,data));removed.forEach(key=>rows.delete(key));return result;
 }finally{release();}}};
 const auth:any={createUser:async(data:any)=>{created++;const uid=created===1?"new-user":"new-user-"+created;identities.set(uid,{disabled:data.disabled});return {uid};},updateUser:async(uid:string,data:any)=>{if(failActivation&&data.disabled===false)throw Error("Activation failed");updates.push({uid,...data});identities.set(uid,{...identities.get(uid),...data});},revokeRefreshTokens:async(uid:string)=>{revoked.push(uid);},deleteUser:async(uid:string)=>{deleted.push(uid);identities.delete(uid);}};
 return {rows,updates,revoked,deleted,identities,services:{db,auth},get created(){return created;},failCommit:()=>{failCommit=true;},failActivation:()=>{failActivation=true;}};
}
