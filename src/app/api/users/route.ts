import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {actor,HttpError} from "@/lib/server/security";
import {administerUser} from "@/lib/server/user-administration";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:NextRequest) {
  try {
    const user = await actor(request);
    await administerUser(user, await request.json());
    return NextResponse.json({ok:true});
  } catch(error) {
    if (error instanceof HttpError) return NextResponse.json({error:error.message},{status:error.status});
    if (error instanceof z.ZodError) return NextResponse.json({error:"Revisa los campos y los permisos; la contraseña nueva requiere al menos 12 caracteres."},{status:400});
    const code = (error as {code?:string})?.code;
    if (code === "auth/email-already-exists") return NextResponse.json({error:"Ya existe una cuenta con ese correo."},{status:409});
    if (code === "auth/invalid-password") return NextResponse.json({error:"La contraseña no cumple los requisitos de seguridad."},{status:400});
    return NextResponse.json({error:"No se completó la administración de la cuenta. Recarga para comprobar su estado antes de reintentar."},{status:503});
  }
}
