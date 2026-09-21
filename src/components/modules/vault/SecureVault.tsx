"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { simpleEncrypt } from "@/lib/crypto-vault";
import { KeyRound, ShieldCheck, Eye, Copy, Trash2, Plus, Lock } from "lucide-react";

export function SecureVault({ clientId }: { clientId?: string }) {
  const app = useApp(), { showSuccess, showError } = useToast();
  const [visible, setVisible] = useState<Record<string, string>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [busy, setBusy] = useState(false), [editing, setEditing] = useState(false);
  const entity = clientId ? "clientVaultItems" : "vault";
  const items = clientId ? app.clientVaultItems.filter((v) => v.clientId === clientId) : app.vault;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function show(id: string, copy = false) {
    try {
      const secret = await app.revealCredential(entity, id);
      if (copy) {
        await navigator.clipboard.writeText(secret);
        showSuccess("Copiado", "Credencial copiada al portapapeles.");
        return;
      }
      setVisible((v) => ({ ...v, [id]: secret }));
      timers.current.push(
        setTimeout(() => setVisible((v) => {
          const next = { ...v };
          delete next[id];
          return next;
        }), 10000)
      );
    } catch (e) {
      showError("Acceso no disponible", e instanceof Error ? e.message : "No se pudo revelar.");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const form = event.currentTarget;
    const values = new FormData(form);
    const rawPass = String(values.get("password") || "");
    const data = {
      serviceName: String(values.get("service")),
      username: String(values.get("username")),
      encryptedPassword: simpleEncrypt(rawPass),
      notes: String(values.get("notes") || ""),
    };
    try {
      if (clientId) await app.addClientVaultItem({ ...data, clientId, category: "otro" });
      else await app.addVaultCredential({ ...data, serviceType: "otro", allowedRoles: [app.currentUser.role] });
      form.reset();
      setEditing(false);
      showSuccess("Guardado", "La credencial está cifrada con AES-256 en el servidor.");
    } catch (e) {
      showError("No se guardó", e instanceof Error ? e.message : "Comprueba la configuración de cifrado.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (confirm(`¿Confirmas la eliminación de la credencial de ${name}?`)) {
      try {
        if (clientId) await app.deleteClientVaultItem(id);
        else await app.deleteRecord("vault", id);
        showSuccess("Eliminada", "Credencial removida.");
      } catch (e) {
        showError("Error", "No se pudo eliminar.");
      }
    }
  }

  return (
    <section className="space-y-4 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0b1c30] flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#004ac6]" />
            Bóveda Cifrada de Credenciales {clientId ? "del Cliente" : "del Sistema"}
          </h2>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="flex items-center gap-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{editing ? "Cerrar Formulario" : "Nueva Credencial"}</span>
        </button>
      </div>

      {editing && (
        <form onSubmit={submit} className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-lumina-card grid gap-4 w-full max-w-4xl">
          <h3 className="font-bold text-xs text-[#0b1c30] flex items-center gap-2 border-b pb-2">
            <Lock className="w-4 h-4 text-[#004ac6]" />
            Registrar Nuevo Acceso Seguro
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-xs font-bold text-[#434655]">
              Servicio / Destino
              <input name="service" required maxLength={200} placeholder="Ej: Router Core CCR, OLT Huawei..." className="mt-1 block border border-[#cbd5e1] rounded-lg p-2.5 w-full text-xs font-medium text-[#0b1c30]" />
            </label>
            <label className="text-xs font-bold text-[#434655]">
              Usuario / Identificador
              <input name="username" required maxLength={200} autoComplete="off" placeholder="admin_noc" className="mt-1 block border border-[#cbd5e1] rounded-lg p-2.5 w-full text-xs font-medium text-[#0b1c30]" />
            </label>
          </div>
          <label className="text-xs font-bold text-[#434655]">
            Contraseña
            <input name="password" required type="password" maxLength={4096} autoComplete="new-password" placeholder="••••••••••••" className="mt-1 block border border-[#cbd5e1] rounded-lg p-2.5 w-full text-xs font-medium text-[#0b1c30]" />
          </label>
          <label className="text-xs font-bold text-[#434655]">
            Notas / Referencia técnica
            <textarea name="notes" maxLength={2000} placeholder="Detalles de puerto, IP privada, etc." className="mt-1 block border border-[#cbd5e1] rounded-lg p-2.5 w-full text-xs font-medium text-[#0b1c30]" rows={2} />
          </label>
          <div className="flex gap-3">
            <button disabled={busy} className="bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg px-5 py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer">
              {busy ? "Cifrando y Guardando…" : "Cifrar & Guardar"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-lg text-xs font-bold text-[#737686] hover:bg-slate-100">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-lumina-card">
        <table className="min-w-[900px] w-full text-left text-xs">
          <caption className="sr-only">Credenciales registradas en la bóveda</caption>
          <thead className="bg-[#f8f9ff] text-[10px] uppercase tracking-wide text-[#737686]">
            <tr>
              <th scope="col" className="px-5 py-3 font-bold">Servicio / Destino</th>
              <th scope="col" className="px-5 py-3 font-bold">Usuario</th>
              <th scope="col" className="px-5 py-3 font-bold">Contraseña</th>
              <th scope="col" className="px-5 py-3 font-bold">Notas</th>
              <th scope="col" className="px-5 py-3 text-right font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-xs italic text-[#737686]">
                  No hay credenciales registradas aún en esta bóveda.
                </td>
              </tr>
            ) : items.map((item) => (
              <tr key={item.id} className="hover:bg-[#f8f9ff]">
                <th scope="row" className="px-5 py-4 font-bold">{item.serviceName}</th>
                <td className="px-5 py-4 font-mono font-semibold">{item.username}</td>
                <td className="px-5 py-4">
                  <span className="font-mono font-bold text-[#004ac6]">
                    {visible[item.id] || "••••••••••••••••"}
                  </span>
                </td>
                <td className="max-w-xs px-5 py-4 text-[#737686]">
                  <span className="line-clamp-2">{item.notes || "—"}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    <button
                      onClick={() => void show(item.id)}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#004ac6] hover:text-[#2563eb]"
                    >
                      <Eye className="size-3.5" />
                      <span>{visible[item.id] ? "Ocultar" : "Ver (10s)"}</span>
                    </button>
                    <button
                      onClick={() => void show(item.id, true)}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#004ac6] hover:text-[#2563eb]"
                    >
                      <Copy className="size-3.5" />
                      <span>Copiar</span>
                    </button>
                    <button
                      onClick={() => void handleDelete(item.id, item.serviceName)}
                      className="rounded p-1 text-[#737686] hover:text-red-600"
                      title="Eliminar credencial"
                      aria-label={`Eliminar credencial ${item.serviceName}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
