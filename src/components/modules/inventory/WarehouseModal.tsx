"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Warehouse } from "@/types";
import { X, Building2, CheckCircle, ArrowLeft } from "lucide-react";

interface WarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouseToEdit?: Warehouse | null;
  embedded?: boolean;
}

export function WarehouseModal({
  isOpen,
  onClose,
  warehouseToEdit,
  embedded = false,
}: WarehouseModalProps) {
  const { addWarehouse, updateWarehouse } = useApp();
  const { showSuccess, showError } = useToast();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("Quito");
  const [address, setAddress] = useState("");
  const [responsibleName, setResponsibleName] = useState("");
  const [responsiblePhone, setResponsiblePhone] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [status, setStatus] = useState<"activo" | "inactivo">("activo");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (warehouseToEdit) {
      setCode(warehouseToEdit.code);
      setName(warehouseToEdit.name);
      setCity(warehouseToEdit.city || "Quito");
      setAddress(warehouseToEdit.address || "");
      setResponsibleName(warehouseToEdit.responsibleName || "");
      setResponsiblePhone(warehouseToEdit.responsiblePhone || "");
      setIsDefault(!!warehouseToEdit.isDefault);
      setStatus(warehouseToEdit.status);
    } else {
      setCode(`BOD-${Date.now().toString().slice(-3)}`);
      setName("");
      setCity("Quito");
      setAddress("");
      setResponsibleName("");
      setResponsiblePhone("");
      setIsDefault(false);
      setStatus("activo");
    }
  }, [warehouseToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      showError("Campos obligatorios", "Completa el código y el nombre de la bodega.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        city: city.trim(),
        address: address.trim(),
        responsibleName: responsibleName.trim(),
        responsiblePhone: responsiblePhone.trim(),
        isDefault,
        status,
      };
      if (warehouseToEdit) {
        await updateWarehouse(warehouseToEdit.id, payload);
        showSuccess("Bodega actualizada", `La bodega "${name}" se actualizó correctamente.`);
      } else {
        await addWarehouse(payload);
        showSuccess("Bodega creada", `La bodega "${name}" se guardó correctamente.`);
      }
      onClose();
    } catch (err: any) {
      showError("Error al guardar", err?.message || "No se pudo guardar la bodega.");
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
          <Building2 className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-bold text-[#0b1c30]">
          {warehouseToEdit ? `Editar Bodega: ${warehouseToEdit.name}` : "Nueva Bodega"}
        </h2>
      </div>
    </div>
  ) : (
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-[#eff4ff] text-[#004ac6]">
          <Building2 className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">
          {warehouseToEdit ? "Editar Bodega" : "Nueva Bodega"}
        </h3>
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
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Nombre de la Bodega *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Bodega Principal, Móvil 1"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Código *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="BOD-01"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono uppercase focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "activo" | "inactivo")}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white font-medium"
              >
                <option value="activo">Activa</option>
                <option value="inactivo">Inactiva</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Responsable
              </label>
              <input
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Nombre del encargado"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Teléfono
              </label>
              <input
                type="text"
                value={responsiblePhone}
                onChange={(e) => setResponsiblePhone(e.target.value)}
                placeholder="099..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Ciudad
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ej. Quito"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Dirección (Opcional)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ubicación o referencia de la bodega"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
            />
          </div>

          <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded text-[#004ac6] focus:ring-[#004ac6]"
            />
            <span className="text-xs font-semibold text-slate-800">
              Usar como bodega principal por defecto
            </span>
          </label>
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
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            {isSubmitting
              ? "Guardando..."
              : warehouseToEdit
              ? "Guardar Cambios"
              : "Guardar Bodega"}
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
