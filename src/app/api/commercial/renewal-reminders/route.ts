import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runScheduledRenewalReminders } from "@/lib/server/renewal-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Tarea de avisos sin configurar." }, { status: 503, headers });
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") || "");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: "Acceso restringido." }, { status: 401, headers });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun");
  if (dryRun !== null && dryRun !== "true" && dryRun !== "false") {
    return NextResponse.json({ error: "El valor de dryRun debe ser true o false." }, { status: 400, headers });
  }
  try {
    const result = await runScheduledRenewalReminders({
      enabled: process.env.RENEWAL_EMAIL_ENABLED === "true",
      dryRun: dryRun === "true",
      offsets: process.env.RENEWAL_EMAIL_OFFSETS,
    });
    return NextResponse.json(result, { status: result.failed || result.unconfirmed ? 500 : 200, headers });
  } catch (error) {
    console.error("[renewal-reminders] Falló la ejecución:", error);
    return NextResponse.json({ error: "No se pudieron procesar los avisos de renovación." }, { status: 500, headers });
  }
}
