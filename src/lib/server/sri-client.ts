import { DOMParser } from "@xmldom/xmldom";
import type { SriEnvironment } from "@/types";

/**
 * Cliente SOAP de los web services offline del SRI (Ecuador).
 * No requiere WSDL: se envían sobres SOAP 1.1 con el formato documentado.
 */

export const SRI_SOAP_ENDPOINTS: Record<SriEnvironment, { recepcion: string; autorizacion: string }> = {
  "1": {
    recepcion: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline",
    autorizacion: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
  },
  "2": {
    recepcion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline",
    autorizacion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
  },
};

export interface SriMensaje {
  identificador?: string;
  mensaje: string;
  informacionAdicional?: string;
  tipo?: string;
}

export interface SriRecepcionResult {
  estado: "RECIBIDA" | "DEVUELTA" | "ERROR_CONEXION";
  mensajes: SriMensaje[];
  claveAcceso?: string;
  raw?: string;
}

export interface SriAutorizacionResult {
  estado: "AUTORIZADO" | "NO AUTORIZADO" | "EN PROCESO" | "ERROR_CONEXION";
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  ambiente?: string;
  comprobanteXml?: string;
  mensajes: SriMensaje[];
  raw?: string;
}

type LocalName = string;

function childElements(node: Node | null | undefined): Element[] {
  if (!node) return [];
  const out: Element[] = [];
  const children = (node as any).childNodes as any;
  if (!children) return out;
  for (let i = 0; i < children.length; i++) {
    const child = children.item(i);
    if (child && child.nodeType === 1) out.push(child as Element);
  }
  return out;
}

function localNameOf(node: Element): string {
  return String(node.localName || node.nodeName || "").split(":").pop() || "";
}

function findAll(node: Node | null | undefined, name: LocalName): Element[] {
  if (!node) return [];
  const found: Element[] = [];
  const walk = (current: Node) => {
    for (const child of childElements(current)) {
      if (localNameOf(child) === name) found.push(child);
      walk(child);
    }
  };
  if ((node as any).nodeType === 9) walk(node);
  else {
    if ((node as any).nodeType === 1 && localNameOf(node as Element) === name) found.push(node as Element);
    walk(node);
  }
  return found;
}

function first(node: Node | null | undefined, name: LocalName): Element | null {
  return findAll(node, name)[0] || null;
}

function textOf(node: Node | null | undefined, name: LocalName): string {
  const element = first(node, name);
  return (element?.textContent || "").trim();
}

function parseXml(raw: string): Document | null {
  try {
    return new DOMParser().parseFromString(raw, "text/xml");
  } catch {
    return null;
  }
}

function extractMensajes(node: Node | null | undefined): SriMensaje[] {
  return findAll(node, "mensaje")
    .map((message) => ({
      identificador: textOf(message, "identificador") || undefined,
      mensaje: textOf(message, "mensaje"),
      informacionAdicional: textOf(message, "informacionAdicional") || undefined,
      tipo: textOf(message, "tipo") || undefined,
    }))
    .filter((message) => message.mensaje);
}

