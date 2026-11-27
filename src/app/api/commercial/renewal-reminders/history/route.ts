import { NextRequest, NextResponse } from "next/server";
import { canAccessSubmodule } from "@/lib/permissions";
import { readRenewalReminderHistory } from "@/lib/server/renewal-email";
import { actor, HttpError, requirePermission } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    requirePermission(user, "manage_finance");
    if (!canAccessSubmodule(user, "ventas", "recurrentes")) throw new HttpError(403, "No tienes acceso a Ventas recurrentes.");
    return NextResponse.json({ events: await readRenewalReminderHistory() }, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof HttpError ? error.message : "No se pudo cargar el historial de avisos." },
      { status: error instanceof HttpError ? error.status : 503, headers },
    );
  }
}
