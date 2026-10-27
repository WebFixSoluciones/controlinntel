import { NextRequest, NextResponse } from "next/server";
import { actor, HttpError } from "@/lib/server/security";
import { recoverSnapshot, rebuildFromLog } from "@/lib/server/recovery";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest) {
  try {
    const user=await actor(request), text=await request.text();
    if(Buffer.byteLength(text)>1_000_000) throw new HttpError(413,"Divide el snapshot en unidades menores.");
    const body=JSON.parse(text);
    if(body.action==="rebuildPreview"||body.action==="rebuildCommit")return NextResponse.json(await rebuildFromLog(user,body,body.action==="rebuildCommit"),{headers:{"Cache-Control":"no-store"}});
    if(!body.snapshot||typeof body.snapshot!=="object")throw new HttpError(400,"Snapshot inválido.");
    return NextResponse.json(await recoverSnapshot(user,body,body.action==="commit"),{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return NextResponse.json({error:error instanceof Error?error.message:"Recuperación fallida."},{status:error instanceof HttpError?error.status:503});}
}
