import { NextRequest, NextResponse } from "next/server";
import { actor, HttpError } from "@/lib/server/security";
import { adminServices } from "@/lib/server/admin";
import { numberHistoricalTickets } from "@/lib/server/ticket-sequence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await actor(request);
    if (user.role !== "superadmin") throw new HttpError(403, "Solo un superadministrador puede numerar tickets históricos.");
    return NextResponse.json(await numberHistoricalTickets(adminServices().db, user), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof HttpError ? error.message : "No se pudo actualizar la numeración de soporte." },
      { status: error instanceof HttpError ? error.status : 503 });
  }
}
