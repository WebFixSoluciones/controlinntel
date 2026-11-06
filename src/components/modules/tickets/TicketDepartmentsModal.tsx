"use client";

import { useId, useState, type FormEvent } from "react";
import { Building2, X } from "lucide-react";
import { useApp } from "@/lib/state";
import { canManageTicketDepartments } from "@/lib/permissions";
import type { TicketDepartmentRecord } from "@/types";

export function TicketDepartmentsModal({ onClose }: { onClose: () => void }) {
  const { currentUser, ticketDepartments, saveRecord } = useApp();
  const titleId = useId();
  const [editing, setEditing] = useState<TicketDepartmentRecord>();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!canManageTicketDepartments(currentUser)) return null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || name.trim().length < 2) return;
    await persist(name.trim(), editing?.active ?? true, editing);
  }

  async function persist(label: string, active: boolean, record?: TicketDepartmentRecord) {
    setBusy(true);
    setError("");
    try {
      await saveRecord("ticketDepartments", { name: label, active, ...(record?.version ? { version: record.version } : {}) },
        record?.id || `dept-${crypto.randomUUID()}`);
      setEditing(undefined);
      setName("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo guardar el departamento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/50 p-3 sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="w-full min-w-0 max-w-xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-center justify-between gap-3 bg-[#004ac6] p-4 text-white">
          <h2 id={titleId} className="flex items-center gap-2 text-sm font-bold"><Building2 className="h-4 w-4" /> Departamentos de soporte</h2>
          <button type="button" aria-label="Cerrar" disabled={busy} onClick={onClose} className="p-2"><X className="h-4 w-4" /></button>
        </header>
        <div className="space-y-4 p-4 text-xs">
          <p className="text-slate-600">Los departamentos activos aparecen al crear un ticket. Los tickets históricos conservan su departamento.</p>
          <form onSubmit={save} className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 basis-48 font-semibold">{editing ? "Editar nombre" : "Nuevo departamento"}
              <input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            {editing && <button type="button" disabled={busy} onClick={() => { setEditing(undefined); setName(""); setError(""); }} className="px-3 py-2">Cancelar edición</button>}
            <button disabled={busy || name.trim().length < 2} className="rounded-lg bg-[#004ac6] px-3 py-2 font-semibold text-white disabled:opacity-50">
              {editing ? "Guardar nombre" : "Agregar"}
            </button>
          </form>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {ticketDepartments.map(row => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0 flex-1 basis-36">
                  <p className="break-words font-semibold">{row.name}</p>
                  <p className={row.active ? "text-emerald-700" : "text-slate-500"}>{row.active ? "Activo" : "Inactivo"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => { setEditing(row); setName(row.name); setError(""); }}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-[#004ac6]">Renombrar</button>
                  <button type="button" disabled={busy} onClick={() => void persist(row.name, !row.active, row)}
                    className="rounded-lg border border-slate-200 px-2 py-1.5">{row.active ? "Desactivar" : "Activar"}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
