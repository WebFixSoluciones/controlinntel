"use client";

import JsBarcode from "jsbarcode";
import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
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
import { DebitNote } from "@/types/billing";
import {
  DEFAULT_INNTEL_SRI_CONFIG,
  numeroALetrasDolares,
  isFiscalAuthorized,
  fiscalStateLabel,
} from "@/lib/sri-service";
import { downloadAuthorizedFiscalXml, authorizedFiscalPdf } from "@/lib/api-client";
import { useToast } from "@/lib/toast-context";
import { printHtmlElement, safeNumber, safeFloat } from "@/lib/print-service";
import { Badge } from "@/components/ui/Badge";

interface RidePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: SriInvoice | null;
  creditNote?: CreditNote | null;
  debitNote?: DebitNote | null;
  withholding?: WithholdingReceipt | null;
  remissionGuide?: RemissionGuide | null;
  companyConfig?: SriCompanyConfig;
  sourceNumber?: string;
  guideNumber?: string;
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
  sourceNumber,
  guideNumber,
  initialFormat = "ride",
}: RidePreviewModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const pdfFrame = useRef<HTMLIFrameElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfRevision, setPdfRevision] = useState(0);
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
    if (barcodeRef.current && doc && /^\d{49}$/.test(doc.claveAcceso)) {
      JsBarcode(barcodeRef.current, doc.claveAcceso, { format: "CODE128", displayValue: false, width: 1.3, height: 38, margin: 12 });
    }
  }, [doc, isOpen, format]);

  useEffect(() => {
    if (!isOpen || format !== "ride") return;
    const name = printAreaRef.current?.querySelector<HTMLElement>("[data-issuer-name]");
    if (!name) return;
    const fit = () => {
      let size = 12;
      name.style.fontSize = `${size}px`;
      while (name.scrollWidth > name.clientWidth && size > 6) { size -= 0.25; name.style.fontSize = `${size}px`; }
    };
    const observer = new ResizeObserver(fit); observer.observe(name); fit();
    return () => observer.disconnect();
  }, [isOpen, format, doc, companyConfig]);

  const pdfKind = invoice ? "factura" : creditNote ? "nota_credito" : debitNote ? "nota_debito" : withholding ? "retencion" : "guia_remision";
  const usesAuthorizedPdf = !!doc && invoice?.documentType !== "nota_venta" && isFiscalAuthorized(doc) && format === "ride";
  useEffect(() => {
    setPdfUrl(null); setPdfError(""); setPdfReady(false);
    if (!isOpen || !usesAuthorizedPdf || !doc?.id) return;
    const controller = new AbortController(); let cancelled = false, url: string | undefined;
    authorizedFiscalPdf(pdfKind, doc.id, controller.signal).then(blob => {
      if (cancelled) return;
      url = URL.createObjectURL(blob); setPdfUrl(url);
    }).catch(error => { if (!cancelled) setPdfError(error.message || "No se pudo cargar el PDF autorizado."); });
    return () => { cancelled = true; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [isOpen, usesAuthorizedPdf, doc?.id, pdfKind, pdfRevision]);

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
    if (usesAuthorizedPdf) {
      if (!pdfUrl || !pdfReady) return;
      try { if (!pdfFrame.current?.contentWindow) throw new Error("Visor no disponible"); pdfFrame.current.contentWindow.focus(); pdfFrame.current.contentWindow.print(); }
      catch { window.open(pdfUrl, "_blank", "noopener,noreferrer"); }
      return;
    }
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
      <div className="relative flex max-h-[95dvh] w-full max-w-6xl flex-col bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto print:border-none print:shadow-none print:rounded-none">
        <header className="shrink-0 border-b border-slate-200 bg-white print:hidden">
          <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-slate-500">{isNotaVenta ? "Comprobante interno" : fiscalAuthorized ? "RIDE electrónico" : "Vista previa SRI"}</span><Badge className={`rounded px-2 py-0.5 font-semibold ${fiscalAuthorized ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{isNotaVenta ? doc.status : fiscalStateLabel(doc)}</Badge></div>
              <h2 className="mt-1 text-sm font-semibold text-slate-900">{docTypeLabel} <span className="font-mono">{docNumber}</span></h2>
            </div>
            <button type="button" aria-label="Cerrar vista previa" onClick={onClose} className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="size-5" /></button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-4 py-3 sm:px-6">
            {isInvoice ? <div role="group" aria-label="Formato de impresión" className="flex rounded-lg border bg-white p-1">
              <button type="button" aria-pressed={format === "ride"} onClick={() => setFormat("ride")} className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold ${format === "ride" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}><FileText className="size-4" />A4</button>
              <button type="button" aria-pressed={format === "ticket"} onClick={() => setFormat("ticket")} className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold ${format === "ticket" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}><Receipt className="size-4" />Ticket 80 mm</button>
            </div> : <span className="text-xs font-medium text-slate-500">Formato A4</span>}
            <div role="group" aria-label="Acciones del comprobante" className="flex flex-wrap items-center gap-2">
              {!isNotaVenta && claveAcceso && <button type="button" onClick={handleCopyClave} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">{copiedKey ? <Check className="size-4" /> : <Copy className="size-4" />}{copiedKey ? "Clave copiada" : "Copiar clave"}</button>}
              {!isNotaVenta && <button type="button" onClick={handleDownloadXml} disabled={!fiscalAuthorized} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><Download className="size-4" />{xmlDownloaded ? "Descargado" : "Descargar XML"}</button>}
              {usesAuthorizedPdf && <button type="button" disabled={!pdfUrl} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40" onClick={() => { if (!pdfUrl) return; const link = document.createElement("a"); link.href = pdfUrl; link.download = `RIDE-${pdfKind}-${docNumber}.pdf`; document.body.appendChild(link); link.click(); link.remove(); }}><Download className="size-4" />Descargar PDF</button>}
              <button type="button" onClick={handlePrint} disabled={!isNotaVenta && (!fiscalAuthorized || usesAuthorizedPdf && !pdfReady)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"><Printer className="size-4" />{format === "ticket" ? "Imprimir ticket" : isNotaVenta ? "Imprimir nota" : "Imprimir RIDE"}</button>
            </div>
          </div>
        </header>

        {/* Contenedor del documento imprimible */}
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-6 text-slate-900 bg-slate-100/70 print:max-h-none print:overflow-visible print:p-0 print:bg-white">
          {usesAuthorizedPdf ? (
            <div className="space-y-2" data-authorized-ride-pdf>
              {pdfError ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">{pdfError}<button type="button" className="ml-3 underline" onClick={() => setPdfRevision(value => value + 1)}>Reintentar</button></div> : !pdfUrl ? <p role="status" className="p-10 text-center text-sm text-slate-500">Cargando PDF RIDE autorizado…</p> : <>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-medium text-blue-700 underline">Abrir PDF en otra pestaña</a>
                <iframe ref={pdfFrame} title="PDF RIDE autorizado INNTEL" src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} onLoad={() => setPdfReady(true)} className="h-[72dvh] min-h-80 w-full rounded border bg-white" />
              </>}
            </div>
          ) : format === "ticket" && isInvoice && invoice ? (
            /* =====================================================
               VISTA TICKET TÉRMICO POS (80mm)
               ===================================================== */
            <div
              ref={printAreaRef}
              data-document-preview
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
              data-document-preview
              id="ride-print-area"
              className="w-[794px] max-w-none shrink-0 mx-auto bg-white p-6 rounded-lg shadow-xs border border-slate-200 space-y-4 text-[11.5px] leading-snug print:shadow-none print:border-none print:p-0 print:space-y-3"
            >
              <div data-ride-header className="grid grid-cols-2 gap-0 border border-slate-300 print-avoid-break">
                <div className="min-w-0 space-y-2 p-3">
                  <h1 data-issuer-name className="whitespace-nowrap text-xs font-semibold text-slate-900">{emisor.razonSocial}</h1>
                  <div className="flex items-start gap-3">
                    <img src={emisor.logoUrl || "/logo-inntel.webp"} alt="Logo INNTEL" className="h-14 w-16 shrink-0 object-contain" />
                    <div className="min-w-0 space-y-1 text-[10px]">
                      <p className="font-semibold text-blue-700">{emisor.nombreComercial}</p>
                      <p><strong>RUC:</strong> {emisor.ruc}</p>
                      <p><strong>Dirección matriz:</strong> {emisor.direccionMatriz}</p>
                      {emisor.direccionEstablecimiento && emisor.direccionEstablecimiento !== emisor.direccionMatriz && <p><strong>Sucursal:</strong> {emisor.direccionEstablecimiento}</p>}
                      <p><strong>Teléfono:</strong> {emisor.telefonoContacto || "N/D"}</p>
                      {!isNotaVenta && <><p><strong>Obligado a llevar contabilidad:</strong> {emisor.obligadoContabilidad ? "SI" : "NO"}</p><p><strong>Régimen:</strong> {(emisor.tipoContribuyente || "general").replaceAll("_", " ").toUpperCase()}</p></>}
                      {!isNotaVenta && emisor.resolucionAgenteRetencion && <p><strong>Agente de retención:</strong> {emisor.resolucionAgenteRetencion}</p>}
                      {!isNotaVenta && emisor.contribuyenteEspecial && <p><strong>Contribuyente especial:</strong> {emisor.contribuyenteEspecial}</p>}
                    </div>
                  </div>
                </div>
                <div className="min-w-0 space-y-2 border-l border-slate-300 p-3 text-[10px]">
                  {isNotaVenta ? <><p className="font-semibold">COMPROBANTE INTERNO · SIN VALIDEZ TRIBUTARIA</p><p>Estado: {doc.status === "anulada" ? "ANULADO" : "REGISTRADO"}</p></> : <>
                    <div className="flex flex-wrap justify-between gap-2"><p><strong>Ambiente:</strong> {docEnvironment === "2" ? "PRODUCCIÓN" : "PRUEBAS"}</p><p><strong>Emisión:</strong> NORMAL</p></div>
                    <div><p className="font-semibold">Clave de acceso:</p><p className="break-all font-mono text-[8px] select-all">{claveAcceso || "Pendiente"}</p></div>
                    <div><p className="font-semibold">N.º autorización:</p><p className="whitespace-nowrap font-mono text-[8px] select-all">{fiscalAuthorized ? doc.numeroAutorizacion : "Pendiente"}</p></div>
                    <p><strong>Fecha y hora de autorización:</strong> {fiscalAuthorized && doc.authorizationDate ? new Date(doc.authorizationDate).toLocaleString("es-EC", { timeZone: "America/Guayaquil" }) : "Pendiente"}</p>
                    {/^\d{49}$/.test(claveAcceso || "") && <div className="min-w-0 text-center"><svg ref={barcodeRef} className="mx-auto h-10 w-full" role="img" aria-label="Código de barras de la clave de acceso" /><p className="break-all font-mono text-[8px] select-all">{claveAcceso}</p></div>}
                    {!fiscalAuthorized && <p className="font-semibold text-amber-800">{fiscalStateLabel(doc)} · SIN VALIDEZ TRIBUTARIA</p>}
                    {docEnvironment === "1" && fiscalAuthorized && <p className="font-semibold text-amber-800">COMPROBANTE DE PRUEBAS · SIN VALIDEZ TRIBUTARIA</p>}
                  </>}
                  <p className="border-t border-slate-300 pt-2 font-semibold">{isInvoice && !isNotaVenta ? "FACTURA ELECTRÓNICA" : docTypeLabel} <span className="font-mono">{docNumber}</span></p>
                </div>
              </div>

              <div className="border border-slate-300 p-3 print-avoid-break">
                <div data-ride-buyer className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10px]">
                  <div className="min-w-0 space-y-1">
                    <p><strong>{isRemissionGuide ? "DESTINATARIO:" : isWithholding ? "SUJETO RETENIDO:" : "CLIENTE:"}</strong> {clienteNombre}</p>
                    <p><strong>DIRECCIÓN:</strong> {(doc as any).clientAddress || (remissionGuide && remissionGuide.destAddress) || "N/D"}</p>
                    <p><strong>CI O RUC:</strong> {clienteRuc}</p>
                    <p><strong>TELÉFONO:</strong> {(doc as any).clientPhone || "N/D"}</p>
                    <p className="break-words"><strong>EMAIL:</strong> {(doc as any).clientEmail || "N/D"}</p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p><strong>DOC. INTERNO:</strong> {sourceNumber || (invoice?.relatedSaleId ? "Nota de venta vinculada" : "Ninguno")}</p>
                    <p><strong>DOC. REFERENCIA:</strong> {creditNote?.invoiceNumber || debitNote?.modifiedInvoiceNumber || withholding?.invoiceNumber || invoice?.orderNumber || "Ninguno"}</p>
                    <p><strong>GUÍA DE REMISIÓN:</strong> {isRemissionGuide ? docNumber : guideNumber || "Sin guía"}</p>
                    <p><strong>FECHA EMISIÓN:</strong> {fechaEmision}</p>
                    {invoice?.creditDueDate && <p><strong>FECHA VENCIMIENTO:</strong> {invoice.creditDueDate}</p>}
                  </div>

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
