import nodemailer from "nodemailer";
import { adminServices } from "./admin";
import type { SriCompanyConfig, SriInvoice } from "@/types";

/**
 * Entrega de documentos electrónicos por correo.
 *
 * La configuración SMTP "pública" (host, puerto, remitente, destinatarios de
 * copia) vive en `sriCompanyConfig`, que sí llega al navegador. La contraseña
 * de la cuenta de correo se guarda únicamente en `sriSecrets/email` y nunca se
 * devuelve al cliente.
 */

export const EMAIL_SECRET_COLLECTION = "sriSecrets";
export const EMAIL_SECRET_DOC = "email";

export interface EmailSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  copyTo: string;
  notifyClient: boolean;
  notifyCompany: boolean;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

const DEFAULT_PORT = 587;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function splitEmails(value: unknown): string[] {
  return clean(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => isValidEmail(item));
}

/** Extrae la configuración pública de correo desde la configuración del emisor. */
export function emailSettingsFromConfig(config?: Partial<SriCompanyConfig> | null): EmailSettings {
  const portRaw = Number(config?.emailPort);
  const port = Number.isFinite(portRaw) && portRaw > 0 && portRaw < 65536 ? Math.trunc(portRaw) : DEFAULT_PORT;
  const user = clean(config?.emailUser);
  const fromEmail = clean(config?.emailFrom) || user;
  return {
    enabled: Boolean(config?.emailEnabled),
    host: clean(config?.emailHost),
    port,
    secure: config?.emailSecure === true,
    user,
    fromName: clean(config?.emailFromName) || clean(config?.razonSocial),
    fromEmail,
    replyTo: clean(config?.emailReplyTo) || fromEmail,
    copyTo: clean(config?.emailCopyTo),
    notifyClient: config?.emailNotifyClient !== false,
    notifyCompany: config?.emailNotifyCompany === true,
  };
}

/** Indica si la configuración pública está completa para operar. */
export function isEmailSettingsComplete(settings: EmailSettings): boolean {
  return Boolean(settings.host && settings.port && settings.user && settings.fromEmail);
}

/** Lee la contraseña SMTP almacenada en el servidor (nunca se expone). */
export async function readEmailPassword(): Promise<string> {
  const { db } = adminServices();
  const doc = await db.collection(EMAIL_SECRET_COLLECTION).doc(EMAIL_SECRET_DOC).get();
  const data = doc.data();
  return data?.password ? String(data.password) : "";
}

