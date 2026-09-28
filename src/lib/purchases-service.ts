import {
  PurchaseItem,
  PurchaseInvoice,
  PurchaseWithholding,
  SupplierCreditNote,
} from "@/types";
import { generarClaveAccesoSRI } from "./sri-service";

/**
 * Calcula el Costo Promedio Ponderado para una entrada de compras al inventario.
 * Fórmula: ((Stock Actual * Costo Actual) + (Cantidad Entrada * Costo Entrada)) / (Stock Actual + Cantidad Entrada)
 */
export function calculateWeightedAverageCost(
  currentStock: number,
  currentAverageCost: number,
  entryQuantity: number,
  entryUnitCost: number
): number {
  const curStock = Math.max(0, Number(currentStock) || 0);
  const curAvg = Math.max(0, Number(currentAverageCost) || 0);
  const entQty = Math.max(0, Number(entryQuantity) || 0);
  const entCost = Math.max(0, Number(entryUnitCost) || 0);

  const totalQty = curStock + entQty;
  if (totalQty <= 0) return entCost || curAvg || 0;

  const totalValue = (curStock * curAvg) + (entQty * entCost);
  const newAvg = totalValue / totalQty;
  return Math.round(newAvg * 10000) / 10000;
}

/**
 * Resultado de la extracción de una Factura de Proveedor desde un XML del SRI.
 */
export interface ParsedSupplierXmlResult {
  isValid: boolean;
  error?: string;
  supplierRuc: string;
  supplierRazonSocial: string;
  supplierNombreComercial?: string;
  documentNumber: string;
  claveAcceso: string;
  date: string;
  ambiente: string;
  subtotal15: number;
  subtotal0: number;
  subtotal: number;
  ivaAmount: number;
  total: number;
  items: {
    sku: string;
    name: string;
    quantity: number;
    unitCost: number;
    discount: number;
    ivaRate: number;
    subtotal: number;
    ivaAmount: number;
    total: number;
  }[];
}

/**
 * Extrae el contenido de un tag XML usando Regex (compatible con Browser y Node).
 */
function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

/**
 * Parsea el XML oficial del SRI de una factura emitida por un proveedor.
 */
