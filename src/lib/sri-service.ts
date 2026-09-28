import {
  SriInvoice,
  SriCompanyConfig,
  CreditNote,
  WithholdingReceipt,
} from "@/types";

/**
 * Configuración predeterminada del Emisor SRI para INNTEL CORP S.A.
 */
export const DEFAULT_INNTEL_SRI_CONFIG: SriCompanyConfig = {
  id: "sri-config-inntel",
  ruc: "1792458921001",
  razonSocial: "INNTEL CORP S.A.",
  nombreComercial: "INNTEL CORP - SOLUCIONES INTEGRALES",
  direccionMatriz: "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito, Ecuador",
  direccionEstablecimiento: "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito, Ecuador",
  establecimiento: "001",
  puntoEmision: "001",
  obligadoContabilidad: true,
  tipoContribuyente: "general",
  ambiente: "1", // 1: Pruebas, 2: Producción
  emailNotificaciones: "facturacion@inntelcorp.com",
  telefonoContacto: "+593 2 394 5000",
};

/**
 * Validador oficial de Cédula y RUC de Ecuador.
 */
export function validarIdentificacionEcuador(
  identificacion: string,
  tipoIdentificacion: string = ""
): boolean {
  if (!identificacion) return false;
  const clean = String(identificacion).trim();

  // Consumidor Final es válido de inmediato
  if (clean === "9999999999999") return true;

  const cleanTipo = String(tipoIdentificacion).toLowerCase();
  if (cleanTipo === "pasaporte" || cleanTipo === "06" || cleanTipo === "exterior" || cleanTipo === "08") {
    return true;
  }

  const len = clean.length;
  if (len !== 10 && len !== 13) return false;

  // Si es RUC de 13 dígitos, los 3 últimos deben ser 001 (o al menos terminar en dígito válido de establecimiento)
  if (len === 13 && !clean.endsWith("001")) {
    return false;
  }

  const cedula = clean.substring(0, 10);
  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;

  const tercerDigito = parseInt(cedula.substring(2, 3), 10);

  // RUC Sociedades Privadas / Extranjeros sin cédula (tercer dígito = 9)
  if (tercerDigito === 9) {
    const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    const verificador = parseInt(cedula.substring(9, 10), 10);
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      suma += parseInt(cedula[i], 10) * coeficientes[i];
    }
    const residuo = suma % 11;
    const digitoCalculado = residuo === 0 ? 0 : 11 - residuo;
    return digitoCalculado === verificador;
  }

  // RUC Sociedades Públicas (tercer dígito = 6)
  if (tercerDigito === 6) {
    const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
    const verificador = parseInt(cedula.substring(8, 9), 10);
    let suma = 0;
    for (let i = 0; i < 8; i++) {
      suma += parseInt(cedula[i], 10) * coeficientes[i];
    }
    const residuo = suma % 11;
    const digitoCalculado = residuo === 0 ? 0 : 11 - residuo;
    return digitoCalculado === verificador;
  }

  // Cédula de Persona Natural (tercer dígito < 6)
  if (tercerDigito < 6) {
    const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    const verificador = parseInt(cedula.substring(9, 10), 10);
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let valor = parseInt(cedula[i], 10) * coeficientes[i];
      if (valor >= 10) valor -= 9;
      suma += valor;
    }
    const residuo = suma % 10;
    const digitoCalculado = residuo === 0 ? 0 : 10 - residuo;
    return digitoCalculado === verificador;
  }

  return false;
}

/**
 * Algoritmo Módulo 11 oficial del SRI para el dígito verificador.
 */