function escapeXml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function soapCall(
  url: string,
  action: string,
  bodyXml: string,
  timeoutMs = 20_000
): Promise<string> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>${bodyXml}</soapenv:Body>
</soapenv:Envelope>`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: action,
          Accept: "text/xml",
          "User-Agent": "INNTEL-CORP/1.0 (+https://control.intelcorp.com)",
        },
        body: envelope,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      const raw = await response.text();
      if (!response.ok && !raw.includes("Envelope")) {
        throw new Error(`El SRI respondió HTTP ${response.status}.`);
      }
      return raw;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No se pudo conectar con el SRI.");
}

/**
 * Envía el XML firmado (Base64) al servicio de recepción del SRI.
 */
export async function recepcionComprobante(
  claveAcceso: string,
  xmlFirmado: string,
  ambiente: SriEnvironment
): Promise<SriRecepcionResult> {
  const { recepcion } = SRI_SOAP_ENDPOINTS[ambiente] || SRI_SOAP_ENDPOINTS["1"];
  const xmlBase64 = Buffer.from(xmlFirmado, "utf8").toString("base64");
  const body = `<ec:validarComprobante xmlns:ec="http://ec.gob.sri.ws.recepcion"><xml>${xmlBase64}</xml></ec:validarComprobante>`;

  try {
    const raw = await soapCall(recepcion, "validarComprobante", body);
    const doc = parseXml(raw);
    if (!doc) {
      return {
        estado: "ERROR_CONEXION",
        mensajes: [{ mensaje: "El SRI devolvió una respuesta no interpretable.", tipo: "ERROR" }],
        claveAcceso,
        raw,
      };
    }

    const estadoRaw = (textOf(doc, "estado") || "").toUpperCase();
    const estado = estadoRaw === "RECIBIDA" ? "RECIBIDA" : "DEVUELTA";
    const mensajes = extractMensajes(doc);
    return { estado, mensajes, claveAcceso, raw };
  } catch (error: any) {
    return {
      estado: "ERROR_CONEXION",
      mensajes: [
        {
          identificador: "SRI-RECEPCION",
          mensaje: "No fue posible entregar el comprobante al SRI.",
          informacionAdicional: error?.message || "Error de red o tiempo de espera agotado.",
          tipo: "ERROR",
        },
      ],
      claveAcceso,
    };
  }
}

/**
 * Consulta la autorización de un comprobante por su clave de acceso.
 */
export async function autorizacionComprobante(
  claveAcceso: string,
  ambiente: SriEnvironment
): Promise<SriAutorizacionResult> {
  const { autorizacion: autorizacionUrl } = SRI_SOAP_ENDPOINTS[ambiente] || SRI_SOAP_ENDPOINTS["1"];
  const body = `<ec:autorizacionComprobante xmlns:ec="http://ec.gob.sri.ws.autorizacion"><claveAccesoComprobante>${escapeXml(
    claveAcceso
  )}</claveAccesoComprobante></ec:autorizacionComprobante>`;

  try {
    const raw = await soapCall(autorizacionUrl, "autorizacionComprobante", body);
    const doc = parseXml(raw);
    if (!doc) {
      return {
        estado: "ERROR_CONEXION",
        mensajes: [{ mensaje: "El SRI devolvió una respuesta no interpretable.", tipo: "ERROR" }],
        raw,
      };
    }

    const autorizacion = first(doc, "autorizacion");
    if (!autorizacion) {
      const numero = textOf(doc, "numeroComprobantes");
      return {
        estado: "EN PROCESO",
        mensajes: [
          {
            mensaje: `El SRI aún no registra autorización para la clave ${claveAcceso}.`,
            informacionAdicional: numero ? `Comprobantes devueltos: ${numero}` : undefined,
            tipo: "ADVERTENCIA",
          },
        ],
        raw,
      };
    }

    const estadoRaw = (textOf(autorizacion, "estado") || "").toUpperCase();
    const estado: SriAutorizacionResult["estado"] =
      estadoRaw === "AUTORIZADO" ? "AUTORIZADO" : estadoRaw === "NO AUTORIZADO" ? "NO AUTORIZADO" : "EN PROCESO";

    const comprobante = first(autorizacion, "comprobante");
    return {
      estado,
      numeroAutorizacion: textOf(autorizacion, "numeroAutorizacion") || undefined,
      fechaAutorizacion: textOf(autorizacion, "fechaAutorizacion") || undefined,
      ambiente: textOf(autorizacion, "ambiente") || undefined,
      comprobanteXml: comprobante ? (comprobante.textContent || "").trim() : undefined,
      mensajes: extractMensajes(autorizacion),
      raw,
    };
  } catch (error: any) {
    return {
      estado: "ERROR_CONEXION",
      mensajes: [
        {
          identificador: "SRI-AUTORIZACION",
          mensaje: "No fue posible consultar la autorización del comprobante.",
          informacionAdicional: error?.message || "Error de red o tiempo de espera agotado.",
          tipo: "ERROR",
        },
      ],
    };
  }
}

export interface SriEmissionResult {
  autorizado: boolean;
  estado: SriAutorizacionResult["estado"] | "DEVUELTA";
  recepcion: SriRecepcionResult;
  autorizacion?: SriAutorizacionResult;
  mensajes: SriMensaje[];
}

/**
 * Envía el comprobante y espera su autorización. Si la recepción falla por
 * "ya registrado", igualmente se consulta la autorización por clave.
 */
export async function enviarComprobante(
  claveAcceso: string,
  xmlFirmado: string,
  ambiente: SriEnvironment,
  options?: { autorizacionIntentos?: number; esperaMs?: number }
): Promise<SriEmissionResult> {
  const recepcion = await recepcionComprobante(claveAcceso, xmlFirmado, ambiente);

  const intentos = Math.max(1, options?.autorizacionIntentos ?? 4);
  const esperaMs = Math.max(0, options?.esperaMs ?? 1500);

  let autorizacion: SriAutorizacionResult | undefined;
  for (let intento = 0; intento < intentos; intento++) {
    if (intento > 0 && esperaMs > 0) await new Promise((resolve) => setTimeout(resolve, esperaMs));
    autorizacion = await autorizacionComprobante(claveAcceso, ambiente);
    if (autorizacion.estado === "AUTORIZADO" || autorizacion.estado === "NO AUTORIZADO") break;
    if (autorizacion.estado === "ERROR_CONEXION" && intento === 0) continue;
  }

  if (autorizacion?.estado === "AUTORIZADO") {
    return {
      autorizado: true,
      estado: "AUTORIZADO",
      recepcion,
      autorizacion,
      mensajes: autorizacion.mensajes,
    };
  }

  if (autorizacion && autorizacion.estado !== "ERROR_CONEXION") {
    return {
      autorizado: false,
      estado: autorizacion.estado,
      recepcion,
      autorizacion,
      mensajes: [...autorizacion.mensajes, ...recepcion.mensajes],
    };
  }

  if (recepcion.estado === "DEVUELTA") {
    return {
      autorizado: false,
      estado: "DEVUELTA",
      recepcion,
      autorizacion,
      mensajes: recepcion.mensajes,
    };
  }

  return {
    autorizado: false,
    estado: "ERROR_CONEXION",
    recepcion,
    autorizacion,
    mensajes: [...recepcion.mensajes, ...(autorizacion?.mensajes || [])],
  };
}