export function parseSupplierSriXml(xmlString: string): ParsedSupplierXmlResult {
  if (!xmlString || typeof xmlString !== "string") {
    return {
      isValid: false,
      error: "El contenido del archivo XML está vacío o no es una cadena válida.",
      supplierRuc: "",
      supplierRazonSocial: "",
      documentNumber: "",
      claveAcceso: "",
      date: "",
      ambiente: "1",
      subtotal15: 0,
      subtotal0: 0,
      subtotal: 0,
      ivaAmount: 0,
      total: 0,
      items: [],
    };
  }

  try {
    const infoTrib = extractTag(xmlString, "infoTributaria");
    if (!infoTrib) {
      return {
        isValid: false,
        error: "XML no contiene sección <infoTributaria> válida del SRI.",
        supplierRuc: "",
        supplierRazonSocial: "",
        documentNumber: "",
        claveAcceso: "",
        date: "",
        ambiente: "1",
        subtotal15: 0,
        subtotal0: 0,
        subtotal: 0,
        ivaAmount: 0,
        total: 0,
        items: [],
      };
    }

    const supplierRuc = extractTag(infoTrib, "ruc");
    const supplierRazonSocial = extractTag(infoTrib, "razonSocial");
    const supplierNombreComercial = extractTag(infoTrib, "nombreComercial") || supplierRazonSocial;
    const claveAcceso = extractTag(infoTrib, "claveAcceso");
    const estab = extractTag(infoTrib, "estab").padStart(3, "0").slice(-3);
    const ptoEmi = extractTag(infoTrib, "ptoEmi").padStart(3, "0").slice(-3);
    const secuencial = extractTag(infoTrib, "secuencial").padStart(9, "0").slice(-9);
    const documentNumber = `${estab}-${ptoEmi}-${secuencial}`;
    const ambiente = extractTag(infoTrib, "ambiente") || "1";

    const infoFactura = extractTag(xmlString, "infoFactura");
    let fechaEmision = extractTag(infoFactura, "fechaEmision");
    // Formato DD/MM/YYYY a YYYY-MM-DD
    if (fechaEmision.includes("/")) {
      const parts = fechaEmision.split("/");
      if (parts.length === 3) {
        fechaEmision = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }

    const totalSinImpuestos = parseFloat(extractTag(infoFactura, "totalSinImpuestos")) || 0;
    const importeTotal = parseFloat(extractTag(infoFactura, "importeTotal")) || 0;

    // Extraer ítems desde <detalles>
    const items: ParsedSupplierXmlResult["items"] = [];
    const detallesMatch = xmlString.match(/<detalles>([\s\S]*?)<\/detalles>/i);
    
    let subtotal15 = 0;
    let subtotal0 = 0;
    let ivaAmount = 0;

    if (detallesMatch && detallesMatch[1]) {
      const detalleRegex = /<detalle>([\s\S]*?)<\/detalle>/gi;
      let dMatch;
      while ((dMatch = detalleRegex.exec(detallesMatch[1])) !== null) {
        const dContent = dMatch[1];
        const sku = extractTag(dContent, "codigoPrincipal") || extractTag(dContent, "codigoInterno") || `ITM-${items.length + 1}`;
        const name = extractTag(dContent, "descripcion") || "Producto / Servicio";
        const quantity = parseFloat(extractTag(dContent, "cantidad")) || 1;
        const unitCost = parseFloat(extractTag(dContent, "precioUnitario")) || 0;
        const discount = parseFloat(extractTag(dContent, "descuento")) || 0;
        const subtotal = parseFloat(extractTag(dContent, "precioTotalSinImpuesto")) || (quantity * unitCost - discount);

        // Impuesto
        const impValor = parseFloat(extractTag(dContent, "valor")) || 0;
        const impTarifa = parseFloat(extractTag(dContent, "tarifa")) || 0;
        const ivaRate = impTarifa > 0 ? impTarifa : (impValor > 0 ? 15 : 0);

        if (ivaRate > 0) {
          subtotal15 += subtotal;
          ivaAmount += (impValor > 0 ? impValor : subtotal * (ivaRate / 100));
        } else {
          subtotal0 += subtotal;
        }

        items.push({
          sku,
          name,
          quantity,
          unitCost,
          discount,
          ivaRate,
          subtotal: Math.round(subtotal * 100) / 100,
          ivaAmount: Math.round((impValor > 0 ? impValor : subtotal * (ivaRate / 100)) * 100) / 100,
          total: Math.round((subtotal + (impValor > 0 ? impValor : subtotal * (ivaRate / 100))) * 100) / 100,
        });
      }
    }

    if (items.length === 0) {
      // Si no desglosa detalles, crear ítem genérico con los totales
      const calcIva = Math.max(0, importeTotal - totalSinImpuestos);
      subtotal15 = totalSinImpuestos;
      ivaAmount = calcIva;
      items.push({
        sku: "GEN-COMPRA",
        name: `Compra Proveedor ${supplierRazonSocial}`,
        quantity: 1,
        unitCost: totalSinImpuestos,
        discount: 0,
        ivaRate: calcIva > 0 ? 15 : 0,
        subtotal: totalSinImpuestos,
        ivaAmount: calcIva,
        total: importeTotal,
      });
    }

    const subtotal = Math.round((subtotal15 + subtotal0) * 100) / 100;
    ivaAmount = Math.round(ivaAmount * 100) / 100;
    const finalTotal = Math.round((importeTotal || (subtotal + ivaAmount)) * 100) / 100;

    return {
      isValid: true,
      supplierRuc,
      supplierRazonSocial,
      supplierNombreComercial,
      documentNumber,
      claveAcceso,
      date: fechaEmision || new Date().toISOString().slice(0, 10),
      ambiente,
      subtotal15: Math.round(subtotal15 * 100) / 100,
      subtotal0: Math.round(subtotal0 * 100) / 100,
      subtotal,
      ivaAmount,
      total: finalTotal,
      items,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `Error al procesar XML del SRI: ${err?.message || "Estructura inválida"}`,
      supplierRuc: "",
      supplierRazonSocial: "",
      documentNumber: "",
      claveAcceso: "",
      date: "",
      ambiente: "1",
      subtotal15: 0,
      subtotal0: 0,
      subtotal: 0,
      ivaAmount: 0,
      total: 0,
      items: [],
    };
  }
}

/**
 * Calcula los montos de Retención en la Fuente de Impuesto a la Renta e IVA.
 */
export function calculateWithholdingAmounts({
  baseImponible15,
  baseImponible0,
  ivaAmount,
  rentaPercentage,
  ivaPercentage,
}: {
  baseImponible15: number;
  baseImponible0: number;
  ivaAmount: number;
  rentaPercentage: number;
  ivaPercentage: number;
}): {
  rentaBase: number;
  rentaAmount: number;
  ivaBase: number;
  ivaRetainedAmount: number;
  totalWithheld: number;
} {
  const rentaBase = (Number(baseImponible15) || 0) + (Number(baseImponible0) || 0);
  const rentaPct = Math.max(0, Number(rentaPercentage) || 0);
  const rentaAmount = Math.round((rentaBase * (rentaPct / 100)) * 100) / 100;

  const ivaBase = Math.max(0, Number(ivaAmount) || 0);
  const ivaPct = Math.max(0, Number(ivaPercentage) || 0);
  const ivaRetainedAmount = Math.round((ivaBase * (ivaPct / 100)) * 100) / 100;

  const totalWithheld = Math.round((rentaAmount + ivaRetainedAmount) * 100) / 100;

  return {
    rentaBase,
    rentaAmount,
    ivaBase,
    ivaRetainedAmount,
    totalWithheld,
  };
}

/**
 * Genera la clave de acceso oficial de 49 dígitos para Comprobantes de Retención (Tipo '07').
 */
export function generateWithholdingAccessKey({
  date,
  companyRuc,
  ambiente = "1",
  establecimiento = "001",
  puntoEmision = "001",
  secuencial,
}: {
  date: string;
  companyRuc: string;
  ambiente?: "1" | "2";
  establecimiento?: string;
  puntoEmision?: string;
  secuencial: string | number;
}): string {
  return generarClaveAccesoSRI({
    fechaEmision: date,
    tipoComprobante: "07", // 07: Comprobante de Retención
    ruc: companyRuc,
    ambiente,
    establecimiento,
    puntoEmision,
    secuencial,
  });
}
