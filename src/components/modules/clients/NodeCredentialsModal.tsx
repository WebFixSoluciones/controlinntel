"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Search, X } from "lucide-react";
import { useApp } from "@/lib/state";
import { canAccessModule, canUser } from "@/lib/permissions";
import { useToast } from "@/lib/toast-context";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { NodeSystemCredentials } from "./NodeSystemCredentials";
import type { NodeSystemService } from "@/types";

export function NodeCredentialsModal({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const { nodes, currentUser, updateNode } = useApp();
  const { showError, showSuccess, showConfirm } = useToast();
  const node = nodes.find(item => item.id === nodeId);
  const canEdit = canAccessModule(currentUser, "red") && canUser(currentUser, "red", "canManageNodes") && canUser(currentUser, "red", "canEditRouterCredentials");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string; username: string; password: string; version?: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const close = () => {
    if (pending.current) return;
    if (editing) showConfirm("Descartar cambios", "Hay una credencial en edición. ¿Deseas cerrar sin guardar?", onClose);
    else onClose();
  };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  const startEdit = (service: NodeSystemService) => {
    const open = () => setEditing({ id: service.id, username: service.username || service.credentials?.split("/")[0]?.trim() || "", password: "", version: node?.version });
    if (editing) showConfirm("Cambiar credencial", "¿Descartar la edición actual?", open);
    else open();
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!node || !editing || !canEdit || pending.current) return;
    pending.current = true; setSaving(true);
    try {
      await updateNode(node.id, { version: editing.version, services: (node.services || []).map(service => {
        if (service.id !== editing.id) return service;
        // Empty password preserves the existing sealed secret in the server.
        return { ...service, username: editing.username.trim(), password: editing.password || undefined, credentials: undefined };
      }) });
      setEditing(null);
      showSuccess("Credencial actualizada", "Se guardaron el usuario y la contraseña del sistema seleccionado.");
    } catch (error) {
      showError("No se pudo guardar", error instanceof Error ? error.message : "Actualiza el nodo y vuelve a intentarlo.");
    } finally { pending.current = false; setSaving(false); }
  };

  if (!node) return null;
  const query = search.trim().toLocaleLowerCase();
  const services = (node.services || []).filter(service => service.id === editing?.id || !query ||
    [service.systemName, service.linkOrIp, service.username, service.notes].some(value => value?.toLocaleLowerCase().includes(query)));

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="node-credentials-title"
      className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
      onKeyDown={event => {
        if (event.key === "Escape") { event.stopPropagation(); close(); }
        if (event.key === "Tab") {
          const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea, [tabindex="0"]') || [])];
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <header className="flex items-center justify-between gap-3 bg-[#004ac6] px-5 py-4 text-white">
        <div className="min-w-0"><h2 id="node-credentials-title" className="flex items-center gap-2 font-semibold"><KeyRound className="size-5" />Credenciales</h2><p className="mt-1 break-words text-xs text-blue-100">{node.name} · {node.services?.length || 0} credenciales</p></div>
        <button type="button" onClick={close} disabled={saving} aria-label="Cerrar credenciales" className="rounded-lg p-2 hover:bg-white/15 disabled:opacity-50"><X className="size-5" /></button>
      </header>
      <div className="border-b p-4"><label className="flex items-center gap-2 rounded-lg border px-3 py-2"><Search className="size-4 shrink-0 text-slate-500" /><input type="search" aria-label="Buscar credencial" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar sistema, IP, usuario o notas..." className="min-w-0 flex-1 text-sm outline-none" /></label></div>
      <div className="min-h-0 overflow-y-auto p-4">
        {!services.length && <p className="py-8 text-center text-sm text-slate-500">No se encontraron credenciales.</p>}
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">{services.map(service => <div key={service.id} className="min-w-0 rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex justify-end">{canEdit && <ActionIconButton action="edit" disabled={saving} label={`Editar credencial de ${service.systemName}`} onClick={() => startEdit(service)} />}</div>
          <NodeSystemCredentials key={`${service.id}-${node.version || 0}`} nodeId={node.id} service={service} />
          {editing?.id === service.id && <form onSubmit={save} className="mt-3 space-y-3 border-t pt-3" autoComplete="off">
            <label className="block text-xs font-semibold">Usuario<input aria-label="Usuario de la credencial" autoComplete="off" value={editing.username} maxLength={500} disabled={saving} onChange={event => setEditing({ ...editing, username: event.target.value })} className="mt-1 w-full min-w-0 rounded border px-3 py-2 text-sm font-normal" /></label>
            <label className="block text-xs font-semibold">Nueva contraseña<input type="password" aria-label="Nueva contraseña de la credencial" autoComplete="new-password" value={editing.password} maxLength={4096} disabled={saving} onChange={event => setEditing({ ...editing, password: event.target.value })} className="mt-1 w-full min-w-0 rounded border px-3 py-2 text-sm font-normal" /></label>
            <p className="text-xs text-slate-500">Déjala vacía para conservar la contraseña actual.</p>
            <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setEditing(null)} className="rounded border px-3 py-2 text-xs">Cancelar</button><button type="submit" disabled={saving} className="rounded bg-[#004ac6] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar credencial"}</button></div>
          </form>}
        </div>)}</div>
      </div>
    </div>
  </div>;
}
