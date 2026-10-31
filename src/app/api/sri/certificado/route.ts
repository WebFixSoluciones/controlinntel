import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { actor, HttpError, requirePermission } from "@/lib/server/security";
import { save } from "@/lib/server/operations";
import { parsePkcs12 } from "@/lib/server/sri-signer";
import {
  clearEmitterSecret,
  hasEmitterSecret,
  readEmitterSecret,
  readSriCompanyConfig,
  writeEmitterSecret,
} from "@/lib/server/sri-secrets";
import type { SriCompanyConfig } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, limit = 20, windowMs = 60_000): boolean {
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

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const bodySchema = z.object({
  action: z.enum(["validar", "guardar"]),
  /** Contenido Base64 puro o Data URL del archivo .p12/.pfx. */
  certificadoBase64: z.string().min(16).max(Math.ceil((MAX_FILE_BYTES * 4) / 3) + 4096),
  certificadoClave: z.string().min(1).max(500),
  nombreArchivo: z.string().trim().max(255).optional(),
});

/** Quita prefijos tipo `data:application/x-pkcs12;base64,` y espacios. */
function normalizeBase64(value: string): string {
  return String(value || "")
    .replace(/^data:[^,]*;base64,/i, "")
    .replace(/\s+/g, "");
}

function estimatedBytes(base64: string): number {
  const clean = base64.replace(/=+$/, "");
  return Math.round((clean.length * 3) / 4);
}

function publicCertificateFields(
  summary: ReturnType<typeof parsePkcs12>,
  fileName: string,
  size: number
): Partial<SriCompanyConfig> {
  return {
    certificadoNombre: fileName || summary.subject || "Certificado de firma",
    certificadoVencimiento: summary.validTo,
    certificadoEmisor: summary.issuer || "",
    certificadoTamano: size,
    certificadoFechaCarga: new Date().toISOString(),
    certificadoCargado: true,
  };
}

function failure(error: unknown) {
  const status = error instanceof HttpError ? error.status : error instanceof ZodError ? 400 : 503;
  const message =
    error instanceof HttpError
      ? error.message
      : error instanceof ZodError
      ? "Datos inválidos. Revisa el archivo y la contraseña."
      : (error as Error)?.message || "Servicio temporalmente no disponible.";
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!checkRateLimit(`sri-cert-get-${ip}`, 60)) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Espera un momento." }, { status: 429 });
    }
    await actor(request);
    const config = await readSriCompanyConfig();
    const stored = await hasEmitterSecret();
    return NextResponse.json(
      {
        stored,
        certificado: {
          nombre: config.certificadoNombre || "",
          vencimiento: config.certificadoVencimiento || "",
          emisor: config.certificadoEmisor || "",
          tamano: config.certificadoTamano || 0,
          fechaCarga: config.certificadoFechaCarga || "",
          cargado: Boolean(config.certificadoCargado) && stored,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!checkRateLimit(`sri-cert-post-${ip}`, 12)) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Espera un momento." }, { status: 429 });
    }
    if (Number(request.headers.get("content-length") || 0) > 3 * 1024 * 1024) {
      throw new HttpError(413, "El certificado supera el tamaño permitido.");
    }

    const user = await actor(request);
    requirePermission(user, "manage_finance");

    const body = bodySchema.parse(await request.json());
    const base64 = normalizeBase64(body.certificadoBase64);
    const size = estimatedBytes(base64);
    if (size > MAX_FILE_BYTES) throw new HttpError(413, "El certificado supera los 2 MB permitidos.");

    let summary;
    try {
      summary = parsePkcs12(base64, body.certificadoClave);
    } catch (error: any) {
      throw new HttpError(400, error?.message || "No se pudo leer el certificado.");
    }

    if (summary.expired) {
      throw new HttpError(400, "El certificado está vencido. Carga una firma electrónica vigente.");
    }

    const fileName = body.nombreArchivo || summary.subject || "certificado.p12";
    const metadata = publicCertificateFields(summary, fileName, size);

    if (body.action === "validar") {
      return NextResponse.json(
        {
          valid: true,
          message: "Certificado válido. Puedes guardarlo para emitir comprobantes.",
          certificado: {
            nombre: metadata.certificadoNombre,
            vencimiento: summary.validTo,
            emisor: summary.issuer,
            titular: summary.subject,
            expiresInDays: summary.expiresInDays,
            keySize: summary.keySize,
            fingerprintSha1: summary.fingerprintSha1,
            tamano: size,
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Guardar: primero los secretos y luego los metadatos públicos. Si el
    // guardado de metadatos falla, el secreto queda igualmente disponible.
    await writeEmitterSecret({
      pkcs12Base64: base64,
      password: body.certificadoClave,
      fileName,
    });

    const config = await readSriCompanyConfig();
    const saved = (await save(
      user,
      "sriCompanyConfig",
      {
        id: config.id || "sri-config-inntel",
        ruc: config.ruc,
        razonSocial: config.razonSocial,
        ...metadata,
        // Limpieza de secretos heredados que pudieran haber quedado en el
        // documento público: `save` elimina las claves con valor null.
        certificadoBase64: null,
        certificadoClave: null,
      } as any,
      config.id || "sri-config-inntel"
    )) as Record<string, unknown>;

    return NextResponse.json(
      {
        valid: true,
        message: "Firma electrónica guardada. Ya puedes emitir facturas al SRI.",
        certificado: {
          nombre: saved.certificadoNombre,
          vencimiento: saved.certificadoVencimiento,
          emisor: saved.certificadoEmisor,
          tamano: saved.certificadoTamano,
          fechaCarga: saved.certificadoFechaCarga,
          cargado: true,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await actor(request);
    requirePermission(user, "manage_finance");

    await clearEmitterSecret();

    const config = await readSriCompanyConfig();
    await save(
      user,
      "sriCompanyConfig",
      {
        id: config.id || "sri-config-inntel",
        ruc: config.ruc,
        razonSocial: config.razonSocial,
        certificadoNombre: null,
        certificadoVencimiento: null,
        certificadoEmisor: null,
        certificadoTamano: null,
        certificadoFechaCarga: null,
        certificadoCargado: false,
        certificadoBase64: null,
        certificadoClave: null,
      } as any,
      config.id || "sri-config-inntel"
    );

    return NextResponse.json(
      { message: "Firma electrónica eliminada del servidor." },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return failure(error);
  }
}
