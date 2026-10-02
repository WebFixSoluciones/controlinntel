"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { parseSupplierSriXml } from "@/lib/purchases-service";
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  Building2,
  Boxes,
  CreditCard,
  Calendar,
  Save,
  FileUp,
  Receipt,
  AlertCircle,
} from "lucide-react";
import { PurchaseItem, PurchasePaymentCondition } from "@/types";

interface NewPurchaseViewProps {
  onBack: () => void;
  onSuccess?: () => void;
}

export function NewPurchaseView({ onBack, onSuccess }: NewPurchaseViewProps) {
  const {
    suppliers,
    inventoryProducts,
    inventoryWarehouses,
    bankAccounts,
    addPurchaseInvoice,
  } = useApp();
  const { showSuccess, showError } = useToast();

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
        (s) =>
          s.ruc === parsed.supplierRuc ||
          s.razonSocial.toLowerCase() === parsed.supplierRazonSocial.toLowerCase()
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
        "XML Procesado Exitosamente",
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

      if (field === "productId") {
        const prod = inventoryProducts.find((p) => p.id === value);
        if (prod) {
          item.name = prod.name;
          item.sku = prod.sku;
          item.unitCost = prod.baseCost || 0;
          item.ivaRate = prod.ivaRate || 15;
        }
      }

      const qty = Math.max(0, Number(item.quantity) || 0);
      const cost = Math.max(0, Number(item.unitCost) || 0);
      const disc = Math.max(0, Number(item.discount) || 0);
      const subtotal = Math.max(0, qty * cost - disc);
      const iva = Math.round(subtotal * ((item.ivaRate || 0) / 100) * 100) / 100;
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
  const subtotal15 =
    Math.round(
      items
        .filter((i) => i.ivaRate > 0)
        .reduce((sum, i) => sum + i.subtotal, 0) * 100
    ) / 100;

  const subtotal0 =
    Math.round(
      items
        .filter((i) => i.ivaRate === 0)
        .reduce((sum, i) => sum + i.subtotal, 0) * 100
    ) / 100;

  const totalDiscount =
    Math.round(items.reduce((sum, i) => sum + (i.discount || 0), 0) * 100) / 100;

  const subtotal = Math.round((subtotal15 + subtotal0) * 100) / 100;
  const totalIva =
    Math.round(items.reduce((sum, i) => sum + i.ivaAmount, 0) * 100) / 100;
  const grandTotal = Math.round((subtotal + totalIva) * 100) / 100;

  // Submit Handler
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
        "Compra Registrada con Éxito",
        `Factura ${documentNumber} asentada correctamente (${
          paymentCondition === "contado"
            ? "Pagada de Contado"
            : "Pendiente en Cuentas por Pagar"
        }).`
      );

      if (onSuccess) {
        onSuccess();
      } else {
        onBack();
      }
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo registrar la compra.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 select-none">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Volver al Historial"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Registrar Compra de Proveedor
            </h2>
            <p className="text-[11px] text-slate-500">
              {mode === "xml"
                ? "Carga de comprobante mediante archivo XML autorizado por el SRI"
                : "Registro manual de factura de adquisición y recepción de mercadería"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Switch */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setMode("xml")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                mode === "xml"
                  ? "bg-white text-[#004ac6] shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Importar XML</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                mode === "manual"
                  ? "bg-white text-[#004ac6] shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ingreso Manual</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? "Guardando..." : "Guardar Compra"}</span>
          </button>
        </div>
      </div>

      {/* XML Upload Banner (when mode === 'xml') */}
      {mode === "xml" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-[#004ac6]" />
              <span className="text-xs font-bold text-slate-800">
                Archivo XML Electrónico del SRI
              </span>
            </div>
            {xmlFileName && (
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {xmlFileName}
              </span>
            )}
          </div>

          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-[#004ac6] rounded-xl bg-slate-50 hover:bg-[#eff4ff]/30 transition cursor-pointer">
            <FileUp className="w-8 h-8 text-[#004ac6] mb-2" />
            <span className="text-xs font-bold text-slate-800">
              {xmlFileName ? "Cambiar archivo XML" : "Selecciona o arrastra el archivo XML de la factura"}
            </span>
            <span className="text-[11px] text-slate-500 mt-1">
              Lectura automática de RUC, razón social, fecha, número de comprobante e ítems
            </span>
            <input
              type="file"
              accept=".xml"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Section 1 & 2: Proveedor, Comprobante y Forma de Pago */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Datos del Proveedor y Factura */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-[#004ac6]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Proveedor & Comprobante
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Seleccionar Proveedor Registrado (Opcional)
              </label>
              <select
                value={supplierId}
                onChange={(e) => handleSelectSupplier(e.target.value)}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              >
                <option value="">-- Proveedor no catalogado / Ingreso manual --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.razonSocial} (RUC: {s.ruc})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                R.U.C. o Cédula *
              </label>
              <input
                type="text"
                required
                value={supplierRuc}
                onChange={(e) => setSupplierRuc(e.target.value)}
                placeholder="1790000000001"
                className="w-full text-xs font-mono font-bold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Razón Social *
              </label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Nombre del Proveedor"
                className="w-full text-xs font-bold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                N° de Factura (001-001-...) *
              </label>
              <input
                type="text"
                required
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="001-002-000012345"
                className="w-full text-xs font-mono font-bold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha de Emisión *
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Clave de Acceso SRI (49 dígitos)
              </label>
              <input
                type="text"
                maxLength={49}
                value={claveAcceso}
                onChange={(e) => setClaveAcceso(e.target.value)}
                placeholder="Clave numérica del comprobante electrónico"
                className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Condiciones de Pago e Inventario */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <CreditCard className="w-4 h-4 text-[#004ac6]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Pago & Bodega de Recepción
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Condición de Pago *
              </label>
              <select
                value={paymentCondition}
                onChange={(e) =>
                  setPaymentCondition(e.target.value as PurchasePaymentCondition)
                }
                className="w-full text-xs font-bold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              >
                <option value="contado">Contado (Liquidado)</option>
                <option value="credito">Crédito (Cuentas por Pagar)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bodega de Ingreso Predeterminada *
              </label>
              <select
                value={defaultWarehouseId}
                onChange={(e) => {
                  setDefaultWarehouseId(e.target.value);
                  setItems((prev) =>
                    prev.map((i) => ({ ...i, warehouseId: e.target.value }))
                  );
                }}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              >
                {inventoryWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            {paymentCondition === "contado" ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cuenta Origen de Pago *
                  </label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="w-full text-xs font-medium rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - {b.accountNumber} (Saldo: ${b.currentBalance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Método de Pago *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full text-xs font-medium rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  >
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="efectivo">Efectivo / Caja Chica</option>
                    <option value="cheque">Cheque</option>
                    <option value="tarjeta_debito">Tarjeta de Débito</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fecha de Vencimiento de Crédito *
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs font-bold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notas / Referencia Comercial
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones de compra o recepción"
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#004ac6]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Detalle de Productos & Materiales Comprados
            </h3>
          </div>

          <button
            type="button"
            onClick={handleAddManualItem}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#eff4ff] hover:bg-[#dbeafe] text-[#004ac6] rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Línea</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
            <p>No hay ítems cargados en el comprobante.</p>
            <p className="text-[11px] text-slate-400">
              Carga un XML del SRI o presiona &quot;Agregar Línea&quot; para registrar ítems manualmente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-bold min-w-[200px]">Producto / Descripción</th>
                  <th className="py-2.5 px-2 font-bold min-w-[100px]">SKU</th>
                  <th className="py-2.5 px-2 font-bold w-20 text-right">Cant.</th>
                  <th className="py-2.5 px-2 font-bold w-24 text-right">Costo Unit.</th>
                  <th className="py-2.5 px-2 font-bold w-20 text-right">Desc.</th>
                  <th className="py-2.5 px-2 font-bold w-20 text-center">Tarifa IVA</th>
                  <th className="py-2.5 px-2 font-bold w-24 text-right">Subtotal</th>
                  <th className="py-2.5 px-2 font-bold w-24 text-right">Total</th>
                  <th className="py-2.5 px-2 font-bold text-center w-12">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-2 px-3">
                      <div className="space-y-1">
                        <select
                          value={item.productId || ""}
                          onChange={(e) => handleUpdateItem(idx, "productId", e.target.value)}
                          className="w-full text-xs font-semibold rounded-lg border border-slate-200 p-1.5 bg-white text-slate-800"
                        >
                          <option value="">-- Vincular con Inventario (Opcional) --</option>
                          {inventoryProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => handleUpdateItem(idx, "name", e.target.value)}
                          placeholder="Descripción del ítem"
                          className="w-full text-xs rounded-lg border border-slate-200 p-1.5 bg-white text-slate-700"
                        />
                      </div>
                    </td>

                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={item.sku || ""}
                        onChange={(e) => handleUpdateItem(idx, "sku", e.target.value)}
                        placeholder="SKU"
                        className="w-full text-xs font-mono rounded-lg border border-slate-200 p-1.5 bg-white text-slate-700"
                      />
                    </td>

                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(idx, "quantity", e.target.value)}
                        className="w-full text-xs font-mono font-bold text-right rounded-lg border border-slate-200 p-1.5 bg-white text-slate-800"
                      />
                    </td>

                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        required
                        value={item.unitCost}
                        onChange={(e) => handleUpdateItem(idx, "unitCost", e.target.value)}
                        className="w-full text-xs font-mono text-right rounded-lg border border-slate-200 p-1.5 bg-white text-slate-800"
                      />
                    </td>

                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.discount || 0}
                        onChange={(e) => handleUpdateItem(idx, "discount", e.target.value)}
                        className="w-full text-xs font-mono text-right rounded-lg border border-slate-200 p-1.5 bg-white text-slate-800"
                      />
                    </td>

                    <td className="py-2 px-2 text-center">
                      <select
                        value={item.ivaRate}
                        onChange={(e) => handleUpdateItem(idx, "ivaRate", Number(e.target.value))}
                        className="text-xs font-bold rounded-lg border border-slate-200 p-1.5 bg-white text-slate-700"
                      >
                        <option value="15">15%</option>
                        <option value="0">0%</option>
                      </select>
                    </td>

                    <td className="py-2 px-2 text-right font-mono font-bold text-slate-700">
                      ${item.subtotal.toFixed(2)}
                    </td>

                    <td className="py-2 px-2 text-right font-mono font-bold text-[#004ac6]">
                      ${item.total.toFixed(2)}
                    </td>

                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Eliminar Ítem"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals Summary */}
        {items.length > 0 && (
          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal 15%:</span>
                <span className="font-mono font-bold">${subtotal15.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal 0% (Tarifa 0):</span>
                <span className="font-mono font-bold">${subtotal0.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Descuento Total:</span>
                  <span className="font-mono font-bold">-${totalDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>IVA 15%:</span>
                <span className="font-mono font-bold">${totalIva.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Factura:</span>
                <span className="font-mono text-[#004ac6]">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
        >
          Cancelar y Volver
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isSubmitting ? "Guardando..." : "Asentar Compra"}</span>
        </button>
      </div>
    </form>
  );
}