/** Guarda (o elimina, con `null`) la contraseña SMTP. */
export async function writeEmailPassword(password: string | null): Promise<void> {
  const { db } = adminServices();
  const reference = db.collection(EMAIL_SECRET_COLLECTION).doc(EMAIL_SECRET_DOC);
  if (password === null) {
    await reference.delete();
    return;
  }
  await reference.set(
    {
      password: String(password),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

function buildTransport(settings: EmailSettings, password: string) {
  if (!isEmailSettingsComplete(settings)) {
    throw new Error("Completa host, puerto, usuario y correo remitente antes de enviar.");
  }
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: { user: settings.user, pass: password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 25_000,
  });
}

export interface SendEmailInput {
  settings: EmailSettings;
  password: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

/** Envía un correo con la configuración indicada. Devuelve el `messageId`. */
export async function sendEmail(input: SendEmailInput): Promise<string> {
  const to = input.to.filter(isValidEmail);
  if (to.length === 0) throw new Error("No hay destinatarios válidos para enviar el correo.");
  if (!input.password) throw new Error("Falta la contraseña de la cuenta de correo.");

  const transport = buildTransport(input.settings, input.password);
  try {
    const info = await transport.sendMail({
      from: input.settings.fromName
        ? `"${input.settings.fromName.replace(/"/g, "'")}" <${input.settings.fromEmail}>`
        : input.settings.fromEmail,
      replyTo: input.settings.replyTo || undefined,
      to,
      cc: (input.cc || []).filter(isValidEmail),
      bcc: (input.bcc || []).filter(isValidEmail),
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });
    return String(info?.messageId || "");
  } catch (error: any) {
    throw new Error(normalizeSmtpError(error));
  } finally {
    try {
      transport.close();
    } catch {
      /* el transporte ya está cerrado */
    }
  }
}

function normalizeSmtpError(error: any): string {
  const code = String(error?.code || "");
  const message = String(error?.message || "Error desconocido del servidor de correo.");
  if (code === "EAUTH" || /authentication|invalid login|535/i.test(message)) {
    return "El servidor de correo rechazó las credenciales. Verifica usuario y contraseña SMTP.";
  }
  if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ESOCKET") {
    return "No fue posible conectar con el servidor de correo. Revisa host y puerto.";
  }
  if (code === "EENVELOPE") {
    return "El servidor de correo rechazó los destinatarios del mensaje.";
  }
  return `No se pudo enviar el correo: ${message}`;
}

/** Valida credenciales SMTP sin enviar un mensaje. */
export async function verifyEmailConnection(settings: EmailSettings, password: string): Promise<void> {
  if (!password) throw new Error("Falta la contraseña de la cuenta de correo.");
  const transport = buildTransport(settings, password);
  try {
    await transport.verify();
  } catch (error: any) {
    throw new Error(normalizeSmtpError(error));
  } finally {
    try {
      transport.close();
    } catch {
      /* el transporte ya está cerrado */
    }
  }
}

function money(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface InvoiceEmailInput {
  config: SriCompanyConfig;
  invoice: SriInvoice;
  xmlFirmado?: string;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
}

function buildInvoiceHtml(input: InvoiceEmailInput): string {
  const { config, invoice } = input;
  const empresa = escapeHtml(config.razonSocial || "INNTEL CORP S.A.");
  const filas = (invoice.items || [])
    .map(
      (item) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${Number(item.quantity || 0)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(item.unitPrice)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(item.total)}</td>
      </tr>`
    )
    .join("");

  const autorizacion = input.numeroAutorizacion
    ? `<p style="margin:4px 0;font-size:13px;color:#065f46;">Autorización SRI: <strong>${escapeHtml(
        input.numeroAutorizacion
      )}</strong>${input.fechaAutorizacion ? ` · ${escapeHtml(input.fechaAutorizacion)}` : ""}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0f172a;padding:20px 24px;color:#ffffff;">
      <h1 style="margin:0;font-size:18px;letter-spacing:.3px;">${empresa}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#cbd5e1;">Comprobante electrónico autorizado por el SRI</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 12px;font-size:14px;">Estimado(a) <strong>${escapeHtml(
        invoice.clientName || "cliente"
      )}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">
        Adjuntamos su comprobante electrónico <strong>${escapeHtml(
          invoice.documentNumber
        )}</strong> por un valor total de <strong>${money(invoice.total)}</strong>.
      </p>
      ${autorizacion}
      <p style="margin:10px 0 4px;font-size:12px;color:#475569;">Clave de acceso SRI</p>
      <p style="margin:0 0 18px;font-family:Consolas,monospace;font-size:12px;word-break:break-all;">${escapeHtml(
        invoice.claveAcceso
      )}</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f8fafc;text-align:left;">
            <th style="padding:8px;border-bottom:1px solid #e5e7eb;">Detalle</th>
            <th style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">Cant.</th>
            <th style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">P. Unit.</th>
            <th style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <table style="width:100%;margin-top:12px;font-size:13px;">
        <tr><td style="padding:3px 8px;">Subtotal 15%</td><td style="padding:3px 8px;text-align:right;">${money(
          invoice.subtotal15
        )}</td></tr>
        <tr><td style="padding:3px 8px;">Subtotal 0%</td><td style="padding:3px 8px;text-align:right;">${money(
          invoice.subtotal0
        )}</td></tr>
        <tr><td style="padding:3px 8px;">IVA</td><td style="padding:3px 8px;text-align:right;">${money(
          invoice.ivaTotal
        )}</td></tr>
        <tr><td style="padding:6px 8px;font-weight:bold;border-top:1px solid #e2e8f0;">TOTAL</td><td style="padding:6px 8px;text-align:right;font-weight:bold;border-top:1px solid #e2e8f0;">${money(
          invoice.total
        )}</td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#64748b;">
        El XML firmado del comprobante se adjunta a este mensaje. Conserve este correo como respaldo tributario.
      </p>
    </div>
    <div style="background:#f8fafc;padding:14px 24px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;">
      ${empresa} · RUC ${escapeHtml(config.ruc || "")} · ${escapeHtml(config.direccionMatriz || "")}
    </div>
  </div>
</body></html>`;
}

export interface InvoiceEmailResult {
  sent: boolean;
  recipients: string[];
  skippedReason?: string;
  error?: string;
  messageId?: string;
}

/**
 * Envía el comprobante autorizado por correo. Es "best effort": si el correo
 * falla, la emisión no se revierte; el resultado se reporta por separado.
 */
export async function sendInvoiceEmail(input: InvoiceEmailInput): Promise<InvoiceEmailResult> {
  const settings = emailSettingsFromConfig(input.config);
  const recipients: string[] = [];

  if (settings.enabled && settings.notifyClient) {
    const cliente = splitEmails(input.invoice.clientEmail);
    recipients.push(...cliente);
  }

  const copiaEmpresa = settings.notifyCompany
    ? splitEmails(input.config.emailNotificaciones || settings.fromEmail)
    : [];
  const copiaExtra = splitEmails(settings.copyTo);

  const to = [...new Set(recipients)];
  const cc = [...new Set([...copiaEmpresa, ...copiaExtra])].filter((email) => !to.includes(email));

  if (!settings.enabled) {
    return { sent: false, recipients: [], skippedReason: "La entrega por correo está desactivada." };
  }
  if (!isEmailSettingsComplete(settings)) {
    return { sent: false, recipients: [], skippedReason: "La configuración SMTP está incompleta." };
  }
  if (to.length === 0 && cc.length === 0) {
    return { sent: false, recipients: [], skippedReason: "El comprobante no tiene destinatarios configurados." };
  }

  try {
    const password = await readEmailPassword();
    if (!password) {
      return {
        sent: false,
        recipients: [...to, ...cc],
        skippedReason: "No hay contraseña SMTP guardada en el servidor.",
      };
    }

    const attachments: EmailAttachment[] = [];
    if (input.xmlFirmado) {
      attachments.push({
        filename: `${input.invoice.documentNumber}.xml`,
        content: input.xmlFirmado,
        contentType: "application/xml",
      });
    }

    const messageId = await sendEmail({
      settings,
      password,
      to: to.length > 0 ? to : cc,
      cc: to.length > 0 ? cc : [],
      subject: `Comprobante electrónico ${input.invoice.documentNumber} - ${
        input.config.nombreComercial || input.config.razonSocial || "INNTEL CORP"
      }`,
      text: [
        `Comprobante electrónico ${input.invoice.documentNumber}`,
        `Cliente: ${input.invoice.clientName}`,
        `Total: ${money(input.invoice.total)}`,
        `Clave de acceso: ${input.invoice.claveAcceso}`,
        input.numeroAutorizacion ? `Autorización SRI: ${input.numeroAutorizacion}` : "",
        "El XML firmado del comprobante se adjunta a este mensaje.",
      ]
        .filter(Boolean)
        .join("\n"),
      html: buildInvoiceHtml(input),
      attachments,
    });

    return { sent: true, recipients: [...new Set([...to, ...cc])], messageId };
  } catch (error: any) {
    return {
      sent: false,
      recipients: [...new Set([...to, ...cc])],
      error: error?.message || "No se pudo enviar el comprobante por correo.",
    };
  }
}
