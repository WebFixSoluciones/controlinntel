"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  X,
  SlidersHorizontal,
  Building2,
  Package,
  PlusCircle,
  MinusCircle,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultWarehouseId?: string;
  defaultProductId?: string;
  embedded?: boolean;
}

export function AdjustmentModal({
  isOpen,
  onClose,
  defaultWarehouseId,
  defaultProductId,
  embedded = false,
}: AdjustmentModalProps) {
  const { inventoryProducts, inventoryWarehouses, executeAdjustment } = useApp();
  const { showSuccess, showError } = useToast();

  const [warehouseId, setWarehouseId] = useState("");
  const [type, setType] = useState<"manual_ingreso" | "manual_egreso">("manual_ingreso");
  const [concept, setConcept] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setWarehouseId(defaultWarehouseId || inventoryWarehouses[0]?.id || "");
      const prod = inventoryProducts.find((p) => p.id === defaultProductId) || inventoryProducts.filter((p) => p.tracksStock)[0];
      setProductId(prod?.id || "");
      setQuantity(1);
      setUnitCost(prod?.baseCost || 0);
      setConcept("Ajuste por toma física de inventario");
      setType("manual_ingreso");
    }
  }, [isOpen, defaultWarehouseId, defaultProductId, inventoryWarehouses, inventoryProducts]);

  if (!isOpen) return null;

  const selectedWh = inventoryWarehouses.find((w) => w.id === warehouseId);
  const selectedProduct = inventoryProducts.find((p) => p.id === productId);
  const currentWhStock = Number(selectedProduct?.stockByWarehouse?.[warehouseId] || 0);
  const newCalculatedStock =
    type === "manual_ingreso"
      ? currentWhStock + Number(quantity || 0)
      : Math.max(0, currentWhStock - Number(quantity || 0));

  const isEgresoExceeding = type === "manual_egreso" && quantity > currentWhStock;

  const handleProductChange = (id: string) => {
    setProductId(id);
    const prod = inventoryProducts.find((p) => p.id === id);
    if (prod) {
      setUnitCost(prod.baseCost);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWh) {
      showError("Bodega Requerida", "Por favor selecciona una bodega válida.");
      return;
    }

    if (!selectedProduct) {
      showError("Producto Requerido", "Por favor selecciona un producto a ajustar.");
      return;
    }

    if (quantity <= 0) {
      showError("Cantidad Inválida", "La cantidad debe ser mayor a cero.");
      return;
    }

    if (isEgresoExceeding) {
      showError(
        "Stock Insuficiente",
        `No es posible egresar ${quantity} unidades porque solo existen ${currentWhStock} en la bodega seleccionada.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await executeAdjustment({
        warehouseId,
        type,
        concept: concept.trim() || "Ajuste de inventario",
        items: [
          {
            productId,
            type: type === "manual_ingreso" ? "ingreso" : "egreso",
            quantity,
            unitCost: type === "manual_ingreso" ? unitCost : selectedProduct.baseCost,
          },
        ],
      });

      showSuccess(
        "Ajuste Procesado",
        `Se registró el ${type === "manual_ingreso" ? "ingreso" : "egreso"} de ${quantity} ${selectedProduct.unit}s en ${selectedWh.name}.`
      );
      onClose();
    } catch (err: any) {
      showError("Error al Ajustar", err?.message || "No se pudo completar el ajuste de stock.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerNode = embedded ? (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] mb-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl bg-white border border-[#e2e8f0] hover:bg-slate-50 text-[#434655] transition-colors cursor-pointer shadow-2xs"
          title="Volver al Listado de Ajustes"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#737686] mb-0.5">
            <button
              type="button"
              onClick={onClose}
              className="hover:text-[#004ac6] hover:underline cursor-pointer transition-colors"
              title="Volver a Inventarios"
            >
              Inventarios
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={onClose}
              className="hover:text-[#004ac6] hover:underline cursor-pointer transition-colors"
              title="Volver a Ajustes"
            >
              Ajustes de Inventario
            </button>
            <span>/</span>
            <span className="text-[#004ac6] font-bold">Nuevo Ajuste Manual</span>
          </div>
          <h2 className="text-lg font-black text-[#0b1c30] flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-amber-600" />
            Ajuste Manual de Inventario
          </h2>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-xl border border-[#e2e8f0] bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form="adjustment-form-element"
          disabled={isSubmitting || isEgresoExceeding}
          className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            type === "manual_ingreso"
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-rose-600 hover:bg-rose-700"
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          {isSubmitting ? "Registrando..." : "Confirmar Ajuste"}
        </button>
      </div>
    </div>
  ) : (
    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
          <SlidersHorizontal className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">
            Ajuste Manual de Inventario
          </h3>
          <p className="text-[11px] text-slate-500">
            Corrección de diferencias por toma física, sobrantes o mermas
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const formContent = (
    <div className={embedded ? "bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden w-full max-w-4xl mx-auto" : "bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95"}>
      {!embedded && headerNode}
      <form id="adjustment-form-element" onSubmit={handleSubmit}>
        <div className="p-6 md:p-8 space-y-5 text-xs">
          {/* Tipo de Ajuste Tabs */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
              Sentido del Ajuste *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("manual_ingreso")}
                className={`py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                  type === "manual_ingreso"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                Ingreso (+ Sobrante)
              </button>
              <button
                type="button"
                onClick={() => setType("manual_egreso")}
                className={`py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                  type === "manual_egreso"
                    ? "bg-rose-50 border-rose-300 text-rose-800 shadow-2xs ring-2 ring-rose-500/20"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <MinusCircle className="w-4 h-4 text-rose-600" />
                Egreso (- Faltante / Daño)
              </button>
            </div>
          </div>

          {/* Bodega y Producto en 2 columnas en pantalla grande */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                Bodega Afectada *
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
              >
                {inventoryWarehouses
                  .filter((w) => w.status === "activo")
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} - {w.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                Producto o Material *
              </label>
              <select
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
              >
                {inventoryProducts
                  .filter((p) => p.tracksStock && p.status === "activo")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} - (Stock: {p.stockByWarehouse?.[warehouseId] || 0} {p.unit})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Cantidad y Costo Unitario */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Cantidad a Ajustar ({selectedProduct?.unit || "u"}) *
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                {type === "manual_ingreso" ? "Costo Unitario de Entrada ($)" : "Costo Valorado Promedio ($)"}
              </label>
              <input
                type="number"
                step="0.01"
                disabled={type === "manual_egreso"}
                value={type === "manual_ingreso" ? unitCost : selectedProduct?.baseCost || 0}
                onChange={(e) => setUnitCost(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>

          {/* Resumen del Saldo Resultante */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-[11px] text-slate-500 block">Saldo Actual en Bodega:</span>
              <span className="font-bold text-slate-700">
                {currentWhStock} {selectedProduct?.unit || "u"}
              </span>
            </div>

            <div className="text-center font-bold text-slate-400">
              {type === "manual_ingreso" ? "+" : "-"} {quantity}
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Saldo Resultante:</span>
              <span
                className={`font-black text-sm ${
                  isEgresoExceeding ? "text-rose-600" : "text-emerald-700"
                }`}
              >
                {newCalculatedStock} {selectedProduct?.unit || "u"}
              </span>
            </div>
          </div>

          {isEgresoExceeding && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>No puedes egresar más unidades de las disponibles en esta bodega.</span>
            </div>
          )}

          {/* Concepto / Motivo */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Motivo / Justificación del Ajuste *
            </label>
            <textarea
              rows={3}
              required
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej. Diferencia detectada en conteo físico de cuadrilla de técnicos..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 md:px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
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
            disabled={isSubmitting || isEgresoExceeding}
            className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              type === "manual_ingreso"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            {isSubmitting ? "Registrando..." : "Confirmar Ajuste"}
          </button>
        </div>
      </form>
    </div>
  );

  if (embedded) {
    return (
      <div className="w-full animate-in fade-in duration-200">
        {headerNode}
        {formContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      {formContent}
    </div>
  );
}
