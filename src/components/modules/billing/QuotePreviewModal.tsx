"use client";

import React, { useRef } from "react";
import {
  X,
  Printer,
  FileSpreadsheet,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { ClientQuote, SriCompanyConfig } from "@/types";
import { DEFAULT_INNTEL_SRI_CONFIG, numeroALetrasDolares } from "@/lib/sri-service";

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

  const emisor = companyConfig;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Barra superior de control */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Cotización Formal N° {quote.quoteNumber}
              </h3>
              <p className="text-[11px] text-slate-500">
                Formato oficial con normativas comerciales y regulatorias
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Convertir a Factura</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#004ac6] hover:bg-[#2563eb] text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Guardar PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Documento Imprimible (Formato Cotización PDF) */}
        <div className="p-8 overflow-y-auto space-y-6 text-xs bg-white text-slate-900 flex-1 print:p-0 print:m-0" ref={printAreaRef}>
          {/* Cabecera Principal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-black text-2xl tracking-tighter text-[#004ac6]">INNTEL</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
                  Telecomunicaciones & Servicios ISP
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-900">{emisor.razonSocial}</h4>
              <p className="text-[11px] text-slate-600 mt-1"><strong>RUC:</strong> {emisor.ruc}</p>
              <p className="text-[11px] text-slate-600"><strong>Matriz:</strong> {emisor.direccionMatriz}</p>
              <p className="text-[11px] text-slate-600"><strong>Contacto:</strong> {emisor.emailNotificaciones || "contacto@inntelcorp.com"}</p>
              <p className="text-[11px] text-slate-600"><strong>Obligado a llevar contabilidad:</strong> {emisor.obligadoContabilidad}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                  PROFORMA / COTIZACIÓN
                </span>
                <h3 className="text-lg font-black text-slate-900 font-mono">
                  {quote.quoteNumber}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-semibold">Fecha de Emisión:</span>
                  <span className="font-bold text-slate-800">{quote.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Fecha de Vencimiento:</span>
                  <span className="font-bold text-amber-700">{quote.validUntil}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Información del Cliente */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Destinatario / Cliente</span>
              <p className="font-bold text-sm text-slate-900">{quote.clientName}</p>
              <p className="text-[11px] text-slate-600 font-mono mt-0.5"><strong>RUC / C.I.:</strong> {quote.clientRuc}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Condiciones Comerciales</span>
              <p className="text-[11px] text-slate-700"><strong>Estado:</strong> {quote.status.toUpperCase()}</p>
              <p className="text-[11px] text-slate-700"><strong>Vigencia:</strong> 30 días calendario a partir de emisión</p>
            </div>
          </div>

          {/* Tabla de Artículos Cotizados */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-14 text-center">Cant.</th>
                  <th className="py-2.5 px-4">Descripción del Producto / Servicio</th>
                  <th className="py-2.5 px-3 text-right w-24">P. Unitario</th>
                  <th className="py-2.5 px-3 text-right w-24">Subtotal</th>
                  <th className="py-2.5 px-3 text-right w-24">IVA</th>
                  <th className="py-2.5 px-4 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quote.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">{it.quantity}</td>
                    <td className="py-2.5 px-4">
                      <span className="font-bold text-slate-900 block">{it.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">SKU: {it.sku || it.productId}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">${it.unitPrice.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">${it.subtotal.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-sky-600">${it.ivaAmount.toFixed(2)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">${it.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totales y Letras */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-7 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Importe en Letras:</span>
              <p className="text-xs font-bold text-slate-800 italic">
                {numeroALetrasDolares(quote.total)}
              </p>
              {quote.notes && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Notas Adicionales:</span>
                  <p className="text-[11px] text-slate-700">{quote.notes}</p>
                </div>
              )}
            </div>

            <div className="md:col-span-5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">Subtotal Tarifa 15%:</span>
                <span className="font-mono font-semibold">${quote.subtotal15.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">Subtotal Tarifa 0%:</span>
                <span className="font-mono font-semibold">${quote.subtotal0.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600">IVA 15%:</span>
                <span className="font-mono font-semibold text-sky-600">${quote.ivaTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-t border-slate-300 font-bold text-sm text-[#004ac6]">
                <span>TOTAL A PAGAR:</span>
                <span className="font-mono text-base">${quote.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* NORMATIVAS Y REGLAMENTOS DE LA EMPRESA (Requerimiento Web Fix) */}
          <div className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50/50 space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
              <ShieldCheck className="w-4 h-4 text-[#004ac6]" />
              <h5 className="font-bold text-xs uppercase tracking-wide text-slate-900">
                Normativas, Términos y Reglamentos de la Empresa
              </h5>
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600 leading-relaxed">
              <li>
                <strong>Validez de la Oferta:</strong> La presente proforma técnica y comercial mantiene sus precios y condiciones vigentes por un período de <strong>30 días calendario</strong> contados a partir de su emisión.
              </li>
              <li>
                <strong>Condiciones de Pago:</strong> Para confirmación y despacho de servicios o equipamiento se requiere el <strong>50% de anticipo</strong> y el 50% restante contra entrega e instalación conforme del acta técnica.
              </li>
              <li>
                <strong>Garantía Técnica:</strong> Todos los equipos suministrados (ONT, Enrutadores, Switches y Patchcords) cuentan con garantía de 12 meses por defectos de fabricación bajo condiciones operativas normales.
              </li>
              <li>
                <strong>Cumplimiento Regulatorio ARCOTEL:</strong> La prestación de servicios de telecomunicaciones y acceso a Internet se rige estrictamente bajo el marco de la <em>Ley Orgánica de Telecomunicaciones (LOT)</em> y las disposiciones de la Agencia de Regulación y Control de las Telecomunicaciones (ARCOTEL).
              </li>
              <li>
                <strong>Protección de Datos Personales:</strong> En conformidad con la <em>Ley Orgánica de Protección de Datos Personales (LOPDP)</em> del Ecuador, los datos consignados en esta cotización son confidenciales y serán tratados exclusivamente para fines comerciales y contractuales autorizados.
              </li>
            </ol>
          </div>

          {/* Firmas de Conformidad */}
          <div className="grid grid-cols-2 gap-12 pt-10 text-center text-xs">
            <div className="border-t border-slate-400 pt-2">
              <p className="font-bold text-slate-900">{emisor.razonSocial}</p>
              <p className="text-[10px] text-slate-500">Departamento Comercial / Emisor Autorizado</p>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <p className="font-bold text-slate-900">{quote.clientName}</p>
              <p className="text-[10px] text-slate-500">Aceptación y Firma del Cliente / RUC: {quote.clientRuc}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
