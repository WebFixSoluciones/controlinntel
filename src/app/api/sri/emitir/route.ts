import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { actor, HttpError, requirePermission } from "@/lib/server/security";
import { save } from "@/lib/server/operations";
import { adminServices } from "@/lib/server/admin";
import { generarFacturaXml } from "@/lib/sri-service";
import { materialFromStored, signSriXml } from "@/lib/server/sri-signer";
import { enviarComprobante, type SriEmissionResult } from "@/lib/server/sri-client";
import { sendInvoiceEmail, type InvoiceEmailResult } from "@/lib/server/email-delivery";
import { readEmitterSecret, readSriCompanyConfig } from "@/lib/server/sri-secrets";
import type { SriCompanyConfig, SriEnvironment, SriInvoice } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** La firma + recepción + autorización del SRI puede tardar varios segundos. */
export const maxDuration = 60;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

const invoiceItemSchema = z
  .object({
    name: z.string().trim().min(1).max(500),
    quantity: z.coerce.number().finite().positive(),
    unitPrice: z.coerce.number().finite().nonnegative(),
  })
  .passthrough();

const invoiceSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,150}$/),
    documentType: z.literal("factura").optional(),
    documentNumber: z.string().regex(/^\d{3}-\d{3}-\d{9}$/, "Número de factura inválido."),
    claveAcceso: z.string().regex(/^\d{49}$/, "La clave de acceso debe tener 49 dígitos."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de emisión inválida."),
    clientId: z.string().min(1).max(150),
    clientName: z.string().trim().min(1).max(500),
    clientRuc: z.string().trim().min(1).max(20),
    clientEmail: z.string().trim().max(320).optional().default(""),
    clientAddress: z.string().trim().max(500).optional().default(""),
    tipoIdentificacion: z.string().trim().min(1).max(2),
    items: z.array(invoiceItemSchema).min(1, "La factura debe tener al menos una línea de detalle."),
    total: z.coerce.number().finite().nonnegative(),
    relatedSaleId: z.string().max(150).optional(),
  })
  .passthrough();

const bodySchema = z.object({
  invoice: invoiceSchema,
  enviarCorreo: z.boolean().optional(),
});

