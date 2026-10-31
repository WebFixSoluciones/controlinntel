import { createHash } from "node:crypto";
import forge from "node-forge";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { C14nCanonicalization } from "xml-crypto";

/**
 * Firma electrónica XAdES-BES para comprobantes del SRI (Ecuador).
 *
 * El SRI exige:
 *  - Firma enveloped sobre el nodo raíz (`Id="comprobante"`).
 *  - `SignedProperties` dentro de `ds:Object` con `SigningTime`, `SigningCertificate`
 *    (digest SHA-1 del certificado + issuer/serial) y `DataObjectFormat`.
 *  - Referencias con digest SHA-1 y canonicalización C14N 1.0.
 *  - RSA-SHA1 sobre `SignedInfo`.
 *
 * La firma se construye de forma determinista para que los digests sean
 * reproducibles por cualquier validador (SRI, firmador oficial, etc.).
 */

const DS_NS = "http://www.w3.org/2000/09/xmldsig#";
const ETSI_NS = "http://uri.etsi.org/01903/v1.3.2#";
const C14N_ALGORITHM = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const ENVELOPED_ALGORITHM = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const RSA_SHA1_ALGORITHM = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
const SHA1_ALGORITHM = "http://www.w3.org/2000/09/xmldsig#sha1";
const SIGNATURE_ID = "Signature-inntel";
const SIGNED_PROPERTIES_ID = "SignedProperties-inntel";
const KEY_INFO_ID = "KeyInfo-inntel";
const OBJECT_ID = "Object-inntel";

export interface SriCertificateSummary {
  subject: string;
  issuer: string;
  issuerRfc2253: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  expiresInDays: number;
  expired: boolean;
  /** Certificado X.509 en DER codificado Base64 (sin cabeceras PEM). */
  certificateBase64: string;
  certificatePem: string;
  fingerprintSha1: string;
  keySize: number;
}

export interface SriSigningMaterial extends SriCertificateSummary {
  privateKeyPem: string;
  certificateDigestSha1: string;
}

export interface SriSignedXml {
  xml: string;
  digestComprobante: string;
  digestSignedProperties: string;
  signatureValue: string;
  signingTime: string;
}

function rawBase64(input: string): string {
  return String(input || "")
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
}

function sha1Base64(data: string | Buffer): string {
  return createHash("sha1").update(data).digest("base64");
}

