import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { actor, HttpError } from "@/lib/server/security";
import { snapshot,save,remove,reveal,billing,pay,createClient } from "@/lib/server/operations";
import { collectionPermissions, type Entity } from "@/lib/permissions";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const id=z.string().regex(/^[a-zA-Z0-9_-]{1,150}$/);
const command=z.object({
  action:z.enum(["save","delete","reveal","billing","pay","createClient"]),
  service:z.record(z.unknown()).optional(),
  entity:z.enum(Object.keys(collectionPermissions) as [Entity,...Entity[]]).optional(),
  id:id.optional(),version:z.number().int().positive().optional(),data:z.record(z.unknown()).optional(),
  month:z.number().optional(),year:z.number().optional(),method:z.string().max(200).optional(),
});
function failure(error:unknown) {
  const status=error instanceof HttpError?error.status:error instanceof ZodError?400:503;
  return NextResponse.json({error:error instanceof HttpError?error.message:error instanceof ZodError?"Datos inválidos. Revisa los campos.":"Servicio temporalmente no disponible. Comprueba la configuración del servidor."},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(request:NextRequest) {
  try { return NextResponse.json(await snapshot(await actor(request)),{headers:{"Cache-Control":"no-store"}}); }
  catch(error) {return failure(error);}
}
export async function POST(request:NextRequest) {
  try {
    if(Number(request.headers.get("content-length")||0)>262144) throw new HttpError(413,"Solicitud demasiado grande.");
    const user=await actor(request),body=command.parse(await request.json());
    let result:unknown;
    switch(body.action) {
      case "createClient":
        if(!body.data) throw new HttpError(400,"Datos incompletos.");
        result=await createClient(user,body.data,body.service);break;
      case "save":
        if(!body.entity||!body.data) throw new HttpError(400,"Datos incompletos.");
        result=await save(user,body.entity,body.data,body.id,body.version);break;
      case "delete":
        if(!body.entity||!body.id||!body.version) throw new HttpError(400,"Datos incompletos.");
        await remove(user,body.entity,body.id,body.version);break;
      case "reveal":
        if(!body.entity||!body.id) throw new HttpError(400,"Datos incompletos.");
        result=await reveal(user,body.entity,body.id);break;
      case "billing": result=await billing(user,body.month!,body.year!);break;
      case "pay":
        if(!body.id||!body.method) throw new HttpError(400,"Datos incompletos.");
        await pay(user,body.id,body.method);break;
    }
    return NextResponse.json({result},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return failure(error);}
}
