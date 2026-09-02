"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, ClientQuoteOrder, QuoteOrderItem } from "@/types";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  DollarSign,
  ShoppingCart,
  FileText,
  X,
  Send,
  Calendar,
} from "lucide-react";

interface ClientQuotesManagerProps {
  client: Client;
}

export function ClientQuotesManager({ client }: ClientQuotesManagerProps) {
  const { clientQuotes, addClientQuote, updateClientQuoteStatus, deleteClientQuote, generateMonthlyBillingBatch } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("Cotización de Servicio de Internet Dedicado");
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 86400000 * 15).toISOString().split("T")[0]);
  const [notes, setNotes] = useState("Tarifas en dólares americanos (USD). Incluye instalación de acometida de fibra óptica y router Wi-Fi 6.");
  
  const [items, setItems] = useState<QuoteOrderItem[]>([
    { id: "item-1", description: "Plan Fibra Óptica Dedicado 100 Mbps Simétrico", quantity: 1, unitPrice: 28.0, total: 28.0 },
    { id: "item-2", description: "Instalación de Acometida Drop & Fusión Óptica", quantity: 1, unitPrice: 0.0, total: 0.0 },
  ]);

  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(15.0);

  const quotes = clientQuotes.filter((q) => q.clientId === client.id);

  const handleAddItem = () => {
    if (!newItemDesc.trim()) return;
    const qty = Math.max(1, newItemQty);
    const price = Math.max(0, newItemPrice);
    const total = parseFloat((qty * price).toFixed(2));

    setItems([
      ...items,
      { id: "item-" + Date.now(), description: newItemDesc.trim(), quantity: qty, unitPrice: price, total },
    ]);
    setNewItemDesc("");
    setNewItemQty(1);
    setNewItemPrice(15.0);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const iva = parseFloat((subtotal * 0.15).toFixed(2));
  const total = parseFloat((subtotal + iva).toFixed(2));

  const handleCreateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      showError("Sin Ítems", "Agrega al menos un servicio o producto a la cotización.");
      return;
    }

    const qNumber = `COT-${new Date().getFullYear()}-${(quotes.length + 1).toString().padStart(4, "0")}`;

    addClientQuote({
      clientId: client.id,
      clientName: client.businessName,
      clientRuc: client.identificationNumber,
      quoteNumber: qNumber,
      title: title.trim(),
      items,
      subtotal,
      ivaAmount: iva,
      total,
      status: "borrador",
      validUntil,
      notes,
    });

    showSuccess("Cotización Creada", `Comprobante ${qNumber} emitido para ${client.businessName}.`);
    setIsModalOpen(false);
  };

  const handleConvertToOrder = (quote: ClientQuoteOrder) => {
    updateClientQuoteStatus(quote.id, "orden_pedido");
    showSuccess("Orden de Pedido Emitida", `La cotización ${quote.quoteNumber} ahora es una Orden de Pedido formal.`);
  };

  const handleDeleteQuote = (quote: ClientQuoteOrder) => {
    showConfirm(
      "¿Eliminar Cotización?",
      `¿Deseas eliminar la cotización ${quote.quoteNumber}?`,
      () => {
        deleteClientQuote(quote.id);
        showSuccess("Eliminado", "La cotización fue removida.");
      },
      "Eliminar"
    );
  };

  const getStatusBadge = (status: ClientQuoteOrder["status"]) => {
    switch (status) {
      case "orden_pedido":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
            Orden de Pedido Activa
          </span>
        );
      case "aprobada":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-100 text-sky-800 border border-sky-200">
            Aprobada por Cliente
          </span>
        );
      case "enviada":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
            Enviada / Pendiente
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
            Borrador
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
        <div>
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Cotizaciones Comerciales & Órdenes de Pedido
          </h4>
          <p className="text-[11px] text-slate-400">
            Gestión de propuestas tarifarias, cálculo de IVA 15% y conversión a órdenes de cobro
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva Cotización / Orden</span>
        </button>
      </div>

      {/* Quotes List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quotes.length === 0 ? (
          <div className="col-span-2 py-10 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-600 text-xs">Sin cotizaciones registradas</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Haz clic en "Nueva Cotización / Orden" para armar una propuesta comercial.</p>
          </div>
        ) : (
          quotes.map((q) => (
            <div
              key={q.id}
              className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                    {q.quoteNumber}
                  </span>
                  {getStatusBadge(q.status)}
                </div>

                <h5 className="font-bold text-sm text-slate-900 mt-2">{q.title}</h5>
                <p className="text-[11px] text-slate-400 mt-0.5">Válida hasta: {q.validUntil}</p>

                {/* Items preview */}
                <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                  {q.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-slate-700">
                      <span className="truncate pr-2">
                        {it.quantity}x {it.description}
                      </span>
                      <span className="font-mono font-bold">${it.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                  <div className="text-[11px] text-slate-500">
                    <span>Subtotal: ${q.subtotal.toFixed(2)}</span> • <span>IVA (15%): ${q.ivaAmount.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-slate-900 font-mono">${q.total.toFixed(2)} USD</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleDeleteQuote(q)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  title="Eliminar cotización"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-2">
                  {q.status !== "orden_pedido" && (
                    <button
                      onClick={() => handleConvertToOrder(q)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer flex items-center gap-1.5"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Emitir Orden</span>
                    </button>
                  )}
                  <button
                    onClick={() => window.print()}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                    title="Imprimir / Exportar comprobante"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Quote Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Nueva Cotización Comercial
              </h4>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="p-5 overflow-y-auto space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Título de la Cotización *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Vigencia de la Oferta</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              {/* Items Section */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="font-bold text-slate-800 block">Detalle de Servicios & Equipos</label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Descripción del ítem (ej. Router Wi-Fi 6 GPON)"
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5"
                  />
                  <input
                    type="number"
                    min={1}
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                    className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-center"
                    title="Cantidad"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
                    className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-right font-mono"
                    title="Precio Unitario"
                  />
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-xl cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <div className="space-y-1 max-h-36 overflow-y-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-100">
                      <span className="truncate pr-2 font-medium">
                        {it.quantity}x {it.description} (${it.unitPrice.toFixed(2)})
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">${it.total.toFixed(2)}</span>
                        <button type="button" onClick={() => handleRemoveItem(it.id)} className="text-slate-400 hover:text-rose-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculation summary */}
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between font-mono">
                  <div>
                    <p className="text-[11px] text-slate-600">Subtotal: ${subtotal.toFixed(2)}</p>
                    <p className="text-[11px] text-slate-600">IVA 15%: ${iva.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-800 font-bold uppercase block">Total Cotizado</span>
                    <span className="text-base font-black text-emerald-900">${total.toFixed(2)} USD</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-bold text-slate-600 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm cursor-pointer">
                  Guardar Cotización
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
