"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  X,
  ArrowRightLeft,
  Building2,
  Package,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultOriginWarehouseId?: string;
  defaultProductId?: string;
}

export function TransferModal({
  isOpen,
  onClose,
  defaultOriginWarehouseId,
  defaultProductId,
}: TransferModalProps) {
  const { inventoryProducts, inventoryWarehouses, executeTransfer } = useApp();
  const { showSuccess, showError } = useToast();

  const [originWhId, setOriginWhId] = useState("");
  const [destWhId, setDestWhId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize defaults
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
      setProductId(defaultProductId || inventoryProducts.filter((p) => p.tracksStock)[0]?.id || "");
      setQuantity(1);
      setReason("");
    }
  }, [isOpen, defaultOriginWarehouseId, defaultProductId, inventoryWarehouses, inventoryProducts]);

  if (!isOpen) return null;

  const selectedProduct = inventoryProducts.find((p) => p.id === productId);
  const availableOriginStock = Number(selectedProduct?.stockByWarehouse?.[originWhId] || 0);
  const availableDestStock = Number(selectedProduct?.stockByWarehouse?.[destWhId] || 0);
  const isStockSufficient = availableOriginStock >= quantity && quantity > 0;
  const isSameWarehouse = originWhId === destWhId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSameWarehouse) {
      showError("Bodegas Inválidas", "La bodega de origen y de destino no pueden ser iguales.");
      return;
    }

    if (!selectedProduct) {
      showError("Producto Requerido", "Por favor selecciona un producto válido.");
      return;
    }

    if (quantity <= 0) {
      showError("Cantidad Inválida", "La cantidad a transferir debe ser mayor a cero.");
      return;
    }

    if (availableOriginStock < quantity) {
      showError(
        "Stock Insuficiente",
        `La bodega de origen solo dispone de ${availableOriginStock} ${selectedProduct.unit}s.`
      );
      return;
    }

    if (!reason.trim()) {
      showError("Motivo Requerido", "Por favor ingresa una justificación para el traslado.");
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
        "Traslado Exitoso",
        `Se transfirieron ${quantity} ${selectedProduct.unit}s de "${selectedProduct.name}" correctamente.`
      );
      onClose();
    } catch (err: any) {
      showError("Error en Traslado", err?.message || "No se pudo procesar la transferencia.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-50 text-[#004ac6]">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Transferencia Inter-Bodegas
              </h3>
              <p className="text-[11px] text-slate-500">
                Traslado físico y contable de materiales y equipos entre almacenes
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
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 text-xs">
            {/* Bodegas Origen y Destino */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-rose-500" />
                  Bodega Origen (Salida) *
                </label>
                <select
                  value={originWhId}
                  onChange={(e) => setOriginWhId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
                >
                  {inventoryWarehouses
                    .filter((w) => w.status === "activo")
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                </select>
                <div className="mt-1.5 text-[11px] text-slate-500">
                  Stock actual:{" "}
                  <span className="font-bold text-slate-800">
                    {availableOriginStock} {selectedProduct?.unit || "u"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                  Bodega Destino (Entrada) *
                </label>
                <select
                  value={destWhId}
                  onChange={(e) => setDestWhId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 bg-white font-medium ${
                    isSameWarehouse
                      ? "border-rose-300 focus:border-rose-500 bg-rose-50/20"
                      : "border-slate-200 focus:border-[#004ac6]"
                  }`}
                >
                  {inventoryWarehouses
                    .filter((w) => w.status === "activo")
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                </select>
                <div className="mt-1.5 text-[11px] text-slate-500">
                  Stock actual:{" "}
                  <span className="font-bold text-slate-800">
                    {availableDestStock} {selectedProduct?.unit || "u"}
                  </span>
                </div>
              </div>
            </div>

            {isSameWarehouse && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>La bodega de origen y de destino deben ser diferentes.</span>
              </div>
            )}

            {/* Producto Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                Producto o Equipo a Trasladar *
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
              >
                {inventoryProducts
                  .filter((p) => p.tracksStock && p.status === "activo")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} - (Stock global: {p.stock} {p.unit})
                    </option>
                  ))}
              </select>
            </div>

            {/* Cantidad & Disponibilidad */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Cantidad a Transferir ({selectedProduct?.unit || "unidades"}) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, availableOriginStock)}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 ${
                    !isStockSufficient
                      ? "border-rose-300 bg-rose-50/30 text-rose-700 focus:ring-rose-200 focus:border-rose-500"
                      : "border-slate-200 focus:ring-[#004ac6]/20 focus:border-[#004ac6] text-slate-800"
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Disponibilidad en Origen
                </label>
                <div
                  className={`px-3 py-2 rounded-xl border flex items-center justify-between font-medium ${
                    availableOriginStock <= 0
                      ? "bg-rose-50 border-rose-200 text-rose-700"
                      : availableOriginStock < quantity
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {availableOriginStock >= quantity ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    {availableOriginStock >= quantity ? "Stock disponible" : "Insuficiente"}
                  </span>
                  <span className="font-bold">
                    {availableOriginStock} {selectedProduct?.unit || "u"}
                  </span>
                </div>
              </div>
            </div>

            {/* Motivo del Traslado */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Motivo / Justificación de la Transferencia *
              </label>
              <textarea
                rows={2}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Reabastecimiento de cuadrilla móvil para despliegue de instalaciones FTTH..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
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
              disabled={isSubmitting || !isStockSufficient || isSameWarehouse}
              className="px-5 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRightLeft className="w-4 h-4" />
              {isSubmitting ? "Procesando..." : "Confirmar Traslado"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
