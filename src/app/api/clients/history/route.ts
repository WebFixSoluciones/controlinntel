import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actor, HttpError } from "@/lib/server/security";
import { adminServices } from "@/lib/server/admin";
import { canViewClientSalesHistory } from "@/lib/permissions";
import { clientSalesHistory } from "@/lib/client-sales-history";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    if (!canViewClientSalesHistory(user)) throw new HttpError(403, "No tienes permiso para consultar el historial de ventas del cliente.");
    const id = z.string().regex(/^[\w-]{1,150}$/).parse(request.nextUrl.searchParams.get("clientId"));
    const { db } = adminServices();
    const client = (await db.collection("clients").doc(id).get()).data();
    if (!client) throw new HttpError(404, "Cliente inexistente.");
    const read = async (collection: string) => {
      const snapshots = await Promise.all([db.collection(collection).where("clientId", "==", id).limit(1000).get(), db.collection(collection).where("clientRuc", "==", client.identificationNumber).limit(1000).get()]);
      if (snapshots.some(snapshot => snapshot.size === 1000)) throw new HttpError(413, "El historial es extenso. Consulta el reporte por fechas para revisar el período requerido.");
      return [...new Map(snapshots.flatMap(snapshot => snapshot.docs).map(doc => [doc.id, { ...doc.data(), id: doc.id }])).values()];
    };
    const [invoices, charges] = await Promise.all([read("billingInvoices"), read("monthlyCharges")]);
    return NextResponse.json(clientSalesHistory(invoices, charges), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof HttpError ? error.message : "No se pudo cargar el historial." }, { status: error instanceof HttpError ? error.status : 400 });
  }
}
