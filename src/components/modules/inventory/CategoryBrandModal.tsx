"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { X, Tag, Award, CheckCircle } from "lucide-react";

interface CategoryBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "categoria" | "marca";
  onCreated?: (id: string, name: string) => void;
}

export function CategoryBrandModal({
  isOpen,
  onClose,
  mode,
  onCreated,
}: CategoryBrandModalProps) {
  const { addCategory, addBrand } = useApp();
  const { showSuccess, showError } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<"producto" | "servicio" | "ambos">("ambos");
  const [originCountry, setOriginCountry] = useState("Ecuador");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showError("Campo Obligatorio", "Por favor ingresa un nombre válido.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "categoria") {
        await addCategory({
          name: name.trim(),
          description: description.trim(),
          itemType,
        });
        showSuccess("Categoría Creada", `La categoría "${name}" ha sido registrada.`);
      } else {
        await addBrand({
          name: name.trim(),
          originCountry: originCountry.trim() || undefined,
        });
        showSuccess("Marca Creada", `La marca "${name}" ha sido registrada.`);
      }

      if (onCreated) {
        onCreated("", name.trim());
      }
      setName("");
      setDescription("");
      onClose();
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo registrar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#eff4ff] text-[#004ac6]">
              {mode === "categoria" ? <Tag className="w-4 h-4" /> : <Award className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {mode === "categoria" ? "Nueva Categoría" : "Nueva Marca / Fabricante"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {mode === "categoria"
                  ? "Clasificación para productos o servicios"
                  : "Fabricante o marca de equipamiento ISP"}
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
          <div className="p-5 space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Nombre de {mode === "categoria" ? "la Categoría" : "la Marca"} *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  mode === "categoria"
                    ? "Ej. Equipos GPON & ONTs, Herrajes"
                    : "Ej. Huawei, MikroTik, Ubiquiti"
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                autoFocus
              />
            </div>

            {mode === "categoria" ? (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Aplica a
                  </label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] bg-white"
                  >
                    <option value="ambos">Productos Físicos y Servicios</option>
                    <option value="producto">Solo Productos Físicos</option>
                    <option value="servicio">Solo Servicios Técnicos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Descripción / Alcance (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Breve detalle del tipo de material o servicio..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6] resize-none"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  País de Origen / Procedencia (Opcional)
                </label>
                <input
                  type="text"
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                  placeholder="Ej. China, Letonia, EE.UU., Ecuador"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {isSubmitting ? "Guardando..." : "Guardar Registro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
