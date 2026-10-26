"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  X,
  ArrowRightLeft,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultOriginWarehouseId?: string;
  defaultProductId?: string;
  embedded?: boolean;
}

export function TransferModal({
  isOpen,
  onClose,
  defaultOriginWarehouseId,
  defaultProductId,
  embedded = false,
}: TransferModalProps) {
  const { inventoryProducts, inventoryWarehouses, executeTransfer } = useApp();
  const { showSuccess, showError } = useToast();

  const [originWhId, setOriginWhId] = useState("");
  const [destWhId, setDestWhId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const firstWh = inventoryWarehouses[0]?.id || "";
      const secondWh = inventoryWarehouses[1]?.id || inventoryWarehouses[0]?.id || "";
      setOriginWhId(defaultOriginWarehouseId || firstWh);
      setDestWhId(
        defaultOriginWarehouseId && defaultOriginWarehouseId === secondWh
          ? firstWh
          : secondWh
      );
      setProductId(
        defaultProductId || inventoryProducts.filter((p) => p.tracksStock)[0]?.id || ""
      );
      setQuantity(1);
      setReason("");
    }
  }, [
    isOpen,
    defaultOriginWarehouseId,
    defaultProductId,
    inventoryWarehouses,
    inventoryProducts,
  ]);

  if (!isOpen) return null;

  const selectedProduct = inventoryProducts.find((p) => p.id === productId);
  const availableOriginStock = Number(
    selectedProduct?.stockByWarehouse?.[originWhId] || 0
  );
  const availableDestStock = Number(
    selectedProduct?.stockByWarehouse?.[destWhId] || 0
  );
  const isStockSufficient = availableOriginStock >= quantity && quantity > 0;
  const isSameWarehouse = originWhId === destWhId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSameWarehouse) {
      showError("Bodegas iguales", "Selecciona una bodega destino diferente a la de origen.");
      return;
    }

    if (!selectedProduct) {
      showError("Producto obligatorio", "Selecciona un producto para transferir.");
      return;
    }

    if (quantity <= 0) {
      showError("Cantidad inválida", "La cantidad debe ser mayor a cero.");
      return;
    }

    if (availableOriginStock < quantity) {
      showError(
        "Stock insuficiente",
        `La bodega origen solo tiene ${availableOriginStock} disponibles.`
      );
      return;
    }

    if (!reason.trim()) {
      showError("Motivo obligatorio", "Por favor ingresa el motivo de la transferencia.");
      return;
    }

    setIsSubmitting(true);
    try {
      await executeTransfer({
        originWarehouseId: originWhId,
        destWarehouseId: destWhId,
        productId,
        quantity,
        reason: reason.trim(),
      });

      showSuccess(
        "Transferencia realizada",
        `Se transfirieron ${quantity} de "${selectedProduct.name}".`
      );
      onClose();
    } catch (err: any) {
      showError("Error al transferir", err?.message || "No se pudo realizar la transferencia.");
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
        <div className="p-2 rounded-xl bg-[#eff4ff] text-[#004ac6]">
          <ArrowRightLeft className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-bold text-[#0b1c30]">Nueva Transferencia</h2>
      </div>
    </div>
  ) : (
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-[#eff4ff] text-[#004ac6]">
          <ArrowRightLeft className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Nueva Transferencia</h3>
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

  const formBody = (
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Desde Bodega *
              </label>
              <select
                value={originWhId}
                onChange={(e) => setOriginWhId(e.target.value)}
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
              <div className="mt-1 text-[11px] text-slate-500">
                Disponible: <strong className="text-slate-800">{availableOriginStock}</strong>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Hacia Bodega *
              </label>
              <select
                value={destWhId}
                onChange={(e) => setDestWhId(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 bg-white font-medium ${
                  isSameWarehouse
                    ? "border-rose-300 focus:border-rose-500 bg-rose-50/20"
                    : "border-slate-200 focus:border-[#004ac6]"
                }`}
              >
                {inventoryWarehouses
                  .filter((w) => w.status === "activo")
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
              <div className="mt-1 text-[11px] text-slate-500">
                Stock actual: <strong className="text-slate-800">{availableDestStock}</strong>
              </div>
            </div>
          </div>

          {isSameWarehouse && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>Selecciona dos bodegas diferentes.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Producto *
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
              >
                {inventoryProducts
                  .filter((p) => p.tracksStock && p.status === "activo")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Cantidad *
              </label>
              <input
                type="number"
                min="1"
                max={Math.max(1, availableOriginStock)}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className={`w-full px-3 py-2 rounded-lg border text-xs font-bold focus:outline-hidden focus:ring-2 ${
                  !isStockSufficient
                    ? "border-rose-300 bg-rose-50/30 text-rose-700"
                    : "border-slate-200 focus:ring-[#004ac6]/20 focus:border-[#004ac6] text-slate-800"
                }`}
              />
            </div>
          </div>

          {!isStockSufficient && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Cantidad supera el stock disponible en la bodega origen
              </span>
              <span className="font-bold">Disponible: {availableOriginStock}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Motivo *
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Reposición de materiales"
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
            disabled={isSubmitting || !isStockSufficient || isSameWarehouse}
            className="px-5 py-2 rounded-lg bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSubmitting ? "Transferiendo..." : "Guardar Transferencia"}
          </button>
        </div>
      </form>
    </div>
  );

  if (embedded) {
    return <div className="w-full animate-in fade-in duration-200">{formBody}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      {formBody}
    </div>
  );
}
