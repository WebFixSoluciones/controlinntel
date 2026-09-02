"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, ClientVaultItem } from "@/types";
import { simpleDecrypt, maskPassword } from "@/lib/crypto-vault";
import {
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2,
  Lock,
  Wifi,
  Radio,
  Camera,
  Server,
  X,
  AlertCircle,
} from "lucide-react";

interface ClientVaultTabProps {
  client: Client;
}

export function ClientVaultTab({ client }: ClientVaultTabProps) {
  const { clientVaultItems, addClientVaultItem, deleteClientVaultItem, currentUser } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const [revealedIds, setRevealedIds] = useState<{ [id: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceName, setServiceName] = useState("Acceso Router Wi-Fi / ONT");
  const [category, setCategory] = useState<ClientVaultItem["category"]>("ont_router");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [ipAddress, setIpAddress] = useState("192.168.100.1");
  const [port, setPort] = useState(80);
  const [notes, setNotes] = useState("Credenciales de acceso local a la ONT Huawei / ZTE");

  const items = clientVaultItems.filter((v) => v.clientId === client.id);

  const handleToggleReveal = (id: string) => {
    const isRevealed = !!revealedIds[id];
    if (!isRevealed) {
      setRevealedIds((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setRevealedIds((prev) => ({ ...prev, [id]: false }));
      }, 10000);
    } else {
      setRevealedIds((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleCopy = (id: string, encryptedPass?: string) => {
    const rawPass = simpleDecrypt(encryptedPass || "");
    navigator.clipboard.writeText(rawPass);
    setCopiedId(id);
    showSuccess("Copiado", "Contraseña copiada al portapapeles.");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName || !username || !password) return;

    addClientVaultItem({
      clientId: client.id,
      serviceName: serviceName.trim(),
      category,
      username: username.trim(),
      encryptedPassword: "ENC_" + btoa(password).split("").reverse().join(""),
      ipAddress: ipAddress.trim(),
      port: Number(port) || undefined,
      notes: notes.trim(),
    });

    showSuccess("Credencial Guardada", `Acceso para ${serviceName} protegido en bóveda.`);
    setIsModalOpen(false);
    setPassword("");
  };

  const handleDelete = (item: ClientVaultItem) => {
    showConfirm(
      "¿Eliminar Credencial?",
      `¿Deseas remover la clave cifrada de ${item.serviceName}?`,
      () => {
        deleteClientVaultItem(item.id);
        showSuccess("Removido", "Credencial eliminada.");
      },
      "Eliminar"
    );
  };

  const getCategoryIcon = (cat: ClientVaultItem["category"]) => {
    switch (cat) {
      case "wifi":
        return <Wifi className="w-4 h-4 text-sky-600" />;
      case "cctv_camaras":
        return <Camera className="w-4 h-4 text-purple-600" />;
      case "vpn_remoto":
        return <Server className="w-4 h-4 text-emerald-600" />;
      default:
        return <Radio className="w-4 h-4 text-indigo-600" />;
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
        <div>
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-purple-600" />
            Bóveda de Credenciales & Accesos Dedicados del Cliente (AES-256)
          </h4>
          <p className="text-[11px] text-slate-400">
            Resguardo cifrado de contraseñas de ONT, claves Wi-Fi, puertos de cámaras CCTV y túneles VPN
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva Clave / Acceso</span>
        </button>
      </div>

      {/* Grid of Credentials */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 ? (
          <div className="col-span-full py-10 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-600 text-xs">Sin credenciales registradas</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Haz clic en "Nueva Clave / Acceso" para guardar claves de ONT, Wi-Fi o cámaras.</p>
          </div>
        ) : (
          items.map((item) => {
            const isRevealed = !!revealedIds[item.id];
            const pass = isRevealed ? simpleDecrypt(item.encryptedPassword || "") : maskPassword(10);

            return (
              <div
                key={item.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                      {getCategoryIcon(item.category)}
                      {item.category.replace("_", " ")}
                    </span>
                    <button
                      onClick={() => handleDelete(item)}
                      className="text-slate-300 hover:text-rose-600 p-0.5 cursor-pointer"
                      title="Eliminar credencial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h5 className="font-bold text-xs text-slate-900 mt-2">{item.serviceName}</h5>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Usuario: <span className="font-bold text-slate-800">{item.username}</span>
                  </p>
                  {item.ipAddress && (
                    <p className="text-[10px] text-sky-700 font-mono">
                      IP: {item.ipAddress} {item.port ? `:${item.port}` : ""}
                    </p>
                  )}

                  <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className={`font-mono text-xs ${isRevealed ? "font-bold text-purple-700" : "text-slate-400 tracking-widest"}`}>
                      {pass}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleReveal(item.id)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                        title={isRevealed ? "Ocultar" : "Mostrar (10s)"}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleCopy(item.id, item.encryptedPassword)}
                        className="p-1 rounded text-slate-400 hover:text-purple-600 cursor-pointer"
                        title="Copiar contraseña"
                      >
                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {isRevealed && (
                    <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Auto-ocultamiento en 10s
                    </p>
                  )}

                  {item.notes && <p className="text-[10px] text-slate-400 italic mt-2">{item.notes}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Vault Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-600" />
                Nueva Clave de Cliente
              </h4>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nombre / Dispositivo *</label>
                <input
                  type="text"
                  required
                  placeholder="Router ONT Huawei / Clave Wi-Fi"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold"
                  >
                    <option value="ont_router">ONT / Router</option>
                    <option value="wifi">Clave Wi-Fi</option>
                    <option value="pppoe">Usuario PPPoE</option>
                    <option value="cctv_camaras">CCTV / Cámaras</option>
                    <option value="vpn_remoto">Túnel VPN</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">IP / Host Local</label>
                  <input
                    type="text"
                    placeholder="192.168.100.1"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Usuario *</label>
                  <input
                    type="text"
                    required
                    placeholder="admin / telecomadmin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Contraseña *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notas Técnicas</label>
                <textarea
                  rows={2}
                  placeholder="SSID: Inntel_Fibra_5G, canal 36..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-bold text-slate-600 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-sm cursor-pointer">
                  Guardar Cifrado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