function escapeDnValue(value: string): string {
  const text = String(value ?? "");
  const escaped = text.replace(/([\\,+"<>;=])/g, "\\$1");
  if (/^[ #]/.test(text)) return `\\${escaped}`;
  if (/ $/.test(text)) return `${escaped}\\ `;
  return escaped;
}

function escapeXmlText(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** DN en formato RFC 2253 (orden invertido al del certificado). */
function issuerRfc2253(cert: forge.pki.Certificate): string {
  const attributes = (cert.issuer?.attributes || []).slice().reverse();
  return attributes
    .map((attr: any) => `${attr.shortName || attr.name}=${escapeDnValue(String(attr.value ?? ""))}`)
    .join(",");
}

function certificateDerBase64(cert: forge.pki.Certificate): string {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  return forge.util.encode64(der);
}

function serialToDecimal(serial: string): string {
  const hex = String(serial || "").replace(/[^0-9a-fA-F]/g, "");
  if (!hex) return "0";
  try {
    return BigInt(`0x${hex}`).toString(10);
  } catch {
    return "0";
  }
}

/**
 * Extrae la clave privada y el certificado del emisor desde un PKCS#12 (.p12/.pfx).
 * @param source Contenido Base64 o Data URL del archivo.
 * @param password Contraseña del certificado.
 */
export function parsePkcs12(source: string, password: string): SriSigningMaterial {
  const clean = rawBase64(source);
  if (!clean) throw new Error("El certificado digital está vacío.");
  if (!password) throw new Error("La contraseña del certificado es obligatoria.");

  let der: string;
  try {
    der = forge.util.decode64(clean);
  } catch {
    throw new Error("El archivo no es un certificado PKCS#12 válido (Base64 incorrecto).");
  }
  if (der.charCodeAt(0) !== 0x30) {
    throw new Error("El archivo no es un certificado PKCS#12 válido (.p12/.pfx).");
  }

  let asn1: forge.asn1.Asn1;
  try {
    asn1 = forge.asn1.fromDer(der);
  } catch {
    throw new Error("No se pudo leer la estructura del certificado .p12/.pfx.");
  }

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, true, password);
  } catch (strictError: any) {
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
    } catch {
      const message = String(strictError?.message || "");
      if (/mac|password|invalid/i.test(message)) {
        throw new Error("La contraseña del certificado es incorrecta o el archivo está dañado.");
      }
      throw new Error(`No se pudo abrir el certificado digital: ${message || "formato no soportado"}.`);
    }
  }

  const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const plain = p12.getBags({ bagType: forge.pki.oids.keyBag });
  const keyBag: any =
    (shrouded[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0] ||
    (plain[forge.pki.oids.keyBag] || [])[0];
  const privateKey: forge.pki.rsa.PrivateKey | undefined = keyBag?.key;
  if (!privateKey || typeof (privateKey as any).sign !== "function") {
    throw new Error("El certificado no contiene una clave privada utilizable.");
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certs: forge.pki.Certificate[] = (certBags[forge.pki.oids.certBag] || [])
    .map((bag: any) => bag.cert)
    .filter(Boolean);

  if (certs.length === 0) {
    throw new Error("El certificado no contiene un certificado X.509.");
  }

  // El certificado del firmante es aquel cuya clave pública coincide con la privada.
  const keyModulus = String((privateKey as any).n || "");
  const signer =
    certs.find((cert) => String((cert.publicKey as any)?.n || "") === keyModulus) || certs[0];

  const derBase64 = certificateDerBase64(signer);
  const validFrom = signer.validity?.notBefore || new Date();
  const validTo = signer.validity?.notAfter || new Date();
  const now = Date.now();
  const expiresInDays = Math.floor((validTo.getTime() - now) / 86_400_000);

  return {
    subject: signer.subject?.attributes
      ?.map((attr: any) => `${attr.shortName || attr.name}=${String(attr.value ?? "")}`)
      .join(", ") || "",
    issuer: signer.issuer?.attributes
      ?.map((attr: any) => `${attr.shortName || attr.name}=${String(attr.value ?? "")}`)
      .join(", ") || "",
    issuerRfc2253: issuerRfc2253(signer),
    serialNumber: serialToDecimal(signer.serialNumber),
    validFrom: validFrom.toISOString(),
    validTo: validTo.toISOString(),
    expiresInDays,
    expired: validTo.getTime() < now,
    certificateBase64: derBase64,
    certificatePem: forge.pki.certificateToPem(signer),
    fingerprintSha1: createHash("sha1")
      .update(Buffer.from(derBase64, "base64"))
      .digest("hex")
      .toUpperCase()
      .match(/.{2}/g)!
      .join(":"),
    keySize: Number((privateKey as any).n?.bitLength?.() || 0),
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certificateDigestSha1: sha1Base64(Buffer.from(derBase64, "base64")),
  };
}

/** Material de firma ya validado y listo para reutilizar en varias emisiones. */
export function materialFromStored(
  pkcs12Base64: string,
  password: string
): SriSigningMaterial {
  return parsePkcs12(pkcs12Base64, password);
}

function parseElement(xml: string) {
  const errors: string[] = [];
  const doc = new DOMParser({
    errorHandler: (level: string, message: string) => {
      if (level === "error" || level === "fatalError") errors.push(String(message));
    },
  }).parseFromString(xml, "text/xml");
  if (errors.length) throw new Error(`XML inválido: ${errors[0]}`);
  const element = doc.documentElement;
  if (!element) throw new Error("XML inválido: documento vacío.");
  return element;
}

/**
 * Firma el XML de un comprobante del SRI con XAdES-BES enveloped.
 * El XML de entrada debe tener el nodo raíz con `Id="comprobante"`.
 */
export function signSriXml(xml: string, material: SriSigningMaterial): SriSignedXml {
  const supportedRoots = ["<factura", "<notaCredito", "<notaDebito", "<comprobanteRetencion", "<guiaRemision"];
  if (!xml || !supportedRoots.some((root) => xml.includes(root))) {
    throw new Error("El comprobante no es un XML tributario reconocido.");
  }

  const errors: string[] = [];
  const document = new DOMParser({
    errorHandler: (level: string, message: string) => {
      if (level === "error" || level === "fatalError") errors.push(String(message));
    },
  }).parseFromString(xml, "text/xml");
  if (errors.length) throw new Error(`XML inválido: ${errors[0]}`);

  const root = document.documentElement;
  if (!root) throw new Error("XML inválido: documento vacío.");
  if (!root.getAttribute("id") && !root.getAttribute("Id") && !root.getAttribute("ID")) {
    root.setAttribute("id", "comprobante");
  }

  const canonicalizer = new C14nCanonicalization();

  // 1. Digest del comprobante (aún sin firma). El transform enveloped
  //    elimina únicamente el elemento Signature, por eso la firma se agrega
  //    como último hijo sin insertar nodos de texto nuevos.
  const canonicalComprobante = canonicalizer.process(root as any, {});
  const digestComprobante = sha1Base64(canonicalComprobante);

  const signingTime = new Date().toISOString();

  // 2. SignedProperties: se declaran los namespaces heredados para que el
  //    digest sea idéntico al que calcula cualquier validador sobre el
  //    documento final (C14N inclusivo).
  const signedProperties = [
    `<etsi:SignedProperties xmlns:ds="${DS_NS}" xmlns:etsi="${ETSI_NS}" Id="${SIGNED_PROPERTIES_ID}">`,
    `<etsi:SignedSignatureProperties>`,
    `<etsi:SigningTime>${signingTime}</etsi:SigningTime>`,
    `<etsi:SigningCertificate>`,
    `<etsi:Cert>`,
    `<etsi:CertDigest>`,
    `<ds:DigestMethod Algorithm="${SHA1_ALGORITHM}"/>`,
    `<ds:DigestValue>${material.certificateDigestSha1}</ds:DigestValue>`,
    `</etsi:CertDigest>`,
    `<etsi:IssuerSerial>`,
    `<ds:X509IssuerName>${escapeXmlText(material.issuerRfc2253)}</ds:X509IssuerName>`,
    `<ds:X509SerialNumber>${material.serialNumber}</ds:X509SerialNumber>`,
    `</etsi:IssuerSerial>`,
    `</etsi:Cert>`,
    `</etsi:SigningCertificate>`,
    `</etsi:SignedSignatureProperties>`,
    `<etsi:SignedDataObjectProperties>`,
    `<etsi:DataObjectFormat ObjectReference="#Reference-ID-1">`,
    `<etsi:Description>contenido comprobante</etsi:Description>`,
    `<etsi:MimeType>text/xml</etsi:MimeType>`,
    `</etsi:DataObjectFormat>`,
    `</etsi:SignedDataObjectProperties>`,
    `</etsi:SignedProperties>`,
  ].join("");

  const signedPropertiesElement = parseElement(signedProperties);
  const canonicalSignedProperties = canonicalizer.process(signedPropertiesElement as any, {});
  const digestSignedProperties = sha1Base64(canonicalSignedProperties);

  // 3. SignedInfo
  const signedInfo = [
    `<ds:SignedInfo xmlns:ds="${DS_NS}">`,
    `<ds:CanonicalizationMethod Algorithm="${C14N_ALGORITHM}"/>`,
    `<ds:SignatureMethod Algorithm="${RSA_SHA1_ALGORITHM}"/>`,
    `<ds:Reference Id="Reference-ID-1" URI="#comprobante">`,
    `<ds:Transforms>`,
    `<ds:Transform Algorithm="${ENVELOPED_ALGORITHM}"/>`,
    `</ds:Transforms>`,
    `<ds:DigestMethod Algorithm="${SHA1_ALGORITHM}"/>`,
    `<ds:DigestValue>${digestComprobante}</ds:DigestValue>`,
    `</ds:Reference>`,
    `<ds:Reference Id="Reference-ID-2" URI="#${SIGNED_PROPERTIES_ID}">`,
    `<ds:Transforms>`,
    `<ds:Transform Algorithm="${C14N_ALGORITHM}"/>`,
    `</ds:Transforms>`,
    `<ds:DigestMethod Algorithm="${SHA1_ALGORITHM}"/>`,
    `<ds:DigestValue>${digestSignedProperties}</ds:DigestValue>`,
    `</ds:Reference>`,
    `</ds:SignedInfo>`,
  ].join("");

  const signedInfoElement = parseElement(signedInfo);
  const canonicalSignedInfo = canonicalizer.process(signedInfoElement as any, {});

  // 4. RSA-SHA1 sobre el SignedInfo canónico
  const md = forge.md.sha1.create();
  md.update(canonicalSignedInfo, "utf8");
  const signatureBinary = (forge.pki.privateKeyFromPem(material.privateKeyPem) as any).sign(md);
  const signatureValue = forge.util.encode64(signatureBinary);

  // 5. Ensamble final
  const signatureXml = [
    `<ds:Signature xmlns:ds="${DS_NS}" Id="${SIGNATURE_ID}">`,
    signedInfo,
    `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>`,
    `<ds:KeyInfo Id="${KEY_INFO_ID}">`,
    `<ds:X509Data>`,
    `<ds:X509Certificate>${material.certificateBase64}</ds:X509Certificate>`,
    `</ds:X509Data>`,
    `</ds:KeyInfo>`,
    `<ds:Object Id="${OBJECT_ID}">`,
    `<etsi:QualifyingProperties xmlns:etsi="${ETSI_NS}" Target="#${SIGNATURE_ID}">`,
    signedProperties,
    `</etsi:QualifyingProperties>`,
    `</ds:Object>`,
    `</ds:Signature>`,
  ].join("");

  const signatureDocument = new DOMParser().parseFromString(signatureXml, "text/xml");
  const signatureElement = signatureDocument.documentElement;
  if (!signatureElement) throw new Error("No se pudo construir la firma electrónica.");

  root.appendChild(document.importNode(signatureElement, true));

  const serialized = new XMLSerializer().serializeToString(document);
  const finalXml = /^<\?xml/i.test(serialized)
    ? serialized
    : `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;

  return {
    xml: finalXml,
    digestComprobante,
    digestSignedProperties,
    signatureValue,
    signingTime,
  };
}
