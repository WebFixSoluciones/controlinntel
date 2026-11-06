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
  sinRegistro?: boolean;
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
    if (typeof raw !== "string" || !raw.trim() || /<!DOCTYPE|<!ENTITY/i.test(raw)) return null;
    const doc = new DOMParser().parseFromString(raw, "text/xml");
    return doc.documentElement ? doc : null;
  } catch {
    return null;
  }
}

export function sriSignatureValue(xml: string) {
  const doc = parseXml(xml);
  const signature = doc?.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "SignatureValue")[0];
  return signature?.textContent?.replace(/\s+/g, "") || "";
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
  timeoutMs = 8_000
): Promise<string> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>${bodyXml}</soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: action,
      Accept: "text/xml",
      "User-Agent": "INNTEL-CORP/1.0 (+https://control.inntelcorp.com)",
    },
    body: envelope,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`El SRI respondió HTTP ${response.status}.`);
  return response.text();
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
    const receipt = first(doc, "RespuestaRecepcionComprobante");
    const estadoRaw = textOf(receipt, "estado").toUpperCase();
    if (estadoRaw !== "RECIBIDA" && estadoRaw !== "DEVUELTA") {
      return {
        estado: "ERROR_CONEXION",
        mensajes: [{ mensaje: "El SRI devolvió una respuesta no interpretable.", tipo: "ERROR" }],
        claveAcceso,
        raw,
      };
    }

    return { estado: estadoRaw, mensajes: extractMensajes(receipt), claveAcceso, raw };
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
    const respuesta = first(doc, "RespuestaAutorizacionComprobante");
    const consultada = textOf(respuesta, "claveAccesoConsultada");
    if (!respuesta || consultada !== claveAcceso) {
      return {
        estado: "ERROR_CONEXION",
        mensajes: [{ mensaje: "El SRI devolvió una respuesta no interpretable.", tipo: "ERROR" }],
        raw,
      };
    }

    const entries = findAll(respuesta, "autorizacion");
    const authorized = entries.find(entry => {
      const xml = parseXml(textOf(entry, "comprobante"));
      const tributaria = first(xml, "infoTributaria");
      const declared = textOf(entry, "ambiente").toUpperCase();
      const expected = ambiente === "2" ? ["2", "PRODUCCION", "PRODUCCIÓN"] : ["1", "PRUEBAS"];
      return textOf(entry, "estado") === "AUTORIZADO"
        && textOf(entry, "numeroAutorizacion") === claveAcceso
        && Number.isFinite(Date.parse(textOf(entry, "fechaAutorizacion")))
        && expected.includes(declared)
        && textOf(tributaria, "claveAcceso") === claveAcceso
        && textOf(tributaria, "ambiente") === ambiente
        && !!xml?.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature")[0];
    });
    const rejected = (entry: Element) => ["NO AUTORIZADO", "RECHAZADO"].includes(textOf(entry, "estado"));
    const autorizacion = authorized || entries.find(rejected);
    if (!autorizacion) {
      const numero = textOf(respuesta, "numeroComprobantes");
      return {
        estado: entries.some(entry => ["EN PROCESO", "PPR"].includes(textOf(entry, "estado")))
          || (!entries.length && numero === "0") ? "EN PROCESO" : "ERROR_CONEXION",
        sinRegistro: entries.length === 0 && numero === "0",
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

    const estado = authorized ? "AUTORIZADO" : "NO AUTORIZADO";

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
  options?: { autorizacionIntentos?: number; esperaMs?: number; onReception?: (receipt: SriRecepcionResult) => Promise<void> }
): Promise<SriEmissionResult> {
  const recepcion = await recepcionComprobante(claveAcceso, xmlFirmado, ambiente);
  await options?.onReception?.(recepcion);

  const intentos = Math.min(2, Math.max(1, options?.autorizacionIntentos ?? 2));
  const esperaMs = Math.max(0, options?.esperaMs ?? 1500);

  let autorizacion: SriAutorizacionResult | undefined;
  for (let intento = 0; intento < intentos; intento++) {
    if (intento > 0 && esperaMs > 0) await new Promise((resolve) => setTimeout(resolve, esperaMs));
    autorizacion = await autorizacionComprobante(claveAcceso, ambiente);
    if (autorizacion.estado === "AUTORIZADO" || autorizacion.estado === "NO AUTORIZADO") break;
    if (recepcion.estado !== "RECIBIDA" || autorizacion.estado === "ERROR_CONEXION") break;
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

  if (autorizacion?.estado === "NO AUTORIZADO" || (recepcion.estado === "RECIBIDA" && autorizacion?.estado === "EN PROCESO")) {
    return {
      autorizado: false,
      estado: autorizacion.estado,
      recepcion,
      autorizacion,
      mensajes: [...autorizacion.mensajes, ...recepcion.mensajes],
    };
  }

  if (recepcion.estado === "DEVUELTA" && !recepcion.mensajes.some(m => ["43", "70"].includes(m.identificador || ""))) {
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
