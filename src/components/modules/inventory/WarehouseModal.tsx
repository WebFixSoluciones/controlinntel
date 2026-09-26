"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Warehouse } from "@/types";
import { X, Building2, MapPin, Phone, User, CheckCircle, ShieldCheck } from "lucide-react";

interface WarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouseToEdit?: Warehouse | null;
}

export function WarehouseModal({
  isOpen,
  onClose,
  warehouseToEdit,
}: WarehouseModalProps) {
  const { addWarehouse, updateWarehouse } = useApp();
  const { showSuccess, showError } = useToast();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("Quito, Pichincha");
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
      setCity(warehouseToEdit.city || "Quito, Pichincha");
      setAddress(warehouseToEdit.address || "");
      setResponsibleName(warehouseToEdit.responsibleName || "");
      setResponsiblePhone(warehouseToEdit.responsiblePhone || "");
      setIsDefault(!!warehouseToEdit.isDefault);
      setStatus(warehouseToEdit.status);
    } else {
      setCode("");
      setName("");
      setCity("Quito, Pichincha");
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
      showError("Campos Obligatorios", "Por favor completa el código y nombre de la bodega.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (warehouseToEdit) {
        await updateWarehouse(warehouseToEdit.id, {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          city: city.trim(),
          address: address.trim(),
          responsibleName: responsibleName.trim(),
          responsiblePhone: responsiblePhone.trim(),
          isDefault,
          status,
        });
        showSuccess("Bodega Actualizada", `La bodega "${name}" ha sido modificada.`);
      } else {
        await addWarehouse({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          city: city.trim(),
          address: address.trim(),
          responsibleName: responsibleName.trim(),
          responsiblePhone: responsiblePhone.trim(),
          isDefault,
          status,
        });
        showSuccess("Bodega Registrada", `La bodega "${name}" ha sido creada exitosamente.`);
      }
      onClose();
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo procesar la bodega.");
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
            <div className="p-2.5 rounded-xl bg-[#eff4ff] text-[#004ac6]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {warehouseToEdit ? "Editar Bodega / Almacén" : "Nueva Bodega / Almacén"}
              </h3>
              <p className="text-[11px] text-slate-500">
                Gestión de centros de almacenamiento, nodos y unidades móviles
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Código de Bodega *
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ej. BOD-CENTRAL, BOD-MOV-01"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Estado Operativo
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white"
                >
                  <option value="activo">Activa</option>
                  <option value="inactivo">Inactiva / Bloqueada</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Nombre de la Bodega *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Bodega Central - Quito (NOC), Bodega Móvil Cuadrilla 1"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Ciudad / Provincia
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ej. Quito, Pichincha"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={responsiblePhone}
                  onChange={(e) => setResponsiblePhone(e.target.value)}
                  placeholder="+593 99 ..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Custodio / Responsable de Bodega
              </label>
              <input
                type="text"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                placeholder="Ej. Ing. Diego Cárdenas, Téc. Roberto Gómez"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Dirección Física o Ubicación
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej. Av. Amazonas N45-12 y Gaspar de Villarroel, Edificio Corporativo..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] resize-none"
              />
            </div>

            <div className="pt-1">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded text-[#004ac6] focus:ring-[#004ac6]"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800">Bodega Predeterminada</span>
                  <p className="text-[11px] text-slate-500">
                    Se seleccionará por defecto en ventas, compras y consultas de stock
                  </p>
                </div>
              </label>
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
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {isSubmitting ? "Guardando..." : warehouseToEdit ? "Actualizar Bodega" : "Guardar Bodega"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
