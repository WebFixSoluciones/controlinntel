"use client";

import React, { useRef } from "react";
import {
  X,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  Building2,
  FileText,
  BadgePercent,
  Calendar,
  User,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { ClientQuote, SriCompanyConfig } from "@/types";
import {
  DEFAULT_INNTEL_SRI_CONFIG,
  numeroALetrasDolares,
} from "@/lib/sri-service";
import { printHtmlElement, safeNumber, safeFloat } from "@/lib/print-service";

interface QuotePreviewModalProps {
  isOpen?: boolean;
  onClose: () => void;
  quote?: ClientQuote | null;
  companyConfig?: SriCompanyConfig;
  onConvertToInvoice?: (quote: ClientQuote) => void;
}

export function QuotePreviewModal({
  isOpen = true,
  onClose,
  quote,
  companyConfig = DEFAULT_INNTEL_SRI_CONFIG,
  onConvertToInvoice,
}: QuotePreviewModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !quote) return null;

  const handlePrint = () => {
    if (printAreaRef.current) {
      printHtmlElement(printAreaRef.current, `Cotizacion-${quote.quoteNumber || "INNTEL"}`, "a4");
    } else {
      window.print();
    }
  };

  // Cálculos precisos y desglosados de subtotales
  const items = quote.items || [];
  
  const subtotal15 =
    quote.subtotal15 !== undefined && Number(quote.subtotal15) > 0
      ? safeFloat(quote.subtotal15)
      : items
          .filter((it) => it.ivaRate === undefined || safeFloat(it.ivaRate) === 15)
          .reduce(
            (sum, it) =>
              sum +
              (it.subtotal !== undefined
                ? safeFloat(it.subtotal)
                : safeFloat(it.quantity) * safeFloat(it.unitPrice) - safeFloat(it.discount)),
            0
          );

  const subtotal5 = items
    .filter((it) => safeFloat(it.ivaRate) === 5)
    .reduce(
      (sum, it) =>
        sum +
        (it.subtotal !== undefined
          ? safeFloat(it.subtotal)
          : safeFloat(it.quantity) * safeFloat(it.unitPrice) - safeFloat(it.discount)),
      0
    );

  const subtotal0 =
    quote.subtotal0 !== undefined
      ? safeFloat(quote.subtotal0)
      : items
          .filter((it) => safeFloat(it.ivaRate) === 0)
          .reduce(
            (sum, it) =>
              sum +
              (it.subtotal !== undefined
                ? safeFloat(it.subtotal)
                : safeFloat(it.quantity) * safeFloat(it.unitPrice) - safeFloat(it.discount)),
            0
          );

  const subtotalNoObjeto = 0;
  const subtotalExento = 0;
  const subtotalSinImpuestos =
    subtotal15 + subtotal5 + subtotal0 + subtotalNoObjeto + subtotalExento;

  const descuento =
    quote.discountTotal !== undefined
      ? safeFloat(quote.discountTotal)
      : items.reduce((sum, it) => sum + safeFloat(it.discount), 0);

  const iva15 =
    quote.ivaTotal !== undefined && subtotal5 === 0
      ? safeFloat(quote.ivaTotal)
      : parseFloat((subtotal15 * 0.15).toFixed(2));
  const iva5 = parseFloat((subtotal5 * 0.05).toFixed(2));
  const ivaTotal = parseFloat((iva15 + iva5).toFixed(2));

  const total =
    quote.total !== undefined
      ? safeFloat(quote.total)
      : parseFloat((subtotalSinImpuestos + ivaTotal).toFixed(2));

  const totalEnLetras = numeroALetrasDolares(total);

  // Formateo de fechas
  const formatFecha = (dStr?: string) => {
    if (!dStr) return new Date().toLocaleDateString("es-EC");
    if (dStr.includes("-")) {
      const parts = dStr.split("T")[0].split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  const fechaEmision = formatFecha(quote.date);

  // Cálculo de vigencia (30 días por defecto en Ecuador según Contífico)
  let fechaVigencia = "";
  if (quote.validUntil) {
    fechaVigencia = formatFecha(quote.validUntil);
  } else if (quote.date) {
    try {
      const d = new Date(quote.date.includes("T") ? quote.date : quote.date + "T00:00:00");
      d.setDate(d.getDate() + 30);
      fechaVigencia = d.toLocaleDateString("es-EC");
    } catch {
      fechaVigencia = "30 días calendario";
    }
  } else {
    fechaVigencia = "30 días calendario";
  }

  const emisor = companyConfig || DEFAULT_INNTEL_SRI_CONFIG;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150 print:p-0 print:bg-white print:static print:overflow-visible print:block">
        <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto print:border-none print:shadow-none print:rounded-none print:my-0 print:max-w-none print:w-full print:max-h-none print:overflow-visible flex flex-col">
          {/* Barra superior de herramientas - No se imprime */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-900 text-white print:hidden">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[6px] bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    FORMATO CONTÍFICO OFICIAL
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] uppercase ${
                      quote.status === "facturada"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : quote.status === "aprobada"
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {quote.status}
                  </span>
                </div>
                <h3 className="font-bold text-white text-sm">
                  Cotización N° {quote.quoteNumber}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onConvertToInvoice && quote.status !== "facturada" && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onConvertToInvoice(quote);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Transformar a Venta</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#004ac6] hover:bg-[#2563eb] text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir / Guardar PDF</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-[6px] transition cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Contenedor del Documento A4 */}
          <div className="p-4 sm:p-8 overflow-y-auto max-h-[85vh] bg-slate-100/70 print:p-0 print:m-0 print:max-h-none print:overflow-visible print:bg-white">
            <div
              id="quote-print-area"
              ref={printAreaRef}
              className="max-w-[850px] mx-auto bg-white p-6 sm:p-8 rounded-[6px] shadow-xs border border-slate-200 space-y-5 text-[11px] leading-relaxed text-slate-800 print:shadow-none print:border-none print:p-0 print:max-w-none print:w-full print:text-black"
            >
              {/* =========================================================
                  CABECERA ESTILO CONTÍFICO (2 Columnas)
                  ========================================================= */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start print:grid-cols-2">
                {/* Columna Izquierda: Logo Oficial y Datos del Emisor */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-20 h-16 rounded-[4px] bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0">
                      <img
                        src="/logo-inntel.webp"
                        alt={emisor.razonSocial}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div>
                      <h1 className="text-base font-black text-slate-900 tracking-tight leading-tight">
                        {emisor.razonSocial || "INNTEL CORP S.A."}
                      </h1>
                      <p className="text-[11px] font-semibold text-[#004ac6]">
                        {emisor.nombreComercial || "INNTEL CORP - SOLUCIONES INTEGRALES"}
                      </p>
                      <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase block mt-0.5">
                        INNOVACIÓN EN TELECOMUNICACIONES
                      </span>
                    </div>
                  </div>

                  {/* Tarjeta de datos fiscales del Emisor (Estilo Contífico) */}
                  <div className="p-3 rounded-[4px] bg-slate-50 border border-slate-200 space-y-1 text-[11px] text-slate-700 leading-tight">
                    <p>
                      <span className="font-bold text-slate-900">Dirección Matriz:</span>{" "}
                      {emisor.direccionMatriz || "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito, Ecuador"}
                    </p>
                    {emisor.direccionEstablecimiento && emisor.direccionEstablecimiento !== emisor.direccionMatriz && (
                      <p>
                        <span className="font-bold text-slate-900">Dirección Sucursal:</span>{" "}
                        {emisor.direccionEstablecimiento}
                      </p>
                    )}
                    <p>
                      <span className="font-bold text-slate-900">Teléfono:</span>{" "}
                      {emisor.telefonoContacto || "+593 2 394 5000 / 0989613811"}
                    </p>
                    <p>
                      <span className="font-bold text-slate-900">Correo Electrónico:</span>{" "}
                      {emisor.emailNotificaciones || "facturacion@inntelcorp.com"}
                    </p>
                    <p>
                      <span className="font-bold text-slate-900">OBLIGADO A LLEVAR CONTABILIDAD:</span>{" "}
                      <span className="font-bold text-slate-900">
                        {emisor.obligadoContabilidad ? "SI" : "NO"}
                      </span>
                    </p>
                    {emisor.tipoContribuyente && (
                      <p>
                        <span className="font-bold text-slate-900">Contribuyente Régimen:</span>{" "}
                        <span className="font-semibold uppercase">
                          {emisor.tipoContribuyente.replace("_", " ")}
                        </span>
                      </p>
                    )}
                    {emisor.resolucionAgenteRetencion && (
                      <p>
                        <span className="font-bold text-slate-900">Agente de Retención Resolución No.:</span>{" "}
                        {emisor.resolucionAgenteRetencion}
                      </p>
                    )}
                  </div>
                </div>

                {/* Columna Derecha: Recuadro Oficial Contífico */}
                <div className="p-4 rounded-[6px] border-2 border-slate-900 space-y-2.5 bg-white text-slate-900">
                  <div className="border-b border-slate-200 pb-2">
                    <p className="text-xs font-black tracking-wider text-slate-900">
                      R.U.C.: {emisor.ruc || "1792458921001"}
                    </p>
                    <h3 className="text-base font-black text-[#004ac6] tracking-tight uppercase mt-0.5">
                      COTIZACIÓN / PROFORMA
                    </h3>
                    <p className="text-xs font-mono font-bold text-slate-900">
                      No. {quote.quoteNumber}
                    </p>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-700">
                    <p className="flex justify-between">
                      <span className="font-bold text-slate-900">FECHA DE EMISIÓN:</span>
                      <span className="font-semibold text-slate-900">{fechaEmision}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-bold text-slate-900">FECHA DE VIGENCIA:</span>
                      <span className="font-semibold text-slate-900">{fechaVigencia}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-bold text-slate-900">VALIDEZ DE LA OFERTA:</span>
                      <span className="font-bold text-slate-900">30 DÍAS CALENDARIO</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="font-bold text-slate-900">TIPO DE DOCUMENTO:</span>
                      <span className="font-medium text-slate-600">PROFORMA COMERCIAL</span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200 text-center">
                    <span className="text-[10px] text-slate-500 font-medium italic block">
                      Documento comercial sin validez tributaria ante el SRI
                    </span>
                  </div>
                </div>
              </div>

              {/* =========================================================
                  DATOS DEL CLIENTE / RECEPTOR (Estilo Contífico)
                  ========================================================= */}
              <div className="p-3.5 rounded-[4px] bg-slate-50 border border-slate-300 text-[11.5px] print-avoid-break">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 print:grid-cols-2">
                  <p>
                    <span className="font-bold text-slate-900">Razón Social / Cliente:</span>{" "}
                    <span className="font-bold text-slate-900">{quote.clientName}</span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-900">Identificación (RUC / C.I.):</span>{" "}
                    <span className="font-mono font-bold text-slate-900">
                      {quote.clientRuc || "N/A"}
                    </span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-900">Dirección:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {quote.clientAddress || "Ecuador"}
                    </span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-900">Teléfono:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {quote.clientPhone || "N/A"}
                    </span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-900">Correo Electrónico:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {quote.clientEmail || "N/A"}
                    </span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-900">Fecha Emisión:</span>{" "}
                    <span className="font-medium text-slate-800">{fechaEmision}</span>
                  </p>
                </div>
              </div>

              {/* =========================================================
                  TABLA DE ÍTEMS Y DETALLE DE LA COTIZACIÓN
                  ========================================================= */}
              <div className="rounded-[4px] border border-slate-300 overflow-hidden print-avoid-break">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold border-b border-slate-900">
                      <th className="py-2 px-2.5 text-center w-10">#</th>
                      <th className="py-2 px-3 w-28">Código</th>
                      <th className="py-2 px-2 text-center w-20">Cant.</th>
                      <th className="py-2 px-3">Descripción</th>
                      <th className="py-2 px-3 text-right w-24">Precio Unit.</th>
                      <th className="py-2 px-3 text-right w-20">Desc.</th>
                      <th className="py-2 px-3 text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                          No se han agregado artículos o servicios a la cotización.
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => {
                        const lineSubtotal =
                          it.subtotal !== undefined
                            ? safeFloat(it.subtotal)
                            : safeFloat(it.quantity) * safeFloat(it.unitPrice) - safeFloat(it.discount);
                        const skuCode = it.sku || it.productId || `COT-${idx + 1}`;

                        return (
                          <tr key={it.id || idx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-2.5 text-center font-medium text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-mono font-semibold text-slate-700">
                              {skuCode}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-slate-900">
                              {safeNumber(it.quantity)} {it.unit || "Unid."}
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-900 block leading-tight">
                                {it.name || it.description}
                              </span>
                              {it.description && it.description !== it.name && (
                                <span className="text-[10px] text-slate-500 block mt-0.5 leading-snug">
                                  {it.description}
                                </span>
                              )}
                              {it.serialNumbers && it.serialNumbers.length > 0 && (
                                <span className="text-[9.5px] font-mono text-[#004ac6] block mt-0.5">
                                  S/N: {it.serialNumbers.join(", ")}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-800">
                              ${safeNumber(it.unitPrice)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              ${safeNumber(it.discount)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              ${safeNumber(lineSubtotal)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* =========================================================
                  PIE DE PÁGINA: INFORMACIÓN ADICIONAL + TOTALES CONTÍFICO
                  ========================================================= */}
              <div className="grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-4 print-avoid-break">
                {/* Columna Izquierda: Información Adicional y Condiciones Contífico */}
                <div className="md:col-span-7 print:col-span-7 space-y-3">
                  <div className="p-3 rounded-[4px] bg-slate-50 border border-slate-300 space-y-2 text-[11px] text-slate-700">
                    <h4 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1 uppercase tracking-wider">
                      Información Adicional
                    </h4>
                    
                    <div className="space-y-1">
                      <p>
                        <span className="font-bold text-slate-900">Observaciones:</span>{" "}
                        <span className="text-slate-800">
                          {quote.notes ||
                            "Tarifas en dólares americanos (USD). Incluye acometida de fibra óptica, equipos homologados y soporte técnico 24/7."}
                        </span>
                      </p>

                      <p>
                        <span className="font-bold text-slate-900">Forma de Pago:</span>{" "}
                        <span className="font-medium text-slate-800">
                          Contado / Transferencia Bancaria
                        </span>
                      </p>

                      <p>
                        <span className="font-bold text-slate-900">Tiempo de Entrega / Instalación:</span>{" "}
                        <span className="font-medium text-slate-800">
                          24 a 48 horas tras aprobación comercial
                        </span>
                      </p>

                      <p>
                        <span className="font-bold text-slate-900">Asesor Comercial:</span>{" "}
                        <span className="font-semibold text-slate-900">VENTAS 01</span>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-0.5 text-[10px] text-slate-600">
                      <p className="font-bold text-slate-800 uppercase">
                        Datos Bancarios para Transferencias:
                      </p>
                      <p>
                        <strong>Banco:</strong> Banco Pichincha | <strong>Cta. Corriente:</strong> 2100234567
                      </p>
                      <p>
                        <strong>Titular:</strong> INNTEL CORP S.A. | <strong>RUC:</strong> 1792458921001
                      </p>
                      <p>
                        <strong>Confirmaciones:</strong> pagos@inntelcorp.com
                      </p>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Cuadro Oficial de Totales Estilo Contífico */}
                <div className="md:col-span-5 print:col-span-5">
                  <div className="rounded-[4px] border-2 border-slate-900 overflow-hidden divide-y divide-slate-200 text-[11px]">
                    <div className="flex justify-between px-3 py-1.5 bg-slate-50">
                      <span className="font-bold text-slate-700">SUBTOTAL 15%:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        ${safeNumber(subtotal15)}
                      </span>
                    </div>

                    {subtotal5 > 0 && (
                      <div className="flex justify-between px-3 py-1.5">
                        <span className="font-bold text-slate-700">SUBTOTAL 5%:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          ${safeNumber(subtotal5)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between px-3 py-1.5">
                      <span className="font-bold text-slate-700">SUBTOTAL 0%:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        ${safeNumber(subtotal0)}
                      </span>
                    </div>

                    <div className="flex justify-between px-3 py-1.5 bg-slate-50">
                      <span className="font-bold text-slate-700">SUBTOTAL NO OBJETO DE IVA:</span>
                      <span className="font-mono font-semibold text-slate-900">$0.00</span>
                    </div>

                    <div className="flex justify-between px-3 py-1.5">
                      <span className="font-bold text-slate-700">SUBTOTAL EXENTO DE IVA:</span>
                      <span className="font-mono font-semibold text-slate-900">$0.00</span>
                    </div>

                    <div className="flex justify-between px-3 py-1.5 bg-slate-50 font-bold">
                      <span className="text-slate-900">SUBTOTAL SIN IMPUESTOS:</span>
                      <span className="font-mono text-slate-900">
                        ${safeNumber(subtotalSinImpuestos)}
                      </span>
                    </div>

                    <div className="flex justify-between px-3 py-1.5">
                      <span className="font-bold text-slate-700">TOTAL DESCUENTO:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        ${safeNumber(descuento)}
                      </span>
                    </div>

                    <div className="flex justify-between px-3 py-1.5 bg-slate-50">
                      <span className="font-bold text-[#004ac6]">IVA 15%:</span>
                      <span className="font-mono font-bold text-[#004ac6]">
                        ${safeNumber(iva15)}
                      </span>
                    </div>

                    {iva5 > 0 && (
                      <div className="flex justify-between px-3 py-1.5 bg-slate-50">
                        <span className="font-bold text-[#004ac6]">IVA 5%:</span>
                        <span className="font-mono font-bold text-[#004ac6]">
                          ${safeNumber(iva5)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between px-3.5 py-2 bg-slate-900 text-white font-black text-xs">
                      <span>VALOR TOTAL:</span>
                      <span className="font-mono text-sm tracking-wide text-white">
                        ${safeNumber(total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* =========================================================
                  TOTAL EN LETRAS Y FIRMAS DE ACEPTACIÓN
                  ========================================================= */}
              <div className="space-y-4 pt-1 print-avoid-break">
                <div className="p-2.5 rounded-[4px] bg-slate-50 border border-slate-300 text-center">
                  <p className="font-mono font-bold text-[11px] text-slate-900 uppercase">
                    {totalEnLetras}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-12 pt-6">
                  <div className="text-center">
                    <div className="border-t border-slate-400 pt-1.5 max-w-[220px] mx-auto">
                      <p className="font-bold text-slate-900 text-[11px]">
                        Firma Autorizada
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {emisor.razonSocial || "INNTEL CORP S.A."}
                      </p>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="border-t border-slate-400 pt-1.5 max-w-[220px] mx-auto">
                      <p className="font-bold text-slate-900 text-[11px]">
                        Aceptado por Cliente
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Nombre, C.I. y Firma de Conformidad
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center pt-2 border-t border-slate-200">
                  <p className="text-[9.5px] text-slate-400">
                    Documento comercial emitido por {emisor.nombreComercial || "INNTEL CORP"} • www.inntelcorp.com • Quito - Ecuador
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
