"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  Building2,
  FileCheck2,
  FileText,
  Receipt,
} from "lucide-react";
import {
  SriInvoice,
  CreditNote,
  WithholdingReceipt,
  RemissionGuide,
  SriCompanyConfig,
} from "@/types";
import {
  DEFAULT_INNTEL_SRI_CONFIG,
  numeroALetrasDolares,
  generarFacturaXml,
  generarNotaCreditoXml,
  generarComprobanteRetencionXml,
  generarGuiaRemisionXml,
  generarXmlFirmado,
  descargarXmlArchivo,
} from "@/lib/sri-service";

interface RidePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: SriInvoice | null;
  creditNote?: CreditNote | null;
  withholding?: WithholdingReceipt | null;
  remissionGuide?: RemissionGuide | null;
  companyConfig?: SriCompanyConfig;
  initialFormat?: "ride" | "ticket";
}

export function RidePreviewModal({
  isOpen,
  onClose,
  invoice,
  creditNote,
  withholding,
  remissionGuide,
  companyConfig = DEFAULT_INNTEL_SRI_CONFIG,
  initialFormat = "ride",
}: RidePreviewModalProps) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [xmlDownloaded, setXmlDownloaded] = useState(false);
  const [format, setFormat] = useState<"ride" | "ticket">(initialFormat);

  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat);
    }
  }, [isOpen, initialFormat]);

  if (!isOpen) return null;

  const doc = invoice || creditNote || withholding || remissionGuide;
  if (!doc) return null;

  const isInvoice = !!invoice;
  const isNotaVenta = isInvoice && invoice?.documentType === "nota_venta";
  const isCreditNote = !!creditNote;
  const isWithholding = !!withholding;
  const isRemissionGuide = !!remissionGuide;

  const docTypeLabel = isNotaVenta
    ? "NOTA DE VENTA"
    : isInvoice
    ? "FACTURA"
    : isCreditNote
    ? "NOTA DE CRÉDITO"
    : isWithholding
    ? "COMPROBANTE DE RETENCIÓN"
    : "GUÍA DE REMISIÓN";

  const docNumber = doc.documentNumber;
  const claveAcceso = doc.claveAcceso;
  const fechaEmision = doc.date;
  const emisor = companyConfig;

  // Adquiriente
  const clienteNombre = isRemissionGuide
    ? remissionGuide.destClientName
    : (doc as any).clientName || "CONSUMIDOR FINAL";
  const clienteRuc = isRemissionGuide
    ? remissionGuide.destClientRuc
    : (doc as any).clientRuc || "9999999999999";

  // Totales
  const subtotal15 = (invoice && invoice.subtotal15) || (creditNote && creditNote.subtotal15) || 0;
  const subtotal0 = (invoice && invoice.subtotal0) || (creditNote && creditNote.subtotal0) || 0;
  const subtotalNoObjeto = (invoice && invoice.subtotalNoObjeto) || 0;
  const subtotalExento = (invoice && invoice.subtotalExento) || 0;
  const subtotalSinImpuestos = subtotal15 + subtotal0 + subtotalNoObjeto + subtotalExento;
  const discountTotal = (invoice && invoice.discountTotal) || 0;
  const ivaTotal = (invoice && invoice.ivaTotal) || (creditNote && creditNote.ivaTotal) || 0;
  const total = isWithholding
    ? withholding.totalRetained
    : (invoice && invoice.total) || (creditNote && creditNote.total) || 0;

  const totalEnLetras = numeroALetrasDolares(total);

  // Desglose de formas de pago para RIDE y Ticket
  const paymentRows: Array<{ label: string; sriLabel: string; amount: number; termDays: number }> = [];
  if (invoice) {
    const bd = invoice.paymentsBreakdown;
    if (bd && (bd.efectivo > 0 || bd.transferencia > 0 || bd.tarjeta > 0 || bd.credito > 0)) {
      if (bd.efectivo > 0) {
        paymentRows.push({
          label: "Efectivo",
          sriLabel: "01 - SIN UTILIZACIÓN DEL SISTEMA FINANCIERO",
          amount: Math.min(invoice.total, bd.efectivo),
          termDays: 0,
        });
      }
      if (bd.transferencia > 0) {
        paymentRows.push({
          label: `Transferencia${invoice.transferenciaRef ? ` (${invoice.transferenciaRef})` : ""}`,
          sriLabel: "20 - OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO",
          amount: bd.transferencia,
          termDays: 0,
        });
      }
      if (bd.tarjeta > 0) {
        paymentRows.push({
          label: `Tarjeta${invoice.tarjetaRef ? ` (${invoice.tarjetaRef})` : ""}`,
          sriLabel: "19 - TARJETA DE CRÉDITO / DÉBITO",
          amount: bd.tarjeta,
          termDays: 0,
        });
      }
      if (bd.credito > 0) {
        paymentRows.push({
          label: "Crédito Directo",
          sriLabel: "20 - CRÉDITO DIRECTO CON UTILIZACIÓN DEL SISTEMA FINANCIERO",
          amount: bd.credito,
          termDays: invoice.paymentTermDays || 30,
        });
      }
    } else {
      paymentRows.push({
        label:
          invoice.paymentMethod === "efectivo"
            ? "Efectivo"
            : invoice.paymentMethod === "tarjeta"
            ? "Tarjeta"
            : invoice.paymentMethod === "credito"
            ? "Crédito Directo"
            : "Transferencia Bancaria",
        sriLabel:
          invoice.paymentMethod === "efectivo"
            ? "01 - SIN UTILIZACIÓN DEL SISTEMA FINANCIERO"
            : invoice.paymentMethod === "tarjeta"
            ? "19 - TARJETA DE CRÉDITO"
            : "20 - OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO",
        amount: invoice.total,
        termDays: invoice.paymentTermDays || 0,
      });
    }
  }

  const handleCopyClave = () => {
    if (!claveAcceso) return;
    navigator.clipboard.writeText(claveAcceso);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleDownloadXml = () => {
    try {
      let rawXml = "";
      let fileName = "";

      if (invoice && !isNotaVenta) {
        rawXml = generarFacturaXml(invoice, emisor);
        fileName = `SRI-FACTURA-${invoice.documentNumber}.xml`;
      } else if (creditNote) {
        rawXml = generarNotaCreditoXml(creditNote, emisor);
        fileName = `SRI-NC-${creditNote.documentNumber}.xml`;
      } else if (withholding) {
        rawXml = generarComprobanteRetencionXml(withholding, emisor);
        fileName = `SRI-RET-${withholding.documentNumber}.xml`;
      } else if (remissionGuide) {
        rawXml = generarGuiaRemisionXml(remissionGuide, emisor);
        fileName = `SRI-GUIA-${remissionGuide.documentNumber}.xml`;
      }

      if (!rawXml) return;
      const signedXml = generarXmlFirmado(rawXml, emisor);
      descargarXmlArchivo(signedXml, fileName);
      setXmlDownloaded(true);
      setTimeout(() => setXmlDownloaded(false), 2000);
    } catch (e) {
      console.error("Error al descargar XML SRI:", e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-5xl bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden my-auto print:border-none print:shadow-none print:rounded-none">
        {/* Barra superior de herramientas - No se imprime */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[6px] bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
              {isNotaVenta ? <Receipt className="w-5 h-5 text-emerald-400" /> : <FileCheck2 className="w-5 h-5 text-blue-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {isNotaVenta ? "COMPROBANTE DE VENTA INTERNO" : "RIDE OFICIAL SRI ECUADOR"}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] ${
                    doc.status === "autorizada" || doc.status === "registrado"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : doc.status === "anulada"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  {isNotaVenta && doc.status === "autorizada"
                    ? "REGISTRADO"
                    : doc.status.toUpperCase()}
                </span>
              </div>
              <h2 className="text-sm font-black text-white">
                {docTypeLabel}: {docNumber}
              </h2>
            </div>

            {/* Selector de Formato: RIDE A4 vs Ticket POS 80mm */}
            {isInvoice && (
              <div className="hidden sm:flex items-center bg-slate-800 p-1 rounded-[6px] border border-slate-700 ml-3">
                <button
                  type="button"
                  onClick={() => setFormat("ride")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-bold transition cursor-pointer ${
                    format === "ride"
                      ? "bg-[#004ac6] text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{isNotaVenta ? "Formato A4" : "RIDE Oficial (A4)"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("ticket")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-bold transition cursor-pointer ${
                    format === "ticket"
                      ? "bg-[#004ac6] text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Ticket POS (80mm)</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isNotaVenta && claveAcceso && (
              <button
                onClick={handleCopyClave}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
                title="Copiar Clave de Acceso"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedKey ? "Clave Copiada" : "Copiar Clave"}</span>
              </button>
            )}

            {!isNotaVenta && (
              <button
                onClick={handleDownloadXml}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
                title="Descargar XML Firmado XAdES-BES"
              >
                {xmlDownloaded ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-blue-400" />}
                <span>{xmlDownloaded ? "Descargado" : "Descargar XML"}</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[6px] bg-[#004ac6] hover:bg-[#003ca3] text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{format === "ticket" ? "Imprimir Ticket" : isNotaVenta ? "Imprimir Nota" : "Imprimir RIDE"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-[6px] text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenedor del documento imprimible */}
        <div className="p-6 sm:p-10 text-slate-900 bg-slate-100/70 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 print:bg-white">
          {format === "ticket" && isInvoice && invoice ? (
            /* =====================================================
               VISTA TICKET TÉRMICO POS (80mm)
               ===================================================== */
            <div className="w-[310px] mx-auto bg-white p-5 rounded-[6px] shadow-md border border-slate-200 font-mono text-[11px] leading-snug text-slate-900 print:shadow-none print:border-none print:w-full">
              <div className="text-center border-b border-dashed border-slate-400 pb-3 mb-3 space-y-0.5">
                <p className="text-sm font-black uppercase">{emisor.nombreComercial || emisor.razonSocial}</p>
                <p className="text-[10px] font-bold">{emisor.razonSocial}</p>
                <p className="text-[10px]">RUC: {emisor.ruc}</p>
                <p className="text-[9.5px] text-slate-600">{emisor.direccionMatriz}</p>
                {emisor.telefonoContacto && <p className="text-[9.5px]">Tel: {emisor.telefonoContacto}</p>}
                {!isNotaVenta && (
                  <p className="text-[9.5px]">
                    Ambiente: {emisor.ambiente === "2" ? "PRODUCCIÓN" : "PRUEBAS"} | Obligado Contab: {emisor.obligadoContabilidad ? "SI" : "NO"}
                  </p>
                )}
              </div>

              <div className="border-b border-dashed border-slate-400 pb-3 mb-3 space-y-0.5 text-[10px]">
                <p className="font-black text-xs text-center uppercase mb-1">
                  {isNotaVenta ? "NOTA DE VENTA (RECIBO)" : "FACTURA ELECTRÓNICA"}
                </p>
                <p>
                  <strong>Nro:</strong> {docNumber}
                </p>
                <p>
                  <strong>Fecha:</strong> {fechaEmision} {invoice.time || ""}
                </p>
                {!isNotaVenta && claveAcceso && (
                  <div className="mt-1 pt-1 border-t border-dotted border-slate-300">
                    <p className="font-bold text-[9px]">CLAVE DE ACCESO / AUTORIZACIÓN:</p>
                    <p className="text-[8.5px] break-all leading-tight">{claveAcceso}</p>
                  </div>
                )}
              </div>

              <div className="border-b border-dashed border-slate-400 pb-3 mb-3 space-y-0.5 text-[10px]">
                <p>
                  <strong>Cliente:</strong> {clienteNombre}
                </p>
                <p>
                  <strong>RUC/CI:</strong> {clienteRuc}
                </p>
                {invoice.clientAddress && (
                  <p>
                    <strong>Dir:</strong> {invoice.clientAddress}
                  </p>
                )}
              </div>

              <table className="w-full text-[10px] border-b border-dashed border-slate-400 pb-2 mb-3">
                <thead>
                  <tr className="border-b border-slate-400 text-left">
                    <th className="py-1">CANT</th>
                    <th className="py-1">DESCRIPCIÓN</th>
                    <th className="py-1 text-right">P.U.</th>
                    <th className="py-1 text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dotted divide-slate-200">
                  {invoice.items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="py-1 pr-1 align-top font-bold">{it.quantity}</td>
                      <td className="py-1 pr-1 align-top">{it.name}</td>
                      <td className="py-1 pr-1 align-top text-right">${it.unitPrice.toFixed(2)}</td>
                      <td className="py-1 align-top text-right font-bold">${it.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 text-[10.5px] border-b border-dashed border-slate-400 pb-3 mb-3">
                <div className="flex justify-between">
                  <span>SUBTOTAL 15%:</span>
                  <span>${subtotal15.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SUBTOTAL 0%:</span>
                  <span>${subtotal0.toFixed(2)}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between">
                    <span>DESCUENTO:</span>
                    <span>-${discountTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>IVA 15%:</span>
                  <span>${ivaTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-black pt-1 border-t border-slate-300">
                  <span>TOTAL A PAGAR:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1 text-[9.5px] border-b border-dashed border-slate-400 pb-3 mb-3">
                <p className="font-bold uppercase">Forma de Pago:</p>
                {paymentRows.map((row, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{row.label}</span>
                    <span className="font-bold">${row.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="text-center text-[9.5px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">¡GRACIAS POR SU COMPRA!</p>
                <p>
                  {isNotaVenta
                    ? "Comprobante de venta interno sin validez tributaria."
                    : "Descargue su comprobante electrónico en el portal del SRI."}
                </p>
              </div>
            </div>
          ) : (
            /* =====================================================
               VISTA FORMATO A4 (RIDE OFICIAL SRI / NOTA DE VENTA)
               ===================================================== */
            <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-[6px] shadow-xs border border-slate-200 space-y-6 text-[12px] leading-relaxed print:shadow-none print:border-none print:p-0">
              {/* Cabecera: 2 Columnas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                {/* Columna Izquierda: Datos del Emisor */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-[6px] bg-gradient-to-br from-[#004ac6] to-sky-600 flex items-center justify-center text-white shadow-md">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl font-black text-slate-900 tracking-tight">
                        {emisor.razonSocial}
                      </h1>
                      <p className="text-[11px] font-semibold text-[#004ac6]">
                        {emisor.nombreComercial}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-[6px] bg-slate-50 border border-slate-200/80 space-y-1.5 text-slate-700">
                    <p>
                      <span className="font-bold text-slate-900">Dirección Matriz:</span>{" "}
                      {emisor.direccionMatriz}
                    </p>
                    <p>
                      <span className="font-bold text-slate-900">Dirección Sucursal:</span>{" "}
                      {emisor.direccionEstablecimiento}
                    </p>
                    <p>
                      <span className="font-bold text-slate-900">Teléfono:</span>{" "}
                      {emisor.telefonoContacto || "+593 2 394 5000"}
                    </p>
                    <p>
                      <span className="font-bold text-slate-900">OBLIGADO A LLEVAR CONTABILIDAD:</span>{" "}
                      <span className="font-bold text-slate-900">{emisor.obligadoContabilidad ? "SI" : "NO"}</span>
                    </p>
                    {!isNotaVenta && (
                      <p>
                        <span className="font-bold text-slate-900">Contribuyente Régimen:</span>{" "}
                        <span className="font-semibold uppercase text-slate-800">
                          {emisor.tipoContribuyente.replace("_", " ")}
                        </span>
                      </p>
                    )}
                    {emisor.resolucionAgenteRetencion && !isNotaVenta && (
                      <p>
                        <span className="font-bold text-slate-900">Agente de Retención Resolución No.:</span>{" "}
                        {emisor.resolucionAgenteRetencion}
                      </p>
                    )}
                    {emisor.contribuyenteEspecial && !isNotaVenta && (
                      <p>
                        <span className="font-bold text-slate-900">Contribuyente Especial Resolución No.:</span>{" "}
                        {emisor.contribuyenteEspecial}
                      </p>
                    )}
                  </div>
                </div>

                {/* Columna Derecha: Recuadro Oficial SRI o Recibo Interno */}
                <div className="p-5 rounded-[6px] border-2 border-slate-900 space-y-3 bg-white">
                  <div className="border-b border-slate-200 pb-2">
                    <p className="text-sm font-black tracking-wider text-slate-900">
                      R.U.C.: {emisor.ruc}
                    </p>
                    <h3 className="text-lg font-black text-[#004ac6] tracking-tight">
                      {docTypeLabel}
                    </h3>
                    <p className="text-sm font-mono font-bold text-slate-900">
                      No. {docNumber}
                    </p>
                  </div>

                  {isNotaVenta ? (
                    <div className="space-y-2 text-[11.5px] text-slate-700 pt-1">
                      <p>
                        <span className="font-bold text-slate-900">TIPO DE DOCUMENTO:</span>{" "}
                        RECIBO INTERNO / NOTA DE VENTA
                      </p>
                      <p>
                        <span className="font-bold text-slate-900">ESTADO:</span>{" "}
                        <span className="font-bold text-emerald-700">
                          {doc.status === "anulada" ? "ANULADO" : "REGISTRADO"}
                        </span>
                      </p>
                      <p>
                        <span className="font-bold text-slate-900">FECHA DE REGISTRO:</span>{" "}
                        {fechaEmision} {invoice?.time || ""}
                      </p>
                      <p>
                        <span className="font-bold text-slate-900">VALIDEZ:</span>{" "}
                        CONTROL INTERNO / NO TRIBUTARIO
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1 text-[11px] text-slate-700">
                        <p>
                          <span className="font-bold text-slate-900">NÚMERO DE AUTORIZACIÓN:</span>
                          <br />
                          <span className="font-mono text-[10px] break-all text-slate-900 font-semibold select-all">
                            {claveAcceso}
                          </span>
                        </p>
                        <p>
                          <span className="font-bold text-slate-900">FECHA Y HORA DE AUTORIZACIÓN:</span>{" "}
                          {invoice && invoice.authorizationDate
                            ? new Date(invoice.authorizationDate).toLocaleString("es-EC")
                            : `${fechaEmision} ${invoice?.time || "10:35:00"}`}
                        </p>
                        <p>
                          <span className="font-bold text-slate-900">AMBIENTE:</span>{" "}
                          <span className="font-bold text-slate-900">{emisor.ambiente === "2" ? "PRODUCCIÓN" : "PRUEBAS"}</span>
                        </p>
                        <p>
                          <span className="font-bold text-slate-900">EMISIÓN:</span> NORMAL
                        </p>
                      </div>

                      {/* Código de barras visual Code 128 y clave de acceso */}
                      <div className="pt-2 border-t border-slate-200 space-y-1">
                        <span className="font-bold text-[10px] text-slate-700 uppercase tracking-wider block">
                          CLAVE DE ACCESO
                        </span>

                        <div className="w-full bg-white py-1 flex items-center justify-center overflow-hidden">
                          <svg
                            className="w-full h-9"
                            viewBox="0 0 320 40"
                            preserveAspectRatio="none"
                            fill="currentColor"
                          >
                            {Array.from({ length: 70 }).map((_, i) => {
                              const width = (i * 17) % 5 === 0 ? 3 : (i * 13) % 3 === 0 ? 2 : 1;
                              const x = i * 4.5;
                              return <rect key={i} x={x} y="0" width={width} height="40" fill="#0f172a" />;
                            })}
                          </svg>
                        </div>

                        <p className="text-center font-mono font-bold text-[11px] tracking-widest text-slate-900 break-all select-all">
                          {claveAcceso}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Recuadro de Información del Comprador / Sujeto Pasivo / Transportista */}
              <div className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[11.5px]">
                  <p>
                    <span className="font-bold text-slate-900">
                      {isRemissionGuide ? "Destinatario:" : isWithholding ? "Sujeto Pasivo Retenido:" : "Razón Social / Nombres y Apellidos:"}
                    </span>{" "}
                    <span className="font-semibold text-slate-900">{clienteNombre}</span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-900">Identificación (RUC / C.I.):</span>{" "}
                    <span className="font-mono font-bold text-slate-900">{clienteRuc}</span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-900">Fecha de Emisión:</span>{" "}
                    {fechaEmision}
                  </p>

                  {isInvoice && (
                    <>
                      <p>
                        <span className="font-bold text-slate-900">
                          {invoice.orderNumber ? "Nro. Pedido / Ref:" : "Guía de Remisión:"}
                        </span>{" "}
                        {invoice.orderNumber || (invoice.notes?.includes("Guía") ? invoice.notes : "S/N")}
                      </p>
                      {invoice.clientAddress && (
                        <p className="sm:col-span-2">
                          <span className="font-bold text-slate-900">Dirección:</span>{" "}
                          {invoice.clientAddress}
                        </p>
                      )}
                    </>
                  )}

                  {isCreditNote && creditNote && (
                    <div className="sm:col-span-2 p-2.5 rounded-[4px] bg-amber-50 border border-amber-200 mt-1">
                      <p className="font-bold text-amber-900">
                        Comprobante que se Modifica: Factura No. {creditNote.invoiceNumber}
                      </p>
                      <p className="text-amber-800 text-[11px]">
                        Fecha Factura Origen: {creditNote.invoiceDate} | Motivo: {creditNote.reason}
                      </p>
                    </div>
                  )}

                  {isWithholding && withholding && (
                    <div className="sm:col-span-2 p-2.5 rounded-[4px] bg-sky-50 border border-sky-200 mt-1">
                      <p className="font-bold text-sky-900">
                        Comprobante de Sustento: Factura No. {withholding.invoiceNumber}
                      </p>
                      <p className="text-sky-800 text-[11px]">
                        Período Fiscal: {withholding.fiscalPeriod}
                      </p>
                    </div>
                  )}

                  {isRemissionGuide && remissionGuide && (
                    <div className="sm:col-span-2 p-2.5 rounded-[4px] bg-indigo-50 border border-indigo-200 mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <p>
                        <strong className="text-indigo-950">Transportista:</strong> {remissionGuide.carrierName} (RUC: {remissionGuide.carrierRuc})
                      </p>
                      <p>
                        <strong className="text-indigo-950">Placa Vehículo:</strong> {remissionGuide.licensePlate}
                      </p>
                      <p>
                        <strong className="text-indigo-950">Ruta:</strong> {remissionGuide.route}
                      </p>
                      <p>
                        <strong className="text-indigo-950">Destino:</strong> {remissionGuide.destAddress}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabla de Ítems (Factura, Nota de Venta y Nota de Crédito) */}
              {(isInvoice || isCreditNote) && (
                <div className="rounded-[6px] border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[11px] font-bold">
                        <th className="py-2.5 px-3">Cod. Principal</th>
                        <th className="py-2.5 px-2 text-center">Cant.</th>
                        <th className="py-2.5 px-3">Descripción</th>
                        <th className="py-2.5 px-3 text-right">Precio Unitario</th>
                        <th className="py-2.5 px-3 text-right">Descuento</th>
                        <th className="py-2.5 px-3 text-right">Precio Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-[11.5px]">
                      {(invoice || creditNote)!.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                            {item.sku || "PROD-" + (idx + 1)}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-900">
                            {item.quantity.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900">{item.name}</div>
                            {item.description && (
                              <div className="text-[10px] text-slate-500">{item.description}</div>
                            )}
                            {item.serialNumbers && item.serialNumbers.length > 0 && (
                              <div className="text-[10px] text-[#004ac6] font-mono mt-0.5">
                                S/N: {item.serialNumbers.join(", ")}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            ${item.unitPrice.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            ${(item.discount || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            ${item.subtotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tabla para Comprobante de Retención */}
              {isWithholding && withholding && (
                <div className="rounded-[6px] border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11.5px]">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[11px] font-bold">
                        <th className="py-2.5 px-3">Comprobante Sustento</th>
                        <th className="py-2.5 px-3">Impuesto</th>
                        <th className="py-2.5 px-3">Código SRI</th>
                        <th className="py-2.5 px-3 text-right">Base Imponible</th>
                        <th className="py-2.5 px-3 text-right">% Retención</th>
                        <th className="py-2.5 px-3 text-right">Valor Retenido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {withholding.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                            Factura {withholding.invoiceNumber}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {it.taxType}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {it.code}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            ${it.taxBase.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {it.percentage}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            ${it.retainedAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tabla para Guía de Remisión */}
              {isRemissionGuide && remissionGuide && (
                <div className="rounded-[6px] border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11.5px]">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[11px] font-bold">
                        <th className="py-2.5 px-3">Cod. Ítem</th>
                        <th className="py-2.5 px-3 text-center">Cantidad</th>
                        <th className="py-2.5 px-3">Unidad</th>
                        <th className="py-2.5 px-3">Descripción de Mercadería Transportada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {remissionGuide.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {it.sku || `ART-${idx + 1}`}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                            {it.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {it.unit}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {it.name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sección Inferior: Info Adicional & Totales */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 print:grid-cols-12">
                {/* Columna Izquierda: Información Adicional y Pagos */}
                <div className="md:col-span-7 space-y-4">
                  <div className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1 uppercase tracking-wider">
                      Información Adicional
                    </h4>
                    <div className="space-y-1 text-[11px] text-slate-700">
                      {invoice && invoice.clientEmail && (
                        <p>
                          <span className="font-semibold text-slate-900">Email:</span>{" "}
                          {invoice.clientEmail}
                        </p>
                      )}
                      {invoice && invoice.clientPhone && (
                        <p>
                          <span className="font-semibold text-slate-900">Teléfono:</span>{" "}
                          {invoice.clientPhone}
                        </p>
                      )}
                      <p>
                        <span className="font-semibold text-slate-900">Bodega de Despacho:</span>{" "}
                        {(doc as any).warehouseName || "Bodega Central - Quito (NOC)"}
                      </p>
                      {invoice && invoice.notes && (
                        <p>
                          <span className="font-semibold text-slate-900">Observaciones:</span>{" "}
                          {invoice.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Formas de Pago */}
                  {invoice && (
                    <div className="p-4 rounded-[6px] border border-slate-200 space-y-2">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                        Formas de Pago
                      </h4>
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                            <th className="py-1 text-left">Forma de Pago</th>
                            <th className="py-1 text-right">Valor</th>
                            <th className="py-1 text-center">Plazo</th>
                            <th className="py-1 text-center">Tiempo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {paymentRows.map((row, idx) => (
                            <tr key={idx}>
                              <td className="py-1.5 text-slate-800">
                                {isNotaVenta ? row.label : row.sriLabel}
                              </td>
                              <td className="py-1.5 text-right font-mono font-bold text-slate-900">
                                ${row.amount.toFixed(2)}
                              </td>
                              <td className="py-1.5 text-center text-slate-600">
                                {row.termDays}
                              </td>
                              <td className="py-1.5 text-center text-slate-600">Días</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Columna Derecha: Cuadro Oficial de Totales */}
                <div className="md:col-span-5">
                  {(isInvoice || isCreditNote) ? (
                    <div className="rounded-[6px] border-2 border-slate-900 overflow-hidden divide-y divide-slate-200 text-[11px]">
                      <div className="flex justify-between px-3.5 py-1.5 bg-slate-50">
                        <span className="font-bold text-slate-700">SUBTOTAL 15%:</span>
                        <span className="font-mono font-semibold text-slate-900">${subtotal15.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between px-3.5 py-1.5">
                        <span className="font-bold text-slate-700">SUBTOTAL 0%:</span>
                        <span className="font-mono font-semibold text-slate-900">${subtotal0.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between px-3.5 py-1.5 bg-slate-50">
                        <span className="font-bold text-slate-700">SUBTOTAL NO OBJETO DE IVA:</span>
                        <span className="font-mono font-semibold text-slate-900">${subtotalNoObjeto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between px-3.5 py-1.5">
                        <span className="font-bold text-slate-700">SUBTOTAL EXENTO DE IVA:</span>
                        <span className="font-mono font-semibold text-slate-900">${subtotalExento.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between px-3.5 py-1.5 bg-slate-50 font-bold">
                        <span className="text-slate-900">SUBTOTAL SIN IMPUESTOS:</span>
                        <span className="font-mono text-slate-900">${subtotalSinImpuestos.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between px-3.5 py-1.5">
                        <span className="font-bold text-slate-700">TOTAL DESCUENTO:</span>
                        <span className="font-mono font-semibold text-slate-900">${discountTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between px-3.5 py-1.5 bg-slate-50">
                        <span className="font-bold text-[#004ac6]">IVA 15%:</span>
                        <span className="font-mono font-bold text-[#004ac6]">${ivaTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between px-3.5 py-1.5">
                        <span className="font-bold text-slate-700">PROPINA:</span>
                        <span className="font-mono font-semibold text-slate-900">$0.00</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5 bg-slate-900 text-white text-xs font-black">
                        <span>VALOR TOTAL:</span>
                        <span className="font-mono text-sm tracking-wide text-white">
                          ${total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : isWithholding ? (
                    <div className="rounded-[6px] border-2 border-slate-900 overflow-hidden divide-y divide-slate-200 text-[11px]">
                      <div className="flex justify-between px-3.5 py-2 bg-slate-50">
                        <span className="font-bold text-slate-700">TOTAL BASE IMPONIBLE:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          ${withholding!.items.reduce((s, it) => s + it.taxBase, 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5 bg-emerald-700 text-white text-xs font-black">
                        <span>TOTAL RETENIDO:</span>
                        <span className="font-mono text-sm tracking-wide text-white">
                          ${total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-[6px] border border-slate-200 text-center bg-slate-50 text-slate-600">
                      <p className="font-semibold text-xs">Mercadería Despachada para Transporte</p>
                      <p className="text-[11px] mt-1 font-mono">Conforme Guía Oficial No. {docNumber}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Leyenda en letras y pie de página */}
              <div className="p-3.5 rounded-[6px] bg-slate-100 border border-slate-200 text-center space-y-1">
                <p className="font-mono font-bold text-xs text-slate-900 uppercase">
                  {totalEnLetras}
                </p>
                <p className="text-[10px] text-slate-500">
                  {isNotaVenta
                    ? "Comprobante de venta interno emitido para registro y control administrativo local."
                    : "Documento tributario electrónico emitido bajo normativa oficial del Servicio de Rentas Internas (SRI) del Ecuador."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
