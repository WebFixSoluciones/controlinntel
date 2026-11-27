import { NextRequest, NextResponse } from "next/server";
import { canAccessSubmodule } from "@/lib/permissions";
import { getRecurringRunSummary } from "@/lib/renewal-alerts";
import { adminServices } from "@/lib/server/admin";
import { actor, HttpError, requirePermission } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    requirePermission(user, "manage_finance");
    if (!canAccessSubmodule(user, "ventas", "recurrentes")) throw new HttpError(403, "No tienes acceso a Ventas recurrentes.");

    const { db } = adminServices();
    const snapshot = await db.collection("recurringScheduleRuns")
      .orderBy("date", "desc")
      .limit(1)
      .select("date", "status", "issued", "reviewCount", "failures")
      .get();
    const latest = snapshot.docs[0]?.data();
    return NextResponse.json({ latestRun: latest ? getRecurringRunSummary(latest) : null }, { headers });
  } catch (error) {
    const expected = error instanceof HttpError;
    return NextResponse.json({ error: expected ? error.message : "No se pudo consultar la facturación automática." }, {
      status: expected ? error.status : 503,
      headers,
    });
  }
}
