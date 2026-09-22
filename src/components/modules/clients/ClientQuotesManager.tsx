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
  AlertCircle,
} from "lucide-react";

interface ClientQuotesManagerProps {
  client: Client;
}

export function ClientQuotesManager({ client }: ClientQuotesManagerProps) {
  const { clientQuotes, addClientQuote, updateClientQuoteStatus, deleteClientQuote } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

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

  const quotes = clientQuotes.filter((q) => q.clientId === client.id);

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

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const iva = parseFloat((subtotal * 0.15).toFixed(2));
  const total = parseFloat((subtotal + iva).toFixed(2));

  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalItems = [...items];

      // Si el usuario ingresó datos en el formulario rápido y no hizo clic en "+", auto-incorporar
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
      window.dispatchEvent(
        new CustomEvent("inntel:error", {
          detail: error instanceof Error ? error.message : "No se pudo guardar.",
        })
      );
    }
  };

  const handleConvertToOrder = async (quote: ClientQuoteOrder) => {
    try {
      await updateClientQuoteStatus(quote.id, "orden_pedido");
      showSuccess("Orden de Pedido Emitida", `La cotización ${quote.quoteNumber} ahora es una Orden de Pedido formal.`);
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("inntel:error", {
          detail: error instanceof Error ? error.message : "No se pudo guardar.",
        })
      );
    }
  };

  const handleDeleteQuote = (quote: ClientQuoteOrder) => {
    showConfirm(
      "¿Eliminar Cotización?",
      `¿Deseas eliminar la cotización ${quote.quoteNumber}?`,
      async () => {
        try {
          await deleteClientQuote(quote.id);
          showSuccess("Eliminado", "La cotización fue removida.");
        } catch (error) {
          window.dispatchEvent(
            new CustomEvent("inntel:error", {
              detail: error instanceof Error ? error.message : "No se pudo guardar.",
            })
          );
        }
      },
      "Eliminar"
    );
  };

  const getStatusBadge = (status: ClientQuoteOrder["status"]) => {
    switch (status) {
      case "orden_pedido":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
            Orden de Pedido Activa
          </span>
        );
      case "aprobada":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-100 text-sky-800 border border-sky-200">
            Aprobada por Cliente
          </span>
        );
      case "enviada":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
            Enviada / En Negociación
          </span>
        );
      case "borrador":
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            Borrador Comercial
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#0b1c30]">Cotizaciones Comerciales & Órdenes de Pedido</h3>
            <span className="text-[11px] text-[#737686]">Propuestas económicas y pedidos de servicio para este abonado</span>
          </div>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Cotización Comercial</span>
        </button>
      </div>

      {/* Quotes Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quotes.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-600 text-xs">Sin cotizaciones registradas</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Crea una nueva cotización para registrar propuestas de internet, enlaces y equipos.
            </p>
          </div>
        ) : (
          quotes.map((q) => (
            <div
              key={q.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-lumina-card flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#004ac6] block">{q.quoteNumber}</span>
                    <h4 className="font-bold text-sm text-[#0b1c30] mt-0.5">{q.title}</h4>
                  </div>
                  {getStatusBadge(q.status)}
                </div>

                <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs border border-slate-100">
                  {q.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-slate-700">
                      <span className="truncate pr-2 font-medium">
                        {it.quantity}x {it.description}
                      </span>
                      <span className="font-mono font-bold text-slate-900">${it.total.toFixed(2)}</span>
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
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                  title="Eliminar cotización"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-2">
                  {q.status !== "orden_pedido" && (
                    <button
                      onClick={() => handleConvertToOrder(q)}
                      className="px-3 py-1.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-2xs cursor-pointer flex items-center gap-1.5 transition-all"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Emitir Orden</span>
                    </button>
                  )}
                  <button
                    onClick={() => window.print()}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[92vh] my-4">
            <div className="p-4 px-6 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-[#004ac6]" />
                <h4 className="font-bold text-[#0b1c30] text-sm">Nueva Cotización Comercial</h4>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="font-bold text-[#434655] block mb-1">Título de la Cotización *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Vigencia de la Oferta</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="pt-2 border-t border-[#e2e8f0] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#0b1c30] text-xs">Detalle de Servicios & Artículos Cotizados</label>
                  <span className="text-[11px] text-[#737686]">{items.length} artículo(s) en la lista</span>
                </div>

                {/* Input row for adding new item */}
                <div className="p-3 bg-[#f8f9ff] rounded-xl border border-[#dce9ff] space-y-2">
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
                        className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Cant."
                        value={newItemQty}
                        onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                        className="w-full bg-white border border-[#cbd5e1] rounded-xl px-2 py-2 text-center text-xs font-semibold text-[#0b1c30]"
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
                        className="w-full bg-white border border-[#cbd5e1] rounded-xl px-2 py-2 text-right font-mono font-bold text-[#004ac6] text-xs"
                        title="Precio Unitario"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table of items */}
                <div className="border border-[#e2e8f0] rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f8f9ff] text-[#434655] font-bold text-[10px] uppercase border-b border-[#e2e8f0]">
                      <tr>
                        <th className="py-2.5 px-4">Descripción del Artículo</th>
                        <th className="py-2.5 px-3 text-center">Cant.</th>
                        <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                        <th className="py-2.5 px-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                            No hay artículos agregados. Usa los campos de arriba para añadir ítems.
                          </td>
                        </tr>
                      ) : (
                        items.map((it) => (
                          <tr key={it.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-4 font-semibold text-[#0b1c30]">{it.description}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-[#434655]">{it.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-[#434655]">
                              ${it.unitPrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0b1c30]">
                              ${it.total.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(it.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
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
                <div className="p-4 bg-[#f8f9ff] rounded-2xl border border-[#dce9ff] flex items-center justify-between font-mono">
                  <div className="space-y-0.5">
                    <p className="text-xs text-slate-600">
                      Subtotal: <strong className="text-[#0b1c30]">${subtotal.toFixed(2)}</strong>
                    </p>
                    <p className="text-xs text-slate-600">
                      IVA (15%): <strong className="text-[#0b1c30]">${iva.toFixed(2)}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#004ac6] font-bold uppercase block tracking-wider">
                      Total Cotizado
                    </span>
                    <span className="text-lg font-black text-[#004ac6]">${total.toFixed(2)} USD</span>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Notas / Condiciones Comerciales</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#737686] hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
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
