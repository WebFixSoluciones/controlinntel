"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  Trash2,
  Package,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Search,
  User,
} from "lucide-react";
import { useApp } from "@/lib/state";
import { ClientQuote, InvoiceItem } from "@/types";

interface BillingQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteToEdit?: ClientQuote | null;
  onSuccess?: (quote: ClientQuote) => void;
}

export function BillingQuoteModal({
  isOpen,
  onClose,
  quoteToEdit,
  onSuccess,
}: BillingQuoteModalProps) {
  const { clients, inventoryProducts, createBillingQuote, updateBillingQuote } = useApp();

  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ClientQuote["status"]>("enviada");
  const [searchProductTerm, setSearchProductTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (quoteToEdit) {
        setClientId(quoteToEdit.clientId);
        setDate(quoteToEdit.date);
        setValidUntil(quoteToEdit.validUntil);
        setItems(quoteToEdit.items || []);
        setNotes(quoteToEdit.notes || "");
        setStatus(quoteToEdit.status);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        setDate(today);
        setValidUntil(thirtyDaysLater);
        setClientId(clients[0]?.id || "");
        setItems([]);
        setNotes("Validez de la oferta: 30 días calendario. Precios no incluyen impuestos adicionales no descritos.");
        setStatus("enviada");
      }
      setErrorMsg("");
    }
  }, [isOpen, quoteToEdit, clients]);

  if (!isOpen) return null;

  const selectedClient = clients.find((c) => c.id === clientId) || clients[0];

  const handleAddItem = (product: (typeof inventoryProducts)[0]) => {
    const existing = items.find((it) => it.productId === product.id);
    if (existing) {
      handleUpdateQuantity(existing.id, existing.quantity + 1);
      return;
    }

    const unitPrice = product.salePrice || 10;
    const ivaRate = product.ivaRate || 15;
    const quantity = 1;
    const discount = 0;
    const subtotal = unitPrice * quantity - discount;
    const ivaAmount = subtotal * (ivaRate / 100);
    const total = subtotal + ivaAmount;

    const newItem: InvoiceItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      unit: product.unit,
      quantity,
      unitPrice,
      discount,
      ivaRate,
      subtotal,
      ivaAmount,
      total,
    };

    setItems((prev) => [...prev, newItem]);
    setSearchProductTerm("");
  };

  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const subtotal = it.unitPrice * newQty - it.discount;
        const ivaAmount = subtotal * (it.ivaRate / 100);
        const total = subtotal + ivaAmount;
        return { ...it, quantity: newQty, subtotal, ivaAmount, total };
      })
    );
  };

  const handleUpdatePrice = (itemId: string, newPrice: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const subtotal = newPrice * it.quantity - it.discount;
        const ivaAmount = subtotal * (it.ivaRate / 100);
        const total = subtotal + ivaAmount;
        return { ...it, unitPrice: newPrice, subtotal, ivaAmount, total };
      })
    );
  };

  const handleUpdateDiscount = (itemId: string, newDiscount: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const subtotal = Math.max(0, it.unitPrice * it.quantity - newDiscount);
        const ivaAmount = subtotal * (it.ivaRate / 100);
        const total = subtotal + ivaAmount;
        return { ...it, discount: newDiscount, subtotal, ivaAmount, total };
      })
    );
  };

  const handleUpdateIvaRate = (itemId: string, newRate: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const ivaAmount = it.subtotal * (newRate / 100);
        const total = it.subtotal + ivaAmount;
        return { ...it, ivaRate: newRate, ivaAmount, total };
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const filteredProducts = inventoryProducts.filter((p) => {
    if (!searchProductTerm.trim()) return true;
    const q = searchProductTerm.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  // Totales
  const subtotal15 = items.filter((it) => it.ivaRate === 15).reduce((sum, it) => sum + it.subtotal, 0);
  const subtotal0 = items.filter((it) => it.ivaRate === 0).reduce((sum, it) => sum + it.subtotal, 0);
  const discountTotal = items.reduce((sum, it) => sum + (it.discount || 0), 0);
  const ivaTotal = items.reduce((sum, it) => sum + it.ivaAmount, 0);
  const total = subtotal15 + subtotal0 + ivaTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      setErrorMsg("Debe seleccionar un cliente.");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Debe agregar al menos un ítem a la cotización.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (quoteToEdit) {
        await updateBillingQuote(quoteToEdit.id, {
          clientId: selectedClient.id,
          clientName: selectedClient.businessName || selectedClient.legalRepresentative || "Cliente",
          clientRuc: selectedClient.identificationNumber || "",
          clientEmail: selectedClient.email || "",
          clientPhone: selectedClient.phone || "",
          clientAddress: selectedClient.address || "",
          date,
          validUntil,
          items,
          subtotal15,
          subtotal0,
          discountTotal,
          ivaTotal,
          total,
          status,
          notes,
        });
      } else {
        const created = await createBillingQuote({
          clientId: selectedClient.id,
          clientName: selectedClient.businessName || selectedClient.legalRepresentative || "Cliente",
          clientRuc: selectedClient.identificationNumber || "",
          clientEmail: selectedClient.email || "",
          clientPhone: selectedClient.phone || "",
          clientAddress: selectedClient.address || "",
          date,
          validUntil,
          items,
          subtotal15,
          subtotal0,
          discountTotal,
          ivaTotal,
          total,
          status,
          notes,
        });
        if (onSuccess) onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar la cotización.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Propuestas Comerciales
              </span>
              <h2 className="text-lg font-black text-white">
                {quoteToEdit ? `Editar Cotización ${quoteToEdit.quoteNumber}` : "Nueva Cotización Formal"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fila 1: Cliente & Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Cliente:</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2 bg-white text-slate-900"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName} ({c.identificationNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Fecha Emisión:</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Válida Hasta:</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white"
              />
            </div>
          </div>

          {/* Fila 2: Ítems & Buscador */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#004ac6]" />
                Ítems Cotizados
              </h3>

              <div className="relative min-w-[280px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar en inventario y servicios..."
                  value={searchProductTerm}
                  onChange={(e) => setSearchProductTerm(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                />

                {searchProductTerm.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-56 overflow-y-auto z-20 divide-y divide-slate-100">
                    {filteredProducts.slice(0, 6).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddItem(p)}
                        className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{p.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            SKU: {p.sku} | PVP: ${p.salePrice.toFixed(2)}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {p.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">Descripción</th>
                    <th className="py-2.5 px-2 text-center w-20">Cant.</th>
                    <th className="py-2.5 px-2 text-right w-24">PVP ($)</th>
                    <th className="py-2.5 px-2 text-right w-20">Desc. ($)</th>
                    <th className="py-2.5 px-2 text-center w-20">IVA</th>
                    <th className="py-2.5 px-3 text-right w-24">Subtotal</th>
                    <th className="py-2.5 px-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No hay ítems en la cotización. Utiliza el buscador para agregar ítems.
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3">
                          <p className="font-bold text-slate-900">{it.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">SKU: {it.sku}</p>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => handleUpdateQuantity(it.id, parseFloat(e.target.value) || 1)}
                            className="w-16 text-center text-xs font-bold rounded-lg border border-slate-300 p-1"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.unitPrice}
                            onChange={(e) => handleUpdatePrice(it.id, parseFloat(e.target.value) || 0)}
                            className="w-20 text-right text-xs font-mono font-semibold rounded-lg border border-slate-300 p-1"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.discount || 0}
                            onChange={(e) => handleUpdateDiscount(it.id, parseFloat(e.target.value) || 0)}
                            className="w-16 text-right text-xs font-mono rounded-lg border border-slate-300 p-1 text-slate-600"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <select
                            value={it.ivaRate}
                            onChange={(e) => handleUpdateIvaRate(it.id, parseInt(e.target.value, 10))}
                            className="text-xs font-bold rounded-lg border border-slate-300 p-1 bg-white"
                          >
                            <option value={15}>15%</option>
                            <option value={0}>0%</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          ${it.subtotal.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
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
          </div>

          {/* Fila 3: Términos & Totales */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
            <div className="md:col-span-7 space-y-2">
              <label className="text-xs font-semibold text-slate-700">Términos & Observaciones:</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white transition"
              />
            </div>

            <div className="md:col-span-5 p-4 rounded-2xl bg-slate-900 text-white space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Subtotal 15%:</span>
                <span className="font-mono">${subtotal15.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300">
                <span>Subtotal 0%:</span>
                <span className="font-mono">${subtotal0.toFixed(2)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-xs text-amber-300">
                  <span>Descuento Total:</span>
                  <span className="font-mono">-${discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-sky-300">
                <span>IVA 15%:</span>
                <span className="font-mono font-bold">${ivaTotal.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm font-black">
                <span>TOTAL COTIZACIÓN:</span>
                <span className="text-xl font-mono text-amber-400">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="px-6 py-2.5 rounded-xl bg-[#004ac6] hover:bg-[#003ca3] disabled:opacity-50 text-white text-xs font-bold shadow-md transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{quoteToEdit ? "Guardar Cambios" : "Guardar Cotización"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
