"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { simpleEncrypt } from "@/lib/crypto-vault";
import {
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Plus,
  Lock,
  Search,
  RotateCcw,
  Edit2,
  X,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

export function SecureVault({ clientId }: { clientId?: string }) {
  const app = useApp();
  const { showSuccess, showError } = useToast();
  const [visible, setVisible] = useState<Record<string, string>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const entity = clientId ? "clientVaultItems" : "vault";
  const items = clientId ? app.clientVaultItems.filter((v) => v.clientId === clientId) : app.vault;

  const edited = items.find((v) => v.id === editingId);
  const filtered = items.filter((v) =>
    `${v.serviceName} ${v.username} ${v.notes || ""}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function show(id: string, copy = false) {
    if (!copy && visible[id] !== undefined) {
      setVisible((v) => {
        const next = { ...v };
        delete next[id];
        return next;
      });
      return;
    }
    try {
      const secret = await app.revealCredential(entity, id);
      if (copy) {
        await navigator.clipboard.writeText(secret);
        showSuccess("Copiado", "Contraseña copiada al portapapeles de manera segura.");
        return;
      }
      setVisible((v) => ({ ...v, [id]: secret }));
      timers.current.push(
        setTimeout(() => {
          setVisible((v) => {
            const next = { ...v };
            delete next[id];
            return next;
          });
        }, 10000)
      );
    } catch (e) {
      showError("Acceso no disponible", e instanceof Error ? e.message : "No se pudo revelar la credencial.");
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
      ...(!editingId || rawPass ? { encryptedPassword: simpleEncrypt(rawPass) } : {}),
      notes: String(values.get("notes") || ""),
    };
    try {
      if (editingId) {
        if (clientId) await app.updateClientVaultItem(editingId, data);
        else await app.updateVaultCredential(editingId, data);
        setVisible((v) => {
          const next = { ...v };
          delete next[editingId];
          return next;
        });
      } else if (clientId) {
        await app.addClientVaultItem({ ...data, clientId, category: "otro" });
      } else {
        await app.addVaultCredential({ ...data, serviceType: "otro", allowedRoles: [app.currentUser.role] });
      }
      form.reset();
      setEditing(false);
      setEditingId(null);
      setError("");
      showSuccess("Guardado Exitoso", "Credencial cifrada con AES-GCM y guardada en la bóveda.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la credencial.");
      showError("Error", e instanceof Error ? e.message : "Comprueba la configuración de cifrado.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (confirm(`¿Confirmas la eliminación definitiva del acceso de ${name}?`)) {
      try {
        if (clientId) await app.deleteClientVaultItem(id);
        else await app.deleteRecord("vault", id);
        showSuccess("Credencial Eliminada", "El registro ha sido removido de la bóveda.");
      } catch (e) {
        showError("Error", "No se pudo eliminar la credencial.");
      }
    }
  }

  return (
    <section className="space-y-4 select-none">
      {/* Sub-header inside vault view */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[#004ac6]" />
          <h2 className="text-lg font-bold text-[#0b1c30]">
            {clientId ? "Credenciales & Claves del Abonado" : "Accesos Cifrados de Infraestructura NOC"}
          </h2>
        </div>

        <button
          disabled={busy}
          onClick={() => {
            setEditing(!editing);
            setEditingId(null);
            setError("");
          }}
          className="flex items-center gap-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{editing ? "Cerrar Formulario" : "Nueva Credencial"}</span>
        </button>
      </div>

      {/* Create / Edit Form Card */}
      {editing && (
        <form
          key={editingId || "new"}
          onSubmit={submit}
          className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-lumina-card space-y-4 w-full max-w-3xl animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
            <h3 className="font-bold text-xs text-[#0b1c30] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#004ac6]" />
              {editingId ? "Modificar Credencial Cifrada" : "Registrar Nuevo Acceso Seguro"}
            </h3>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-[#434655] block mb-1">Servicio / Destino *</label>
              <input
                name="service"
                defaultValue={edited?.serviceName || ""}
                required
                maxLength={200}
                placeholder="Ej: Router Core CCR, OLT Huawei..."
                className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#434655] block mb-1">Usuario / Identificador *</label>
              <input
                name="username"
                defaultValue={edited?.username || ""}
                required
                maxLength={200}
                autoComplete="off"
                placeholder="admin_noc"
                className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-mono font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#434655] block mb-1">
              Contraseña {editingId ? "(dejar vacía para conservar la actual)" : "*"}
            </label>
            <input
              name="password"
              required={!editingId}
              type="password"
              maxLength={4096}
              autoComplete="new-password"
              placeholder="••••••••••••"
              className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-mono font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#434655] block mb-1">Notas / Referencia Técnica</label>
            <textarea
              name="notes"
              defaultValue={edited?.notes || ""}
              maxLength={2000}
              placeholder="Detalles de puerto, IP privada, reglas de firewall..."
              className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-medium text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
              rows={2}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2 border-t border-[#e2e8f0]">
            <button
              disabled={busy}
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#737686] hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              disabled={busy}
              type="submit"
              className="px-5 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              {busy ? "Cifrando..." : "Cifrar & Guardar"}
            </button>
          </div>
        </form>
      )}

      {/* Filter Toolbar Card */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-lumina-card flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por servicio, usuario o notas..."
            className="w-full bg-white text-xs text-[#0b1c30] rounded-xl pl-9 pr-3 py-2 border border-[#cbd5e1] focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6]"
          />
        </div>

        {query && (
          <button
            onClick={() => setQuery("")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#cbd5e1] text-xs font-semibold text-[#434655] hover:bg-[#f8f9ff] cursor-pointer transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#737686]" />
            <span>Limpiar</span>
          </button>
        )}
      </div>

      {/* Credentials Table Card */}
      <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-lumina-card">
        <table className="min-w-[900px] w-full text-left text-xs">
          <caption className="sr-only">Credenciales registradas en la bóveda</caption>
          <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
            <tr>
              <th scope="col" className="py-3.5 px-5">Servicio / Destino</th>
              <th scope="col" className="py-3.5 px-5">Usuario / Identificador</th>
              <th scope="col" className="py-3.5 px-5">Contraseña Cifrada</th>
              <th scope="col" className="py-3.5 px-5">Notas / Referencia</th>
              <th scope="col" className="py-3.5 px-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-xs text-[#737686]">
                  <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-600">No hay credenciales registradas que coincidan.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Usa &quot;Nueva Credencial&quot; para registrar un acceso seguro.</p>
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[#f8f9ff] transition-colors">
                  <th scope="row" className="py-4 px-5 font-bold text-[#0b1c30] text-sm">
                    {item.serviceName}
                  </th>
                  <td className="py-4 px-5">
                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {item.username}
                    </span>
                  </td>
                  <td className="py-4 px-5">
                    <div className="font-mono font-bold text-[#004ac6] bg-blue-50/50 px-2.5 py-1 rounded-lg inline-block border border-blue-100">
                      {visible[item.id] ? (
                        <span className="text-emerald-700 font-bold">{visible[item.id]}</span>
                      ) : (
                        <span className="tracking-widest text-slate-400">••••••••••••••••</span>
                      )}
                    </div>
                  </td>
                  <td className="max-w-xs py-4 px-5 text-[#737686]">
                    <span className="line-clamp-2 text-[11px]">{item.notes || "—"}</span>
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <button
                        onClick={() => void show(item.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          visible[item.id]
                            ? "bg-slate-200 text-slate-800"
                            : "bg-[#eff4ff] text-[#004ac6] hover:bg-[#dce9ff]"
                        }`}
                        title="Revelar por 10 segundos"
                      >
                        {visible[item.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{visible[item.id] ? "Ocultar" : "Ver"}</span>
                      </button>

                      <button
                        onClick={() => void show(item.id, true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                        title="Copiar contraseña al portapapeles"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </button>

                      <button
                        disabled={busy}
                        onClick={() => {
                          setEditingId(item.id);
                          setEditing(true);
                          setError("");
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-[#004ac6] hover:bg-[#eff4ff] transition-colors cursor-pointer"
                        title="Editar credencial"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => void handleDelete(item.id, item.serviceName)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Eliminar credencial"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
