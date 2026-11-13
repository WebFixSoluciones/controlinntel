import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { actor, HttpError, requirePermission } from "@/lib/server/security";
import { adminServices } from "@/lib/server/admin";
import { canAccessSubmodule, canUser } from "@/lib/permissions";
import { CommercialValidationError } from "@/lib/commercial-core";
import { readSriCompanyConfig } from "@/lib/server/sri-secrets";
import { sriKinds, sriRequest } from "@/lib/server/sri-documents";
import { correctRejectedDocument, processFiscalDocument, reserveFiscalDocument } from "@/lib/server/sri-workflow";
import { sendInvoiceEmail } from "@/lib/server/email-delivery";
import { fiscalMetadata } from "@/lib/server/sri-metadata";
import type { SriInvoice } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    requirePermission(user, "manage_finance");
    const input = sriRequest.parse({ kind: "consultar", documentKind: request.nextUrl.searchParams.get("kind"), id: request.nextUrl.searchParams.get("id") });
    if (input.kind !== "consultar") throw new HttpError(400, "Solicitud de XML inválida.");
    const spec = sriKinds[input.documentKind];
    if (!canAccessSubmodule(user, "facturacion", spec.submodule)) throw new HttpError(403, "Acceso restringido a este comprobante.");
    const { db } = adminServices();
    const doc = (await db.collection(spec.collection).doc(input.id).get()).data();
    if (!doc || doc.documentType === "nota_venta" || doc.estadoSRI !== "AUTORIZADO" || !doc.xmlAutorizado) {
      throw new HttpError(404, "El comprobante todavía no tiene un XML autorizado.");
    }
    return NextResponse.json({ xml: doc.xmlAutorizado }, { headers });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof ZodError ? 400 : 503;
    return NextResponse.json({ error: error instanceof HttpError ? error.message : "No se pudo recuperar el XML autorizado." }, { status, headers });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await actor(request);
    requirePermission(user, "manage_finance");
    const raw = await request.text();
    if (raw.length > 100_000) throw new HttpError(413, "La solicitud es demasiado grande.");
    const input = JSON.parse(raw);
    const correctionId = z.string().regex(/^[\w-]{1,150}$/).optional().parse(input?.correctionId);
    const operationId = z.string().uuid().optional().parse(input?.operationId);
    const body = sriRequest.parse(input);
    const kind = body.kind === "consultar" ? body.documentKind : body.kind;
    const spec = sriKinds[kind];
    if (!canAccessSubmodule(user, "facturacion", spec.submodule)
      || ((body.kind !== "consultar" || body.retry || correctionId) && (!canUser(user, "facturacion", "canCreateInvoice") || !canUser(user, "facturacion", "canAuthorizeSri") || user.role === "consulta"))) {
      throw new HttpError(403, "No tienes autorización para esta operación fiscal.");
    }
    const { db } = adminServices();
    const config = await readSriCompanyConfig(db);
    const ref = correctionId ? db.collection(spec.collection).doc(correctionId)
      : body.kind === "consultar" ? db.collection(spec.collection).doc(body.id)
      : await reserveFiscalDocument(db, user, config, body, operationId);
    const result = correctionId
      ? await correctRejectedDocument(db, user, config, kind, ref, body.kind === "consultar" ? undefined : body)
      : await processFiscalDocument(db, user, config, kind, ref, body.kind === "consultar" ? body.retry ? "reintentar" : "consultar" : "emitir");
    let email;
    if (kind === "factura" && result.newlyAuthorized && result.document.fiscalWorkflowVersion === 1
      && result.document.ambiente === "2" && config.emailEnabled) {
      try {
        const invoice = result.document as SriInvoice;
        email = await sendInvoiceEmail({ config, invoice, xmlFirmado: invoice.xmlAutorizado,
          numeroAutorizacion: invoice.numeroAutorizacion, fechaAutorizacion: invoice.authorizationDate });
      } catch {
        email = { sent: false, error: "La autorización quedó guardada. Falló la entrega por correo." };
      }
    }
    return NextResponse.json({ ...result, document: fiscalMetadata(result.document), email }, { headers });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof ZodError || error instanceof SyntaxError || error instanceof CommercialValidationError) {
      const message = error instanceof ZodError ? error.issues[0]?.message : error instanceof CommercialValidationError ? error.message : "Solicitud inválida.";
      return NextResponse.json({ error: message }, { status: 400, headers });
    }
    console.error("Error en flujo SRI", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "No se pudo completar la operación fiscal. Consulta el comprobante antes de reenviarlo." }, { status: 503, headers });
  }
}
