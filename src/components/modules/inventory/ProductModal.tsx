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
  DollarSign,
  Building2,
  CheckCircle,
  Plus,
  ArrowLeft,
} from "lucide-react";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: InventoryProduct | null;
  defaultType?: InventoryItemType;
  embedded?: boolean;
}

export function ProductModal({
  isOpen,
  onClose,
  productToEdit,
  defaultType = "producto",
  embedded = false,
}: ProductModalProps) {
  const {
    inventoryCategories,
    inventoryBrands,
    inventoryWarehouses,
    addInventoryProduct,
    updateInventoryProduct,
  } = useApp();
  const { showSuccess, showError } = useToast();

  const [type, setType] = useState<InventoryItemType>(defaultType);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [unit, setUnit] = useState<UnitOfMeasure>("unidad");
  const [status, setStatus] = useState<"activo" | "inactivo">("activo");

  // Precios e IVA
  const [baseCost, setBaseCost] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [salePriceConIva, setSalePriceConIva] = useState<number>(0);
  const [taxMode, setTaxMode] = useState<TaxMode>("EXCLUIDO");
  const [ivaRate, setIvaRate] = useState<number>(15);

  // Stock (Solo para Productos)
  const [minStock, setMinStock] = useState<number>(5);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [stockByWarehouse, setStockByWarehouse] = useState<Record<string, number>>({});

  // Sub-modal para crear Categoría o Marca rápido
  const [isCatBrandOpen, setIsCatBrandOpen] = useState(false);
  const [catBrandMode, setCatBrandMode] = useState<"categoria" | "marca">("categoria");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (productToEdit) {
      setType(productToEdit.type);
      setSku(productToEdit.sku);
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
      setDefaultWarehouseId(
        productToEdit.defaultWarehouseId || inventoryWarehouses[0]?.id || ""
      );
      setStockByWarehouse(productToEdit.stockByWarehouse || {});
      setStatus(productToEdit.status);
    } else {
      setType(defaultType);
      const codeSuffix = Date.now().toString().slice(-4);
      setSku(defaultType === "servicio" ? `SRV-${codeSuffix}` : `PRD-${codeSuffix}`);
      setName("");
      setDescription("");
      setCategoryId("");
      setBrandId(inventoryBrands[0]?.id || "");
      setUnit(defaultType === "servicio" ? "servicio" : "unidad");
      setBaseCost(0);
      setSalePrice(0);
      setSalePriceConIva(0);
      setTaxMode("EXCLUIDO");
      setIvaRate(15);
      setMinStock(5);
      const defaultWh =
        inventoryWarehouses.find((w) => w.isDefault)?.id ||
        inventoryWarehouses[0]?.id ||
        "";
      setDefaultWarehouseId(defaultWh);
      setStockByWarehouse(defaultWh ? { [defaultWh]: 0 } : {});
      setStatus("activo");
    }
  }, [
    productToEdit,
    isOpen,
    defaultType,
    inventoryCategories,
    inventoryBrands,
    inventoryWarehouses,
  ]);

  if (!isOpen) return null;

  const handleTypeSwitch = (newType: InventoryItemType) => {
    setType(newType);
    if (!inventoryCategories.some(c => c.id === categoryId && (c.itemType === "ambos" || c.itemType === newType))) setCategoryId("");
    if (newType === "servicio") {
      setUnit("servicio");
      if (sku.startsWith("PRD-") || sku.startsWith("ART-")) {
        setSku(`SRV-${sku.slice(4)}`);
      }
    } else {
      setUnit("unidad");
      if (sku.startsWith("SRV-")) {
        setSku(`PRD-${sku.slice(4)}`);
      }
    }
  };

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
      showError(
        "Nombre obligatorio",
        `Por favor ingresa el nombre del ${type === "servicio" ? "servicio" : "producto"}.`
      );
      return;
    }

    if (!sku.trim()) {
      showError("Código obligatorio", "Por favor ingresa un código identificador.");
      return;
    }

    setIsSubmitting(true);
    try {
      const categoryObj = inventoryCategories.find((c) => c.id === categoryId);
      const brandObj = inventoryBrands.find((b) => b.id === brandId);

      const productPayload = {
        sku: sku.trim().toUpperCase(),
        barcode: productToEdit?.barcode,
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        categoryId: categoryId || inventoryCategories[0]?.id || "cat-general",
        categoryName: categoryObj?.name,
        brandId: type === "producto" ? brandId || undefined : undefined,
        brandName: type === "producto" ? brandObj?.name : undefined,
        unit,
        baseCost: Math.max(0, Number(baseCost) || 0),
        salePrice: Math.max(0, Number(salePrice) || 0),
        salePriceConIva: Math.max(0, Number(salePriceConIva) || 0),
        taxMode,
        ivaRate,
        tracksStock: type === "producto",
        stock:
          type === "producto"
            ? Object.values(stockByWarehouse).reduce(
                (acc, v) => acc + (Number(v) || 0),
                0
              )
            : 0,
        minStock: type === "producto" ? Math.max(0, Number(minStock) || 0) : 0,
        maxStock: productToEdit?.maxStock,
        stockByWarehouse: type === "producto" ? stockByWarehouse : {},
        defaultWarehouseId: type === "producto" ? defaultWarehouseId : undefined,
        model: productToEdit?.model,
        serialNumberRequired: productToEdit?.serialNumberRequired || false,
        fiberLengthMeters: productToEdit?.fiberLengthMeters,
        status,
      };

      if (productToEdit) {
        const updatePayload = {
          ...productPayload,
          stock: productToEdit.stock,
          stockByWarehouse: productToEdit.stockByWarehouse || {},
        };
        await updateInventoryProduct(productToEdit.id, updatePayload);
        showSuccess(
          type === "servicio" ? "Servicio actualizado" : "Producto actualizado",
          `"${name}" se actualizó correctamente.`
        );
      } else {
        await addInventoryProduct(productPayload);
        showSuccess(
          type === "servicio" ? "Servicio creado" : "Producto creado",
          `"${name}" se guardó correctamente.`
        );
      }

      onClose();
    } catch (err: any) {
      showError("Error al guardar", err?.message || "No se pudo guardar el registro.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalStock = Object.values(stockByWarehouse).reduce(
    (acc, v) => acc + (Number(v) || 0),
    0
  );

  const headerNode = embedded ? (
    <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between gap-4 bg-white">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-xl border border-[#e2e8f0] text-xs font-bold text-[#434655] hover:bg-[#f8f9ff] hover:text-[#004ac6] transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver</span>
        </button>
        <div className="h-5 w-px bg-slate-200" />
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#eff4ff] text-[#004ac6]">
            {type === "servicio" ? (
              <Wrench className="w-4 h-4" />
            ) : (
              <Package className="w-4 h-4" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#0b1c30]">
              {productToEdit
                ? `Editar ${type === "servicio" ? "Servicio" : "Producto"}`
                : `Nuevo ${type === "servicio" ? "Servicio" : "Producto"}`}
            </h2>
          </div>
        </div>
      </div>

      {/* Selector de Tipo cuando se está creando */}
      {!productToEdit && (
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => handleTypeSwitch("producto")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
              type === "producto"
                ? "bg-white text-[#004ac6] shadow-2xs"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Producto
          </button>
          <button
            type="button"
            onClick={() => handleTypeSwitch("servicio")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
              type === "servicio"
                ? "bg-white text-[#004ac6] shadow-2xs"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Servicio
          </button>
        </div>
      )}
    </div>
  ) : (
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-[#eff4ff] text-[#004ac6]">
          {type === "servicio" ? (
            <Wrench className="w-4 h-4" />
          ) : (
            <Package className="w-4 h-4" />
          )}
        </div>
        <h3 className="text-sm font-bold text-slate-800">
          {productToEdit
            ? `Editar ${type === "servicio" ? "Servicio" : "Producto"}`
            : `Nuevo ${type === "servicio" ? "Servicio" : "Producto"}`}
        </h3>
      </div>
      <button aria-label="Cerrar"
        type="button"
        onClick={onClose}
        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const content = (
    <div
      className={
        embedded
          ? "bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden w-full"
          : "bg-white rounded-xl shadow-2xl border border-[#e2e8f0] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]"
      }
    >
      {headerNode}

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-4 text-xs">
          {/* Selector de Tipo en modo popup */}
          {!embedded && !productToEdit && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => handleTypeSwitch("producto")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                  type === "producto"
                    ? "bg-white text-[#004ac6] shadow-2xs"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                Producto
              </button>
              <button
                type="button"
                onClick={() => handleTypeSwitch("servicio")}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                  type === "servicio"
                    ? "bg-white text-[#004ac6] shadow-2xs"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                Servicio
              </button>
            </div>
          )}

          {/* 1. Datos Generales */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label htmlFor="product-modal-field-1" className="block text-[11px] font-semibold text-slate-700 mb-1">
                {type === "servicio" ? "Nombre del Servicio *" : "Nombre del Producto *"}
              </label>
              <input id="product-modal-field-1"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  type === "servicio"
                    ? "Ej. Instalación de red o Soporte técnico"
                    : "Ej. Router Wi-Fi Dual Band"
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="product-modal-field-2" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Código *
              </label>
              <input id="product-modal-field-2"
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder={type === "servicio" ? "SRV-001" : "PRD-001"}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="product-modal-field-3" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Estado
              </label>
              <select id="product-modal-field-3"
                value={status}
                onChange={(e) => setStatus(e.target.value as "activo" | "inactivo")}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 ${
              type === "producto" ? "md:grid-cols-3" : "md:grid-cols-2"
            } gap-3`}
          >
            <div>
              <label htmlFor="product-modal-field-4" className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Categoría</span>
                <button
                  type="button"
                  onClick={() => {
                    setCatBrandMode("categoria");
                    setIsCatBrandOpen(true);
                  }}
                  className="text-[#004ac6] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Nueva
                </button>
              </label>
              <select id="product-modal-field-4"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
              >
                <option value="">Sin categoría</option>
                {inventoryCategories.filter(c => c.itemType === "ambos" || c.itemType === type).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {type === "producto" && (
              <div>
                <label htmlFor="product-modal-field-5" className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Marca</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCatBrandMode("marca");
                      setIsCatBrandOpen(true);
                    }}
                    className="text-[#004ac6] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Nueva
                  </button>
                </label>
                <select id="product-modal-field-5"
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
                >
                  <option value="">Sin marca</option>
                  {inventoryBrands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="product-modal-field-6" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Unidad
              </label>
              <select id="product-modal-field-6"
                value={unit}
                onChange={(e) => setUnit(e.target.value as UnitOfMeasure)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
              >
                {type === "servicio" ? (
                  <>
                    <option value="servicio">Servicio</option>
                    <option value="hora">Hora</option>
                    <option value="unidad">Unidad</option>
                  </>
                ) : (
                  <>
                    <option value="unidad">Unidad</option>
                    <option value="metro">Metro</option>
                    <option value="rollo">Rollo</option>
                    <option value="caja">Caja</option>
                    <option value="kit">Kit</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="product-modal-field-7" className="block text-[11px] font-semibold text-slate-700 mb-1">
              Descripción (Opcional)
            </label>
            <input id="product-modal-field-7"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalle breve del producto o servicio..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
            />
          </div>

          {/* 2. Precios e Impuestos */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="font-bold text-[11px] uppercase tracking-wider text-[#004ac6] flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Precios
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label htmlFor="product-modal-field-8" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Costo ($)
                </label>
                <input id="product-modal-field-8"
                  type="number"
                  step="0.01"
                  min="0"
                  value={baseCost}
                  disabled={!!productToEdit}
                  onChange={(e) => setBaseCost(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                />
              </div>

              <div>
                <label htmlFor="product-modal-field-9" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  IVA
                </label>
                <select id="product-modal-field-9"
                  value={ivaRate}
                  onChange={(e) => handleIvaRateChange(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-bold text-slate-800"
                >
                  <option value={15}>15%</option>
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                </select>
              </div>

              <div>
                <label htmlFor="product-modal-field-10" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Precio sin IVA ($)
                </label>
                <input id="product-modal-field-10"
                  type="number"
                  step="0.01"
                  min="0"
                  value={salePrice}
                  onChange={(e) => handleSalePriceChange(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-[#004ac6] focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                />
              </div>

              <div>
                <label htmlFor="product-modal-field-11" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Precio Final con IVA ($)
                </label>
                <input id="product-modal-field-11"
                  type="number"
                  step="0.01"
                  min="0"
                  value={salePriceConIva}
                  onChange={(e) => handleSalePriceConIvaChange(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/40 text-xs font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* 3. Stock y Bodegas (Solo Productos) */}
          {type === "producto" && (
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] uppercase tracking-wider text-[#004ac6] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Stock y Bodegas
                </span>
                <span className="text-[11px] text-slate-600">
                  Stock Total: <strong className="text-slate-900">{totalStock}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="product-modal-field-12" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Bodega Principal
                  </label>
                  <select id="product-modal-field-12"
                    value={defaultWarehouseId}
                    onChange={(e) => setDefaultWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
                  >
                    {inventoryWarehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="product-modal-field-13" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Stock Mínimo (Alerta)
                  </label>
                  <input id="product-modal-field-13"
                    type="number"
                    min="0"
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700">
                    {productToEdit ? "Cantidad actual por bodega" : "Stock inicial por bodega"}
                  </span>
                  {productToEdit && (
                    <span className="text-[10px] text-slate-500">
                      Usa Ajustes o Transferencias para cambiar cantidades
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {inventoryWarehouses.map((w) => {
                    const whStock = stockByWarehouse[w.id] ?? 0;
                    return (
                      <div
                        key={w.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-slate-200"
                      >
                        <span className="truncate text-[11px] font-semibold text-slate-700 pr-2">
                          {w.name}
                        </span>
                        {productToEdit ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-xs">
                            {whStock}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            value={whStock}
                            onChange={(e) =>
                              handleStockByWhChange(w.id, Number(e.target.value))
                            }
                            className="w-16 px-2 py-1 rounded border border-slate-200 text-right text-xs font-bold focus:outline-none focus:border-[#004ac6]"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Barra única de botones */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            {isSubmitting
              ? "Guardando..."
              : productToEdit
              ? "Guardar Cambios"
              : type === "servicio"
              ? "Guardar Servicio"
              : "Guardar Producto"}
          </button>
        </div>
      </form>
    </div>
  );

  if (embedded) {
    return (
      <>
        {content}
        <CategoryBrandModal
          isOpen={isCatBrandOpen}
          onClose={() => setIsCatBrandOpen(false)}
          mode={catBrandMode}
        />
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        {content}
      </div>

      <CategoryBrandModal
        isOpen={isCatBrandOpen}
        onClose={() => setIsCatBrandOpen(false)}
        mode={catBrandMode}
      />
    </>
  );
}
