import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { actor, HttpError } from "@/lib/server/security";
import { commercialActions, executeCommercial } from "@/lib/server/commercial";
import { requirePermission } from "@/lib/server/security";
import { adminServices } from "@/lib/server/admin";
import { CommercialValidationError } from "@/lib/commercial-core";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.object({action:z.enum(commercialActions),operationId:z.string().uuid(),data:z.record(z.unknown())});
export async function GET(request:NextRequest) {
  try {const user=await actor(request);requirePermission(user,"manage_finance");const {db}=adminServices();
    const runs=await db.collection("billingRuns").where("actorId","==",user.uid).get();
    return NextResponse.json({runs:runs.docs.map(d=>({...d.data(),id:d.id})).filter((r:any)=>r.status!=="completed").sort((a:any,b:any)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,20)},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"No se pudo cargar el lote."},{status:error instanceof HttpError?error.status:503});}
}
export async function POST(request:NextRequest) {
  try {
    const user=await actor(request), raw=await request.text();
    if(Buffer.byteLength(raw)>262144) throw new HttpError(413,"Solicitud demasiado grande.");
    const command=schema.parse(JSON.parse(raw));
    return NextResponse.json({result:await executeCommercial(user,command)},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    if(!(error instanceof HttpError||error instanceof CommercialValidationError||error instanceof ZodError)) console.error("[api/commercial] fallo no controlado:",error);
    return NextResponse.json({error:error instanceof HttpError||error instanceof CommercialValidationError?error.message:error instanceof ZodError?"Datos inválidos.":"No se pudo confirmar la operación. Reintenta para consultar su resultado."},{status:error instanceof HttpError?error.status:error instanceof ZodError||error instanceof CommercialValidationError?400:503,headers:{"Cache-Control":"no-store"}});
  }
}
