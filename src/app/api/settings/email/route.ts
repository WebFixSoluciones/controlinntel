import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { actor, HttpError, requirePermission } from "@/lib/server/security";
import { save } from "@/lib/server/operations";
import {
  emailSettingsFromConfig,
  isEmailSettingsComplete,
  readEmailPassword,
  sendEmail,
  verifyEmailConnection,
  writeEmailPassword,
} from "@/lib/server/email-delivery";
import { readSriCompanyConfig } from "@/lib/server/sri-secrets";
import type { SriCompanyConfig } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
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

const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value), "Correo inválido.")
  .optional();

const configSchema = z.object({
  emailEnabled: z.boolean().optional(),
  emailHost: z.string().trim().max(255).optional(),
  emailPort: z.coerce.number().int().min(1).max(65535).optional(),
  emailSecure: z.boolean().optional(),
  emailUser: z.string().trim().max(320).optional(),
  emailFromName: z.string().trim().max(120).optional(),
  emailFrom: optionalEmail,
  emailReplyTo: optionalEmail,
  emailCopyTo: z.string().trim().max(1000).optional(),
  emailNotifyClient: z.boolean().optional(),
  emailNotifyCompany: z.boolean().optional(),
});

const bodySchema = z.object({
  action: z.enum(["guardar", "probar", "enviar_prueba", "eliminar_password"]),
  config: configSchema.optional(),
  password: z.string().max(500).optional(),
  clearPassword: z.boolean().optional(),
  destinatario: optionalEmail,
});

function publicEmailConfig(config: SriCompanyConfig, hasPassword: boolean) {
  return {
    emailEnabled: Boolean(config.emailEnabled),
    emailHost: config.emailHost || "",
    emailPort: Number(config.emailPort) || 587,
    emailSecure: config.emailSecure === true,
    emailUser: config.emailUser || "",
    emailFromName: config.emailFromName || "",
    emailFrom: config.emailFrom || "",
    emailReplyTo: config.emailReplyTo || "",
    emailCopyTo: config.emailCopyTo || "",
    emailNotifyClient: config.emailNotifyClient !== false,
    emailNotifyCompany: config.emailNotifyCompany === true,
    hasPassword,
  };
}

function failure(error: unknown) {
  const status = error instanceof HttpError ? error.status : error instanceof ZodError ? 400 : 503;
  const message =
    error instanceof HttpError
      ? error.message
      : error instanceof ZodError
      ? error.issues?.[0]?.message || "Datos inválidos. Revisa los campos."
      : (error as Error)?.message || "Servicio temporalmente no disponible.";
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!checkRateLimit(`email-get-${ip}`, 60)) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Espera un momento." }, { status: 429 });
    }
    const user = await actor(request);
    requirePermission(user, "manage_finance");

    const config = await readSriCompanyConfig();
    const password = await readEmailPassword();
    return NextResponse.json(
      {
        config: publicEmailConfig(config, Boolean(password)),
        complete: isEmailSettingsComplete(emailSettingsFromConfig(config)),
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
    if (!checkRateLimit(`email-post-${ip}`, 20)) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Espera un momento." }, { status: 429 });
    }

    const user = await actor(request);
    requirePermission(user, "manage_finance");
    const body = bodySchema.parse(await request.json());

    const current = await readSriCompanyConfig();

    if (body.action === "guardar") {
      if (!body.config) throw new HttpError(400, "No se recibió la configuración de correo.");
      if (body.config.emailEnabled && !body.config.emailHost) {
        throw new HttpError(400, "Indica el servidor SMTP para activar la entrega por correo.");
      }

      const merged = { ...current, ...body.config } as SriCompanyConfig;
      const saved = (await save(
        user,
        "sriCompanyConfig",
        {
          id: current.id || "sri-config-inntel",
          ruc: current.ruc,
          razonSocial: current.razonSocial,
          ...body.config,
        } as any,
        current.id || "sri-config-inntel"
      )) as Record<string, unknown>;

      if (body.clearPassword) await writeEmailPassword(null);
      else if (body.password) await writeEmailPassword(body.password);

      const password = await readEmailPassword();
      return NextResponse.json(
        {
          message: "Configuración de correo guardada.",
          config: publicEmailConfig({ ...merged, ...saved } as SriCompanyConfig, Boolean(password)),
          complete: isEmailSettingsComplete(emailSettingsFromConfig({ ...merged, ...saved } as SriCompanyConfig)),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (body.action === "eliminar_password") {
      await writeEmailPassword(null);
      return NextResponse.json(
        { message: "Contraseña SMTP eliminada del servidor.", hasPassword: false },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // probar / enviar_prueba usan la configuración ya guardada.
    const settings = emailSettingsFromConfig(current);
    if (!isEmailSettingsComplete(settings)) {
      throw new HttpError(400, "Completa servidor, puerto, usuario y correo remitente antes de probar.");
    }

    const password = body.password || (await readEmailPassword());
    if (!password) throw new HttpError(400, "Guarda la contraseña SMTP antes de probar la conexión.");

    if (body.action === "probar") {
      await verifyEmailConnection(settings, password);
      return NextResponse.json(
        { message: "Conexión con el servidor de correo verificada correctamente." },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const destinatario = body.destinatario || settings.fromEmail;
    if (!destinatario) throw new HttpError(400, "Indica un destinatario para el correo de prueba.");

    const messageId = await sendEmail({
      settings,
      password,
      to: [destinatario],
      subject: `Prueba de entrega de documentos - ${current.razonSocial || "INNTEL CORP"}`,
      text: [
        "Este es un correo de prueba enviado desde el módulo de Facturación Electrónica.",
        `Servidor SMTP: ${settings.host}:${settings.port}`,
        `Remitente: ${settings.fromEmail}`,
      ].join("\n"),
      html: `<p>Este es un correo de prueba enviado desde el módulo de <strong>Facturación Electrónica</strong>.</p>
        <p>Servidor SMTP: <strong>${settings.host}:${settings.port}</strong><br/>Remitente: <strong>${settings.fromEmail}</strong></p>`,
    });

    return NextResponse.json(
      { message: `Correo de prueba enviado a ${destinatario}.`, messageId },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return failure(error);
  }
}
