"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { X, Tag, Award, CheckCircle, ArrowLeft } from "lucide-react";

interface CategoryBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "categoria" | "marca";
  onCreated?: (id: string, name: string) => void;
  embedded?: boolean;
}

export function CategoryBrandModal({
  isOpen,
  onClose,
  mode,
  onCreated,
  embedded = false,
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

  const headerNode = embedded ? (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] mb-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl bg-white border border-[#e2e8f0] hover:bg-slate-50 text-[#434655] transition-colors cursor-pointer shadow-2xs"
          title="Volver a Categorías y Marcas"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#737686] mb-0.5">
            <span>Inventarios</span>
            <span>/</span>
            <span>Categorías y Marcas</span>
            <span>/</span>
            <span className="text-[#004ac6] font-bold">
              {mode === "categoria" ? "Nueva Categoría" : "Nueva Marca / Fabricante"}
            </span>
          </div>
          <h2 className="text-lg font-black text-[#0b1c30] flex items-center gap-2">
            {mode === "categoria" ? (
              <Tag className="w-5 h-5 text-[#004ac6]" />
            ) : (
              <Award className="w-5 h-5 text-[#004ac6]" />
            )}
            {mode === "categoria" ? "Registrar Categoría de Catálogo" : "Registrar Marca o Fabricante"}
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
          form="category-brand-form-element"
          disabled={isSubmitting}
          className="px-5 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          {isSubmitting ? "Guardando..." : "Guardar Registro"}
        </button>
      </div>
    </div>
  ) : (
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
        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const formBody = (
    <div className={embedded ? "bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden w-full max-w-2xl mx-auto" : "bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95"}>
      {!embedded && headerNode}
      {/* Form Body */}
      <form id="category-brand-form-element" onSubmit={handleSubmit}>
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
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            {isSubmitting ? "Guardando..." : "Guardar Registro"}
          </button>
        </div>
      </form>
    </div>
  );

  if (embedded) {
    return (
      <div className="w-full animate-in fade-in duration-200">
        {headerNode}
        {formBody}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      {formBody}
    </div>
  );
}
