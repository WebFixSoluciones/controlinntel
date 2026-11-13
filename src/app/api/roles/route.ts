import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {actor,HttpError} from "@/lib/server/security";
import {administerRole} from "@/lib/server/role-administration";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){try{if(Number(request.headers.get("content-length")||0)>131072)throw new HttpError(413,"El rol supera el tamaño permitido.");const result=await administerRole(await actor(request),await request.json());return NextResponse.json({result},{headers:{"Cache-Control":"no-store"}});}catch(error){return NextResponse.json({error:error instanceof HttpError?error.message:error instanceof z.ZodError?"Revisa el nombre, estado y permisos del rol.":"No se pudo administrar el rol."},{status:error instanceof HttpError?error.status:error instanceof z.ZodError?400:503});}}
