import {z} from "zod";
import type {UserProfile} from "@/types";
import {requirePermission,HttpError} from "./security.ts";
import {adminServices} from "./admin.ts";
import {recordOperation} from "./operation-log.ts";
import {syncUserIdentity} from "./user-identity.ts";
import {userAccessSnapshot,modulePermissionsSchema} from "../user-access.ts";
const roles=z.enum(["superadmin","admin","ventas","finanzas","tecnico","soporte","bodega","legal","consulta"]);
// Compatibility input only; effective permissions are generated from the saved matrix.
const permissions=z.array(z.string()).default([]);
const profile=z.object({email:z.string().email(),displayName:z.string().min(3).max(150),role:roles,status:z.enum(["activo","inactivo"]),permissions,permissionModelVersion:z.literal(2).optional(),modulePermissions:modulePermissionsSchema.optional(),department:z.string().max(200).optional(),phone:z.string().max(50).optional()});
const requestSchema=z.object({action:z.enum(["create","update","disable"]),uid:z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(),expectedVersion:z.number().int().nonnegative().optional(),data:z.record(z.unknown()).optional()});
export async function administerUser(user: UserProfile, input: unknown, services: Pick<ReturnType<typeof adminServices>, "auth" | "db"> = adminServices()) {
   requirePermission(user,"manage_users");
   // Role delegation is reserved to the top-level administrator, regardless of UI permissions.
   if(user.role!=="superadmin")throw new HttpError(403,"Solo el superadministrador administra cuentas.");
   const body=requestSchema.parse(input),{auth,db}=services;
   if (body.action !== "create" && body.expectedVersion === undefined) throw new HttpError(400,"Recarga la cuenta antes de guardar los cambios.");
   if(body.action==="create") {
     const data=profile.parse(body.data);
     Object.assign(data, userAccessSnapshot(data as any));
     const password=z.string().min(12).max(128).parse(body.data?.passwordHash);
     const account=await auth.createUser({email:data.email,password,displayName:data.displayName,disabled:true});
     let profileWritten = false;
     try {
       const batch=db.batch(),ref=db.collection("users").doc(account.uid);
       const created=JSON.parse(JSON.stringify({...data,uid:account.uid,createdAt:new Date().toISOString(),version:1}));
       batch.create(ref,created);
       recordOperation(batch as any,db,user,"CREATE_USER",[{collection:"users",id:account.uid,beforeVersion:null,after:created}]);
       await batch.commit();
       profileWritten = true;
       await auth.updateUser(account.uid,{disabled:data.status!=="activo"});
     } catch(e) {
       // Leave account disabled if provisioning was only partially successful.
       if (!profileWritten) await auth.deleteUser(account.uid).catch(() => {});
       else await auth.updateUser(account.uid,{disabled:true});
       throw e;
     }
   } else {
     if(!body.uid)throw new HttpError(400,"Usuario requerido.");
     const uid=body.uid;
     if(uid===user.uid)throw new HttpError(400,"Otro superadministrador debe modificar tu cuenta.");
     const changes=body.action==="disable"?{status:"inactivo"}:body.data||{};
     const password=changes.passwordHash;
     if(password!==undefined)z.string().min(12).max(128).parse(password);
     const saved = await db.runTransaction(async tx=>{
       const ref=db.collection("users").doc(uid),existing=await tx.get(ref),old=existing.data();
       if(!old)throw new HttpError(404,"Usuario inexistente.");
       if (body.expectedVersion !== undefined && Number(old.version || 0) !== body.expectedVersion) throw new HttpError(409,"Este usuario cambió. Recarga antes de guardar.");
       const data=profile.parse({...old,...changes});
       Object.assign(data, userAccessSnapshot(data as any));
       if(data.email!==old.email)throw new HttpError(400,"El correo de acceso no puede cambiarse desde este formulario.");
       if(old.role==="superadmin"&&old.status==="activo"&&(data.role!=="superadmin"||data.status!=="activo")) {
         const admins=await tx.get(db.collection("users").where("role","==","superadmin"));
         if(admins.docs.filter(d=>d.data().status==="activo").length<=1)throw new HttpError(409,"Debe quedar un superadministrador activo.");
       }
       const after=JSON.parse(JSON.stringify({...data,uid,createdAt:old.createdAt,version:Number(old.version||0)+1,updatedAt:new Date().toISOString()}));
       tx.set(ref,after);
       recordOperation(tx,db,user,"UPDATE_USER",[{collection:"users",id:uid,beforeVersion:old.version??null,after}]);
       return after;
     });
     await syncUserIdentity(auth, uid, saved, password as string | undefined);
     // Firestore profile is the authority for active/inactive access.
   }
}
