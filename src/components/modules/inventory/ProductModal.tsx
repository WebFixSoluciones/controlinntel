"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  InventoryProduct,
  InventoryItemType,
  UnitOfMeasure,
  TaxMode,
} from "@/types";
import {
  calculatePriceWithTax,
  calculatePriceWithoutTax,
} from "@/lib/inventory-service";
import { CategoryBrandModal } from "./CategoryBrandModal";
import {
  X,
  Package,
  Wrench,
  Tag,
  Award,
  DollarSign,
  Building2,
  Barcode,
  Layers,
  CheckCircle,
  Plus,
  AlertCircle,
  Hash,
} from "lucide-react";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: InventoryProduct | null;
  defaultType?: InventoryItemType;
}

export function ProductModal({
  isOpen,
  onClose,
  productToEdit,
  defaultType = "producto",
}: ProductModalProps) {
  const {
    inventoryProducts,
    inventoryCategories,
    inventoryBrands,
    inventoryWarehouses,
    addInventoryProduct,
    updateInventoryProduct,
  } = useApp();
  const { showSuccess, showError } = useToast();

  const [type, setType] = useState<InventoryItemType>(defaultType);
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [unit, setUnit] = useState<UnitOfMeasure>("unidad");

  // Precios e IVA
  const [baseCost, setBaseCost] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [salePriceConIva, setSalePriceConIva] = useState<number>(0);
  const [taxMode, setTaxMode] = useState<TaxMode>("EXCLUIDO");
  const [ivaRate, setIvaRate] = useState<number>(15);

  // Stock
  const [minStock, setMinStock] = useState<number>(5);
  const [maxStock, setMaxStock] = useState<number>(100);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [stockByWarehouse, setStockByWarehouse] = useState<Record<string, number>>({});

  // Telecom Attributes
  const [model, setModel] = useState("");
  const [serialNumberRequired, setSerialNumberRequired] = useState(false);
  const [fiberLengthMeters, setFiberLengthMeters] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<"activo" | "inactivo">("activo");

  // Sub-modal for category/brand
  const [isCatBrandOpen, setIsCatBrandOpen] = useState(false);
  const [catBrandMode, setCatBrandMode] = useState<"categoria" | "marca">("categoria");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (productToEdit) {
      setType(productToEdit.type);
      setSku(productToEdit.sku);
      setBarcode(productToEdit.barcode || "");
      setName(productToEdit.name);
      setDescription(productToEdit.description || "");
      setCategoryId(productToEdit.categoryId);
      setBrandId(productToEdit.brandId || "");
      setUnit(productToEdit.unit);
      setBaseCost(productToEdit.baseCost);
      setSalePrice(productToEdit.salePrice);
      setSalePriceConIva(productToEdit.salePriceConIva);
      setTaxMode(productToEdit.taxMode);
      setIvaRate(productToEdit.ivaRate);
      setMinStock(productToEdit.minStock);
      setMaxStock(productToEdit.maxStock || 100);
      setDefaultWarehouseId(productToEdit.defaultWarehouseId || inventoryWarehouses[0]?.id || "");
      setStockByWarehouse(productToEdit.stockByWarehouse || {});
      setModel(productToEdit.model || "");
      setSerialNumberRequired(!!productToEdit.serialNumberRequired);
      setFiberLengthMeters(productToEdit.fiberLengthMeters);
      setStatus(productToEdit.status);
    } else {
      setType(defaultType);
      const randomSku = defaultType === "servicio" ? `SRV-${Date.now().toString().slice(-4)}` : `ART-${Date.now().toString().slice(-4)}`;
      setSku(randomSku);
      setBarcode("");
      setName("");
      setDescription("");
      setCategoryId(inventoryCategories[0]?.id || "");
      setBrandId(inventoryBrands[0]?.id || "");
      setUnit(defaultType === "servicio" ? "servicio" : "unidad");
      setBaseCost(0);
      setSalePrice(0);
      setSalePriceConIva(0);
      setTaxMode("EXCLUIDO");
      setIvaRate(15);
      setMinStock(5);
      setMaxStock(100);
      const defaultWh = inventoryWarehouses.find((w) => w.isDefault)?.id || inventoryWarehouses[0]?.id || "";
      setDefaultWarehouseId(defaultWh);
      setStockByWarehouse(defaultWh ? { [defaultWh]: 0 } : {});
      setModel("");
      setSerialNumberRequired(false);
      setFiberLengthMeters(undefined);
      setStatus("activo");
    }
  }, [productToEdit, isOpen, defaultType, inventoryCategories, inventoryBrands, inventoryWarehouses]);

  if (!isOpen) return null;

  // Reactively calculate prices
  const handleSalePriceChange = (val: number) => {
    setSalePrice(val);
    setSalePriceConIva(calculatePriceWithTax(val, ivaRate));
  };

  const handleSalePriceConIvaChange = (val: number) => {
    setSalePriceConIva(val);
    setSalePrice(calculatePriceWithoutTax(val, ivaRate));
  };

  const handleIvaRateChange = (rate: number) => {
    setIvaRate(rate);
    setSalePriceConIva(calculatePriceWithTax(salePrice, rate));
  };

  const handleStockByWhChange = (whId: string, qty: number) => {
    setStockByWarehouse((prev) => ({
      ...prev,
      [whId]: Math.max(0, qty),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showError("Campo Obligatorio", "Por favor ingresa el nombre comercial del ítem.");
      return;
    }

    if (!sku.trim()) {
      showError("Campo Obligatorio", "Por favor ingresa un código SKU interno.");
      return;
    }

    setIsSubmitting(true);
    try {
      const categoryObj = inventoryCategories.find((c) => c.id === categoryId);
      const brandObj = inventoryBrands.find((b) => b.id === brandId);

      const productPayload = {
        sku: sku.trim().toUpperCase(),
        barcode: barcode.trim() || undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        categoryId: categoryId || inventoryCategories[0]?.id || "cat-general",
        categoryName: categoryObj?.name,
        brandId: brandId || undefined,
        brandName: brandObj?.name,
        unit,
        baseCost: Math.max(0, Number(baseCost) || 0),
        salePrice: Math.max(0, Number(salePrice) || 0),
        salePriceConIva: Math.max(0, Number(salePriceConIva) || 0),
        taxMode,
        ivaRate,
        tracksStock: type === "producto",
        stock: type === "producto"
          ? Object.values(stockByWarehouse).reduce((acc, v) => acc + (Number(v) || 0), 0)
          : 0,
        minStock: type === "producto" ? Math.max(0, Number(minStock) || 0) : 0,
        maxStock: type === "producto" ? Math.max(0, Number(maxStock) || 100) : undefined,
        stockByWarehouse: type === "producto" ? stockByWarehouse : {},
        defaultWarehouseId: type === "producto" ? defaultWarehouseId : undefined,
        model: model.trim() || undefined,
        serialNumberRequired: type === "producto" ? serialNumberRequired : false,
        fiberLengthMeters: fiberLengthMeters ? Number(fiberLengthMeters) : undefined,
        status,
      };

      if (productToEdit) {
        await updateInventoryProduct(productToEdit.id, productPayload);
        showSuccess("Producto Actualizado", `"${name}" se actualizó exitosamente.`);
      } else {
        await addInventoryProduct(productPayload);
        showSuccess("Producto Registrado", `"${name}" ha sido añadido al inventario.`);
      }

      onClose();
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo procesar el producto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#eff4ff] text-[#004ac6]">
                {type === "servicio" ? <Wrench className="w-5 h-5" /> : <Package className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {productToEdit
                    ? `Editar ${productToEdit.type === "servicio" ? "Servicio" : "Producto"}`
                    : `Registrar Nuevo ${type === "servicio" ? "Servicio" : "Producto"}`}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {type === "servicio"
                    ? "Mano de obra, enlaces y servicios sin control de existencias"
                    : "Equipos de telecomunicaciones, pasivos y control de stock"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-5 text-xs">
              {/* Type Switcher */}
              {!productToEdit && (
                <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100/80 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setType("producto");
                      setUnit("unidad");
                    }}
                    className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                      type === "producto"
                        ? "bg-white text-[#004ac6] shadow-2xs"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    Producto Físico (Con Stock)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType("servicio");
                      setUnit("servicio");
                    }}
                    className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                      type === "servicio"
                        ? "bg-white text-[#004ac6] shadow-2xs"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    Servicio Técnico (Sin Stock)
                  </button>
                </div>
              )}

              {/* Datos Principales */}
              <div className="space-y-3">
                <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-[#004ac6] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Identificación & Nomenclatura
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nombre Comercial del Ítem *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={
                        type === "servicio"
                          ? "Ej. Instalación de Acometida FTTH 200m"
                          : "Ej. ONT Huawei EchoLife EG8145V5 Dual Band GPON"
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Código / SKU *
                    </label>
                    <input
                      type="text"
                      required
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="Ej. ONT-HW-EG8145V5"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Categoría</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCatBrandMode("categoria");
                          setIsCatBrandOpen(true);
                        }}
                        className="text-[#004ac6] hover:underline font-bold flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" /> Nueva
                      </button>
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
                    >
                      {inventoryCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Marca / Fabricante</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCatBrandMode("marca");
                          setIsCatBrandOpen(true);
                        }}
                        className="text-[#004ac6] hover:underline font-bold flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" /> Nueva
                      </button>
                    </label>
                    <select
                      value={brandId}
                      onChange={(e) => setBrandId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
                    >
                      <option value="">(Sin Marca / Genérico)</option>
                      {inventoryBrands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Unidad de Medida
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white capitalize"
                    >
                      <option value="unidad">Unidad (u)</option>
                      <option value="metro">Metro (m)</option>
                      <option value="rollo">Rollo (Bobina)</option>
                      <option value="caja">Caja</option>
                      <option value="kit">Kit</option>
                      <option value="servicio">Servicio / Evento</option>
                      <option value="hora">Hora Técnica</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Barcode className="w-3.5 h-3.5 text-slate-400" />
                      Código de Barras / EAN13 (Opcional)
                    </label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="Ej. 786100120001"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Estado en Catálogo
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
                    >
                      <option value="activo">Activo (Disponible para venta)</option>
                      <option value="inactivo">Inactivo / Descontinuado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Descripción Técnica / Especificaciones
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detalles sobre puertos, alimentación, estándares soportados..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] resize-none"
                  />
                </div>
              </div>

              {/* Precios & Tributación SRI */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-[#004ac6] flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  Precios & Tributación SRI (Ecuador)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Costo Unitario ($ USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={baseCost}
                      onChange={(e) => setBaseCost(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tarifa IVA SRI
                    </label>
                    <select
                      value={ivaRate}
                      onChange={(e) => handleIvaRateChange(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-bold text-slate-800"
                    >
                      <option value={15}>15% (Vigente)</option>
                      <option value={0}>0% (Exento)</option>
                      <option value={5}>5% (Materiales)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      P. Venta Sin IVA ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={salePrice}
                      onChange={(e) => handleSalePriceChange(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-[#004ac6] focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      P. Venta Con IVA ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={salePriceConIva}
                      onChange={(e) => handleSalePriceConIvaChange(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/30 text-xs font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Control de Stock & Multibodega (Solo para Productos Físicos) */}
              {type === "producto" && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-[#004ac6] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      Control de Stock & Existencias por Bodega
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Stock Total Consolidado:{" "}
                      <strong className="text-slate-800">
                        {Object.values(stockByWarehouse).reduce((acc, v) => acc + (Number(v) || 0), 0)}{" "}
                        {unit}
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Bodega Principal
                      </label>
                      <select
                        value={defaultWarehouseId}
                        onChange={(e) => setDefaultWarehouseId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
                      >
                        {inventoryWarehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code} - {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Alerta Stock Mínimo
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={minStock}
                        onChange={(e) => setMinStock(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Stock Máximo Sugerido
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={maxStock}
                        onChange={(e) => setMaxStock(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                      />
                    </div>
                  </div>

                  {/* Desglose de Stock por Bodega */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      Existencias Físicas por Bodega ({unit}s):
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {inventoryWarehouses.map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200"
                        >
                          <span className="truncate text-[11px] font-medium text-slate-700 pr-2">
                            {w.code}
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={stockByWarehouse[w.id] ?? 0}
                            onChange={(e) => handleStockByWhChange(w.id, Number(e.target.value))}
                            className="w-16 px-2 py-1 rounded border border-slate-200 text-right text-xs font-bold focus:outline-none focus:border-[#004ac6]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Opciones Especiales Telecom */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                      <input
                        type="checkbox"
                        id="serialRequired"
                        checked={serialNumberRequired}
                        onChange={(e) => setSerialNumberRequired(e.target.checked)}
                        className="rounded text-[#004ac6] focus:ring-[#004ac6]"
                      />
                      <label htmlFor="serialRequired" className="text-xs cursor-pointer">
                        <span className="font-bold text-slate-800 block">Requiere Número de Serie / MAC</span>
                        <span className="text-[10px] text-slate-500">
                          Obligatorio registrar serial en salidas (ONTs, Routers)
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Metraje de Fibra (Metros)
                      </label>
                      <input
                        type="number"
                        placeholder="Ej. 1000m (para bobinas drop)"
                        value={fiberLengthMeters || ""}
                        onChange={(e) =>
                          setFiberLengthMeters(e.target.value ? Number(e.target.value) : undefined)
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {isSubmitting
                  ? "Guardando..."
                  : productToEdit
                  ? "Actualizar Catálogo"
                  : "Guardar en Catálogo"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Submodal para Crear Categoría o Marca al Vuelo */}
      <CategoryBrandModal
        isOpen={isCatBrandOpen}
        onClose={() => setIsCatBrandOpen(false)}
        mode={catBrandMode}
      />
    </>
  );
}
