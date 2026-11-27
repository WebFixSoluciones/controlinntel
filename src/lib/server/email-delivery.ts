import nodemailer from "nodemailer";
import { adminServices } from "./admin.ts";
import { fiscalRidePdf } from "./sri-ride-pdf.ts";
import { fiscalEmailHtml, fiscalMailLabels, fiscalMailAmount, type FiscalMailKind } from "./fiscal-email-format.ts";
import type { RecordData } from "../commercial-core.ts";
import { inntelEmailLogo } from "./email-brand.ts";
import type { SriCompanyConfig } from "@/types";
import type { Firestore } from "firebase-admin/firestore";

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
  cid?: string;
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
export async function readEmailPassword(db: Firestore = adminServices().db): Promise<string> {
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

export class SmtpDeliveryError extends Error {
  readonly rejected: boolean;

  constructor(message: string, rejected: boolean) {
    super(message);
    this.rejected = rejected;
  }
}

/** Envía un correo con la configuración indicada. Devuelve el `messageId`. */
export async function sendEmailDetailed(input: SendEmailInput): Promise<{ messageId: string; accepted: string[]; rejected: string[] }> {
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
    const address = (value: any) => String(typeof value === "string" ? value : value?.address || "").toLowerCase();
    return { messageId: String(info?.messageId || ""), accepted: (info.accepted || []).map(address), rejected: (info.rejected || []).map(address) };
  } catch (error: any) {
    const rejected = error?.code === "EAUTH" || error?.code === "EENVELOPE" ||
      (error?.code === "EMESSAGE" && error.responseCode >= 400 && error.responseCode < 600);
    throw new SmtpDeliveryError(normalizeSmtpError(error), rejected);
  } finally {
    try {
      transport.close();
    } catch {
      /* el transporte ya está cerrado */
    }
  }
}

export async function sendEmail(input: SendEmailInput): Promise<string> {
  const result = await sendEmailDetailed(input);
  if (result.rejected.length) throw new Error("El proveedor rechazó uno o más destinatarios.");
  return result.messageId;
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

export interface InvoiceEmailInput {
  config: SriCompanyConfig;
  invoice: RecordData;
  documentKind?: FiscalMailKind;
  omitRecipients?: string[];
  xmlFirmado?: string;
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
}

export function buildInvoiceHtml(input: InvoiceEmailInput): string {
  return fiscalEmailHtml(input.documentKind || "factura", input.invoice, input.config);
}

export function fiscalEmailRecipients(input: InvoiceEmailInput) {
  const settings = emailSettingsFromConfig(input.config);
  const client = settings.notifyClient ? splitEmails(input.invoice.clientEmail) : [];
  const company = settings.notifyCompany ? splitEmails(input.config.emailNotificaciones || settings.fromEmail) : [];
  const unique = (values: string[]) => [...new Set(values.map(value => value.toLowerCase()))];
  if (settings.notifyClient && !client.length) throw new Error("El destinatario no tiene un correo válido. Corrige su ficha y vuelve a enviar el documento.");
  if (settings.notifyCompany && !company.length) throw new Error("Configura el correo de notificaciones de la empresa.");
  const omitted = new Set((input.omitRecipients || []).map(value => value.toLowerCase()));
  const to = unique(client).filter(value => !omitted.has(value));
  const bcc = unique([...company, ...splitEmails(settings.copyTo)]).filter(value => !to.includes(value) && !omitted.has(value));
  return { settings, to, bcc };
}

export interface InvoiceEmailResult {
  sent: boolean;
  recipients: string[];
  skippedReason?: string;
  error?: string;
  messageId?: string;
  deliveryUncertain?: boolean;
  partial?: boolean;
  rejected?: string[];
}

/**
 * Envía el comprobante autorizado por correo. Es "best effort": si el correo
 * falla, la emisión no se revierte; el resultado se reporta por separado.
 */
export async function sendInvoiceEmail(input: InvoiceEmailInput, dependencies = { readPassword: readEmailPassword, send: sendEmailDetailed }): Promise<InvoiceEmailResult> {
  const kind = input.documentKind || "factura", label = fiscalMailLabels[kind];
  const settings = emailSettingsFromConfig(input.config);
  if (!settings.enabled) return { sent: false, recipients: [], skippedReason: "La entrega por correo está desactivada." };
  if (!isEmailSettingsComplete(settings)) return { sent: false, recipients: [], skippedReason: "La configuración SMTP está incompleta." };
  let targets: ReturnType<typeof fiscalEmailRecipients>;
  try { targets = fiscalEmailRecipients(input); } catch (error) { return { sent: false, recipients: [], error: (error as Error).message }; }
  const { to, bcc } = targets;
  if (!to.length && !bcc.length) return input.omitRecipients?.length ? { sent: true, recipients: input.omitRecipients, skippedReason: "Todos los destinatarios ya fueron confirmados." } : { sent: false, recipients: [], skippedReason: "No hay destinatarios configurados." };
  let attachments: EmailAttachment[];
  try {
    if (!input.invoice.xmlAutorizado || input.invoice.estadoSRI !== "AUTORIZADO") throw new Error("El documento no está autorizado.");
    attachments = [
      { filename: `RIDE-${kind}-${input.invoice.documentNumber}.pdf`, content: fiscalRidePdf(kind, input.invoice, input.config), contentType: "application/pdf" },
      { filename: `${kind}-${input.invoice.documentNumber}.xml`, content: input.invoice.xmlAutorizado, contentType: "application/xml" },
      { filename: "inntel.png", content: inntelEmailLogo, contentType: "image/png", cid: "inntel-logo" },
    ];
  } catch { return { sent: false, recipients: [], error: "No se pudieron preparar el PDF y XML autorizados." }; }
  try {
    const password = await dependencies.readPassword();
    if (!password) return { sent: false, recipients: [], skippedReason: "No hay contraseña SMTP guardada en el servidor." };
    const total = fiscalMailAmount(kind, input.invoice);
    const receipt = await dependencies.send({ settings, password, to: to.length ? to : bcc, bcc: to.length ? bcc : [],
      subject: `${label} ${input.invoice.documentNumber} | ${input.config.nombreComercial || "INNTEL CORP"}`,
      text: [label, `Número: ${input.invoice.documentNumber}`, `Destinatario: ${input.invoice.clientName || input.invoice.destClientName || ""}`, total === undefined ? "" : `Valor USD: ${total.toFixed(2)}`, `Clave de acceso: ${input.invoice.claveAcceso}`, "PDF RIDE y XML autorizado adjuntos."].filter(Boolean).join("\n"),
      html: buildInvoiceHtml(input), attachments,
    });
    const unconfirmed = [...to, ...bcc].some(address => !receipt.accepted.includes(address) && !receipt.rejected.includes(address));
    return { deliveryUncertain: unconfirmed, sent: !unconfirmed && receipt.rejected.length === 0, partial: receipt.rejected.length > 0, recipients: receipt.accepted, rejected: receipt.rejected, messageId: receipt.messageId, ...(receipt.rejected.length ? { error: "El proveedor rechazó algunos destinatarios; se conservan los envíos ya aceptados." } : {}) };
  } catch { return { sent: false, recipients: [], error: "El proveedor de correo no confirmó la entrega. Revisa la conexión o el registro SMTP antes de repetir el envío.", deliveryUncertain: true }; }
}
