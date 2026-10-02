"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Receipt,
  Building2,
  Package,
  Layers,
  CreditCard,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  User,
  Search,
} from "lucide-react";
import { useApp } from "@/lib/state";
import { InvoiceItem, SriInvoice } from "@/types";

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (invoice: SriInvoice) => void;
}

export function NewSaleModal({ isOpen, onClose, onSuccess }: NewSaleModalProps) {
  const {
    clients,
    inventoryWarehouses,
    inventoryProducts,
    createInvoice,
    sriCompanyConfig,
  } = useApp();

  const [clientMode, setClientMode] = useState<"registered" | "final" | "custom">("registered");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [customClientName, setCustomClientName] = useState("");
  const [customClientRuc, setCustomClientRuc] = useState("");
  const [customClientEmail, setCustomClientEmail] = useState("");
  const [customClientPhone, setCustomClientPhone] = useState("");
  const [customClientAddress, setCustomClientAddress] = useState("");

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<SriInvoice["paymentMethod"]>("transferencia");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Search & add product
  const [searchProductTerm, setSearchProductTerm] = useState("");

  // Initialize defaults
  useEffect(() => {
    if (isOpen) {
      if (clients.length > 0 && !selectedClientId) {
        setSelectedClientId(clients[0].id);
      }
      if (inventoryWarehouses.length > 0 && !warehouseId) {
        setWarehouseId(inventoryWarehouses[0].id);
      }
      setErrorMsg("");
    }
  }, [isOpen, clients, inventoryWarehouses]);

  if (!isOpen) return null;

  const currentWarehouse = inventoryWarehouses.find((w) => w.id === warehouseId) || inventoryWarehouses[0];

  // Resolve client data
  let clientName = "";
  let clientRuc = "";
  let clientEmail = "";
  let clientPhone = "";
  let clientAddress = "";
  let tipoIdentificacion = "04";

  if (clientMode === "registered") {
    const cl = clients.find((c) => c.id === selectedClientId);
    if (cl) {
      clientName = cl.businessName || cl.legalRepresentative || "Cliente";
      clientRuc = cl.identificationNumber || "";
      clientEmail = cl.email || "";
      clientPhone = cl.phone || "";
      clientAddress = cl.address || "";
      tipoIdentificacion = cl.identificationNumber?.length === 13 ? "04" : "05";
    }
  } else if (clientMode === "final") {
    clientName = "CONSUMIDOR FINAL";
    clientRuc = "9999999999999";
    clientEmail = sriCompanyConfig?.emailNotificaciones || "consumidorfinal@inntelcorp.com";
    clientPhone = "0999999999";
    clientAddress = "Quito, Ecuador";
    tipoIdentificacion = "07";
  } else {
    clientName = customClientName;
    clientRuc = customClientRuc;
    clientEmail = customClientEmail;
    clientPhone = customClientPhone;
    clientAddress = customClientAddress;
    tipoIdentificacion = customClientRuc.length === 13 ? "04" : "05";
  }

  // Filter available products
  const filteredProducts = inventoryProducts.filter((p) => {
    if (!searchProductTerm.trim()) return true;
    const q = searchProductTerm.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
  });

  const handleAddItem = (product: (typeof inventoryProducts)[0]) => {
    // Check if already in items
    const existing = items.find((it) => it.productId === product.id);
    if (existing) {
      handleUpdateQuantity(existing.id, existing.quantity + 1);
      return;
    }

    const availableStock = product.tracksStock
      ? Number(product.stockByWarehouse?.[warehouseId] || 0)
      : 9999;

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
      warehouseId,
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
        return {
          ...it,
          quantity: newQty,
          subtotal,
          ivaAmount,
          total,
        };
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
        return {
          ...it,
          unitPrice: newPrice,
          subtotal,
          ivaAmount,
          total,
        };
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
        return {
          ...it,
          discount: newDiscount,
          subtotal,
          ivaAmount,
          total,
        };
      })
    );
  };

  const handleUpdateIvaRate = (itemId: string, newRate: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const ivaAmount = it.subtotal * (newRate / 100);
        const total = it.subtotal + ivaAmount;
        return {
          ...it,
          ivaRate: newRate,
          ivaAmount,
          total,
        };
      })
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  // Calculations
  const subtotal15 = items
    .filter((it) => it.ivaRate === 15)
    .reduce((sum, it) => sum + it.subtotal, 0);

  const subtotal0 = items
    .filter((it) => it.ivaRate === 0)
    .reduce((sum, it) => sum + it.subtotal, 0);

  const discountTotal = items.reduce((sum, it) => sum + (it.discount || 0), 0);
  const ivaTotal = items.reduce((sum, it) => sum + it.ivaAmount, 0);
  const total = subtotal15 + subtotal0 + ivaTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!clientName.trim() || !clientRuc.trim()) {
      setErrorMsg("Debe especificar los datos del cliente.");
      return;
    }

    if (items.length === 0) {
      setErrorMsg("Debe agregar al menos un producto o servicio a la factura.");
      return;
    }

    // Verify stock availability for physical items
    for (const it of items) {
      const prod = inventoryProducts.find((p) => p.id === it.productId);
      if (prod && prod.tracksStock) {
        const currentWhStock = Number(prod.stockByWarehouse?.[warehouseId] || 0);
        if (currentWhStock < it.quantity) {
          setErrorMsg(
            `Stock insuficiente de ${prod.name} en ${currentWarehouse?.name}. Disponible: ${currentWhStock}, Requerido: ${it.quantity}.`
          );
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const sriPaymentCode =
        paymentMethod === "efectivo"
          ? "01"
          : paymentMethod === "tarjeta"
          ? "19"
          : "20";

      const newInvoice = await createInvoice({
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
        clientId: clientMode === "registered" ? selectedClientId : "cli-custom",
        clientName,
        clientRuc,
        clientEmail: clientEmail || "facturacion@inntelcorp.com",
        clientPhone,
        clientAddress: clientAddress || "Ecuador",
        tipoIdentificacion,
        items,
        subtotal15,
        subtotal0,
        subtotalNoObjeto: 0,
        subtotalExento: 0,
        discountTotal,
        ivaTotal,
        total,
        paymentMethod,
        sriPaymentCode,
        paymentTermDays: paymentMethod === "credito" ? 30 : 0,
        status: "autorizada", // En ambiente de pruebas o producción autoriza directamente
        authorizationDate: new Date().toISOString(),
        warehouseId,
        warehouseName: currentWarehouse?.name || "Bodega Central",
        notes,
      });

      if (onSuccess) {
        onSuccess(newInvoice);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al emitir la factura electrónica.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#004ac6] flex items-center justify-center text-white shadow-md">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Punto de Venta / Emisión SRI
              </span>
              <h2 className="text-lg font-black text-white">
                Nueva Factura Electrónica (IVA 15%)
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

        {/* Contenido scrolleable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fila 1: Cliente & Bodega de Despacho */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Sección Cliente */}
            <div className="md:col-span-8 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#004ac6]" />
                  Comprador / Cliente
                </span>
                <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setClientMode("registered")}
                    className={`px-3 py-1 rounded-lg transition ${
                      clientMode === "registered"
                        ? "bg-white text-slate-900 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Registrado
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode("final")}
                    className={`px-3 py-1 rounded-lg transition ${
                      clientMode === "final"
                        ? "bg-white text-slate-900 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Consumidor Final
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode("custom")}
                    className={`px-3 py-1 rounded-lg transition ${
                      clientMode === "custom"
                        ? "bg-white text-slate-900 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Nuevo
                  </button>
                </div>
              </div>

              {clientMode === "registered" ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">Seleccionar Cliente:</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName} - {c.identificationNumber}
                      </option>
                    ))}
                  </select>
                </div>
              ) : clientMode === "final" ? (
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-900">CONSUMIDOR FINAL</p>
                  <p>R.U.C. / Cédula: 9999999999999</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Razón Social o Nombre *"
                    value={customClientName}
                    onChange={(e) => setCustomClientName(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="RUC o Cédula *"
                    value={customClientRuc}
                    onChange={(e) => setCustomClientRuc(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white"
                  />
                  <input
                    type="email"
                    placeholder="Correo Electrónico (para RIDE)"
                    value={customClientEmail}
                    onChange={(e) => setCustomClientEmail(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Teléfono"
                    value={customClientPhone}
                    onChange={(e) => setCustomClientPhone(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white"
                  />
                </div>
              )}
            </div>

            {/* Sección Bodega de Despacho & Pago */}
            <div className="md:col-span-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#004ac6]" />
                Bodega & Pago
              </span>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700">Bodega de Despacho:</label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2 bg-white text-slate-900"
                >
                  {inventoryWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700">Forma de Pago:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 p-2 bg-white text-slate-900"
                >
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="efectivo">Efectivo / Sin Sist. Financiero</option>
                  <option value="tarjeta">Tarjeta de Crédito / Débito</option>
                  <option value="credito">Crédito Comercial (30 Días)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fila 2: Selector Rápido de Productos & Carrito */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#004ac6]" />
                Ítems de la Venta
              </h3>

              {/* Buscador de catálogo rápido */}
              <div className="relative min-w-[280px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar producto o servicio para agregar..."
                  value={searchProductTerm}
                  onChange={(e) => setSearchProductTerm(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                />

                {searchProductTerm.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-56 overflow-y-auto z-20 divide-y divide-slate-100">
                    {filteredProducts.slice(0, 8).map((p) => {
                      const stockInWh = p.tracksStock ? (p.stockByWarehouse?.[warehouseId] || 0) : null;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleAddItem(p)}
                          className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{p.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              SKU: {p.sku} | PVP: ${p.salePrice.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            {p.tracksStock ? (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  (stockInWh || 0) > 0
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                Stock: {stockInWh} {p.unit}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#004ac6]">
                                Servicio
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Tabla de Carrito */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">Producto / Servicio</th>
                    <th className="py-2.5 px-2 text-center w-20">Cant.</th>
                    <th className="py-2.5 px-2 text-right w-24">Precio ($)</th>
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
                        No hay ítems en la factura. Busca y agrega productos del catálogo arriba.
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
                            step="1"
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
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
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

          {/* Fila 3: Observaciones y Resumen de Totales */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
            <div className="md:col-span-7 space-y-2">
              <label className="text-xs font-semibold text-slate-700">Observaciones en la Factura:</label>
              <textarea
                rows={3}
                placeholder="Observaciones adicionales, datos de despacho o guías..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white transition"
              />
            </div>

            <div className="md:col-span-5 p-4 rounded-2xl bg-slate-900 text-white space-y-2 shadow-md">
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
                <span>TOTAL A PAGAR:</span>
                <span className="text-xl font-mono text-emerald-400">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Pie del formulario con botón de emisión */}
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
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Emitiendo SRI...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Registrar Venta (SRI)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
