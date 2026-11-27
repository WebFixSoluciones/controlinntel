import { NextRequest, NextResponse } from "next/server";
import { getEcuadorDate, addMonthsSafely } from "@/lib/date-utils";
import { canAccessSubmodule, canUser, canViewFinancialAmounts, canViewServicePrices } from "@/lib/permissions";
import { adminServices } from "@/lib/server/admin";
import { previewScheduledRecurringBilling } from "@/lib/server/commercial";
import { actor, HttpError, requirePermission } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    requirePermission(user, "manage_finance");
    if (!canAccessSubmodule(user, "ventas", "recurrentes")) throw new HttpError(403, "No tienes acceso a Ventas recurrentes.");
    const { db } = adminServices();
    const today = getEcuadorDate();
    const first = `${today.slice(0, 7)}-01`;
    const date = request.nextUrl.searchParams.get("date")
      || (Number(today.slice(-2)) <= 7 ? first : addMonthsSafely(first, 1));
    const [preview, log] = await Promise.all([
      previewScheduledRecurringBilling(db, date),
      db.collection("recurringScheduleRuns").orderBy("date", "desc").limit(12).get(),
    ]);
    const runs = log.docs.map(doc => {
      const { date, issued, reviewCount, failures, status, completedAt, pendingCount } = doc.data();
      return { date, issued, reviewCount, failures: failures || [], status, completedAt, pendingCount: pendingCount || 0 };
    });
    const canSeeAmounts = canViewFinancialAmounts(user) && canViewServicePrices(user);
    const canLink = canUser(user, "ventas", "canCreateInvoice");
    const rows = preview.rows.map(row => ({ ...row, total: canSeeAmounts ? row.total : null,
      candidateInvoiceId: canLink ? row.candidateInvoiceId : undefined }));
    return NextResponse.json({ date, rows, runs, configuration: {
      schedulerConfigured: Boolean(process.env.CRON_SECRET), renewalEmailEnabled: process.env.RENEWAL_EMAIL_ENABLED === "true",
    } }, { headers });
  } catch (error) {
    if (!(error instanceof HttpError)) console.error("[recurring-control] No se pudo consultar la vista previa.", error);
    return NextResponse.json({ error: error instanceof HttpError ? error.message : "No se pudo consultar la vista previa de recurrencia." },
      { status: error instanceof HttpError ? error.status : 503, headers });
  }
}
