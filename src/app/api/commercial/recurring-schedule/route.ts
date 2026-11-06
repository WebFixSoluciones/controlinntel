import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getEcuadorDate } from "@/lib/date-utils";
import { adminServices } from "@/lib/server/admin";
import { runScheduledRecurringBilling } from "@/lib/server/commercial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Tarea recurrente sin configurar." }, { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") || "");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 401 });
  }
  const today = getEcuadorDate();
  if (!today.endsWith("-01")) return NextResponse.json({ date: today, issued: 0, skipped: true });
  try {
    const result = await runScheduledRecurringBilling(adminServices().db, today);
    return NextResponse.json(result, { status: result.failures.length ? 500 : 200 });
  } catch (error) {
    console.error("[recurring-schedule] Falló la ejecución:", error);
    return NextResponse.json({ error: "No se pudo procesar la facturación programada." }, { status: 503 });
  }
}
