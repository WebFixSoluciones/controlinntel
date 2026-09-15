import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {actor,requirePermission,HttpError,audit} from "@/lib/server/security";
import {adminServices} from "@/lib/server/admin";
export const runtime="nodejs";
const roles=z.enum(["superadmin","admin","finanzas","tecnico","soporte","legal","consulta"]);
const permissions=z.array(z.enum(["all","manage_users","manage_vault","manage_clients","manage_network","manage_tickets","manage_finance","manage_policies","export_reports"]));
const profile=z.object({email:z.string().email(),displayName:z.string().min(3).max(150),role:roles,status:z.enum(["activo","inactivo"]),permissions,department:z.string().max(200).optional(),phone:z.string().max(50).optional()});
const requestSchema=z.object({action:z.enum(["create","update","disable"]),uid:z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(),data:z.record(z.unknown()).optional()});
export async function POST(request:NextRequest) {
 try {
   const user=await actor(request);requirePermission(user,"manage_users");
   // Role delegation is reserved to the top-level administrator, regardless of UI permissions.
   if(user.role!=="superadmin")throw new HttpError(403,"Solo el superadministrador administra cuentas.");
   const body=requestSchema.parse(await request.json()),{auth,db}=adminServices();
   if(body.action==="create") {
     const data=profile.parse(body.data);
     const password=z.string().min(12).max(128).parse(body.data?.passwordHash);
     const account=await auth.createUser({email:data.email,password,displayName:data.displayName,disabled:true});
     try {
       const batch=db.batch(),ref=db.collection("users").doc(account.uid);
       batch.create(ref,{...data,uid:account.uid,createdAt:new Date().toISOString()});
       const log=audit(user,"CREATE_USER",ref.path);batch.create(db.collection("auditLogs").doc(log.id),log);
       await batch.commit();
       await auth.updateUser(account.uid,{disabled:data.status!=="activo"});
     } catch(e) {
       // Leave account disabled if provisioning was only partially successful.
       await auth.updateUser(account.uid,{disabled:true});throw e;
     }
   } else {
     if(!body.uid)throw new HttpError(400,"Usuario requerido.");
     const uid=body.uid;
     if(uid===user.uid)throw new HttpError(400,"Otro superadministrador debe modificar tu cuenta.");
     const changes=body.action==="disable"?{status:"inactivo"}:body.data||{};
     const password=changes.passwordHash;
     if(password!==undefined)z.string().min(12).max(128).parse(password);
     await db.runTransaction(async tx=>{
       const ref=db.collection("users").doc(uid),existing=await tx.get(ref),old=existing.data();
       if(!old)throw new HttpError(404,"Usuario inexistente.");
       const data=profile.parse({...old,...changes});
       if(data.email!==old.email)throw new HttpError(400,"El correo de acceso no puede cambiarse desde este formulario.");
       if(old.role==="superadmin"&&(data.role!=="superadmin"||data.status!=="activo")) {
         const admins=await tx.get(db.collection("users").where("role","==","superadmin"));
         if(admins.docs.filter(d=>d.data().status==="activo").length<=1)throw new HttpError(409,"Debe quedar un superadministrador activo.");
       }
       tx.update(ref,{...data,updatedAt:new Date().toISOString()});
       const log=audit(user,"UPDATE_USER",ref.path);tx.create(db.collection("auditLogs").doc(log.id),log);
     });
     if(password)await auth.updateUser(uid,{password:password as string});
     await auth.revokeRefreshTokens(uid);
     // Firestore profile is the authority for active/inactive access.
   }
   return NextResponse.json({ok:true});
 }catch(e){
   return NextResponse.json({error:e instanceof HttpError?e.message:e instanceof z.ZodError?"Revisa los campos; la contraseña nueva requiere al menos 12 caracteres.":"No se pudo administrar la cuenta."},{status:e instanceof HttpError?e.status:e instanceof z.ZodError?400:503});
 }
}

