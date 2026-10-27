import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { actor,requirePermission,HttpError } from "@/lib/server/security";
import { adminServices } from "@/lib/server/admin";
import { recordOperation,digest } from "@/lib/server/operation-log";
export const runtime="nodejs";
const schema=z.object({invoiceId:z.string().regex(/^[\w-]{1,150}$/),recipient:z.string().email(),operationId:z.string().uuid()});
export async function POST(request:NextRequest) {
  try {
    const user=await actor(request);requirePermission(user,"manage_finance");
    if(user.role==="consulta")throw new HttpError(403,"Perfil de consulta.");
    const input=schema.parse(await request.json()),url=process.env.EMAIL_DELIVERY_WEBHOOK_URL,token=process.env.EMAIL_DELIVERY_WEBHOOK_TOKEN;
    if(!url||!token)throw new HttpError(503,"El envío de correo aún no está configurado. No se envió ningún mensaje.");
    if(new URL(url).protocol!=="https:")throw new HttpError(503,"El adaptador de correo requiere HTTPS.");
    const {db}=adminServices(),ref=db.collection("outboundMessages").doc(input.operationId),requestHash=digest(input);
    const message:Record<string,any>=await db.runTransaction(async tx=>{
      const prior=await tx.get(ref);
      if(prior.exists){if(prior.data()?.requestHash!==requestHash||prior.data()?.actorId!==user.uid)throw new HttpError(409,"Solicitud de correo incompatible.");return prior.data()!;}
      const invoice=(await tx.get(db.collection("billingInvoices").doc(input.invoiceId))).data();
      if(!invoice||invoice.documentType!=="nota_venta")throw new HttpError(400,"Nota comercial inexistente.");
      const after={id:ref.id,actorId:user.uid,invoiceId:input.invoiceId,recipient:input.recipient,subject:`Nota de venta ${invoice.documentNumber}`,text:`${invoice.clientName}\nNota de venta ${invoice.documentNumber}\nFecha: ${invoice.date}\nTotal: USD ${Number(invoice.total).toFixed(2)}\n${(invoice.items||[]).map((i:any)=>`${i.name}: ${i.quantity} × ${i.unitPrice}`).join("\n")}`,status:"pending",requestHash,version:1,createdAt:new Date().toISOString()};
      tx.create(ref,after);recordOperation(tx,db,user,"QUEUE_EMAIL",[{collection:"outboundMessages",id:ref.id,beforeVersion:null,after}]);return after;
    });
    if(message.status==="accepted")return NextResponse.json({status:"accepted",messageId:message.messageId});
    let messageId:string|undefined,errorMessage:string|undefined;
    try {
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,"Idempotency-Key":input.operationId},body:JSON.stringify({id:input.operationId,to:message.recipient,subject:message.subject,text:message.text}),signal:AbortSignal.timeout(15000)});
      const result=await response.json();
      if(!response.ok||typeof result.messageId!=="string"||!result.messageId)throw new Error("El proveedor no confirmó la aceptación del mensaje.");
      messageId=result.messageId;
    }catch(error){errorMessage=error instanceof Error?error.message:"Respuesta de correo no confirmada.";}
    await db.runTransaction(async tx=>{
      const before=(await tx.get(ref)).data()!;
      if(before.status==="accepted")return;
      const after={...before,status:messageId?"accepted":"unconfirmed",...(messageId?{messageId}:{}),...(errorMessage?{error:errorMessage}:{}),version:Number(before.version)+1,updatedAt:new Date().toISOString()};
      tx.set(ref,after);recordOperation(tx,db,user,messageId?"EMAIL_ACCEPTED":"EMAIL_UNCONFIRMED",[{collection:"outboundMessages",id:ref.id,beforeVersion:before.version,after}]);
    });
    if(errorMessage)throw new HttpError(502,errorMessage+" Reintenta la misma solicitud para consultar o completar su resultado.");
    return NextResponse.json({status:"accepted",messageId});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"No se pudo enviar."},{status:error instanceof HttpError?error.status:400});}
}
