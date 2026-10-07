"use client";

import React, { useState } from "react";
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  Building2,
  FileCheck2,
  FileText,
  ShieldCheck,
  AlertCircle,
  Truck,
  RotateCcw,
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
}

export function RidePreviewModal({
  isOpen,
  onClose,
  invoice,
  creditNote,
  withholding,
  remissionGuide,
  companyConfig = DEFAULT_INNTEL_SRI_CONFIG,
}: RidePreviewModalProps) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [xmlDownloaded, setXmlDownloaded] = useState(false);

  if (!isOpen) return null;

  const doc = invoice || creditNote || withholding || remissionGuide;
  if (!doc) return null;

  const isInvoice = !!invoice;
  const isCreditNote = !!creditNote;
  const isWithholding = !!withholding;
  const isRemissionGuide = !!remissionGuide;

  const docTypeLabel = isInvoice
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
    : (doc as any).clientName || "";
  const clienteRuc = isRemissionGuide
    ? remissionGuide.destClientRuc
    : (doc as any).clientRuc || "";

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

  const handleCopyClave = () => {
    navigator.clipboard.writeText(claveAcceso);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleDownloadXml = () => {
    try {
      let rawXml = "";
      let fileName = "";

      if (invoice) {
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[6px] bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <FileCheck2 className="w-5 h-5 text-[#004ac6]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  RIDE OFICIAL SRI ECUADOR
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] ${
                    doc.status === "autorizada"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  {doc.status.toUpperCase()}
                </span>
              </div>
              <h2 className="text-base font-black text-white">
                {docTypeLabel}: {docNumber}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClave}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
              title="Copiar Clave de Acceso"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedKey ? "Clave Copiada" : "Copiar Clave"}</span>
            </button>

            <button
              onClick={handleDownloadXml}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
              title="Descargar XML Firmado XAdES-BES"
            >
              {xmlDownloaded ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-blue-400" />}
              <span>{xmlDownloaded ? "Descargado" : "Descargar XML"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[6px] bg-[#004ac6] hover:bg-[#003ca3] text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir RIDE</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-[6px] text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenedor del documento RIDE imprimible */}
        <div className="p-6 sm:p-10 text-slate-900 bg-white max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0">
          <div className="max-w-4xl mx-auto space-y-6 text-[12px] leading-relaxed">
            {/* Cabecera SRI: 2 Columnas */}
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
                  <p>
                    <span className="font-bold text-slate-900">Contribuyente Régimen:</span>{" "}
                    <span className="font-semibold uppercase text-slate-800">
                      {emisor.tipoContribuyente.replace("_", " ")}
                    </span>
                  </p>
                  {emisor.resolucionAgenteRetencion && (
                    <p>
                      <span className="font-bold text-slate-900">Agente de Retención Resolución No.:</span>{" "}
                      {emisor.resolucionAgenteRetencion}
                    </p>
                  )}
                  {emisor.contribuyenteEspecial && (
                    <p>
                      <span className="font-bold text-slate-900">Contribuyente Especial Resolución No.:</span>{" "}
                      {emisor.contribuyenteEspecial}
                    </p>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Recuadro Oficial SRI con Clave de Acceso */}
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
                      : `${fechaEmision} 10:35:00`}
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

                  {/* SVG Barcode realista */}
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
                      <span className="font-bold text-slate-900">Guía de Remisión:</span>{" "}
                      {invoice.notes?.includes("Guía") ? invoice.notes : "S/N"}
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

            {/* Tabla de Ítems (Factura y Nota de Crédito) */}
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

                {/* Formas de Pago Oficiales SRI (Sólo Factura) */}
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
                        <tr>
                          <td className="py-1.5 text-slate-800">
                            {invoice.paymentMethod === "efectivo"
                              ? "01 - SIN UTILIZACIÓN DEL SISTEMA FINANCIERO"
                              : invoice.paymentMethod === "tarjeta"
                              ? "19 - TARJETA DE CRÉDITO"
                              : "20 - OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO"}
                          </td>
                          <td className="py-1.5 text-right font-mono font-bold text-slate-900">
                            ${invoice.total.toFixed(2)}
                          </td>
                          <td className="py-1.5 text-center text-slate-600">
                            {invoice.paymentTermDays || 0}
                          </td>
                          <td className="py-1.5 text-center text-slate-600">Días</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Columna Derecha: Cuadro Oficial de Totales SRI */}
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

            {/* Leyenda en letras y pie de página legal */}
            <div className="p-3.5 rounded-[6px] bg-slate-100 border border-slate-200 text-center space-y-1">
              <p className="font-mono font-bold text-xs text-slate-900 uppercase">
                {totalEnLetras}
              </p>
              <p className="text-[10px] text-slate-500">
                Documento tributario electrónico emitido bajo normativa oficial del Servicio de Rentas Internas (SRI) del Ecuador.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
