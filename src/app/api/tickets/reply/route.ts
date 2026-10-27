import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actor, requirePermission, HttpError } from "@/lib/server/security";
import { adminServices } from "@/lib/server/admin";
import { recordOperation } from "@/lib/server/operation-log";
export const runtime="nodejs";
const schema=z.object({id:z.string().regex(/^[\w-]{1,150}$/),messageId:z.string().uuid(),body:z.string().trim().min(1).max(5000),isInternal:z.boolean(),status:z.enum(["abierto","en_progreso","respondido","en_espera","respuesta_cliente","resuelto","cerrado"]).optional()});
export async function POST(request:NextRequest) {
  try {
    const user=await actor(request);requirePermission(user,"manage_tickets");
    if(user.role==="consulta")throw new HttpError(403,"Perfil de consulta.");
    const data=schema.parse(await request.json()),{db}=adminServices();
    await db.runTransaction(async tx=>{
      const ref=db.collection("tickets").doc(data.id),snapshot=await tx.get(ref),ticket=snapshot.data();
      if(!ticket)throw new HttpError(404,"Ticket inexistente.");
      if((ticket.messages||[]).some((m:any)=>m.id===data.messageId))return;
      const timestamp=new Date().toISOString(),message={id:data.messageId,body:data.body,authorId:user.uid,authorName:user.displayName,authorRole:user.role,isInternal:data.isInternal,createdAt:timestamp};
      const status=data.status||(data.isInternal?ticket.status:"respondido");
      const after={...ticket,id:ref.id,status,messages:[...(ticket.messages||[]),message],version:Number(ticket.version||0)+1,updatedAt:timestamp,lastReplyAt:timestamp,lastReplier:user.displayName,...(["resuelto","cerrado"].includes(status)?{resolvedAt:timestamp}:{})};
      tx.set(ref,after);recordOperation(tx,db,user,"REPLY_TICKET",[{collection:"tickets",id:ref.id,beforeVersion:ticket.version??null,after}]);
    });
    return NextResponse.json({ok:true});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"No se pudo responder."},{status:error instanceof HttpError?error.status:400});}
}
