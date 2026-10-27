"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, InvoiceItem, ClientQuote } from "@/types";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  ArrowRightLeft,
  ShoppingCart,
  X,
  ArrowLeft,
  Receipt,
  Eye,
  Edit2,
} from "lucide-react";
import { NewSaleView } from "../billing/NewSaleView";
import { QuotePreviewModal } from "../billing/QuotePreviewModal";
import { BillingQuoteModal } from "../billing/BillingQuoteModal";
import { ClientTabHeader } from "./ClientTabHeader";

interface ClientQuotesManagerProps {
  client: Client;
}

interface NormalizedQuoteItem {
  id: string;
  description: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sku?: string;
  unit?: string;
  ivaRate?: number;
  discount?: number;
  subtotal?: number;
  ivaAmount?: number;
  warehouseId?: string;
  serialNumbers?: string[];
}

interface NormalizedQuote {
  id: string;
  quoteNumber: string;
  title: string;
  date: string;
  validUntil: string;
  items: NormalizedQuoteItem[];
  subtotal: number;
  ivaAmount: number;
  total: number;
  status: "borrador" | "enviada" | "aprobada" | "orden_pedido" | "facturada" | "rechazada";
  notes?: string;
  source: "clientQuote" | "billingQuote";
}

export function ClientQuotesManager({ client }: ClientQuotesManagerProps) {
  const {
    clientQuotes,
    billingQuotes,
    addClientQuote,
    updateClientQuoteStatus,
    deleteClientQuote,
    updateBillingQuote,
    deleteBillingQuote,
    sriCompanyConfig,
    inventoryProducts,
  } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  // Navigation & Transformation to Sale
  const [convertingQuote, setConvertingQuote] = useState<NormalizedQuote | null>(null);

  // Preview / Print Modal
  const [previewQuote, setPreviewQuote] = useState<ClientQuote | null>(null);

  // Modal create/edit quote
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quoteToEdit, setQuoteToEdit] = useState<ClientQuote | null>(null);

  // Helper to convert quote items to standard InvoiceItem format for NewSaleView
  const quoteItemsToInvoiceItems = (rawItems: NormalizedQuoteItem[]): InvoiceItem[] => {
    return rawItems.map((it, idx) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const price = Math.max(0, Number(it.unitPrice) || 0);
      const discount = Math.max(0, Number(it.discount) || 0);
      const subtotal = it.subtotal !== undefined ? Number(it.subtotal) : parseFloat((qty * price - discount).toFixed(2));
      const ivaRate = it.ivaRate !== undefined ? Number(it.ivaRate) : 15;
      const ivaAmount = it.ivaAmount !== undefined ? Number(it.ivaAmount) : parseFloat((subtotal * (ivaRate / 100)).toFixed(2));
      const total = it.total !== undefined ? Number(it.total) : parseFloat((subtotal + ivaAmount).toFixed(2));
      const name = it.name || it.description || "Servicio / Producto Cotizado";

      return {
        id: it.id || `itm-quote-${Date.now()}-${idx}`,
        productId: `prod-quote-${idx}`,
        sku: it.sku || `COT-${(idx + 1).toString().padStart(3, "0")}`,
        name,
        description: it.description || name,
        unit: it.unit || "unidad",
        quantity: qty,
        unitPrice: price,
        discount,
        ivaRate,
        subtotal,
        ivaAmount,
        total,
        warehouseId: it.warehouseId,
        serialNumbers: it.serialNumbers,
      };
    });
  };

  // Convert normalized quote to ClientQuote for QuotePreviewModal
  const toClientQuote = (q: NormalizedQuote): ClientQuote => {
    const invoiceItems = quoteItemsToInvoiceItems(q.items);
    const subtotal15 = invoiceItems.reduce((acc, it) => acc + (it.ivaRate === 15 ? it.subtotal : 0), 0);
    const subtotal0 = invoiceItems.reduce((acc, it) => acc + (it.ivaRate === 0 ? it.subtotal : 0), 0);
    const ivaTotal = invoiceItems.reduce((acc, it) => acc + it.ivaAmount, 0);

    return {
      id: q.id,
      quoteNumber: q.quoteNumber,
      date: q.date || new Date().toISOString().slice(0, 10),
      validUntil: q.validUntil || "",
      clientId: client.id,
      clientName: client.businessName,
      clientRuc: client.identificationNumber,
      clientEmail: client.email || "cliente@correo.com",
      clientPhone: client.phone || "",
      clientAddress: client.address || "",
      items: invoiceItems,
      subtotal15,
      subtotal0,
      discountTotal: 0,
      ivaTotal,
      total: q.total,
      status: q.status === "facturada" ? "facturada" : q.status === "aprobada" ? "aprobada" : "borrador",
      notes: q.notes,
      createdAt: q.date || new Date().toISOString(),
    };
  };

  // Unified list of quotes strictly for this client
  const quotes: NormalizedQuote[] = useMemo(() => {
    const matchesClient = (clientId?: string, ruc?: string, name?: string) => {
      if (clientId && clientId === client.id) return true;
      if (ruc && client.identificationNumber && ruc.trim() === client.identificationNumber.trim()) return true;
      if (name && client.businessName && name.trim().toLowerCase() === client.businessName.trim().toLowerCase()) return true;
      return false;
    };

    const fromClientQuotes: NormalizedQuote[] = (clientQuotes || [])
      .filter((q) => matchesClient(q.clientId, q.clientRuc, q.clientName))
      .map((q) => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        title: q.title,
        date: q.createdAt ? q.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        validUntil: q.validUntil,
        items: (q.items || []).map((it, idx) => ({
          id: it.id || `itm-${idx}`,
          description: it.description,
          name: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
        })),
        subtotal: q.subtotal,
        ivaAmount: q.ivaAmount,
        total: q.total,
        status: q.status,
        notes: q.notes,
        source: "clientQuote" as const,
      }));

    const fromBillingQuotes: NormalizedQuote[] = (billingQuotes || [])
      .filter((q) => matchesClient(q.clientId, q.clientRuc, q.clientName))
      .map((q) => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        title: `Cotización Comercial - ${q.clientName || client.businessName}`,
        date: q.date,
        validUntil: q.validUntil,
        items: (q.items || []).map((it, idx) => ({
          id: it.id || `itm-bq-${idx}`,
          description: it.name || it.description || "",
          name: it.name || it.description || "",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
          sku: it.sku,
          unit: it.unit,
          ivaRate: it.ivaRate,
          discount: it.discount,
          subtotal: it.subtotal,
          ivaAmount: it.ivaAmount,
        })),
        subtotal: (q.subtotal15 || 0) + (q.subtotal0 || 0),
        ivaAmount: q.ivaTotal,
        total: q.total,
        status: q.status,
        notes: q.notes,
        source: "billingQuote" as const,
      }));

    // Deduplicate by quoteNumber preferring clientQuotes
    const map = new Map<string, NormalizedQuote>();
    for (const q of fromClientQuotes) {
      map.set(q.quoteNumber, q);
    }
    for (const q of fromBillingQuotes) {
      if (!map.has(q.quoteNumber)) {
        map.set(q.quoteNumber, q);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [clientQuotes, billingQuotes, client]);

  // Open modal for new quote
  const handleOpenModal = () => {
    setQuoteToEdit(null);
    setIsModalOpen(true);
  };

  // Convert quotation into direct sale in NewSaleView
  const handleStartConvertToSale = (q: NormalizedQuote) => {
    setConvertingQuote(q);
  };

  // Delete quote with user confirmation
  const handleDeleteQuote = (quote: NormalizedQuote) => {
    showConfirm(
      "¿Eliminar Cotización?",
      `¿Deseas eliminar permanentemente la cotización ${quote.quoteNumber}?`,
      async () => {
        try {
          if (quote.source === "clientQuote") {
            await deleteClientQuote(quote.id);
          } else if (quote.source === "billingQuote") {
            await deleteBillingQuote(quote.id);
          }
          showSuccess("Eliminado", `La cotización ${quote.quoteNumber} fue removida con éxito.`);
        } catch (error) {
          showError("Error", "No se pudo eliminar la cotización.");
        }
      },
      "Eliminar Cotización"
    );
  };

  // Status badge styling
  const getStatusBadge = (status: NormalizedQuote["status"]) => {
    switch (status) {
      case "facturada":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Facturada</span>
          </span>
        );
      case "orden_pedido":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
            <span>Orden Pedido</span>
          </span>
        );
      case "aprobada":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
            <span>Aprobada</span>
          </span>
        );
      case "enviada":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span>Enviada</span>
          </span>
        );
      case "borrador":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            <span>Borrador</span>
          </span>
        );
    }
  };

  // If in sale conversion mode, render NewSaleView directly with all prefilled quote data
  if (convertingQuote) {
    return (
      <div className="bg-white rounded-xl p-2 sm:p-4 border border-[#e2e8f0] shadow-xs animate-in fade-in">
        <div className="mb-4 flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setConvertingQuote(null)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
              title="Volver a Cotizaciones"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#004ac6] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {convertingQuote.quoteNumber}
                </span>
                <h3 className="font-bold text-sm text-slate-900">
                  Transformar Cotización a Venta
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Los datos e ítems cotizados han sido precargados. Revisa y emite la Factura Electrónica o Nota de Venta.
              </p>
            </div>
          </div>
        </div>

        <NewSaleView
          initialClientId={client.id}
          initialDocType="factura"
          initialItems={quoteItemsToInvoiceItems(convertingQuote.items)}
          initialOrderNumber={convertingQuote.quoteNumber}
          initialNotes={`Facturado desde Cotización ${convertingQuote.quoteNumber}.${convertingQuote.notes ? " " + convertingQuote.notes : ""}`}
          onBack={() => setConvertingQuote(null)}
          onSuccess={async (invoice) => {
            try {
              if (convertingQuote.source === "clientQuote") {
                await updateClientQuoteStatus(convertingQuote.id, "facturada");
              } else if (convertingQuote.source === "billingQuote") {
                await updateBillingQuote(convertingQuote.id, {
                  status: "facturada",
                  invoicedAt: new Date().toISOString(),
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.documentNumber,
                });
              }
            } catch (err) {
              console.error(err);
            }
            setConvertingQuote(null);
            showSuccess(
              "Venta Registrada",
              `Cotización ${convertingQuote.quoteNumber} transformada en la venta ${invoice.documentNumber}.`
            );
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ClientTabHeader
        title="Cotizaciones"
        icon={FileSpreadsheet}
        badge={
          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff]">
            {quotes.length}
          </span>
        }
        actions={
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Cotización</span>
          </button>
        }
      />

      {/* Quotes Table */}
      {quotes.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-200">
          <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-bold text-slate-700 text-xs">Sin cotizaciones registradas</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            No existen cotizaciones asignadas para este cliente.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-3 px-4 w-[15%]">N° Cotización</th>
                  <th className="py-3 px-4 w-[35%]">Detalle / Servicios Cotizados</th>
                  <th className="py-3 px-4 w-[18%]">Fecha / Vigencia</th>
                  <th className="py-3 px-4 w-[12%] text-center">Estado</th>
                  <th className="py-3 px-4 w-[10%] text-right">Total</th>
                  <th className="py-3 px-4 w-[10%] text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* N° Cotización */}
                    <td className="py-3.5 px-4 font-mono font-bold text-[#004ac6] whitespace-nowrap">
                      {q.quoteNumber}
                    </td>

                    {/* Detalle / Servicios */}
                    <td className="py-3.5 px-4 min-w-[220px]">
                      <span className="font-bold text-slate-900 block">{q.title}</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {q.items.map((it, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                          >
                            {it.quantity}x {it.description}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Fecha / Vigencia */}
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      <div>
                        <span className="font-medium text-slate-800">{q.date}</span>
                        {q.validUntil && (
                          <span className="block text-[10px] text-slate-400">
                            Vence: {q.validUntil}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {getStatusBadge(q.status)}
                    </td>

                    {/* Total */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="font-mono font-black text-sm text-slate-900">
                        ${q.total.toFixed(2)} USD
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Sub: ${q.subtotal.toFixed(2)} + IVA: ${q.ivaAmount.toFixed(2)}
                      </div>
                    </td>

                    {/* Acciones (solo iconos de acción) */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* Icono: Transformar a Venta */}
                        <button
                          type="button"
                          onClick={() => handleStartConvertToSale(q)}
                          className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Transformar a Venta (Factura Electrónica SRI o Nota de Venta)"
                          aria-label="Transformar a Venta"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </button>

                        {/* Icono: Editar Cotización */}
                        <button
                          type="button"
                          onClick={() => {
                            setQuoteToEdit(toClientQuote(q));
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-slate-500 hover:text-[#004ac6] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Editar Cotización Formal"
                          aria-label="Editar Cotización Formal"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Icono: Imprimir / Ver cotización */}
                        <button
                          type="button"
                          onClick={() => setPreviewQuote(toClientQuote(q))}
                          className="p-2 text-slate-500 hover:text-[#004ac6] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Imprimir / Ver Cotización Formal"
                          aria-label="Imprimir / Ver Cotización Formal"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Icono: Eliminar cotización */}
                        <button
                          type="button"
                          onClick={() => handleDeleteQuote(q)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Eliminar Cotización"
                          aria-label="Eliminar Cotización"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Vista Previa e Impresión Oficial */}
      {previewQuote && (
        <QuotePreviewModal
          isOpen={true}
          onClose={() => setPreviewQuote(null)}
          quote={previewQuote}
          companyConfig={sriCompanyConfig}
          onConvertToInvoice={() => {
            const norm = quotes.find((q) => q.quoteNumber === previewQuote.quoteNumber);
            setPreviewQuote(null);
            if (norm) {
              handleStartConvertToSale(norm);
            }
          }}
        />
      )}

      {/* Modal Oficial de Cotización Comercial Aprobado */}
      {isModalOpen && (
        <BillingQuoteModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setQuoteToEdit(null);
          }}
          quoteToEdit={quoteToEdit}
          initialClientId={client.id}
          onSuccess={(savedQuote) => {
            showSuccess(
              "Cotización Guardada",
              `Cotización ${savedQuote.quoteNumber} registrada exitosamente.`
            );
            setIsModalOpen(false);
            setQuoteToEdit(null);
          }}
        />
      )}
    </div>
  );
}