function failure(error: unknown) {
  const status = error instanceof HttpError ? error.status : error instanceof ZodError ? 400 : 503;
  const message =
    error instanceof HttpError
      ? error.message
      : error instanceof ZodError
      ? error.issues?.[0]?.message || "Datos inválidos. Revisa el comprobante."
      : (error as Error)?.message || "No se pudo emitir el comprobante electrónico.";
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function asInvoice(data: Record<string, unknown>): SriInvoice {
  return data as unknown as SriInvoice;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!checkRateLimit(`sri-emitir-${ip}`)) {
      return NextResponse.json({ error: "Demasiadas emisiones seguidas. Espera un minuto." }, { status: 429 });
    }
    if (Number(request.headers.get("content-length") || 0) > 1_048_576) {
      throw new HttpError(413, "La solicitud es demasiado grande.");
    }

    const user = await actor(request);
    requirePermission(user, "manage_finance");

    const body = bodySchema.parse(await request.json());
    const invoice = asInvoice(body.invoice as Record<string, unknown>);

    const config: SriCompanyConfig = await readSriCompanyConfig();
    if (!config.ruc || !config.razonSocial) {
      throw new HttpError(400, "Configura el RUC y la razón social del emisor antes de emitir.");
    }
    if (invoice.claveAcceso.slice(8, 9) !== "01") {
      throw new HttpError(400, "La clave de acceso no corresponde a una factura (tipo 01).");
    }
    if (config.ruc.replace(/\D/g, "") !== invoice.claveAcceso.slice(9, 22)) {
      throw new HttpError(
        400,
        "La clave de acceso no corresponde al RUC del emisor configurado en Facturación Electrónica."
      );
    }
    if (String(config.ambiente || "1") !== invoice.claveAcceso.slice(22, 23)) {
      throw new HttpError(
        400,
        "La clave de acceso se generó con un ambiente distinto al configurado. Actualiza la configuración y reintenta."
      );
    }

    const secret = await readEmitterSecret();
    if (!secret) {
      throw new HttpError(400, "No hay una firma electrónica cargada. Súbela en Ajustes de Facturación Electrónica.");
    }

    let material;
    try {
      material = materialFromStored(secret.pkcs12Base64, secret.password);
    } catch (error: any) {
      throw new HttpError(400, error?.message || "No se pudo abrir el certificado de firma electrónica.");
    }
    if (material.expired) {
      throw new HttpError(400, "El certificado de firma electrónica está vencido. Carga uno vigente.");
    }

    const { db } = adminServices();

    // Si la factura ya fue autorizada, no se reenvía: se devuelve tal cual.
    const existingSnap = await db.collection("billingInvoices").doc(invoice.id).get();
    if (existingSnap.exists) {
      const existing = existingSnap.data() || {};
      if (existing.documentType === "factura" && existing.status === "autorizada" && existing.estadoSRI === "AUTORIZADO") {
        return NextResponse.json(
          {
            invoice: existing,
            autorizado: true,
            estadoSRI: "AUTORIZADO",
            mensajesSRI: existing.mensajesSRI || [],
            recepcion: null,
            autorizacion: {
              numeroAutorizacion: existing.numeroAutorizacion,
              fechaAutorizacion: existing.authorizationDate,
              estado: "AUTORIZADO",
            },
            email: { sent: false, recipients: [], skippedReason: "El comprobante ya estaba autorizado." },
            xmlFirmado: existing.xmlFirmado || null,
            alreadyAuthorized: true,
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Un cliente inexistente (o eliminado) se factura como consumidor final.
    const clientId = String(invoice.clientId || "");
    if (clientId !== "cf-9999999999999") {
      const clientSnap = await db.collection("clients").doc(clientId).get();
      if (!clientSnap.exists) {
        invoice.clientId = "cf-9999999999999";
        if (!invoice.clientRuc || invoice.clientRuc.replace(/\D/g, "").length < 10) {
          invoice.clientRuc = "9999999999999";
          invoice.tipoIdentificacion = "07";
        }
      }
    }

    let xml: string;
    try {
      xml = generarFacturaXml(invoice, config);
    } catch (error: any) {
      throw new HttpError(400, error?.message || "No se pudo generar el XML de la factura.");
    }

    let signed;
    try {
      signed = signSriXml(xml, material);
    } catch (error: any) {
      throw new HttpError(400, `No se pudo firmar el comprobante: ${error?.message || "error desconocido"}`);
    }

    const ambiente = (config.ambiente || "1") as SriEnvironment;
    const environmentLabel = ambiente === "2" ? "producción" : "pruebas";

    let emission: SriEmissionResult;
    try {
      emission = await enviarComprobante(invoice.claveAcceso, signed.xml, ambiente);
    } catch (error: any) {
      emission = {
        autorizado: false,
        estado: "ERROR_CONEXION" as const,
        recepcion: {
          estado: "ERROR_CONEXION" as const,
          mensajes: [
            {
              identificador: "SRI-CONEXION",
              mensaje: "No fue posible comunicarse con el SRI.",
              informacionAdicional: error?.message || "Error de red o tiempo de espera agotado.",
              tipo: "ERROR",
            },
          ],
        },
        mensajes: [
          {
            identificador: "SRI-CONEXION",
            mensaje: "No fue posible comunicarse con el SRI.",
            informacionAdicional: error?.message || "Error de red o tiempo de espera agotado.",
            tipo: "ERROR",
          },
        ],
        autorizacion: undefined,
      };
    }

    const now = new Date().toISOString();
    const autorizado = emission.autorizado === true;
    const estadoSRI = emission.estado;
    const mensajesSRI = (emission.mensajes || []).map((message) => ({
      ...(message.identificador ? { identificador: message.identificador } : {}),
      mensaje: String(message.mensaje || ""),
      ...(message.informacionAdicional ? { informacionAdicional: message.informacionAdicional } : {}),
      ...(message.tipo ? { tipo: message.tipo } : {}),
    }));

    const persisted: Record<string, unknown> = {
      ...body.invoice,
      id: invoice.id,
      documentType: "factura",
      clientId: invoice.clientId,
      status: autorizado ? "autorizada" : "emitida",
      estadoSRI,
      numeroAutorizacion: emission.autorizacion?.numeroAutorizacion || null,
      xmlFirmado: signed.xml,
      mensajesSRI,
      ultimoEnvioSRI: now,
      authorizationDate: autorizado
        ? emission.autorizacion?.fechaAutorizacion || now
        : null,
      ambiente: ambiente,
      certificadoFirma: {
        titular: material.subject,
        emisor: material.issuer,
        vencimiento: material.validTo,
        huellaSha1: material.fingerprintSha1,
        firmadoEn: signed.signingTime,
      },
    };

    const saved = (await save(user, "billingInvoices", persisted, invoice.id)) as Record<string, unknown>;

    // Enlazar la Nota de Venta de origen. Solo se marca "facturada" cuando el
    // SRI autoriza; si no, queda "pendiente" para reintentar el mismo comprobante.
    if (invoice.relatedSaleId) {
      try {
        const saleSnap = await db.collection("billingInvoices").doc(invoice.relatedSaleId).get();
        if (saleSnap.exists && saleSnap.data()?.documentType === "nota_venta") {
          await save(
            user,
            "billingInvoices",
            {
              sriStatus: autorizado ? "facturada" : "pendiente",
              sriInvoiceId: invoice.id,
              sriDocumentNumber: invoice.documentNumber,
            } as any,
            invoice.relatedSaleId
          );
        }
      } catch (linkError: any) {
        console.warn("No se pudo enlazar la nota de venta a la factura:", linkError?.message || linkError);
      }
    }

    let email: InvoiceEmailResult = {
      sent: false,
      recipients: [],
      skippedReason: autorizado
        ? "La entrega por correo está desactivada."
        : "No se envía correo porque el comprobante no fue autorizado por el SRI.",
    };
    if (autorizado && body.enviarCorreo !== false && config.emailEnabled) {
      try {
        email = await sendInvoiceEmail({
          config,
          invoice: { ...asInvoice(saved), ...invoice },
          xmlFirmado: signed.xml,
          numeroAutorizacion: emission.autorizacion?.numeroAutorizacion,
          fechaAutorizacion: emission.autorizacion?.fechaAutorizacion,
        });
      } catch (mailError: any) {
        email = {
          sent: false,
          recipients: [],
          error: mailError?.message || "No se pudo enviar el comprobante por correo.",
        };
      }
    }

    return NextResponse.json(
      {
        invoice: saved,
        autorizado,
        estadoSRI,
        mensajesSRI,
        ambiente,
        environmentLabel,
        recepcion: {
          estado: emission.recepcion?.estado,
          mensajes: emission.recepcion?.mensajes || [],
        },
        autorizacion: emission.autorizacion
          ? {
              numeroAutorizacion: emission.autorizacion.numeroAutorizacion,
              fechaAutorizacion: emission.autorizacion.fechaAutorizacion,
              estado: emission.autorizacion.estado,
            }
          : null,
        email,
        xmlFirmado: signed.xml,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return failure(error);
  }
}
