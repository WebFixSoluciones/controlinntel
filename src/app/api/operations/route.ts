import { NextRequest,NextResponse } from "next/server";
import { actor,requirePermission,HttpError } from "@/lib/server/security";
import { adminServices } from "@/lib/server/admin";
import { redact } from "@/lib/server/operation-log";
export const runtime="nodejs";
export async function GET(request:NextRequest) {
  try {const user=await actor(request);requirePermission(user,"manage_users");const {db}=adminServices();
    const cursor=request.nextUrl.searchParams.get("cursor");
    let query=db.collection("operationLog").orderBy("__name__").limit(100);
    if(cursor){if(!/^[\w-]{1,150}$/.test(cursor))throw new HttpError(400,"Cursor inválido.");query=query.startAfter(cursor);}
    const page=await query.get();
    return NextResponse.json({events:page.docs.map(d=>redact({...d.data(),id:d.id})),nextCursor:page.size===100?page.docs[page.docs.length-1].id:null},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"No se pudo leer el historial."},{status:error instanceof HttpError?error.status:503});}
}
