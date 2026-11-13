import {randomUUID} from "node:crypto";
import {z} from "zod";
import type {UserProfile, UserRoleTemplate} from "@/types";
import {adminServices} from "./admin.ts";
import {HttpError,requirePermission} from "./security.ts";
import {recordOperation} from "./operation-log.ts";
import {modulePermissionsSchema} from "../user-access.ts";
import {completePermissions} from "../permission-catalog.ts";
import {normalizedRole} from "../role-access.ts";

const schema=z.object({action:z.enum(["create","update","delete"]),id:z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(),expectedVersion:z.number().int().nonnegative().optional(),data:z.object({name:z.string().trim().min(2).max(80),description:z.string().trim().max(500).default(""),status:z.enum(["activo","inactivo"]).default("activo"),modulePermissions:modulePermissionsSchema}).optional()});
export const roleNameKey=(name:string)=>name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").toLocaleLowerCase("es");
export async function administerRole(user:UserProfile,input:unknown,db=adminServices().db){
 requirePermission(user,"manage_users");if(user.role!=="superadmin")throw new HttpError(403,"Solo el superadministrador administra roles.");
 const body=schema.parse(input),id=body.action==="create"?"role-"+randomUUID():body.id;
 if(!id)throw new HttpError(400,"Selecciona un rol.");
 if(body.action!=="create"&&body.expectedVersion===undefined)throw new HttpError(400,"Recarga el rol antes de guardarlo.");
 return db.runTransaction(async tx=>{
  const ref=db.collection("userRoleTemplates").doc(id),snap=await tx.get(ref),old=snap.data();
  if(body.action!=="create"&&!old)throw new HttpError(404,"El rol no existe.");
  if(old&&Number(old.version||0)!==body.expectedVersion)throw new HttpError(409,"El rol cambió. Recarga antes de guardar.");
  if(body.action==="delete"){
   const assigned=await tx.get(db.collection("users").where("accessRoleId","==",id));
   if(assigned.docs.length)throw new HttpError(409,"Este rol tiene usuarios asignados. Desactívalo o reasigna sus usuarios antes de eliminarlo.");
   tx.delete(ref);recordOperation(tx,db,user,"DELETE_ACCESS_ROLE",[{collection:"userRoleTemplates",id,beforeVersion:old?.version??null,after:null}]);return {id};
  }
  if(!body.data)throw new HttpError(400,"Completa los datos del rol.");
  const key=roleNameKey(body.data.name);if(["superadmin","superadministrador","superadministrador (sistema)"].includes(key))throw new HttpError(400,"Ese nombre está reservado al perfil protegido de sistema.");
  const roles=await tx.get(db.collection("userRoleTemplates"));
  if(roles.docs.some(doc=>doc.id!==id&&roleNameKey(String(doc.data().name))===key))throw new HttpError(409,"Ya existe un rol con ese nombre.");
  const after={...body.data,id,name:body.data.name.replace(/\s+/g," "),baseRole:"admin" as const,permissionModelVersion:2 as const,modulePermissions:completePermissions(body.data.modulePermissions as any),version:Number(old?.version||0)+1,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  tx.set(ref,after);recordOperation(tx,db,user,old?"UPDATE_ACCESS_ROLE":"CREATE_ACCESS_ROLE",[{collection:"userRoleTemplates",id,beforeVersion:old?.version??null,after}]);return normalizedRole(after as UserRoleTemplate);
 });
}
