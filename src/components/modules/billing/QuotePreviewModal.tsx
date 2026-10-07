"use client";

import React, { useRef } from "react";
import Image from "next/image";
import {
  X,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import { ClientQuote, SriCompanyConfig } from "@/types";
import { DEFAULT_INNTEL_SRI_CONFIG } from "@/lib/sri-service";

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
    window.print();
  };

  // Cálculos precisos de subtotales por tasa impositiva
  const items = quote.items || [];
  const subtotal15 = items
    .filter((it) => (it.ivaRate === undefined || it.ivaRate === 15))
    .reduce((sum, it) => sum + (it.subtotal || it.quantity * it.unitPrice), 0);

  const subtotal5 = items
    .filter((it) => it.ivaRate === 5)
    .reduce((sum, it) => sum + (it.subtotal || it.quantity * it.unitPrice), 0);

  const subtotal0 = items
    .filter((it) => it.ivaRate === 0)
    .reduce((sum, it) => sum + (it.subtotal || it.quantity * it.unitPrice), 0);

  const iva15 = parseFloat((subtotal15 * 0.15).toFixed(2));
  const iva5 = parseFloat((subtotal5 * 0.05).toFixed(2));
  const descuento = quote.discountTotal || 0;
  const total = parseFloat((subtotal15 + subtotal5 + subtotal0 + iva15 + iva5 - descuento).toFixed(2));
  const saldo = total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-4xl bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[94vh]">
        {/* Barra superior de control */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[6px] bg-blue-50 text-[#004ac6] flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Cotización N° {quote.quoteNumber}
              </h3>
              <p className="text-[11px] text-slate-500">
                Formato Oficial INNTEL INNOVACIÓN EN TELECOMUNICACIONES
              </p>
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#004ac6] hover:bg-[#2563eb] text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-[6px] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Documento Imprimible (Formato Oficial INNTEL idéntico a imagen del usuario) */}
        <div
          className="p-8 overflow-y-auto space-y-6 text-xs bg-white text-slate-900 flex-1 print:p-0 print:m-0"
          ref={printAreaRef}
        >
          {/* Bloque Superior: Logo + Emisor (Izquierda) | Cotización + Cliente (Derecha) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Lado Izquierdo */}
            <div className="space-y-4">
              <div className="flex flex-col items-start gap-1">
                <Image
                  src="/logo-inntel.webp"
                  alt="INNTEL INNOVACION EN TELECOMUNICACIONES"
                  width={190}
                  height={65}
                  className="h-14 w-auto object-contain"
                  priority
                />
                <span className="text-[9px] font-black tracking-widest text-[#004ac6] uppercase mt-0.5">
                  INNOVACIÓN EN TELECOMUNICACIONES
                </span>
              </div>

              {/* Caja Gris Emisor */}
              <div className="p-4 bg-[#f1f5f9]/70 rounded-[6px] border border-slate-200 space-y-1 text-xs">
                <div>
                  <span className="text-slate-600 font-bold">Nombre comercial: </span>
                  <span className="font-semibold text-slate-900">
                    {companyConfig?.nombreComercial || "INNTEL CORP"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 font-bold">Razón Social: </span>
                  <span className="font-semibold text-slate-900">
                    {companyConfig?.razonSocial || "VALLE SAMPEDRO ALEXANDRA ANABEL"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 font-bold">RUC/CI: </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {companyConfig?.ruc || "1750599340001"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 font-bold">Dirección: </span>
                  <span className="font-semibold text-slate-900">
                    {companyConfig?.direccionMatriz || "Quito"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 font-bold">Correo: </span>
                  <span className="font-semibold text-slate-900">
                    {companyConfig?.emailNotificaciones || "financiero@inntelcorp.com"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 font-bold">Teléfono: </span>
                  <span className="font-semibold text-slate-900">
                    {companyConfig?.telefonoContacto || "0990262239"}
                  </span>
                </div>
              </div>
            </div>

            {/* Lado Derecho: Header Cotización y Datos del Cliente */}
            <div className="space-y-4">
              <div className="flex items-baseline justify-between border-b-2 border-slate-300 pb-2">
                <span className="text-base font-black tracking-wider text-slate-900 uppercase">
                  COTIZACION:
                </span>
                <span className="font-mono text-base font-black text-slate-900">
                  No. {quote.quoteNumber}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-600 font-bold block text-[11px]">Cliente:</span>
                  <span className="font-bold text-slate-900 text-sm block">
                    {quote.clientName}
                  </span>
                </div>

                <div>
                  <span className="text-slate-600 font-bold block text-[11px]">CI/RUC:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {quote.clientRuc || "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-600 font-bold block text-[11px]">Dirección:</span>
                  <span className="font-semibold text-slate-800">
                    {quote.clientAddress || "Ecuador"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-600 font-bold block text-[11px]">Teléfono:</span>
                  <span className="font-semibold text-slate-800">
                    {quote.clientPhone || "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-600 font-bold block text-[11px]">Fecha Emisión:</span>
                  <span className="font-semibold text-slate-900">
                    {quote.date ? quote.date.split("-").reverse().join("/") : new Date().toLocaleDateString("es-EC")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de Artículos Cotizados */}
          <div className="border border-slate-200 rounded-[6px] overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f1f5f9] text-slate-800 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12 border-r border-slate-200">#</th>
                  <th className="py-2.5 px-4 border-r border-slate-200">Item</th>
                  <th className="py-2.5 px-4 text-right w-28 border-r border-slate-200">Cantidad</th>
                  <th className="py-2.5 px-4 text-right w-28 border-r border-slate-200">Precio</th>
                  <th className="py-2.5 px-4 text-right w-32">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      No se han agregado artículos a la cotización.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const lineSubtotal = it.subtotal || it.quantity * it.unitPrice;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700 border-r border-slate-200">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-200">
                          <span className="font-bold text-slate-900 block">
                            {it.name || it.description}
                          </span>
                          {it.sku && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              SKU: {it.sku}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-800 border-r border-slate-200">
                          {it.quantity.toFixed(2)} {it.unit || "Unid."}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-800 border-r border-slate-200">
                          ${it.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          ${lineSubtotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bloque Inferior: Información Adicional (Izquierda) | Desglose Totales (Derecha) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start pt-2">
            {/* Izquierda: Información Adicional (Caja gris idéntica al formato) */}
            <div className="md:col-span-7 p-4 bg-[#f1f5f9]/80 rounded-[6px] border border-slate-200 space-y-2 text-xs">
              <h5 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1.5">
                Información Adicional
              </h5>
              <div className="grid grid-cols-1 gap-2 pt-1">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-slate-700 min-w-[90px]">Descripción:</span>
                  <span className="text-slate-800 font-medium leading-relaxed">
                    {quote.notes || "Servicio cotizado sujeto a confirmación técnica de factibilidad."}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 min-w-[90px]">Usuario:</span>
                  <span className="font-semibold text-slate-900">
                    VENTAS 01
                  </span>
                </div>
              </div>
            </div>

            {/* Derecha: Desglose completo de impuestos y totales */}
            <div className="md:col-span-5 bg-white rounded-[6px] border border-slate-200 overflow-hidden text-xs">
              <div className="divide-y divide-slate-100">
                <div className="flex justify-between px-3.5 py-2">
                  <span className="text-slate-600 font-medium">Descuento:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    ${descuento.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between px-3.5 py-2">
                  <span className="text-slate-600 font-medium">Subtotal 15%:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    ${subtotal15.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between px-3.5 py-2">
                  <span className="text-slate-600 font-medium">Subtotal 5%:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    ${subtotal5.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between px-3.5 py-2">
                  <span className="text-slate-600 font-medium">Subtotal 0%:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    ${subtotal0.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between px-3.5 py-2">
                  <span className="text-slate-600 font-medium">IVA 15%:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    ${iva15.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between px-3.5 py-2">
                  <span className="text-slate-600 font-medium">IVA 5%:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    ${iva5.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between px-3.5 py-2.5 bg-slate-50 font-bold border-t border-slate-300">
                  <span className="text-slate-900">Total:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    ${total.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between px-3.5 py-2.5 bg-slate-50 font-bold border-t border-slate-200">
                  <span className="text-[#004ac6]">Saldo:</span>
                  <span className="font-mono font-black text-[#004ac6] text-sm">
                    ${saldo.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
