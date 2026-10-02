"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, ClientQuoteOrder, QuoteOrderItem, InvoiceItem, ClientQuote } from "@/types";
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
} from "lucide-react";
import { NewSaleView } from "../billing/NewSaleView";
import { QuotePreviewModal } from "../billing/QuotePreviewModal";

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
  } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  // Navigation & Transformation to Sale
  const [convertingQuote, setConvertingQuote] = useState<NormalizedQuote | null>(null);

  // Preview / Print Modal
  const [previewQuote, setPreviewQuote] = useState<ClientQuote | null>(null);

  // Modal create quick quote
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("Cotización de Servicio de Telecomunicaciones");
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 86400000 * 15).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState(
    "Tarifas en dólares americanos (USD). Incluye instalación de acometida de fibra óptica, router Wi-Fi 6 y soporte técnico 24/7."
  );

  const [items, setItems] = useState<QuoteOrderItem[]>([
    {
      id: "item-1",
      description: "Servicio de Internet Fibra Óptica Dedicado",
      quantity: 1,
      unitPrice: 35.0,
      total: 35.0,
    },
  ]);

  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(25.0);

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

  // Unified list of quotes for this client
  const quotes: NormalizedQuote[] = useMemo(() => {
    const fromClientQuotes: NormalizedQuote[] = (clientQuotes || [])
      .filter((q) => q.clientId === client.id)
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
      .filter((q) => q.clientId === client.id)
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

  // Open modal with default values
  const handleOpenModal = () => {
    setTitle(`Cotización de Servicio - ${client.businessName}`);
    setValidUntil(new Date(Date.now() + 86400000 * 15).toISOString().split("T")[0]);
    setNewItemDesc("");
    setNewItemQty(1);
    setNewItemPrice(30.0);
    setItems([
      {
        id: "item-1",
        description: "Servicio de Internet Fibra Óptica",
        quantity: 1,
        unitPrice: 28.0,
        total: 28.0,
      },
    ]);
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    if (!newItemDesc.trim()) {
      showError("Descripción Requerida", "Escribe la descripción o nombre del artículo/servicio.");
      return;
    }
    const qty = Math.max(1, Number(newItemQty) || 1);
    const price = Math.max(0, Number(newItemPrice) || 0);
    const total = parseFloat((qty * price).toFixed(2));

    const newItem: QuoteOrderItem = {
      id: "item-" + Date.now(),
      description: newItemDesc.trim(),
      quantity: qty,
      unitPrice: price,
      total,
    };

    setItems((prev) => [...prev, newItem]);
    setNewItemDesc("");
    setNewItemQty(1);
    setNewItemPrice(20.0);
    showSuccess("Artículo Agregado", `Se agregó "${newItem.description}" a la cotización.`);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const modalSubtotal = items.reduce((sum, i) => sum + i.total, 0);
  const modalIva = parseFloat((modalSubtotal * 0.15).toFixed(2));
  const modalTotal = parseFloat((modalSubtotal + modalIva).toFixed(2));

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalItems = [...items];

      if (newItemDesc.trim()) {
        const qty = Math.max(1, Number(newItemQty) || 1);
        const price = Math.max(0, Number(newItemPrice) || 0);
        const autoTotal = parseFloat((qty * price).toFixed(2));
        finalItems.push({
          id: "item-" + Date.now(),
          description: newItemDesc.trim(),
          quantity: qty,
          unitPrice: price,
          total: autoTotal,
        });
      }

      if (finalItems.length === 0) {
        showError("Sin Artículos", "Agrega al menos un artículo o servicio a la cotización.");
        return;
      }

      const calculatedSubtotal = finalItems.reduce((sum, i) => sum + i.total, 0);
      const calculatedIva = parseFloat((calculatedSubtotal * 0.15).toFixed(2));
      const calculatedTotal = parseFloat((calculatedSubtotal + calculatedIva).toFixed(2));

      const qNumber = `COT-${new Date().getFullYear()}-${(quotes.length + 1).toString().padStart(4, "0")}`;

      await addClientQuote({
        clientId: client.id,
        clientName: client.businessName,
        clientRuc: client.identificationNumber,
        quoteNumber: qNumber,
        title: title.trim(),
        items: finalItems,
        subtotal: calculatedSubtotal,
        ivaAmount: calculatedIva,
        total: calculatedTotal,
        status: "borrador",
        validUntil,
        notes,
      });

      showSuccess("Cotización Registrada", `Comprobante comercial ${qNumber} emitido.`);
      setIsModalOpen(false);
    } catch (error) {
      showError("Error", error instanceof Error ? error.message : "No se pudo guardar.");
    }
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Facturada / Vendida</span>
          </span>
        );
      case "orden_pedido":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            <ShoppingCart className="w-3 h-3 text-blue-600" />
            <span>Orden de Pedido</span>
          </span>
        );
      case "aprobada":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200">
            <CheckCircle2 className="w-3 h-3 text-sky-600" />
            <span>Aprobada</span>
          </span>
        );
      case "enviada":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span>Enviada</span>
          </span>
        );
      case "borrador":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            <span>Borrador</span>
          </span>
        );
    }
  };

  // If in sale conversion mode, render NewSaleView directly with all prefilled quote data
  if (convertingQuote) {
    return (
      <div className="bg-white rounded-2xl p-2 sm:p-4 border border-slate-200 shadow-xs animate-in fade-in">
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
    <div className="space-y-4 select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Cotizaciones Comerciales & Órdenes de Pedido</h3>
            <span className="text-[11px] text-slate-500">Propuestas económicas y pedidos de servicio para este cliente</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Cotización Comercial</span>
        </button>
      </div>

      {/* Quotes Table */}
      {quotes.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
          <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-bold text-slate-700 text-xs">Sin cotizaciones registradas</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Crea una nueva cotización para registrar propuestas de internet, enlaces y equipos.
          </p>
          <button
            type="button"
            onClick={handleOpenModal}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear Cotización</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">N° Cotización</th>
                  <th className="py-3 px-4">Detalle / Servicios Cotizados</th>
                  <th className="py-3 px-4">Fecha / Vigencia</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
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

                    {/* Acciones */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Transformar a Venta */}
                        <button
                          type="button"
                          onClick={() => handleStartConvertToSale(q)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200 text-xs font-bold transition cursor-pointer shadow-2xs"
                          title="Transformar a Venta (Factura Electrónica / Nota de Venta)"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Transformar a Venta</span>
                        </button>

                        {/* Imprimir / Ver comprobante proforma */}
                        <button
                          type="button"
                          onClick={() => setPreviewQuote(toClientQuote(q))}
                          className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Imprimir / Ver Cotización Formal"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Eliminar cotización */}
                        <button
                          type="button"
                          onClick={() => handleDeleteQuote(q)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Eliminar Cotización"
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

      {/* Modal: Nueva Cotización Comercial Rápida */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-4">
            <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-[#004ac6]" />
                <h4 className="font-bold text-slate-900 text-sm">Nueva Cotización Comercial</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Título de la Cotización *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-900 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vigencia de la Oferta</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900 text-xs">Detalle de Servicios & Artículos Cotizados</label>
                  <span className="text-[11px] text-slate-500">{items.length} artículo(s) en la lista</span>
                </div>

                {/* Input row for adding new item */}
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
                  <span className="text-[11px] font-bold text-[#004ac6] block">Agregar Nuevo Artículo / Servicio:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        placeholder="Descripción (ej: Router Wi-Fi 6 GPON, Instalación fibra...)"
                        value={newItemDesc}
                        onChange={(e) => setNewItemDesc(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddItem();
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Cant."
                        value={newItemQty}
                        onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-center text-xs font-semibold text-slate-900 outline-hidden"
                        title="Cantidad"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="Precio $"
                        value={newItemPrice}
                        onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-right font-mono font-bold text-[#004ac6] text-xs outline-hidden"
                        title="Precio Unitario"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white font-bold rounded-xl text-xs transition shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table of items */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Descripción del Artículo</th>
                        <th className="py-2.5 px-3 text-center">Cant.</th>
                        <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                        <th className="py-2.5 px-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                            No hay artículos agregados. Usa los campos de arriba para añadir ítems.
                          </td>
                        </tr>
                      ) : (
                        items.map((it) => (
                          <tr key={it.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-4 font-semibold text-slate-900">{it.description}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700">{it.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                              ${it.unitPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              ${it.total.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(it.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Eliminar artículo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Calculation summary */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between font-mono">
                  <div className="space-y-0.5">
                    <p className="text-xs text-slate-600">
                      Subtotal: <strong className="text-slate-900">${modalSubtotal.toFixed(2)}</strong>
                    </p>
                    <p className="text-xs text-slate-600">
                      IVA (15%): <strong className="text-slate-900">${modalIva.toFixed(2)}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#004ac6] font-bold uppercase block tracking-wider">
                      Total Cotizado
                    </span>
                    <span className="text-lg font-black text-[#004ac6]">${modalTotal.toFixed(2)} USD</span>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Notas / Condiciones Comerciales</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar Cotización</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
