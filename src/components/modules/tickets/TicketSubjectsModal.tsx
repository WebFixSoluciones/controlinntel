"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { X, Plus, Trash2, Pencil, Check, ListChecks } from "lucide-react";
import { TicketCategory, TicketDepartment, TicketSubject } from "@/types";

interface TicketSubjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEPARTMENTS: { value: TicketDepartment; label: string }[] = [
  { value: "soporte_tecnico", label: "Soporte Técnico NOC" },
  { value: "noc_redes", label: "NOC / Planta Externa" },
  { value: "facturacion", label: "Facturación & Cobranzas" },
  { value: "ventas", label: "Ventas & Nuevos Servicios" },
];

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "corte_fibra", label: "Falla de enlace / Corte" },
  { value: "atenuacion_alta", label: "Atenuación / Señal" },
  { value: "configuracion_ip", label: "Configuración / Red" },
  { value: "facturacion", label: "Facturación" },
  { value: "otro", label: "Otro" },
];

export function TicketSubjectsModal({ isOpen, onClose }: TicketSubjectsModalProps) {
  const { ticketSubjects, addTicketSubject, updateTicketSubject, deleteTicketSubject } = useApp();
  const { showError, showSuccess, showConfirm } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState<TicketDepartment>("soporte_tecnico");
  const [category, setCategory] = useState<TicketCategory>("otro");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDepartment("soporte_tecnico");
    setCategory("otro");
  };

  const handleEdit = (s: TicketSubject) => {
    setEditingId(s.id);
    setName(s.name);
    setDepartment(s.defaultDepartment);
    setCategory(s.category);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      showError("Asunto inválido", "Escribe un nombre de asunto de al menos 3 caracteres.");
      return;
    }
    const duplicate = ticketSubjects.some(
      (s) => s.id !== editingId && s.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      showError("Asunto duplicado", "Ya existe un asunto con ese nombre.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateTicketSubject(editingId, { name: trimmed, defaultDepartment: department, category });
        showSuccess("Asunto actualizado", `"${trimmed}" fue actualizado.`);
      } else {
        await addTicketSubject({ name: trimmed, defaultDepartment: department, category });
        showSuccess("Asunto creado", `"${trimmed}" ya está disponible al crear tickets.`);
      }
      resetForm();
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo guardar el asunto.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (s: TicketSubject) => {
    showConfirm(
      "¿Eliminar asunto?",
      `El asunto "${s.name}" ya no aparecerá al crear tickets. Los tickets existentes no se modifican.`,
      async () => {
        try {
          await deleteTicketSubject(s.id);
          if (editingId === s.id) resetForm();
        } catch {
          showError("Error", "No se pudo eliminar el asunto.");
        }
      },
      "Eliminar"
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 bg-[#004ac6] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <ListChecks className="w-5 h-5" />
            <div>
              <h3 className="font-bold text-sm leading-tight">Asuntos de Tickets</h3>
              <p className="text-[11px] text-blue-100">Define los motivos disponibles al crear un ticket</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-12 gap-2.5 bg-[#f8f9ff] p-3 rounded-lg border border-[#e2e8f0]">
            <div className="md:col-span-12">
              <label className="font-bold text-[#434655] block mb-1">
                {editingId ? "Editar asunto" : "Nuevo asunto"} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Corte de servicio / Cambio de contraseña WiFi"
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30] focus:border-[#004ac6] focus:outline-none"
              />
            </div>
            <div className="md:col-span-5">
              <label className="font-bold text-[#434655] block mb-1">Departamento por defecto</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as TicketDepartment)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 font-semibold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-none"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4">
              <label className="font-bold text-[#434655] block mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-2.5 py-2 font-semibold text-[#0b1c30] cursor-pointer focus:border-[#004ac6] focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex items-end gap-1.5">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-lg font-bold cursor-pointer"
              >
                {editingId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingId ? "Guardar" : "Agregar"}</span>
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-2 border border-[#cbd5e1] bg-white text-[#434655] rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
            <table className="table-fixed w-full text-left text-xs">
              <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-2.5 px-4 w-[50%]">Asunto</th>
                  <th className="py-2.5 px-4 w-[30%]">Departamento</th>
                  <th className="py-2.5 px-4 w-[20%] text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {ticketSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center italic text-[#737686]">
                      Aún no has creado asuntos. Agrega el primero arriba.
                    </td>
                  </tr>
                ) : (
                  ticketSubjects.map((s) => (
                    <tr key={s.id} className="hover:bg-[#f8f9ff]">
                      <td className="py-2.5 px-4 font-semibold text-[#0b1c30] break-words">{s.name}</td>
                      <td className="py-2.5 px-4 text-[#475569]">
                        {DEPARTMENTS.find((d) => d.value === s.defaultDepartment)?.label || s.defaultDepartment}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleEdit(s)}
                          className="p-1.5 rounded-lg text-[#737686] hover:text-[#004ac6] hover:bg-[#eff4ff] cursor-pointer"
                          title="Editar asunto"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="p-1.5 rounded-lg text-[#737686] hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Eliminar asunto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#e2e8f0] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#0b1c30] hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
