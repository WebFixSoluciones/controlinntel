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
  Calendar,
  FileText,
  Save,
} from "lucide-react";
import { useApp } from "@/lib/state";
import { InvoiceItem, SriInvoice } from "@/types";

interface EditSaleModalProps {
  isOpen: boolean;
  invoice: SriInvoice | null;
  onClose: () => void;
  onSuccess?: (invoice: SriInvoice) => void;
}

export function EditSaleModal({ isOpen, invoice, onClose, onSuccess }: EditSaleModalProps) {
  const {
    clients,
    inventoryWarehouses,
    inventoryProducts,
    bankAccounts,
    updateInvoice,
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
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [transferenciaRef, setTransferenciaRef] = useState<string>("");
  const [tarjetaRef, setTarjetaRef] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Search product picker
  const [searchProductTerm, setSearchProductTerm] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Initialize form when invoice is passed
  useEffect(() => {
    if (isOpen && invoice) {
      setErrorMsg("");
      setDate(invoice.date || new Date().toISOString().slice(0, 10));
      setNotes(invoice.notes || "");
      setPaymentMethod(invoice.paymentMethod || "transferencia");
      setBankAccountId(invoice.bankAccountId || (bankAccounts[0]?.id || ""));
      setTransferenciaRef(invoice.transferenciaRef || "");
      setTarjetaRef(invoice.tarjetaRef || "");
      setWarehouseId(invoice.warehouseId || inventoryWarehouses[0]?.id || "");

      // Determine client mode
      if (invoice.clientId === "cf-9999999999999" || invoice.clientRuc === "9999999999999") {
        setClientMode("final");
        setSelectedClientId("");
        setCustomClientName("");
        setCustomClientRuc("");
      } else {
        const found = clients.find((c) => c.id === invoice.clientId);
        if (found) {
          setClientMode("registered");
          setSelectedClientId(found.id);
          setCustomClientName("");
          setCustomClientRuc("");
        } else {
          setClientMode("custom");
          setSelectedClientId("");
          setCustomClientName(invoice.clientName || "");
          setCustomClientRuc(invoice.clientRuc || "");
          setCustomClientEmail(invoice.clientEmail || "");
          setCustomClientPhone(invoice.clientPhone || "");
          setCustomClientAddress(invoice.clientAddress || "");
        }
      }

      // Clone items
      setItems(
        (invoice.items || []).map((it) => ({
          ...it,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          discount: Number(it.discount) || 0,
          ivaRate: Number(it.ivaRate) || 0,
          subtotal: Number(it.subtotal) || 0,
          ivaAmount: Number(it.ivaAmount) || 0,
          total: Number(it.total) || 0,
        }))
      );
    }
  }, [isOpen, invoice, clients, inventoryWarehouses, bankAccounts]);

  if (!isOpen || !invoice) return null;

  const isNotaVenta = invoice.documentType === "nota_venta";
  const docTitle = isNotaVenta ? "Nota de Venta" : "Comprobante de Venta";

  // Filter products for search
  const filteredProducts = inventoryProducts.filter((p) => {
    if (!searchProductTerm.trim()) return false;
    const q = searchProductTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  });

  const handleAddItem = (product: (typeof inventoryProducts)[0]) => {
    const existing = items.find((it) => it.productId === product.id);
    if (existing) {
      handleUpdateQuantity(existing.id, existing.quantity + 1);
      setSearchProductTerm("");
      setShowProductDropdown(false);
      return;
    }

    const unitPrice = product.salePrice || 10;
    const ivaRate = isNotaVenta ? 0 : (product.ivaRate ?? 15);
    const quantity = 1;
    const discount = 0;
    const subtotal = Math.round((unitPrice * quantity - discount) * 100) / 100;
    const ivaAmount = Math.round(subtotal * (ivaRate / 100) * 100) / 100;
    const total = Math.round((subtotal + ivaAmount) * 100) / 100;

    const newItem: InvoiceItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description || product.name,
      unit: product.unit || "unidad",
      quantity,
      unitPrice,
      discount,
      ivaRate,
      subtotal,
      ivaAmount,
      total,
      warehouseId: warehouseId || invoice.warehouseId,
    };

    setItems((prev) => [...prev, newItem]);
    setSearchProductTerm("");
    setShowProductDropdown(false);
  };

  const handleAddManualItem = () => {
    const defaultPrice = 10;
    const ivaRate = isNotaVenta ? 0 : 15;
    const quantity = 1;
    const discount = 0;
    const subtotal = Math.round((defaultPrice * quantity - discount) * 100) / 100;
    const ivaAmount = Math.round(subtotal * (ivaRate / 100) * 100) / 100;
    const total = Math.round((subtotal + ivaAmount) * 100) / 100;

    const newItem: InvoiceItem = {
      id: `item-manual-${Date.now()}`,
      productId: `manual-${Date.now()}`,
      sku: `SRV-${Date.now().toString().slice(-4)}`,
      name: "Servicio / Ítem Personalizado",
      description: "Detalle del servicio o producto",
      unit: "servicio",
      quantity,
      unitPrice: defaultPrice,
      discount,
      ivaRate,
      subtotal,
      ivaAmount,
      total,
      warehouseId: warehouseId || invoice.warehouseId,
    };

    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const subtotal = Math.round((it.unitPrice * newQty - (it.discount || 0)) * 100) / 100;
        const ivaAmount = Math.round(subtotal * (it.ivaRate / 100) * 100) / 100;
        const total = Math.round((subtotal + ivaAmount) * 100) / 100;
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
    const validPrice = Math.max(0, isNaN(newPrice) ? 0 : newPrice);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const subtotal = Math.max(0, Math.round((validPrice * it.quantity - (it.discount || 0)) * 100) / 100);
        const ivaAmount = Math.round(subtotal * (it.ivaRate / 100) * 100) / 100;
        const total = Math.round((subtotal + ivaAmount) * 100) / 100;
        return {
          ...it,
          unitPrice: validPrice,
          subtotal,
          ivaAmount,
          total,
        };
      })
    );
  };

  const handleUpdateDiscount = (itemId: string, newDiscount: number) => {
    const validDiscount = Math.max(0, isNaN(newDiscount) ? 0 : newDiscount);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const subtotal = Math.max(0, Math.round((it.unitPrice * it.quantity - validDiscount) * 100) / 100);
        const ivaAmount = Math.round(subtotal * (it.ivaRate / 100) * 100) / 100;
        const total = Math.round((subtotal + ivaAmount) * 100) / 100;
        return {
          ...it,
          discount: validDiscount,
          subtotal,
          ivaAmount,
          total,
        };
      })
    );
  };

  const handleUpdateDescription = (itemId: string, newName: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return { ...it, name: newName, description: newName };
      })
    );
  };

  const handleUpdateIvaRate = (itemId: string, newRate: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const ivaAmount = Math.round(it.subtotal * (newRate / 100) * 100) / 100;
        const total = Math.round((it.subtotal + ivaAmount) * 100) / 100;
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
  const subtotal15 = Math.round(
    items.filter((it) => it.ivaRate === 15).reduce((sum, it) => sum + it.subtotal, 0) * 100
  ) / 100;

  const subtotal0 = Math.round(
    items.filter((it) => it.ivaRate === 0).reduce((sum, it) => sum + it.subtotal, 0) * 100
  ) / 100;

  const discountTotal = Math.round(
    items.reduce((sum, it) => sum + (it.discount || 0), 0) * 100
  ) / 100;

  const ivaTotal = Math.round(
    items.reduce((sum, it) => sum + it.ivaAmount, 0) * 100
  ) / 100;

  const total = Math.round((subtotal15 + subtotal0 + ivaTotal) * 100) / 100;

  // Resolve client data
  let finalClientName = invoice.clientName;
  let finalClientRuc = invoice.clientRuc;
  let finalClientEmail = invoice.clientEmail;
  let finalClientPhone = invoice.clientPhone || "";
  let finalClientAddress = invoice.clientAddress || "";
  let finalClientId = invoice.clientId;
  let finalTipoIdentificacion = invoice.tipoIdentificacion;

  if (clientMode === "registered") {
    const cl = clients.find((c) => c.id === selectedClientId);
    if (cl) {
      finalClientId = cl.id;
      finalClientName = cl.businessName || cl.legalRepresentative || "Cliente";
      finalClientRuc = cl.identificationNumber || "";
      finalClientEmail = cl.email || "";
      finalClientPhone = cl.phone || "";
      finalClientAddress = cl.address || "";
      finalTipoIdentificacion = cl.identificationNumber?.length === 13 ? "04" : "05";
    }
  } else if (clientMode === "final") {
    finalClientId = "cf-9999999999999";
    finalClientName = "CONSUMIDOR FINAL";
    finalClientRuc = "9999999999999";
    finalClientEmail = "consumidorfinal@inntelcorp.com";
    finalClientPhone = "0999999999";
    finalClientAddress = "Quito, Ecuador";
    finalTipoIdentificacion = "07";
  } else {
    finalClientId = "cli-custom";
    finalClientName = customClientName;
    finalClientRuc = customClientRuc;
    finalClientEmail = customClientEmail;
    finalClientPhone = customClientPhone;
    finalClientAddress = customClientAddress;
    finalTipoIdentificacion = customClientRuc.length === 13 ? "04" : "05";
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!finalClientName.trim() || !finalClientRuc.trim()) {
      setErrorMsg("Debe especificar la información del cliente.");
      return;
    }

    if (items.length === 0) {
      setErrorMsg("El comprobante debe contener al menos un producto o servicio.");
      return;
    }

    // Verify stock availability if items or quantities increased
    for (const it of items) {
      if (it.productId) {
        const prod = inventoryProducts.find((p) => p.id === it.productId);
        if (prod && prod.tracksStock && prod.type !== "servicio") {
          const oldItem = invoice.items?.find((old) => old.productId === it.productId);
          const oldQty = oldItem ? Math.abs(oldItem.quantity) : 0;
          const delta = it.quantity - oldQty;
          if (delta > 0) {
            const whStock = Number(prod.stockByWarehouse?.[warehouseId || invoice.warehouseId] || 0);
            if (whStock < delta) {
              setErrorMsg(
                `Stock insuficiente para '${prod.name}'. Disponible en bodega: ${whStock}, adicional solicitado: ${delta}.`
              );
              return;
            }
          }
        }
      }
    }

    setIsSubmitting(true);
    try {
      const selectedWh = inventoryWarehouses.find((w) => w.id === warehouseId) || inventoryWarehouses[0];

      const updated = await updateInvoice(invoice.id, {
        clientName: finalClientName,
        clientRuc: finalClientRuc,
        clientEmail: finalClientEmail,
        clientPhone: finalClientPhone,
        clientAddress: finalClientAddress,
        clientId: finalClientId,
        tipoIdentificacion: finalTipoIdentificacion,
        warehouseId: warehouseId || invoice.warehouseId,
        warehouseName: selectedWh ? selectedWh.name : invoice.warehouseName,
        paymentMethod,
        bankAccountId: paymentMethod === "transferencia" || paymentMethod === "tarjeta" ? bankAccountId : undefined,
        transferenciaRef: paymentMethod === "transferencia" ? transferenciaRef : undefined,
        tarjetaRef: paymentMethod === "tarjeta" ? tarjetaRef : undefined,
        date: date || invoice.date,
        notes,
        items,
        subtotal15,
        subtotal0,
        subtotalNoObjeto: 0,
        subtotalExento: 0,
        discountTotal,
        ivaTotal,
        total,
      });

      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Ocurrió un error al actualizar la venta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[6px] bg-[#004ac6] text-white">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold leading-tight">
                  Editar {docTitle}
                </h2>
                <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  {invoice.documentNumber}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium capitalize ${
                    invoice.status === "autorizada" || invoice.status === "emitida"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                  }`}
                >
                  {invoice.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Modifica precios, cantidades, ítems o datos del cliente. Los saldos e inventarios se recalcularán automáticamente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section: Client & General Info */}
          <div className="bg-slate-50 p-4 rounded-[6px] border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-500" />
                Información del Cliente y Emisión
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setClientMode("registered")}
                  className={`px-2.5 py-1 text-xs rounded-[4px] font-medium transition cursor-pointer ${
                    clientMode === "registered"
                      ? "bg-[#004ac6] text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Registrado
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode("final")}
                  className={`px-2.5 py-1 text-xs rounded-[4px] font-medium transition cursor-pointer ${
                    clientMode === "final"
                      ? "bg-[#004ac6] text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Consumidor Final
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode("custom")}
                  className={`px-2.5 py-1 text-xs rounded-[4px] font-medium transition cursor-pointer ${
                    clientMode === "custom"
                      ? "bg-[#004ac6] text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Manual / Ocasional
                </button>
              </div>
            </div>

            {/* Client Inputs */}
            {clientMode === "registered" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Seleccionar Cliente
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName || c.legalRepresentative} ({c.identificationNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-slate-600 flex flex-col justify-center bg-white p-2.5 rounded-[6px] border border-slate-200">
                  <p className="font-semibold text-slate-800">{finalClientName}</p>
                  <p>RUC / CI: {finalClientRuc} | {finalClientEmail}</p>
                </div>
              </div>
            )}

            {clientMode === "custom" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nombre / Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={customClientName}
                    onChange={(e) => setCustomClientName(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                    placeholder="Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    RUC / Cédula *
                  </label>
                  <input
                    type="text"
                    required
                    value={customClientRuc}
                    onChange={(e) => setCustomClientRuc(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                    placeholder="1790000000001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={customClientEmail}
                    onChange={(e) => setCustomClientEmail(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                    placeholder="cliente@ejemplo.com"
                  />
                </div>
              </div>
            )}

            {clientMode === "final" && (
              <div className="text-xs text-slate-600 bg-white p-2.5 rounded-[6px] border border-slate-200">
                <span className="font-semibold text-slate-800">CONSUMIDOR FINAL</span> (RUC: 9999999999999)
              </div>
            )}

            {/* Warehouse & Date row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Bodega de Despacho
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                >
                  {inventoryWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Fecha de Emisión
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-[6px] px-3 py-2 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                />
              </div>
            </div>
          </div>

          {/* Section: Items Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-slate-500" />
                Detalle de Productos y Servicios
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search Product Input */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchProductTerm}
                    onChange={(e) => {
                      setSearchProductTerm(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Buscar producto o SKU..."
                    className="w-full text-xs bg-white border border-slate-300 rounded-[6px] pl-8 pr-3 py-1.5 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                  />
                  {showProductDropdown && filteredProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-[6px] shadow-lg max-h-48 overflow-y-auto z-20">
                      {filteredProducts.map((p) => {
                        const available = Number(p.stockByWarehouse?.[warehouseId || invoice.warehouseId] || 0);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleAddItem(p)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs border-b border-slate-100 flex items-center justify-between cursor-pointer"
                          >
                            <div>
                              <span className="font-medium text-slate-800">{p.name}</span>
                              <span className="text-[10px] text-slate-400 block">SKU: {p.sku || "N/A"}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold text-slate-700">${(p.salePrice || 0).toFixed(2)}</span>
                              <span className="text-[10px] text-slate-400 block">Disp: {available}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddManualItem}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-[6px] transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Línea Manual
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200/80 rounded-[6px] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-3 font-semibold">Descripción / Producto</th>
                    <th className="py-2 px-2 font-semibold text-center w-20">Cant.</th>
                    <th className="py-2 px-2 font-semibold text-right w-24">Precio Unit.</th>
                    <th className="py-2 px-2 font-semibold text-right w-20">Desc. ($)</th>
                    <th className="py-2 px-2 font-semibold text-center w-20">IVA</th>
                    <th className="py-2 px-3 font-semibold text-right w-24">Total</th>
                    <th className="py-2 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        No hay ítems registrados. Busca un producto o agrega una línea manual.
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={it.name}
                            onChange={(e) => handleUpdateDescription(it.id, e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-[#004ac6] focus:bg-white px-1 py-0.5 rounded-[2px] text-xs font-medium text-slate-800"
                          />
                          {it.sku && (
                            <span className="text-[10px] text-slate-400 px-1">SKU: {it.sku}</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={it.quantity}
                            onChange={(e) => handleUpdateQuantity(it.id, parseFloat(e.target.value) || 1)}
                            className="w-16 text-center bg-white border border-slate-300 rounded-[4px] px-1 py-1 text-xs focus:outline-none focus:border-[#004ac6]"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="relative inline-block w-20">
                            <span className="absolute left-1.5 top-1 text-slate-400 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.unitPrice}
                              onChange={(e) => handleUpdatePrice(it.id, parseFloat(e.target.value) || 0)}
                              className="w-full text-right bg-white border border-slate-300 rounded-[4px] pl-4 pr-1 py-1 text-xs font-mono focus:outline-none focus:border-[#004ac6]"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.discount || 0}
                            onChange={(e) => handleUpdateDiscount(it.id, parseFloat(e.target.value) || 0)}
                            className="w-16 text-right bg-white border border-slate-300 rounded-[4px] px-1 py-1 text-xs font-mono focus:outline-none focus:border-[#004ac6]"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <select
                            value={it.ivaRate}
                            onChange={(e) => handleUpdateIvaRate(it.id, parseInt(e.target.value, 10))}
                            className="bg-white border border-slate-300 rounded-[4px] px-1 py-1 text-xs text-slate-700 focus:outline-none focus:border-[#004ac6]"
                          >
                            <option value={0}>0%</option>
                            <option value={15}>15%</option>
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right font-semibold font-mono text-slate-800">
                          ${it.total.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="p-1 rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Quitar ítem"
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

          {/* Section: Payment Method, Notes & Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Left: Payment Method & Notes */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Método de Pago
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["transferencia", "efectivo", "tarjeta", "credito"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`px-3 py-2 rounded-[6px] text-xs font-medium capitalize border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMethod === m
                          ? "bg-blue-50 border-[#004ac6] text-[#004ac6]"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {(paymentMethod === "transferencia" || paymentMethod === "tarjeta") && (
                <div className="space-y-2 bg-slate-50 p-3 rounded-[6px] border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Cuenta Bancaria de Destino
                    </label>
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-[6px] px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                    >
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - {b.accountNumber} ({b.accountType})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Nro. de Referencia / Comprobante
                    </label>
                    <input
                      type="text"
                      value={paymentMethod === "transferencia" ? transferenciaRef : tarjetaRef}
                      onChange={(e) =>
                        paymentMethod === "transferencia"
                          ? setTransferenciaRef(e.target.value)
                          : setTarjetaRef(e.target.value)
                      }
                      placeholder="Ej. DEP-9823412"
                      className="w-full text-xs bg-white border border-slate-300 rounded-[6px] px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Notas / Observaciones
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalles adicionales, referencias de entrega..."
                  className="w-full text-xs bg-white border border-slate-300 rounded-[6px] p-2 text-slate-800 focus:outline-none focus:border-[#004ac6]"
                />
              </div>
            </div>

            {/* Right: Summary Card */}
            <div className="bg-slate-50 rounded-[6px] border border-slate-200 p-4 space-y-2.5 h-fit">
              <span className="text-xs font-semibold text-slate-800 block border-b border-slate-200 pb-1.5">
                Resumen de Valores
              </span>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal 15%:</span>
                <span className="font-mono font-medium">${subtotal15.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Subtotal 0%:</span>
                <span className="font-mono font-medium">${subtotal0.toFixed(2)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-xs text-rose-600">
                  <span>Descuento:</span>
                  <span className="font-mono font-medium">-${discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-slate-600">
                <span>IVA 15%:</span>
                <span className="font-mono font-medium">${ivaTotal.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-300 pt-2 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900">Total a Pagar:</span>
                <span className="text-lg font-bold font-mono text-[#004ac6]">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-[6px] border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-[6px] bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-medium transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? "Guardando Cambios..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
