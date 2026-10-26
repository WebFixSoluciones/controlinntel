"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  X,
  SlidersHorizontal,
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
      const prod =
        inventoryProducts.find((p) => p.id === defaultProductId) ||
        inventoryProducts.filter((p) => p.tracksStock)[0];
      setProductId(prod?.id || "");
      setQuantity(1);
      setUnitCost(prod?.baseCost || 0);
      setConcept("");
      setType("manual_ingreso");
    }
  }, [
    isOpen,
    defaultWarehouseId,
    defaultProductId,
    inventoryWarehouses,
    inventoryProducts,
  ]);

  if (!isOpen) return null;

  const selectedWh = inventoryWarehouses.find((w) => w.id === warehouseId);
  const selectedProduct = inventoryProducts.find((p) => p.id === productId);
  const currentWhStock = Number(
    selectedProduct?.stockByWarehouse?.[warehouseId] || 0
  );
  const newCalculatedStock =
    type === "manual_ingreso"
      ? currentWhStock + Number(quantity || 0)
      : Math.max(0, currentWhStock - Number(quantity || 0));

  const isEgresoExceeding =
    type === "manual_egreso" && quantity > currentWhStock;

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
      showError("Bodega obligatoria", "Selecciona una bodega.");
      return;
    }

    if (!selectedProduct) {
      showError("Producto obligatorio", "Selecciona un producto.");
      return;
    }

    if (quantity <= 0) {
      showError("Cantidad inválida", "La cantidad debe ser mayor a cero.");
      return;
    }

    if (isEgresoExceeding) {
      showError(
        "Stock insuficiente",
        `Solo hay ${currentWhStock} disponibles en esta bodega.`
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
        "Ajuste guardado",
        `Se registró el ${
          type === "manual_ingreso" ? "ingreso" : "egreso"
        } de ${quantity} en ${selectedWh.name}.`
      );
      onClose();
    } catch (err: any) {
      showError("Error al guardar", err?.message || "No se pudo guardar el ajuste.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerNode = embedded ? (
    <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center gap-3 bg-white">
      <button
        type="button"
        onClick={onClose}
        className="px-3 py-1.5 rounded-xl border border-[#e2e8f0] text-xs font-bold text-[#434655] hover:bg-[#f8f9ff] hover:text-[#004ac6] transition-all flex items-center gap-1.5 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Volver</span>
      </button>
      <div className="h-5 w-px bg-slate-200" />
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
          <SlidersHorizontal className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-bold text-[#0b1c30]">Nuevo Ajuste de Stock</h2>
      </div>
    </div>
  ) : (
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
          <SlidersHorizontal className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Nuevo Ajuste de Stock</h3>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const formContent = (
    <div
      className={
        embedded
          ? "bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden w-full max-w-2xl"
          : "bg-white rounded-xl shadow-2xl border border-[#e2e8f0] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95"
      }
    >
      {headerNode}
      <form onSubmit={handleSubmit}>
        <div className="p-5 space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setType("manual_ingreso")}
              className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                type === "manual_ingreso"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              Sumar Stock (+)
            </button>
            <button
              type="button"
              onClick={() => setType("manual_egreso")}
              className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                type === "manual_egreso"
                  ? "bg-rose-50 border-rose-300 text-rose-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <MinusCircle className="w-4 h-4 text-rose-600" />
              Restar Stock (-)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Bodega *
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
              >
                {inventoryWarehouses
                  .filter((w) => w.status === "activo")
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Producto *
              </label>
              <select
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
              >
                {inventoryProducts
                  .filter((p) => p.tracksStock && p.status === "activo")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Actual: {p.stockByWarehouse?.[warehouseId] || 0})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Cantidad *
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Costo Unitario ($)
              </label>
              <input
                type="number"
                step="0.01"
                disabled={type === "manual_egreso"}
                value={type === "manual_ingreso" ? unitCost : selectedProduct?.baseCost || 0}
                onChange={(e) => setUnitCost(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Nuevo Stock
              </label>
              <div
                className={`px-3 py-2 rounded-lg border font-bold flex items-center justify-between ${
                  isEgresoExceeding
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                <span className="text-[11px] text-slate-500 font-normal">
                  {currentWhStock} {type === "manual_ingreso" ? "+" : "-"} {quantity} =
                </span>
                <span>{newCalculatedStock}</span>
              </div>
            </div>
          </div>

          {isEgresoExceeding && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>No puedes restar más unidades de las que hay en esta bodega.</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Motivo *
            </label>
            <input
              type="text"
              required
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej. Conteo físico, daño o reposición"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isEgresoExceeding}
            className={`px-5 py-2 rounded-lg text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              type === "manual_ingreso"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            {isSubmitting ? "Guardando..." : "Guardar Ajuste"}
          </button>
        </div>
      </form>
    </div>
  );

  if (embedded) {
    return <div className="w-full animate-in fade-in duration-200">{formContent}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      {formContent}
    </div>
  );
}
