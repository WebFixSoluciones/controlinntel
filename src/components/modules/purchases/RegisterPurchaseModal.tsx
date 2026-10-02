"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { parseSupplierSriXml } from "@/lib/purchases-service";
import {
  UploadCloud,
  FileText,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Building2,
  Boxes,
  CreditCard,
  Calendar,
  X,
} from "lucide-react";
import { PurchaseItem, PurchasePaymentCondition } from "@/types";

interface RegisterPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RegisterPurchaseModal({
  isOpen,
  onClose,
  onSuccess,
}: RegisterPurchaseModalProps) {
  const {
    suppliers,
    inventoryProducts,
    inventoryWarehouses,
    bankAccounts,
    addPurchaseInvoice,
    currentUser,
  } = useApp();
  const { showSuccess, showError, showWarning } = useToast();

  const [mode, setMode] = useState<"xml" | "manual">("xml");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // XML File and parsed state
  const [xmlFileName, setXmlFileName] = useState<string>("");
  const [xmlContent, setXmlContent] = useState<string>("");

  // Common Header State
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierName, setSupplierName] = useState<string>("");
  const [supplierRuc, setSupplierRuc] = useState<string>("");
  const [documentNumber, setDocumentNumber] = useState<string>("");
  const [claveAcceso, setClaveAcceso] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>(
    inventoryWarehouses[0]?.id || "bod-central"
  );

  // Payment State
  const [paymentCondition, setPaymentCondition] =
    useState<PurchasePaymentCondition>("contado");
  const [bankAccountId, setBankAccountId] = useState<string>(
    bankAccounts[0]?.id || ""
  );
  const [paymentMethod, setPaymentMethod] = useState<string>("transferencia");
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState<string>("");

  // Items State
  const [items, setItems] = useState<
    (PurchaseItem & { autoMatched?: boolean })[]
  >([]);

  if (!isOpen) return null;

  // Handle supplier change from dropdown
  const handleSelectSupplier = (selectedId: string) => {
    setSupplierId(selectedId);
    const found = suppliers.find((s) => s.id === selectedId);
    if (found) {
      setSupplierName(found.razonSocial);
      setSupplierRuc(found.ruc);
      if (found.creditDaysDefault > 0) {
        setPaymentCondition("credito");
        const d = new Date(purchaseDate);
        d.setDate(d.getDate() + found.creditDaysDefault);
        setDueDate(d.toISOString().slice(0, 10));
      }
    }
  };

  // Handle XML File Upload & Parsing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xml")) {
      showError("Archivo Inválido", "Por favor sube un archivo XML oficial emitido por el SRI.");
      return;
    }

    setXmlFileName(file.name);
    try {
      const text = await file.text();
      setXmlContent(text);

      const parsed = parseSupplierSriXml(text);
      if (!parsed.isValid) {
        showError("XML Inválido", parsed.error || "No se pudo leer la estructura del comprobante.");
        return;
      }

      setSupplierRuc(parsed.supplierRuc);
      setSupplierName(parsed.supplierRazonSocial);
      setDocumentNumber(parsed.documentNumber);
      setClaveAcceso(parsed.claveAcceso);
      if (parsed.date) setPurchaseDate(parsed.date);

      // Check if supplier already exists
      const existingSup = suppliers.find(
        (s) => s.ruc === parsed.supplierRuc || s.razonSocial.toLowerCase() === parsed.supplierRazonSocial.toLowerCase()
      );
      if (existingSup) {
        setSupplierId(existingSup.id);
      }

      // Map items and auto-match with inventoryProducts
      const mappedItems: PurchaseItem[] = parsed.items.map((it, idx) => {
        const matchedProd = inventoryProducts.find(
          (p) =>
            p.sku.toLowerCase() === it.sku.toLowerCase() ||
            p.name.toLowerCase().includes(it.name.toLowerCase()) ||
            it.name.toLowerCase().includes(p.name.toLowerCase())
        );

        return {
          id: `item-${idx + 1}-${Date.now()}`,
          productId: matchedProd ? matchedProd.id : undefined,
          sku: matchedProd ? matchedProd.sku : it.sku,
          name: it.name,
          quantity: it.quantity,
          unitCost: it.unitCost,
          discount: it.discount,
          ivaRate: it.ivaRate,
          subtotal: it.subtotal,
          ivaAmount: it.ivaAmount,
          total: it.total,
          warehouseId: defaultWarehouseId,
        };
      });

      setItems(mappedItems);
      showSuccess(
        "XML Procesado",
        `Factura ${parsed.documentNumber} de ${parsed.supplierRazonSocial} cargada (${mappedItems.length} ítems).`
      );
    } catch (err: any) {
      showError("Error de Lectura", "No se pudo procesar el archivo XML del SRI.");
    }
  };

  // Manual Item Handling
  const handleAddManualItem = () => {
    const newItem: PurchaseItem = {
      id: `man-item-${Date.now()}-${items.length + 1}`,
      name: "",
      quantity: 1,
      unitCost: 0,
      discount: 0,
      ivaRate: 15,
      subtotal: 0,
      ivaAmount: 0,
      total: 0,
      warehouseId: defaultWarehouseId,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (
    index: number,
    field: keyof PurchaseItem,
    value: any
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // If productId changed, populate SKU and default cost/name
      if (field === "productId") {
        const prod = inventoryProducts.find((p) => p.id === value);
        if (prod) {
          item.name = prod.name;
          item.sku = prod.sku;
          item.unitCost = prod.baseCost || 0;
          item.ivaRate = prod.ivaRate || 15;
        }
      }

      // Recalculate item totals
      const qty = Math.max(0, Number(item.quantity) || 0);
      const cost = Math.max(0, Number(item.unitCost) || 0);
      const disc = Math.max(0, Number(item.discount) || 0);
      const subtotal = Math.max(0, qty * cost - disc);
      const iva = Math.round((subtotal * ((item.ivaRate || 0) / 100)) * 100) / 100;
      const total = Math.round((subtotal + iva) * 100) / 100;

      item.subtotal = Math.round(subtotal * 100) / 100;
      item.ivaAmount = iva;
      item.total = total;

      updated[index] = item;
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal15 = Math.round(
    items
      .filter((i) => i.ivaRate > 0)
      .reduce((sum, i) => sum + i.subtotal, 0) * 100
  ) / 100;

  const subtotal0 = Math.round(
    items
      .filter((i) => i.ivaRate === 0)
      .reduce((sum, i) => sum + i.subtotal, 0) * 100
  ) / 100;

  const subtotal = Math.round((subtotal15 + subtotal0) * 100) / 100;
  const totalIva = Math.round(
    items.reduce((sum, i) => sum + i.ivaAmount, 0) * 100
  ) / 100;
  const grandTotal = Math.round((subtotal + totalIva) * 100) / 100;

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName.trim()) {
      showError("Datos Incompletos", "Por favor ingresa la Razón Social del proveedor.");
      return;
    }
    if (!supplierRuc.trim() || supplierRuc.length < 10) {
      showError("RUC Inválido", "Ingresa un RUC o Cédula válido del proveedor.");
      return;
    }
    if (!documentNumber.trim()) {
      showError("Número Requerido", "Ingresa el número de comprobante (ej. 001-002-000012345).");
      return;
    }
    if (items.length === 0) {
      showError("Sin Ítems", "Debes registrar al menos un producto o servicio en la compra.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addPurchaseInvoice({
        supplierId: supplierId || `prov-quick-${Date.now()}`,
        supplierName: supplierName.trim(),
        supplierRuc: supplierRuc.trim(),
        documentNumber: documentNumber.trim(),
        claveAcceso: claveAcceso.trim() || undefined,
        date: purchaseDate,
        items,
        subtotal15,
        subtotal0,
        subtotal,
        ivaAmount: totalIva,
        total: grandTotal,
        paymentCondition,
        paymentMethod: paymentCondition === "contado" ? paymentMethod : undefined,
        bankAccountId: paymentCondition === "contado" ? bankAccountId : undefined,
        paymentStatus: paymentCondition === "contado" ? "pagado" : "pendiente",
        dueDate: paymentCondition === "credito" ? dueDate : undefined,
        inventoryStatus: items.some((i) => i.productId) ? "ingresado" : "no_aplica",
        xmlContent: xmlContent || undefined,
        notes: notes.trim() || undefined,
      });

      showSuccess(
        "Compra Registrada",
        `Factura ${documentNumber} asentada exitosamente (${paymentCondition === "contado" ? "Pagada de Contado" : "Pendiente en Cuentas por Pagar"}).`
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo registrar la compra.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#004ac6]/10 text-[#004ac6] rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0b1c30]">
                Registrar Factura de Compra
              </h2>
              <p className="text-xs text-[#737686]">
                Carga un XML electrónico del SRI o ingresa la información manualmente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-[#e2e8f0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-[#e2e8f0] bg-white">
          <button
            type="button"
            onClick={() => setMode("xml")}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              mode === "xml"
                ? "border-[#004ac6] text-[#004ac6]"
                : "border-transparent text-[#737686] hover:text-[#0b1c30]"
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar XML del SRI (Recomendado)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              mode === "manual"
                ? "border-[#004ac6] text-[#004ac6]"
                : "border-transparent text-[#737686] hover:text-[#0b1c30]"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Formulario Manual</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* XML Dropzone if mode === "xml" */}
          {mode === "xml" && (
            <div className="p-4 bg-[#eff4ff] border-2 border-dashed border-[#93c5fd] rounded-xl text-center space-y-2">
              <UploadCloud className="w-8 h-8 text-[#004ac6] mx-auto" />
              <div className="text-xs text-[#0b1c30] font-semibold">
                {xmlFileName ? (
                  <span className="text-[#004ac6] font-bold">
                    Archivo cargado: {xmlFileName}
                  </span>
                ) : (
                  <span>
                    Arrastra el archivo <strong className="text-[#004ac6]">.xml</strong> de la factura emitida por tu proveedor
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#737686]">
                Extrae automáticamente RUC, razón social, clave de acceso de 49 dígitos, ítems y valores tributarios.
              </p>
              <div>
                <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs">
                  <span>Seleccionar Archivo XML</span>
                  <input
                    type="file"
                    accept=".xml,text/xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Supplier and Invoice Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0]">
            {/* Supplier Selector */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#004ac6]" />
                Proveedor / Razón Social *
              </label>
              <div className="flex gap-2">
                <select
                  value={supplierId}
                  onChange={(e) => handleSelectSupplier(e.target.value)}
                  className="w-1/2 px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6]"
                >
                  <option value="">-- Seleccionar del directorio --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.razonSocial} ({s.ruc})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Razón Social del Proveedor"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  required
                  className="w-1/2 px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>
            </div>

            {/* Supplier RUC */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                RUC / Identificación *
              </label>
              <input
                type="text"
                placeholder="1792189421001"
                value={supplierRuc}
                onChange={(e) => setSupplierRuc(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-medium text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            {/* Document Number */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                N° Comprobante *
              </label>
              <input
                type="text"
                placeholder="001-002-000012345"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-medium text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            {/* Date */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#004ac6]" />
                Fecha de Emisión *
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            {/* Default Warehouse */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-[#004ac6]" />
                Bodega de Recepción
              </label>
              <select
                value={defaultWarehouseId}
                onChange={(e) => {
                  setDefaultWarehouseId(e.target.value);
                  setItems((prev) =>
                    prev.map((i) => ({ ...i, warehouseId: e.target.value }))
                  );
                }}
                className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6]"
              >
                {inventoryWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Conditions Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-xl border border-[#e2e8f0]">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#004ac6]" />
                Condición de Pago *
              </label>
              <select
                value={paymentCondition}
                onChange={(e) =>
                  setPaymentCondition(e.target.value as PurchasePaymentCondition)
                }
                className="w-full px-3 py-2 bg-[#f8f9ff] border border-[#cbd5e1] rounded-lg text-xs font-bold text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="contado">Contado (Pagado de Inmediato)</option>
                <option value="credito">Crédito (Generar Cuenta por Pagar)</option>
              </select>
            </div>

            {paymentCondition === "contado" ? (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Cuenta Bancaria Origen *
                  </label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6]"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - Saldo: ${b.currentBalance.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Método de Pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6]"
                  >
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="cheque">Cheque</option>
                    <option value="efectivo">Efectivo / Caja Chica</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="space-y-1 md:col-span-2">
                <label className="text-[11px] font-bold text-[#b45309] uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Fecha Límite de Pago (CxP) *
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#fffbeb] border border-[#fde68a] rounded-lg text-xs font-medium text-[#92400e] focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider flex items-center gap-2">
                <span>Detalle de Productos / Servicios</span>
                <span className="text-[11px] font-normal text-[#737686]">
                  (Los productos asignados ingresarán al Kardex de la bodega)
                </span>
              </h3>
              <button
                type="button"
                onClick={handleAddManualItem}
                className="flex items-center gap-1 px-2.5 py-1 bg-[#eff4ff] hover:bg-[#dbeafe] text-[#004ac6] rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Fila</span>
              </button>
            </div>

            <div className="border border-[#e2e8f0] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">Producto en Catálogo</th>
                    <th className="py-2.5 px-3 font-bold">Descripción</th>
                    <th className="py-2.5 px-3 font-bold w-20 text-center">Cant.</th>
                    <th className="py-2.5 px-3 font-bold w-24 text-right">Costo Unit.</th>
                    <th className="py-2.5 px-3 font-bold w-20 text-center">IVA %</th>
                    <th className="py-2.5 px-3 font-bold w-28">Bodega</th>
                    <th className="py-2.5 px-3 font-bold w-24 text-right">Total</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-xs text-[#737686]">
                        No hay ítems registrados. Carga un XML del SRI o presiona &quot;Añadir Fila&quot;.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-[#f8f9ff]/60 transition-colors">
                        {/* Match with catalog */}
                        <td className="py-2 px-3">
                          <select
                            value={item.productId || ""}
                            onChange={(e) =>
                              handleUpdateItem(idx, "productId", e.target.value || undefined)
                            }
                            className="w-full px-2 py-1 bg-white border border-[#cbd5e1] rounded text-[11px] font-medium text-[#0b1c30]"
                          >
                            <option value="">-- No vincular --</option>
                            {inventoryProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Description */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(idx, "name", e.target.value)}
                            placeholder="Descripción del ítem"
                            required
                            className="w-full px-2 py-1 bg-white border border-[#cbd5e1] rounded text-[11px] text-[#0b1c30]"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItem(idx, "quantity", parseFloat(e.target.value) || 0)
                            }
                            required
                            className="w-full px-2 py-1 text-center bg-white border border-[#cbd5e1] rounded text-[11px] font-mono text-[#0b1c30]"
                          />
                        </td>

                        {/* Unit Cost */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unitCost}
                            onChange={(e) =>
                              handleUpdateItem(idx, "unitCost", parseFloat(e.target.value) || 0)
                            }
                            required
                            className="w-full px-2 py-1 text-right bg-white border border-[#cbd5e1] rounded text-[11px] font-mono text-[#0b1c30]"
                          />
                        </td>

                        {/* IVA Rate */}
                        <td className="py-2 px-3">
                          <select
                            value={item.ivaRate}
                            onChange={(e) =>
                              handleUpdateItem(idx, "ivaRate", Number(e.target.value))
                            }
                            className="w-full px-1.5 py-1 text-center bg-white border border-[#cbd5e1] rounded text-[11px] font-medium"
                          >
                            <option value={15}>15%</option>
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                          </select>
                        </td>

                        {/* Destination Warehouse */}
                        <td className="py-2 px-3">
                          <select
                            value={item.warehouseId || defaultWarehouseId}
                            onChange={(e) =>
                              handleUpdateItem(idx, "warehouseId", e.target.value)
                            }
                            className="w-full px-2 py-1 bg-white border border-[#cbd5e1] rounded text-[11px]"
                          >
                            {inventoryWarehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Total */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-[#0b1c30]">
                          ${item.total.toFixed(2)}
                        </td>

                        {/* Delete action */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-[#94a3b8] hover:text-[#ef4444] transition-colors p-1"
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

          {/* Totals Summary */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-2">
            <div className="w-full md:w-1/2">
              <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                Observaciones / Notas de Recepción
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalle adicional sobre esta compra o entrega..."
                className="w-full mt-1 p-2 bg-white border border-[#cbd5e1] rounded-lg text-xs text-[#0b1c30] focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div className="w-full md:w-72 bg-[#f8f9ff] p-3 rounded-xl border border-[#e2e8f0] space-y-1.5 text-xs">
              <div className="flex justify-between text-[#434655]">
                <span>Subtotal 15%:</span>
                <span className="font-mono font-medium">${subtotal15.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#434655]">
                <span>Subtotal 0%:</span>
                <span className="font-mono font-medium">${subtotal0.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#434655]">
                <span>IVA Total:</span>
                <span className="font-mono font-medium">${totalIva.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#0b1c30] font-bold text-sm pt-1 border-t border-[#e2e8f0]">
                <span>Total a Pagar:</span>
                <span className="font-mono text-[#004ac6]">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e2e8f0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#434655] hover:text-[#0b1c30] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isSubmitting ? "Registrando..." : "Confirmar & Asentar Compra"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
