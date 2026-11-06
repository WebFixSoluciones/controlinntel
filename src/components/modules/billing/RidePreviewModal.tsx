"use client";

import JsBarcode from "jsbarcode";
import React, { useState, useEffect, useRef } from "react";
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
  FileCode,
} from "lucide-react";
import {
  SriInvoice,
  CreditNote,
  WithholdingReceipt,
  RemissionGuide,
  SriCompanyConfig,
} from "@/types";
import { DebitNote } from "@/types/billing";
import {
  DEFAULT_INNTEL_SRI_CONFIG,
  numeroALetrasDolares,
  isFiscalAuthorized,
  fiscalStateLabel,
} from "@/lib/sri-service";
import { downloadAuthorizedFiscalXml } from "@/lib/api-client";
import { useToast } from "@/lib/toast-context";
import { printHtmlElement, safeNumber, safeFloat } from "@/lib/print-service";

interface RidePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: SriInvoice | null;
  creditNote?: CreditNote | null;
  debitNote?: DebitNote | null;
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
  debitNote,
  withholding,
  remissionGuide,
  companyConfig = DEFAULT_INNTEL_SRI_CONFIG,
  initialFormat = "ride",
}: RidePreviewModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const { showError } = useToast();
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [xmlDownloaded, setXmlDownloaded] = useState(false);
  const [format, setFormat] = useState<"ride" | "ticket">(initialFormat);

  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat);
    }
  }, [isOpen, initialFormat]);

  const doc = invoice || creditNote || debitNote || withholding || remissionGuide;
  useEffect(() => {
    if (barcodeRef.current && doc && isFiscalAuthorized(doc) && /^\d{49}$/.test(doc.claveAcceso)) {
      JsBarcode(barcodeRef.current, doc.claveAcceso, { format: "CODE128", displayValue: false, width: 1.3, height: 38, margin: 12 });
    }
  }, [doc, isOpen, format]);

  if (!isOpen) return null;

  if (!doc) return null;

  const isInvoice = !!invoice;
  const isNotaVenta = isInvoice && invoice?.documentType === "nota_venta";
  const isCreditNote = !!creditNote;
  const isDebitNote = !!debitNote;
  const isWithholding = !!withholding;
  const isRemissionGuide = !!remissionGuide;

  const docTypeLabel = isNotaVenta
    ? "NOTA DE VENTA"
    : isInvoice
    ? "FACTURA"
    : isCreditNote
    ? "NOTA DE CRÉDITO"
    : isDebitNote
    ? "NOTA DE DÉBITO"
    : isWithholding
    ? "COMPROBANTE DE RETENCIÓN"
    : "GUÍA DE REMISIÓN";

  const docNumber = doc.documentNumber;
  const claveAcceso = doc.claveAcceso;
  const fechaEmision = doc.date;
  const emisor = isNotaVenta ? companyConfig : { ...companyConfig, ...doc.fiscalIssuer };

  // Adquiriente
  const clienteNombre = isRemissionGuide
    ? remissionGuide.destClientName
    : (doc as any).clientName || "CONSUMIDOR FINAL";
  const clienteRuc = isRemissionGuide
    ? remissionGuide.destClientRuc
    : (doc as any).clientRuc || "9999999999999";

  const documentLines = invoice?.items || creditNote?.items || [];
  const taxesByRate = new Map<number, number>();
  for (const item of documentLines) {
    const rate = safeFloat(item.ivaRate);
    taxesByRate.set(rate, (taxesByRate.get(rate) || 0) + safeFloat(item.subtotal));
  }
  if (!documentLines.length && invoice) {
    taxesByRate.set(15, safeFloat(invoice.subtotal15));
    taxesByRate.set(0, safeFloat(invoice.subtotal0));
  }
  if (debitNote) taxesByRate.set(debitNote.ivaRate, safeFloat(debitNote.subtotal));
  const taxBases = [...taxesByRate].sort(([a], [b]) => b - a);
  const subtotalSinImpuestos = taxBases.reduce((sum, [, base]) => sum + base, 0);
  const discountTotal = invoice ? safeFloat(invoice.discountTotal)
    : documentLines.reduce((sum, item) => sum + safeFloat(item.discount), 0);
  const baseLabel = (rate: number) => rate === -2 ? "EXENTO DE IVA" : rate === -1 ? "NO OBJETO DE IVA" : `${rate}%`;
  const ivaTotal = safeFloat(
    (invoice && invoice.ivaTotal) ||
    (creditNote && creditNote.ivaTotal) ||
    (debitNote && debitNote.ivaAmount) ||
    0
  );
  const total = isWithholding
    ? safeFloat(withholding.totalRetained)
    : safeFloat(
        (invoice && invoice.total) ||
        (creditNote && creditNote.total) ||
        (debitNote && debitNote.total) ||
        0
      );

  const totalEnLetras = numeroALetrasDolares(total);

  // Desglose de formas de pago para RIDE y Ticket
  const paymentRows: Array<{ label: string; sriLabel: string; amount: number; termDays: number }> = [];
  if (invoice) {
    const bd = invoice.paymentsBreakdown;
    if (bd && (safeFloat(bd.efectivo) > 0 || safeFloat(bd.transferencia) > 0 || safeFloat(bd.tarjeta) > 0 || safeFloat(bd.credito) > 0)) {
      if (safeFloat(bd.efectivo) > 0) {
        paymentRows.push({
          label: "Efectivo",
          sriLabel: "01 - SIN UTILIZACIÓN DEL SISTEMA FINANCIERO",
          amount: Math.min(invoice.total, safeFloat(bd.efectivo)),
          termDays: 0,
        });
      }
      if (safeFloat(bd.transferencia) > 0) {
        paymentRows.push({
          label: `Transferencia${invoice.transferenciaRef ? ` (${invoice.transferenciaRef})` : ""}`,
          sriLabel: "20 - OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO",
          amount: safeFloat(bd.transferencia),
          termDays: 0,
        });
      }
      if (safeFloat(bd.tarjeta) > 0) {
        paymentRows.push({
          label: `Tarjeta${invoice.tarjetaRef ? ` (${invoice.tarjetaRef})` : ""}`,
          sriLabel: "19 - TARJETA DE CRÉDITO / DÉBITO",
          amount: safeFloat(bd.tarjeta),
          termDays: 0,
        });
      }
      if (safeFloat(bd.credito) > 0) {
        paymentRows.push({
          label: "Crédito Directo",
          sriLabel: "20 - CRÉDITO DIRECTO CON UTILIZACIÓN DEL SISTEMA FINANCIERO",
          amount: safeFloat(bd.credito),
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
        amount: safeFloat(invoice.total),
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

  const fiscalAuthorized = isFiscalAuthorized(doc);
  const docEnvironment = doc.ambiente || (claveAcceso?.[23] === "2" ? "2" : "1");
  const handleDownloadXml = async () => {
    if (!fiscalAuthorized) return;
    const kind = invoice ? "factura" : creditNote ? "nota_credito" : debitNote ? "nota_debito" : withholding ? "retencion" : "guia_remision";
    try {
      await downloadAuthorizedFiscalXml(kind, doc.id, docNumber);
      setXmlDownloaded(true);
      setTimeout(() => setXmlDownloaded(false), 2000);
    } catch (error) {
      showError("Descarga de XML", error instanceof Error ? error.message : "No se pudo descargar el comprobante.");
    }
  };

  const handlePrint = () => {
    if (printAreaRef.current) {
      printHtmlElement(
        printAreaRef.current,
        `${docTypeLabel}-${docNumber || "INNTEL"}`,
        format === "ticket" ? "ticket" : "a4"
      );
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto print:border-none print:shadow-none print:rounded-none">
        {/* Barra superior de herramientas - No se imprime */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#004ac6] text-white print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center text-white">
              {isNotaVenta ? <Receipt className="w-5 h-5 text-white" /> : <FileCheck2 className="w-5 h-5 text-white" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                  {isNotaVenta ? "COMPROBANTE DE VENTA INTERNO" : fiscalAuthorized ? "RIDE ELECTRÓNICO" : "VISTA PREVIA SRI"}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    fiscalAuthorized || (isNotaVenta && doc.status === "registrado")
                      ? "bg-emerald-500 text-white"
                      : doc.status === "anulada"
                      ? "bg-rose-500 text-white"
                      : "bg-amber-400 text-slate-900"
                  }`}
                >
                  {!isNotaVenta ? fiscalStateLabel(doc) : isNotaVenta && doc.status === "autorizada"
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
              <div className="hidden sm:flex items-center bg-black/20 p-1 rounded-lg border border-white/20 ml-3">
                <button
                  type="button"
                  onClick={() => setFormat("ride")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    format === "ride"
                      ? "bg-white text-[#004ac6] shadow-xs"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{isNotaVenta ? "Formato A4" : "RIDE Oficial (A4)"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("ticket")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    format === "ticket"
                      ? "bg-white text-[#004ac6] shadow-xs"
                      : "text-white/80 hover:text-white"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/20 transition cursor-pointer"
                title="Copiar Clave de Acceso"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5 text-white/80" />}
                <span>{copiedKey ? "Clave Copiada" : "Copiar Clave"}</span>
              </button>
            )}

            {!isNotaVenta && (
              <button
                onClick={handleDownloadXml}
                disabled={!fiscalAuthorized}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/20 transition cursor-pointer"
                title="Descargar XML Firmado XAdES-BES"
              >
                {xmlDownloaded ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Download className="w-3.5 h-3.5 text-white/80" />}
                <span>{xmlDownloaded ? "Descargado" : "Descargar XML"}</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              disabled={!isNotaVenta && !fiscalAuthorized}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{format === "ticket" ? "Imprimir Ticket" : isNotaVenta ? "Imprimir Nota" : "Imprimir RIDE"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition ml-1 cursor-pointer"
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
            <div
              ref={printAreaRef}
              id="ticket-print-area"
              className="w-[310px] mx-auto bg-white p-5 rounded-lg shadow-md border border-slate-200 font-mono text-[11px] leading-snug text-slate-900 print:shadow-none print:border-none print:w-full"
            >
              <div className="text-center border-b border-dashed border-slate-400 pb-3 mb-3 space-y-0.5">
                <div className="flex justify-center mb-1.5">
                  <img
                    src="/logo-inntel.webp"
                    alt="INNTEL CORP S.A."
                    className="h-12 w-auto object-contain"
                  />
                </div>
                <p className="text-sm font-black uppercase">{emisor.nombreComercial || emisor.razonSocial}</p>
                <p className="text-[10px] font-bold">{emisor.razonSocial}</p>
                <p className="text-[10px]">RUC: {emisor.ruc}</p>
                <p className="text-[9.5px] text-slate-600">{emisor.direccionMatriz}</p>
                {emisor.telefonoContacto && <p className="text-[9.5px]">Tel: {emisor.telefonoContacto}</p>}
                {!isNotaVenta && (
                  <p className="text-[9.5px]">
                    Ambiente: {docEnvironment === "2" ? "PRODUCCIÓN" : "PRUEBAS · SIN VALIDEZ TRIBUTARIA"} | Obligado Contab: {emisor.obligadoContabilidad ? "SI" : "NO"}
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
                      <td className="py-1 pr-1 align-top font-bold">{safeNumber(it.quantity)}</td>
                      <td className="py-1 pr-1 align-top">{it.name}</td>
                      <td className="py-1 pr-1 align-top text-right">${safeNumber(it.unitPrice)}</td>
                      <td className="py-1 align-top text-right font-bold">${safeNumber(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-1 text-[10.5px] border-b border-dashed border-slate-400 pb-3 mb-3">
                {taxBases.map(([rate, base]) => (
                  <div key={rate} className="flex justify-between">
                    <span>SUBTOTAL {baseLabel(rate)}:</span><span>${safeNumber(base)}</span>
                  </div>
                ))}
                {discountTotal > 0 && (
                  <div className="flex justify-between">
                    <span>DESCUENTO:</span>
                    <span>-${safeNumber(discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>IVA de las partidas:</span>
                  <span>${safeNumber(ivaTotal)}</span>
                </div>
                <div className="flex justify-between text-xs font-black pt-1 border-t border-slate-300">
                  <span>TOTAL A PAGAR:</span>
                  <span>${safeNumber(total)}</span>
                </div>
              </div>

              <div className="space-y-1 text-[9.5px] border-b border-dashed border-slate-400 pb-3 mb-3">
                <p className="font-bold uppercase">Forma de Pago:</p>
                {paymentRows.map((row, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{row.label}</span>
                    <span className="font-bold">${safeNumber(row.amount)}</span>
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
            <div
              ref={printAreaRef}
              id="ride-print-area"
              className="max-w-4xl mx-auto bg-white p-6 sm:p-7 rounded-lg shadow-xs border border-slate-200 space-y-4 text-[11.5px] leading-snug print:shadow-none print:border-none print:p-0 print:space-y-3"
            >
              {/* Cabecera: 2 Columnas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
                {/* Columna Izquierda: Logo Oficial + Datos del Emisor */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-20 h-16 rounded-lg bg-white border border-slate-200 p-1.5 flex items-center justify-center shadow-2xs shrink-0">
                      <img
                        src="/logo-inntel.webp"
                        alt="INNTEL CORP S.A."
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div>
                      <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                        {emisor.razonSocial}
                      </h1>
                      <p className="text-[11px] font-semibold text-[#004ac6]">
                        {emisor.nombreComercial}
                      </p>
                      <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase block mt-0.5">
                        INNOVACIÓN EN TELECOMUNICACIONES
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1 text-slate-700">
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
                <div className="p-4 rounded-lg border-2 border-slate-900 space-y-2.5 bg-white">
                  <div className="border-b border-slate-200 pb-2">
                    <p className="text-sm font-black tracking-wider text-slate-900">
                      R.U.C.: {emisor.ruc}
                    </p>
                    <h3 className="text-base font-black text-[#004ac6] tracking-tight">
                      {docTypeLabel}
                    </h3>
                    <p className="text-sm font-mono font-bold text-slate-900">
                      No. {docNumber}
                    </p>
                  </div>

                  {isNotaVenta ? (
                    <div className="space-y-1.5 text-[11px] text-slate-700 pt-1">
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
                      <div className="space-y-1 text-[10.5px] text-slate-700">
                        <p>
                          <span className="font-bold text-slate-900">NÚMERO DE AUTORIZACIÓN:</span>
                          <br />
                          <span className="font-mono text-[9.5px] break-all text-slate-900 font-semibold select-all">
                            {fiscalAuthorized ? doc.numeroAutorizacion : "Pendiente"}
                          </span>
                        </p>
                        <p>
                          <span className="font-bold text-slate-900">FECHA Y HORA DE AUTORIZACIÓN:</span>{" "}
                          {fiscalAuthorized && doc.authorizationDate ? new Date(doc.authorizationDate).toLocaleString("es-EC", { timeZone: "America/Guayaquil" }) : "Pendiente"}
                        </p>
                        <p>
                          <span className="font-bold text-slate-900">AMBIENTE:</span>{" "}
                          <span className="font-bold text-slate-900">{docEnvironment === "2" ? "PRODUCCIÓN" : "PRUEBAS"}</span>
                        </p>
                        <p>
                          <span className="font-bold text-slate-900">ESTADO:</span> {fiscalStateLabel(doc)}
                          {docEnvironment === "1" && <strong className="block text-amber-800">COMPROBANTE DE PRUEBAS</strong>}
                        </p>
                        {emisor.rucProveedorFacturacion && <p>RUC Proveedor: {emisor.rucProveedorFacturacion}</p>}
                      </div>

                      {/* Código de barras visual Code 128 y clave de acceso */}
                      <div className="pt-1.5 border-t border-slate-200 space-y-1">
                        <span className="font-bold text-[9.5px] text-slate-700 uppercase tracking-wider block">
                          CLAVE DE ACCESO
                        </span>

                        <div className="w-full bg-white py-0.5 flex items-center justify-center overflow-hidden">
                          {fiscalAuthorized && <svg ref={barcodeRef} className="h-auto max-w-full" role="img" aria-label="Código de barras de la clave de acceso" />}
                        </div>

                        <p className="text-center font-mono font-bold text-[10px] tracking-wider text-slate-900 break-all select-all">
                          {claveAcceso}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Recuadro de Información del Comprador / Sujeto Pasivo / Transportista */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 print-avoid-break">
                <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
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
                        <p className="sm:col-span-2 print:col-span-2">
                          <span className="font-bold text-slate-900">Dirección:</span>{" "}
                          {invoice.clientAddress}
                        </p>
                      )}
                    </>
                  )}

                  {isCreditNote && creditNote && (
                    <div className="sm:col-span-2 print:col-span-2 p-2 rounded-md bg-amber-50 border border-amber-200 mt-1">
                      <p className="font-bold text-amber-900">
                        Comprobante que se Modifica: Factura No. {creditNote.invoiceNumber}
                      </p>
                      <p className="text-amber-800 text-[10.5px]">
                        Fecha Factura Origen: {creditNote.invoiceDate} | Motivo: {creditNote.reason}
                      </p>
                    </div>
                  )}

                  {isDebitNote && debitNote && (
                    <div className="sm:col-span-2 print:col-span-2 p-2 rounded-md bg-indigo-50 border border-indigo-200 mt-1">
                      <p className="font-bold text-indigo-950">
                        Comprobante que se Modifica: Factura No. {debitNote.modifiedInvoiceNumber}
                      </p>
                      <p className="text-indigo-800 text-[10.5px]">
                        Fecha Factura Origen: {debitNote.modifiedInvoiceDate}
                      </p>
                    </div>
                  )}

                  {isWithholding && withholding && (
                    <div className="sm:col-span-2 print:col-span-2 p-2 rounded-md bg-sky-50 border border-sky-200 mt-1">
                      <p className="font-bold text-sky-900">
                        Comprobante de Sustento: Factura No. {withholding.invoiceNumber}
                      </p>
                      <p className="text-sky-800 text-[10.5px]">
                        Período Fiscal: {withholding.fiscalPeriod}{withholding.support && ` · Fecha de sustento ${withholding.support.date}`}
                      </p>
                    </div>
                  )}

                  {isRemissionGuide && remissionGuide && (
                    <div className="sm:col-span-2 print:col-span-2 p-2 rounded-md bg-indigo-50 border border-indigo-200 mt-1 grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-1.5 text-[10.5px]">
                      <p>
                        <strong className="text-indigo-950">Transportista:</strong> {remissionGuide.carrierName} (RUC: {remissionGuide.carrierRuc})
                      </p>
                      <p>
                        <strong className="text-indigo-950">Placa Vehículo:</strong> {remissionGuide.licensePlate}
                      </p>
                      <p><strong className="text-indigo-950">Origen:</strong> {remissionGuide.originAddress}</p>
                      <p><strong className="text-indigo-950">Traslado:</strong> {remissionGuide.startDate} a {remissionGuide.endDate}</p>
                      <p><strong className="text-indigo-950">Motivo:</strong> {remissionGuide.reason}</p>
                      {remissionGuide.invoiceNumber && <p><strong className="text-indigo-950">Factura de sustento:</strong> {remissionGuide.invoiceNumber} · {remissionGuide.invoiceDate}</p>}
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
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[11px] font-bold">
                        <th className="py-2.5 px-3">Cod. Principal</th>
                        <th className="py-2.5 px-2 text-center">Cant.</th>
                        <th className="py-2.5 px-3">Descripción</th>
                        <th className="py-2.5 px-3 text-right">Precio Unitario</th>
                        <th className="py-2.5 px-3 text-right">Descuento</th>
                        <th className="py-2.5 px-3 text-right">Subtotal sin IVA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-[11.5px]">
                      {(invoice || creditNote)!.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                            {item.sku || "PROD-" + (idx + 1)}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-900">
                            {safeNumber(item.quantity)}
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
                            ${safeNumber(item.unitPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            ${safeNumber(item.discount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            ${safeNumber(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tabla para Nota de Débito */}
              {isDebitNote && debitNote && (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[11px] font-bold">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Razón / Motivo de Modificación</th>
                        <th className="py-2.5 px-3 text-right">Valor Modificación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-[11.5px]">
                      {debitNote.reasons.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{r.reason}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            ${safeNumber(r.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tabla para Comprobante de Retención */}
              {isWithholding && withholding && (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
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
                            ${safeNumber(it.taxBase)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {safeNumber(it.percentage, 1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            ${safeNumber(it.retainedAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tabla para Guía de Remisión */}
              {isRemissionGuide && remissionGuide && (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
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
              <div className="grid grid-cols-1 md:grid-cols-12 print:grid-cols-12 gap-4 print-avoid-break">
                {/* Columna Izquierda: Información Adicional y Pagos */}
                <div className="md:col-span-7 print:col-span-7 space-y-3">
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
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
                      {Boolean((doc as any).warehouseName) && (
                        <p>
                          <span className="font-semibold text-slate-900">Bodega de Despacho:</span>{" "}
                          {(doc as any).warehouseName}
                        </p>
                      )}
                      {invoice && invoice.notes && (
                        <p>
                          <span className="font-semibold text-slate-900">Observaciones:</span>{" "}
                          {invoice.notes}
                        </p>
                      )}
                      {isCreditNote && creditNote && (
                        <>
                          <p>
                            <span className="font-semibold text-slate-900">Comprobante Modificado:</span>{" "}
                            Factura {creditNote.invoiceNumber} ({creditNote.invoiceDate})
                          </p>
                          <p>
                            <span className="font-semibold text-slate-900">Motivo de Emisión:</span>{" "}
                            {creditNote.reason}
                          </p>
                        </>
                      )}
                      {isDebitNote && debitNote && (
                        <p>
                          <span className="font-semibold text-slate-900">Comprobante Modificado:</span>{" "}
                          Factura {debitNote.modifiedInvoiceNumber} ({debitNote.modifiedInvoiceDate})
                        </p>
                      )}
                      {isWithholding && withholding && (
                        <>
                          <p>
                            <span className="font-semibold text-slate-900">Comprobante Sustento:</span>{" "}
                            Factura {withholding.invoiceNumber}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-900">Ejercicio Fiscal:</span>{" "}
                            {withholding.fiscalPeriod}
                          </p>
                        </>
                      )}
                      {isRemissionGuide && remissionGuide && (
                        <>
                          <p>
                            <span className="font-semibold text-slate-900">Motivo de Traslado:</span>{" "}
                            {(remissionGuide as any).transferReason || "Despacho de Equipos / Instalación"}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-900">Vigencia de Transporte:</span>{" "}
                            {remissionGuide.startDate} al {remissionGuide.endDate}
                          </p>
                        </>
                      )}
                      {!invoice?.clientEmail &&
                        !invoice?.clientPhone &&
                        !invoice?.notes &&
                        !isCreditNote &&
                        !isDebitNote &&
                        !isWithholding &&
                        !isRemissionGuide && (
                          <p>
                            <span className="font-semibold text-slate-900">Emisor:</span>{" "}
                            {emisor.emailNotificaciones || "facturacion@inntelcorp.com"}
                          </p>
                        )}
                    </div>
                  </div>

                  {/* Formas de Pago */}
                  {invoice && (
                    <div className="p-3.5 rounded-lg border border-slate-200 space-y-1.5">
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
                              <td className="py-1 text-slate-800">
                                {isNotaVenta ? row.label : row.sriLabel}
                              </td>
                              <td className="py-1 text-right font-mono font-bold text-slate-900">
                                ${safeNumber(row.amount)}
                              </td>
                              <td className="py-1 text-center text-slate-600">
                                {row.termDays}
                              </td>
                              <td className="py-1 text-center text-slate-600">Días</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Columna Derecha: Cuadro Oficial de Totales */}
                <div className="md:col-span-5 print:col-span-5">
                  {(isInvoice || isCreditNote || isDebitNote) ? (
                    <div className="rounded-lg border-2 border-slate-900 overflow-hidden divide-y divide-slate-200 text-[11px]">
                      {taxBases.map(([rate, base]) => (
                        <div key={rate} className="flex justify-between px-3.5 py-1.5 even:bg-slate-50">
                          <span className="font-bold text-slate-700">SUBTOTAL {baseLabel(rate)}:</span>
                          <span className="font-mono font-semibold text-slate-900">${safeNumber(base)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between px-3.5 py-1.5 bg-slate-50 font-bold">
                        <span className="text-slate-900">SUBTOTAL SIN IMPUESTOS:</span>
                        <span className="font-mono text-slate-900">${safeNumber(subtotalSinImpuestos)}</span>
                      </div>
                      <div className="flex justify-between px-3.5 py-1.5">
                        <span className="font-bold text-slate-700">TOTAL DESCUENTO:</span>
                        <span className="font-mono font-semibold text-slate-900">${safeNumber(discountTotal)}</span>
                      </div>
                      <div className="flex justify-between px-3.5 py-1.5 bg-slate-50">
                        <span className="font-bold text-[#004ac6]">IVA de las partidas:</span>
                        <span className="font-mono font-bold text-[#004ac6]">${safeNumber(ivaTotal)}</span>
                      </div>
                      <div className="flex justify-between px-3.5 py-1.5">
                        <span className="font-bold text-slate-700">PROPINA:</span>
                        <span className="font-mono font-semibold text-slate-900">$0.00</span>
                      </div>
                      <div className="flex justify-between px-4 py-2 bg-slate-900 text-white text-xs font-black">
                        <span>VALOR TOTAL:</span>
                        <span className="font-mono text-sm tracking-wide text-white">
                          ${safeNumber(total)}
                        </span>
                      </div>
                    </div>
                  ) : isWithholding ? (
                    <div className="rounded-lg border-2 border-slate-900 overflow-hidden divide-y divide-slate-200 text-[11px]">
                      <div className="flex justify-between px-3.5 py-2 bg-slate-50">
                        <span className="font-bold text-slate-700">TOTAL BASE IMPONIBLE:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          ${safeNumber(withholding!.items.reduce((s, it) => s + safeFloat(it.taxBase), 0))}
                        </span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5 bg-emerald-700 text-white text-xs font-black">
                        <span>TOTAL RETENIDO:</span>
                        <span className="font-mono text-sm tracking-wide text-white">
                          ${safeNumber(total)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg border border-slate-200 text-center bg-slate-50 text-slate-600">
                      <p className="font-semibold text-xs">Mercadería Despachada para Transporte</p>
                      <p className="text-[11px] mt-1 font-mono">Conforme Guía Oficial No. {docNumber}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Leyenda en letras o Firmas de Transporte y pie de página */}
              {isRemissionGuide ? (
                <div className="pt-6 print-avoid-break space-y-3">
                  <div className="grid grid-cols-3 gap-6 text-center text-[10.5px]">
                    <div className="border-t border-slate-400 pt-1.5">
                      <p className="font-bold text-slate-900">Entregado por (Emisor)</p>
                      <p className="text-slate-500">{emisor.razonSocial}</p>
                    </div>
                    <div className="border-t border-slate-400 pt-1.5">
                      <p className="font-bold text-slate-900">Transportista Autorizado</p>
                      <p className="text-slate-500">{remissionGuide?.carrierName}</p>
                    </div>
                    <div className="border-t border-slate-400 pt-1.5">
                      <p className="font-bold text-slate-900">Recibí Conforme (Destinatario)</p>
                      <p className="text-slate-500">{clienteNombre}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 text-center">
                    Documento tributario electrónico emitido bajo normativa oficial del Servicio de Rentas Internas (SRI) del Ecuador.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-center space-y-0.5 print-avoid-break">
                  <p className="font-mono font-bold text-[11px] text-slate-900 uppercase">
                    {totalEnLetras}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {isNotaVenta
                      ? "Comprobante de venta interno emitido para registro y control administrativo local."
                      : "Documento tributario electrónico emitido bajo normativa oficial del Servicio de Rentas Internas (SRI) del Ecuador."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
