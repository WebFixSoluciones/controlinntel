"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Send,
  User,
  Mail,
  MapPin,
} from "lucide-react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { SriInvoice } from "@/types";
import { formatearSecuencialSRI } from "@/lib/sri-service";

interface ConvertToSriInvoiceModalProps {
  isOpen: boolean;
  sale: SriInvoice | null;
  onClose: () => void;
  onSuccess?: (invoice: SriInvoice) => void;
}

export function ConvertToSriInvoiceModal({
  isOpen,
  sale,
  onClose,
  onSuccess,
}: ConvertToSriInvoiceModalProps) {
  const { sriCompanyConfig, convertSaleToSriInvoice, billingInvoices, clients } = useApp();
  const { showSuccess } = useToast();

  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientRuc, setClientRuc] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen && sale) {
      setErrorMsg("");
      setSelectedClientId(sale.clientId && sale.clientId !== "cf-9999999999999" ? sale.clientId : "");
      setClientName(sale.clientName || "");
      setClientRuc(sale.clientRuc || "");
      setClientEmail(
        sale.clientEmail || sriCompanyConfig?.emailNotificaciones || "facturacion@inntelcorp.com"
      );
      setClientAddress(sale.clientAddress || "Quito, Ecuador");
    }
  }, [isOpen, sale, sriCompanyConfig]);

  if (!isOpen || !sale) return null;

  const estab = sriCompanyConfig.establecimiento || "010";
  const pto = sriCompanyConfig.puntoEmision || "001";
  const startFromFactura = (sriCompanyConfig.secuencialFactura || 1) - 1;
  const maxSec = billingInvoices
    .filter((inv) => (inv.documentType || "factura") === "factura" && inv.status !== "borrador")
    .reduce((max, inv) => {
      const parts = (inv.documentNumber || "").split("-");
      const num = parseInt(parts[2] || "0", 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
  const nextSecuencial = Math.max(maxSec, startFromFactura) + 1;
  const estimatedDocNumber = formatearSecuencialSRI(nextSecuencial, estab, pto);

  const handleSelectRegisteredClient = (cid: string) => {
    setSelectedClientId(cid);
    if (!cid) return;
    const found = clients.find((c) => c.id === cid);
    if (found) {
      setClientName(found.businessName || found.legalRepresentative || "");
      setClientRuc(found.identificationNumber || "");
      setClientEmail(found.email || "facturacion@inntelcorp.com");
      setClientAddress(found.address || "Quito, Ecuador");
    }
  };

  // Validation rules for SRI
  const cleanRuc = clientRuc.replace(/\s+/g, "").trim();
  const isConsumidorFinal = cleanRuc === "9999999999999";
  const isAboveFifty = (sale.total || 0) > 50;

  const handleConvert = async () => {
    setErrorMsg("");

    if (!clientName.trim() || !cleanRuc) {
      setErrorMsg("Debe ingresar la Razón Social y el RUC/Cédula del receptor de la factura.");
      return;
    }

    if (isConsumidorFinal && isAboveFifty) {
      setErrorMsg(
        "Por normativa legal del SRI, las facturas mayores a $50.00 no pueden emitirse a Consumidor Final. Ingrese el RUC o Cédula del cliente en los campos inferiores."
      );
      return;
    }

    if (!clientEmail || !clientEmail.includes("@")) {
      setErrorMsg(
        "El cliente debe tener un correo electrónico válido para recibir el comprobante electrónico SRI."
      );
      return;
    }

    const tipoIdentificacion =
      cleanRuc === "9999999999999" ? "07" : cleanRuc.length === 13 ? "04" : "05";

    setIsSubmitting(true);
    try {
      const newInvoice = await convertSaleToSriInvoice(sale.id, {
        clientId: selectedClientId || sale.clientId,
        clientName: clientName.trim(),
        clientRuc: cleanRuc,
        clientEmail: clientEmail.trim().toLowerCase(),
        clientAddress: clientAddress.trim() || "Ecuador",
        tipoIdentificacion,
      });
      showSuccess(
        "Factura Electrónica Emitida",
        `La venta ${sale.documentNumber} fue promovida exitosamente a Factura SRI ${newInvoice.documentNumber}.`
      );
      if (onSuccess) onSuccess(newInvoice);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Ocurrió un error al emitir la factura electrónica.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#004ac6] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-white">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Pasar a Factura Electrónica SRI</h2>
              <p className="text-xs text-blue-100">
                Promover Nota de Venta Comercial: {sale.documentNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-600 overflow-y-auto max-h-[72vh]">
          {/* Informative Note */}
          <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200/80 space-y-1 text-slate-700">
            <div className="flex items-center gap-1.5 font-bold text-[#004ac6]">
              <CheckCircle2 className="w-4 h-4" />
              <span>Cero Duplicidad de Inventario y Finanzas</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              El inventario y el cobro ya fueron registrados al emitir la Nota de Venta. Esta acción generará el <strong>Comprobante Electrónico Tipo 01</strong> para el SRI con su clave de acceso oficial sin alterar nuevamente los saldos de bodega ni bancos.
            </p>
          </div>

          {/* Client Fiscal Data (Editable) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#004ac6]" />
                Datos Fiscales del Receptor (SRI)
              </span>
              <select
                value={selectedClientId}
                onChange={(e) => handleSelectRegisteredClient(e.target.value)}
                className="text-[11px] bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-[#004ac6]"
              >
                <option value="">-- Cargar cliente registrado --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName} ({c.identificationNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Razón Social / Nombres *
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                  placeholder="Ej. Corporación Inntel S.A."
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  RUC / Cédula *
                </label>
                <input
                  type="text"
                  value={clientRuc}
                  onChange={(e) => setClientRuc(e.target.value)}
                  className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                  placeholder="1790000000001"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  <Mail className="w-3 h-3 inline mr-1 text-slate-400" />
                  Correo para envío RIDE *
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                  placeholder="cliente@empresa.com"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  <MapPin className="w-3 h-3 inline mr-1 text-slate-400" />
                  Dirección Fiscal
                </label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                  placeholder="Quito, Ecuador"
                />
              </div>
            </div>
          </div>

          {/* Electronic Document Assignment */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-800 text-xs block border-b border-slate-200 pb-1.5">
              Comprobante SRI a Generar
            </span>
            <div className="flex justify-between">
              <span>Tipo de Comprobante:</span>
              <span className="font-semibold text-slate-800">01 - FACTURA ELECTRÓNICA</span>
            </div>
            <div className="flex justify-between">
              <span>Secuencial Asignado:</span>
              <span className="font-mono font-bold text-[#004ac6]">{estimatedDocNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Ambiente SRI:</span>
              <span className="font-semibold text-slate-800">
                {sriCompanyConfig.ambiente === "2" ? "Producción (2)" : "Pruebas (1)"}
              </span>
            </div>
          </div>

          {/* Amounts summary */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex justify-between">
              <span>Subtotal 15%:</span>
              <span className="font-mono">${(sale.subtotal15 || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal 0%:</span>
              <span className="font-mono">${(sale.subtotal0 || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>IVA 15%:</span>
              <span className="font-mono">${(sale.ivaTotal || 0).toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-300 pt-1.5 flex justify-between font-bold text-slate-900 text-sm">
              <span>Total Factura:</span>
              <span className="font-mono text-[#004ac6]">${(sale.total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold rounded-xl text-xs transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConvert}
            disabled={isSubmitting}
            className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? "Emitiendo al SRI..." : "Confirmar y Emitir Factura SRI"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
