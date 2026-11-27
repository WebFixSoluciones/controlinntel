import { normalizeSearchText } from "./search.ts";

const positive = /^(?:(?:activ|activad|enviad|aprobad|emitid|aceptad|pagad|cobrad|autorizad|registrad|facturad|aplicad|validad|resuelt|confirmad|conciliad|ingresad|vinculad)[oa]s?|vigentes?|disponibles?|en linea)$/;
const negative = /^(?:(?:eliminad|caducad|cancelad|terminad|finalizad|cerrad|fallid|vencid|anulad|rechazad|devuelt|retirad|inactiv|suspendid|desactivad|excluid|revertid)[oa]s?|fallos?|errores?|sin conexion|fuera de linea|no autorizad[oa]s?)$/;
const warning = /^(?:(?:pendientes?|alertas?|revisar|requiere revision)(?: .+)?|(?:por|a punto de) (?:renovar|vencer|caducar|verificar|conciliar)|en (?:espera|revision)|abono parcial|urgente|sin comprobante)$/;

export function badgeTone(label: string | number | undefined) {
  const status = normalizeSearchText(label)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:contrato|empresa|firma|envio automatico) /, "")
    .replace(/ \([^)]*\)$/, "")
    .replace(/ (?:sri|en pruebas|por proveedor)$/, "");

  if (positive.test(status)) return "positive";
  if (negative.test(status)) return "negative";
  if (warning.test(status)) return "warning";
  return "neutral";
}