export function calcularModulo11(clave48: string): number {
  let factor = 2;
  let suma = 0;
  for (let i = clave48.length - 1; i >= 0; i--) {
    suma += parseInt(clave48[i], 10) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const residuo = suma % 11;
  let verificador = 11 - residuo;
  if (verificador === 11) verificador = 0;
  if (verificador === 10) verificador = 1;
  return verificador;
}

/**
 * Genera la clave de acceso oficial de 49 dígitos según especificación técnica del SRI Ecuador.
 * DDMMYYYY (8) + TipoComprobante (2) + RUC (13) + Ambiente (1) + Serie (6) + Secuencial (9) + CódigoNumérico (8) + TipoEmisión (1) + DígitoVerificador (1)
 */
export function generarClaveAccesoSRI({
  fechaEmision,
  tipoComprobante = "01", // 01 Factura, 04 Nota Crédito, 06 Guía Remisión, 07 Retención
  ruc,
  ambiente = "1",
  establecimiento = "001",
  puntoEmision = "001",
  secuencial,
  codigoNumerico = "12345678",
  tipoEmision = "1", // 1: Emisión Normal
}: {
  fechaEmision: string; // YYYY-MM-DD o DD/MM/YYYY
  tipoComprobante?: string;
  ruc: string;
  ambiente?: string;
  establecimiento?: string;
  puntoEmision?: string;
  secuencial: string | number;
  codigoNumerico?: string;
  tipoEmision?: string;
}): string {
  // Convertir fecha a DDMMYYYY
  let ddmmyyyy = "";
  if (fechaEmision.includes("-")) {
    const [y, m, d] = fechaEmision.split("T")[0].split("-");
    ddmmyyyy = `${d.padStart(2, "0")}${m.padStart(2, "0")}${y}`;
  } else if (fechaEmision.includes("/")) {
    const [d, m, y] = fechaEmision.split("/");
    ddmmyyyy = `${d.padStart(2, "0")}${m.padStart(2, "0")}${y}`;
  } else {
    ddmmyyyy = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  }

  const rucLimpio = String(ruc).trim().padEnd(13, "0").slice(0, 13);
  const estab = String(establecimiento).padStart(3, "0").slice(-3);
  const pto = String(puntoEmision).padStart(3, "0").slice(-3);

  // Extraer sólo los dígitos numéricos del secuencial y rellenar a 9 posiciones
  const cleanSec = String(secuencial).replace(/[^0-9]/g, "");
  const secPadded = cleanSec.padStart(9, "0").slice(-9);

  const codNum = String(codigoNumerico).padStart(8, "0").slice(-8);

  const clave48 = `${ddmmyyyy}${tipoComprobante}${rucLimpio}${ambiente}${estab}${pto}${secPadded}${codNum}${tipoEmision}`;
  const digitoVerificador = calcularModulo11(clave48);

  return `${clave48}${digitoVerificador}`;
}

/**
 * Formatea un número de comprobante oficial: 001-001-000000001
 */
export function formatearSecuencialSRI(
  secuencial: number | string,
  estab = "001",
  pto = "001"
): string {
  const clean = String(secuencial).replace(/[^0-9]/g, "");
  const padded = clean.padStart(9, "0").slice(-9);
  return `${estab.padStart(3, "0")}-${pto.padStart(3, "0")}-${padded}`;
}

/**
 * Convierte un importe monetario a su representación en letras oficial para el RIDE.
 */
export function numeroALetrasDolares(num: number): string {
  const unidades = ["CERO", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const decenas = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE"];
  const decenasGrandes = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const centenas = ["", "CIEN", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHECIENTOS", "NOVECIENTOS"];

  function decodificar(n: number): string {
    if (n < 10) return unidades[n];
    if (n >= 10 && n <= 19) return decenas[n - 10];
    if (n >= 20 && n <= 29) return n === 20 ? "VEINTE" : "VEINTI" + unidades[n - 20];
    const dec = Math.floor(n / 10);
    const uni = n % 10;
    return decenasGrandes[dec] + (uni > 0 ? " Y " + unidades[uni] : "");
  }

  function centenasFn(n: number): string {
    if (n === 100) return "CIEN";
    if (n < 100) return decodificar(n);
    const cen = Math.floor(n / 100);
    const resto = n % 100;
    return (cen === 1 ? "CIENTO" : centenas[cen]) + (resto > 0 ? " " + decodificar(resto) : "");
  }

  function milesFn(n: number): string {
    if (n < 1000) return centenasFn(n);
    const mil = Math.floor(n / 1000);
    const resto = n % 1000;
    const milStr = mil === 1 ? "MIL" : centenasFn(mil) + " MIL";
    return milStr + (resto > 0 ? " " + centenasFn(resto) : "");
  }

  const partes = String(Number(num || 0).toFixed(2)).split(".");
  const entero = parseInt(partes[0], 10);
  const decimales = partes[1] || "00";

  let enteroStr = "";
  if (entero === 0) enteroStr = "CERO";
  else enteroStr = milesFn(entero);

  return `SON: ${enteroStr} CON ${decimales}/100 DÓLARES`;
}

/**
 * Escapa caracteres especiales para XML.
 */
export function escaparXml(valor: string | number | undefined | null): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Genera el XML formal de Factura electrónica bajo estándar XSD v1.1.0 del SRI.
 */
export function generarFacturaXml(
  invoice: SriInvoice,
  emisor: SriCompanyConfig = DEFAULT_INNTEL_SRI_CONFIG
): string {
  const [estab, pto, sec] = invoice.documentNumber.split("-");
  const [y, m, d] = invoice.date.split("-");
  const fechaEmisionDdmmyyyy = `${d}/${m}/${y}`;

  const xmlItems = invoice.items
    .map(
      (item) => `
    <detalle>
      <codigoPrincipal>${escaparXml(item.sku)}</codigoPrincipal>
      <descripcion>${escaparXml(item.name)}</descripcion>
      <cantidad>${item.quantity.toFixed(2)}</cantidad>
      <precioUnitario>${item.unitPrice.toFixed(4)}</precioUnitario>
      <descuento>${item.discount.toFixed(2)}</descuento>
      <precioTotalSinImpuesto>${item.subtotal.toFixed(2)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${item.ivaRate === 15 ? "4" : item.ivaRate === 5 ? "5" : "0"}</codigoPorcentaje>
          <tarifa>${item.ivaRate}</tarifa>
          <baseImponible>${item.subtotal.toFixed(2)}</baseImponible>
          <valor>${item.ivaAmount.toFixed(2)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${emisor.ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${escaparXml(emisor.razonSocial)}</razonSocial>
    <nombreComercial>${escaparXml(emisor.nombreComercial)}</nombreComercial>
    <ruc>${emisor.ruc}</ruc>
    <claveAcceso>${invoice.claveAcceso}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${estab || emisor.establecimiento}</estab>
    <ptoEmi>${pto || emisor.puntoEmision}</ptoEmi>
    <secuencial>${sec}</secuencial>
    <dirMatriz>${escaparXml(emisor.direccionMatriz)}</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${fechaEmisionDdmmyyyy}</fechaEmision>
    <dirEstablecimiento>${escaparXml(emisor.direccionEstablecimiento)}</dirEstablecimiento>
    <obligadoContabilidad>${emisor.obligadoContabilidad ? "SI" : "NO"}</obligadoContabilidad>
    <tipoIdentificacionComprador>${invoice.tipoIdentificacion}</tipoIdentificacionComprador>
    <razonSocialComprador>${escaparXml(invoice.clientName)}</razonSocialComprador>
    <identificacionComprador>${invoice.clientRuc}</identificacionComprador>
    <direccionComprador>${escaparXml(invoice.clientAddress || "Ecuador")}</direccionComprador>
    <totalSinImpuestos>${(invoice.subtotal15 + invoice.subtotal0 + invoice.subtotalNoObjeto).toFixed(2)}</totalSinImpuestos>
    <totalDescuento>${invoice.discountTotal.toFixed(2)}</totalDescuento>
    <totalConImpuestos>
      ${
        invoice.subtotal15 > 0
          ? `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>4</codigoPorcentaje>
        <baseImponible>${invoice.subtotal15.toFixed(2)}</baseImponible>
        <tarifa>15</tarifa>
        <valor>${invoice.ivaTotal.toFixed(2)}</valor>
      </totalImpuesto>`
          : ""
      }
      ${
        invoice.subtotal0 > 0
          ? `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>0</codigoPorcentaje>
        <baseImponible>${invoice.subtotal0.toFixed(2)}</baseImponible>
        <tarifa>0</tarifa>
        <valor>0.00</valor>
      </totalImpuesto>`
          : ""
      }
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${invoice.total.toFixed(2)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>
      <pago>
        <formaPago>${invoice.sriPaymentCode || "01"}</formaPago>
        <total>${invoice.total.toFixed(2)}</total>
      </pago>
    </pagos>
  </infoFactura>
  <detalles>${xmlItems}
  </detalles>
  <infoAdicional>
    <campoAdicional nombre="Email">${escaparXml(invoice.clientEmail)}</campoAdicional>
    ${invoice.clientPhone ? `<campoAdicional nombre="Telefono">${escaparXml(invoice.clientPhone)}</campoAdicional>` : ""}
    <campoAdicional nombre="BodegaDespacho">${escaparXml(invoice.warehouseName)}</campoAdicional>
    ${invoice.notes ? `<campoAdicional nombre="Observaciones">${escaparXml(invoice.notes)}</campoAdicional>` : ""}
  </infoAdicional>
</factura>`;
}
