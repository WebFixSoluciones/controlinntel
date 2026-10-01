"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Receipt,
  User,
  Layers,
  Package,
  Search,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Building2,
  CreditCard,
  Plus,
} from "lucide-react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { InvoiceItem, SriInvoice, InventoryProduct } from "@/types";

interface NewSaleViewProps {
  onBack: () => void;
  onSuccess?: (invoice: SriInvoice) => void;
}

export function NewSaleView({ onBack, onSuccess }: NewSaleViewProps) {
  const {
    clients,
    inventoryWarehouses,
    inventoryProducts,
    createInvoice,
    sriCompanyConfig,
  } = useApp();
  const { showSuccess, showError } = useToast();

  const [clientMode, setClientMode] = useState<"registered" | "final" | "custom">("registered");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");
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

  // Product search
  const [searchProductTerm, setSearchProductTerm] = useState("");

  // Initialize defaults
  useEffect(() => {
    if (clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
    if (inventoryWarehouses.length > 0 && !warehouseId) {
      setWarehouseId(inventoryWarehouses[0].id);
    }
  }, [clients, inventoryWarehouses, selectedClientId, warehouseId]);

  const currentWarehouse = inventoryWarehouses.find((w) => w.id === warehouseId) || inventoryWarehouses[0];

  // Resolve client info
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

  // Filtered clients for selector
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(
      (c) =>
        c.businessName.toLowerCase().includes(q) ||
        c.identificationNumber.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [clients, clientSearch]);

  // Filtered products for quick adder
  const filteredProducts = useMemo(() => {
    if (!searchProductTerm.trim()) return [];
    const q = searchProductTerm.toLowerCase();
    return inventoryProducts.filter(
      (p) =>
        p.status === "activo" &&
        (p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q)))
    );
  }, [inventoryProducts, searchProductTerm]);

  // Item helpers
  const handleAddItem = (prod: InventoryProduct) => {
    const existingIndex = items.findIndex((it) => it.productId === prod.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      const cur = updated[existingIndex];
      const newQty = cur.quantity + 1;
      const sub = newQty * cur.unitPrice - (cur.discount || 0);
      const iva = cur.ivaRate === 15 ? sub * 0.15 : 0;
      updated[existingIndex] = {
        ...cur,
        quantity: newQty,
        subtotal: sub,
        ivaAmount: iva,
        total: sub + iva,
      };
      setItems(updated);
    } else {
      const unitPrice = prod.salePrice || 0;
      const sub = unitPrice;
      const ivaRate = prod.ivaRate ?? 15;
      const iva = (sub * ivaRate) / 100;
      const newItem: InvoiceItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productId: prod.id,
        sku: prod.sku,
        name: prod.name,
        description: prod.description,
        unit: prod.unit || "UND",
        quantity: 1,
        unitPrice,
        discount: 0,
        subtotal: sub,
        ivaRate,
        ivaAmount: iva,
        total: sub + iva,
        warehouseId,
      };
      setItems([...items, newItem]);
    }
    setSearchProductTerm("");
    setErrorMsg("");
  };

  const handleUpdateQuantity = (id: string, qty: number) => {
    if (qty <= 0) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const sub = qty * it.unitPrice - (it.discount || 0);
        const iva = it.ivaRate === 15 ? sub * 0.15 : 0;
        return { ...it, quantity: qty, subtotal: sub, ivaAmount: iva, total: sub + iva };
      })
    );
  };

  const handleUpdatePrice = (id: string, price: number) => {
    if (price < 0) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const sub = it.quantity * price - (it.discount || 0);
        const iva = it.ivaRate === 15 ? sub * 0.15 : 0;
        return { ...it, unitPrice: price, subtotal: sub, ivaAmount: iva, total: sub + iva };
      })
    );
  };

  const handleUpdateDiscount = (id: string, disc: number) => {
    if (disc < 0) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const sub = it.quantity * it.unitPrice - disc;
        const iva = it.ivaRate === 15 ? sub * 0.15 : 0;
        return { ...it, discount: disc, subtotal: sub, ivaAmount: iva, total: sub + iva };
      })
    );
  };

  const handleUpdateIvaRate = (id: string, rate: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const sub = it.quantity * it.unitPrice - (it.discount || 0);
        const iva = rate === 15 ? sub * 0.15 : 0;
        return { ...it, ivaRate: rate, subtotal: sub, ivaAmount: iva, total: sub + iva };
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Totals
  const subtotal15 = items
    .filter((it) => it.ivaRate === 15)
    .reduce((sum, it) => sum + (it.quantity * it.unitPrice - (it.discount || 0)), 0);

  const subtotal0 = items
    .filter((it) => it.ivaRate === 0)
    .reduce((sum, it) => sum + (it.quantity * it.unitPrice - (it.discount || 0)), 0);

  const discountTotal = items.reduce((sum, it) => sum + (it.discount || 0), 0);
  const ivaTotal = items.reduce((sum, it) => sum + it.ivaAmount, 0);
  const total = subtotal15 + subtotal0 + ivaTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!clientName.trim() || !clientRuc.trim()) {
      setErrorMsg("Debe especificar los datos completos del cliente.");
      return;
    }

    if (items.length === 0) {
      setErrorMsg("Debe agregar al menos un producto o servicio a la factura.");
      return;
    }

    // Verify stock availability
    for (const it of items) {
      const prod = inventoryProducts.find((p) => p.id === it.productId);
      if (prod && prod.tracksStock) {
        const currentWhStock = Number(prod.stockByWarehouse?.[warehouseId] || 0);
        if (currentWhStock < it.quantity) {
          setErrorMsg(
            `Stock insuficiente de "${prod.name}" en ${currentWarehouse?.name || "la bodega seleccionada"}. Disponible: ${currentWhStock}, Requerido: ${it.quantity}.`
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
        status: "autorizada",
        authorizationDate: new Date().toISOString(),
        warehouseId,
        warehouseName: currentWarehouse?.name || "Bodega Central",
        notes,
      });

      showSuccess(
        "Factura Emitida con Éxito",
        `Comprobante ${newInvoice.documentNumber} autorizado por el SRI.`
      );

      if (onSuccess) {
        onSuccess(newInvoice);
      }
      onBack();
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al emitir la factura electrónica.");
      showError("Error de Facturación", err?.message || "No se pudo emitir la factura.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
            title="Volver a Historial de Ventas"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
              IVA Vigente: 15%
            </span>
            <span className="text-xs font-bold text-[#434655]">Ítems:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#eff4ff] text-[#004ac6] border border-[#bfdbfe]">
              {items.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || items.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 shadow-2xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Main Screen Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Row 1: Comprador / Cliente & Bodega / Forma de Pago */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Cliente Card */}
          <div className="lg:col-span-8 p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4 text-[#004ac6]" />
                Datos del Comprador / Cliente
              </span>
              <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setClientMode("registered")}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    clientMode === "registered"
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cliente Registrado
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode("final")}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
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
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    clientMode === "custom"
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cliente Ocasional
                </button>
              </div>
            </div>

            {clientMode === "registered" ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filtrar por nombre, razón social o RUC/Cédula..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Seleccionar Cliente:</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
                  >
                    {filteredClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName} ({c.identificationNumber}) - {c.email || "Sin email"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Info preview */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                  <span><strong>RUC/Cédula:</strong> {clientRuc}</span>
                  <span><strong>Email RIDE:</strong> {clientEmail || "No registrado"}</span>
                  <span><strong>Teléfono:</strong> {clientPhone || "N/A"}</span>
                </div>
              </div>
            ) : clientMode === "final" ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <p className="font-bold text-slate-900 text-sm">CONSUMIDOR FINAL</p>
                <p><strong>Identificación:</strong> 9999999999999</p>
                <p className="text-slate-500">Aplica para ventas de mostrador sin requerimiento de crédito tributario fiscal.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Razón Social o Nombre Completo *</label>
                  <input
                    type="text"
                    placeholder="ej. EMPRESA SERVICIOS CIA. LTDA."
                    value={customClientName}
                    onChange={(e) => setCustomClientName(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">RUC o Cédula *</label>
                  <input
                    type="text"
                    placeholder="1792458921001"
                    value={customClientRuc}
                    onChange={(e) => setCustomClientRuc(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Correo Electrónico (para RIDE)</label>
                  <input
                    type="email"
                    placeholder="facturacion@empresa.com"
                    value={customClientEmail}
                    onChange={(e) => setCustomClientEmail(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Teléfono</label>
                  <input
                    type="text"
                    placeholder="0991234567"
                    value={customClientPhone}
                    onChange={(e) => setCustomClientPhone(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Dirección</label>
                  <input
                    type="text"
                    placeholder="Av. Amazonas y Colón"
                    value={customClientAddress}
                    onChange={(e) => setCustomClientAddress(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bodega & Parámetros de Pago Card */}
          <div className="lg:col-span-4 p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card space-y-4">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-slate-100">
              <Layers className="w-4 h-4 text-[#004ac6]" />
              Bodega & Parámetros
            </span>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Bodega de Despacho:</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
              >
                {inventoryWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Forma de Pago SRI:</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
              >
                <option value="transferencia">Transferencia Bancaria (20)</option>
                <option value="efectivo">Efectivo / Sin Sistema Financiero (01)</option>
                <option value="tarjeta">Tarjeta de Crédito / Débito (19)</option>
                <option value="credito">Crédito Comercial (30 Días)</option>
              </select>
            </div>

            <div className="p-3 bg-[#f8f9ff] rounded-xl border border-[#dce9ff] text-[11px] text-[#434655] space-y-1">
              <p><strong>Emisor:</strong> {sriCompanyConfig.razonSocial}</p>
              <p><strong>Establecimiento:</strong> 001 - 001</p>
            </div>
          </div>
        </div>

        {/* Row 2: Ítems y Carrito de Facturación */}
        <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#004ac6]" />
              Detalle de Productos & Servicios ({items.length})
            </h3>

            {/* Quick Product Search */}
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar producto o servicio para agregar..."
                value={searchProductTerm}
                onChange={(e) => setSearchProductTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
              />

              {searchProductTerm.trim() && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto z-20 divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No se encontraron productos con "{searchProductTerm}".
                    </div>
                  ) : (
                    filteredProducts.slice(0, 8).map((p) => {
                      const stockInWh = p.tracksStock ? (p.stockByWarehouse?.[warehouseId] || 0) : null;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleAddItem(p)}
                          className="p-3 hover:bg-[#f8f9ff] cursor-pointer flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{p.name}</p>
                            <p className="text-[11px] text-slate-500 font-mono">
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
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabla de Ítems */}
          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f8f9ff] text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Producto / Servicio</th>
                  <th className="py-3 px-3 text-center w-24">Cantidad</th>
                  <th className="py-3 px-3 text-right w-28">Precio ($)</th>
                  <th className="py-3 px-3 text-right w-24">Desc. ($)</th>
                  <th className="py-3 px-3 text-center w-24">Tarifa IVA</th>
                  <th className="py-3 px-4 text-right w-28">Subtotal ($)</th>
                  <th className="py-3 px-3 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      No hay ítems agregados a la factura. Escribe en el buscador de arriba para añadir productos o servicios.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4">
                        <p className="font-bold text-slate-900">{it.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">SKU: {it.sku}</p>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={it.quantity}
                          onChange={(e) => handleUpdateQuantity(it.id, parseFloat(e.target.value) || 1)}
                          className="w-16 text-center text-xs font-bold rounded-lg border border-slate-300 p-1"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.unitPrice}
                          onChange={(e) => handleUpdatePrice(it.id, parseFloat(e.target.value) || 0)}
                          className="w-20 text-right text-xs font-mono font-semibold rounded-lg border border-slate-300 p-1"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.discount || 0}
                          onChange={(e) => handleUpdateDiscount(it.id, parseFloat(e.target.value) || 0)}
                          className="w-16 text-right text-xs font-mono rounded-lg border border-slate-300 p-1 text-slate-600"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <select
                          value={it.ivaRate}
                          onChange={(e) => handleUpdateIvaRate(it.id, parseInt(e.target.value, 10))}
                          className="text-xs font-bold rounded-lg border border-slate-300 p-1 bg-white cursor-pointer"
                        >
                          <option value={15}>15%</option>
                          <option value={0}>0%</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        ${it.subtotal.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Eliminar ítem"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Row 3: Observaciones y Totales */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card space-y-2">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Observaciones del Comprobante:
            </label>
            <textarea
              rows={4}
              placeholder="Información adicional para la factura, dirección de entrega, número de orden de compra o referencias..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 p-3 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition"
            />
          </div>

          <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900 text-white space-y-2.5 shadow-md">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block pb-2 border-b border-slate-800">
              Liquidación Fiscal SRI
            </span>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Subtotal Tarifa 15%:</span>
              <span className="font-mono">${subtotal15.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-300">
              <span>Subtotal Tarifa 0%:</span>
              <span className="font-mono">${subtotal0.toFixed(2)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-xs text-amber-300">
                <span>Descuento Total:</span>
                <span className="font-mono">-${discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-sky-300">
              <span>IVA 15% (Ecuador):</span>
              <span className="font-mono font-bold">${ivaTotal.toFixed(2)}</span>
            </div>
            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-black">
              <span>TOTAL A PAGAR:</span>
              <span className="text-2xl font-mono text-emerald-400">${total.toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancelar y Volver
          </button>

          <button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white text-xs font-bold shadow-md transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Emitiendo Comprobante SRI...</span>
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
  );
}
