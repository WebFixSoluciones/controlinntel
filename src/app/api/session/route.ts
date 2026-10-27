import { NextRequest, NextResponse } from "next/server";
import { actor, HttpError } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await actor(request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof HttpError ? error.message : "No se pudo verificar la sesión." }, {
      status: error instanceof HttpError ? error.status : 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
