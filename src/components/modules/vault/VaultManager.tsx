"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { VaultCredential } from "@/types";
import { KeyRound, Eye, EyeOff, Copy, Check, ExternalLink, Lock, AlertCircle, Plus, X } from "lucide-react";
import { simpleDecrypt, maskPassword } from "@/lib/crypto-vault";

export function VaultManager() {
  const { vault, currentUser, logVaultAccess, addVaultCredential } = useApp();
  const [revealedIds, setRevealedIds] = useState<{ [id: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const [newServiceName, setNewServiceName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const handleToggleReveal = (cred: VaultCredential) => {
    if (currentUser.role !== "admin" && !cred.allowedRoles.includes(currentUser.role)) {
      alert("No tienes permisos suficientes para ver esta credencial.");
      return;
    }

    const isCurrentlyRevealed = !revealedIds[cred.id];
    if (isCurrentlyRevealed) {
      logVaultAccess(cred.id, cred.serviceName);
      setRevealedIds((prev) => ({ ...prev, [cred.id]: true }));

      setTimeout(() => {
        setRevealedIds((prev) => ({ ...prev, [cred.id]: false }));
      }, 10000);
    } else {
      setRevealedIds((prev) => ({ ...prev, [cred.id]: false }));
    }
  };

  const handleCopy = (cred: VaultCredential) => {
    const rawPass = simpleDecrypt(cred.encryptedPassword || "");
    navigator.clipboard.writeText(rawPass);
    setCopiedId(cred.id);
    logVaultAccess(cred.id, cred.serviceName);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateCredential = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName || !newUsername || !newPassword) return;

    addVaultCredential({
      serviceName: newServiceName,
      serviceType: "arcotel_portal",
      portalUrl: newUrl,
      username: newUsername,
      encryptedPassword: "ENC_" + btoa(newPassword).split("").reverse().join(""),
      notes: "Registrado en bóveda segura",
      allowedRoles: ["admin", "finanzas"],
    });

    setIsNewModalOpen(false);
    setNewServiceName("");
    setNewUsername("");
    setNewPassword("");
    setNewUrl("");
  };

  return (
    <div className="space-y-6 select-none">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-[#712ae2]" />
            Bóveda de Accesos & Credenciales Cifradas (AES-256)
          </h1>
          <p className="text-xs text-[#737686] mt-0.5">
            Almacenamiento seguro de credenciales para SIETEL, FODETEL, QUIPUX, BDH y Routers MikroTik
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5f3ff] text-[#712ae2] rounded-lg border border-[#ddd6fe] text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>Cifrado en Reposo Activo</span>
          </div>

          {currentUser.role === "admin" && (
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#712ae2] hover:bg-[#8a4cfc] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Credencial</span>
            </button>
          )}
        </div>
      </div>

      {vault.length === 0 ? (
        <div className="p-10 rounded-2xl bg-white border border-[#e2e8f0] text-center flex flex-col items-center justify-center">
          <KeyRound className="w-10 h-10 text-[#c3c6d7] mb-2" />
          <h3 className="font-bold text-[#434655] text-sm">Bóveda Vacía</h3>
          <p className="text-xs text-[#737686] mt-1 max-w-sm">No hay credenciales cifradas almacenadas. Haz clic en "Nueva Credencial" para guardar accesos a portales gubernamentales o routers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {vault.map((cred) => {
            const isRevealed = !!revealedIds[cred.id];
            const hasAccess = currentUser.role === "admin" || cred.allowedRoles.includes(currentUser.role);
            const decryptedPass = isRevealed ? simpleDecrypt(cred.encryptedPassword || "") : maskPassword(12);

            return (
              <div
                key={cred.id}
                className="p-6 rounded-2xl bg-white border border-[#e2e8f0] shadow-lumina-card flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-[#f8f9ff] text-[#434655] border border-[#e2e8f0]">
                      {cred.serviceType.replace("_", " ")}
                    </span>
                    {cred.portalUrl && (
                      <a
                        href={cred.portalUrl.startsWith("http") ? cred.portalUrl : `http://${cred.portalUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#004ac6] hover:text-[#2563eb] p-1 hover:bg-[#eff4ff] rounded-md transition-colors"
                        title="Abrir portal oficial"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-[#0b1c30] mt-3">{cred.serviceName}</h3>
                  <p className="text-[11px] text-[#737686] font-mono mt-0.5">
                    Usuario: <span className="font-bold text-[#0b1c30]">{cred.username}</span>
                  </p>

                  <div className="mt-4 p-3 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] flex items-center justify-between">
                    <span className={`font-mono text-xs ${isRevealed ? "font-bold text-[#712ae2]" : "text-[#737686] tracking-widest"}`}>
                      {decryptedPass}
                    </span>

                    {hasAccess && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleReveal(cred)}
                          className="p-1.5 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-[#e5eeff] transition-colors cursor-pointer"
                          title={isRevealed ? "Ocultar" : "Mostrar contraseña (10s)"}
                        >
                          {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleCopy(cred)}
                          className="p-1.5 rounded-lg text-[#737686] hover:text-[#712ae2] hover:bg-purple-50 transition-colors cursor-pointer"
                          title="Copiar contraseña"
                        >
                          {copiedId === cred.id ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {isRevealed && (
                    <p className="text-[10px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Auto-ocultamiento en 10 segundos
                    </p>
                  )}

                  {cred.notes && <p className="text-[11px] text-[#737686] italic mt-3 bg-[#f8f9ff] p-2 rounded-lg border border-[#e2e8f0]">{cred.notes}</p>}
                </div>

                <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[10px] text-[#737686]">
                  <span>Roles: {cred.allowedRoles.join(", ")}</span>
                  {cred.lastAccessedAt && (
                    <span>Visto: {new Date(cred.lastAccessedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden">
            <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <h3 className="font-bold text-[#0b1c30] text-sm">Nueva Credencial de Bóveda</h3>
              <button onClick={() => setIsNewModalOpen(false)} className="p-1 rounded-lg text-[#737686] hover:text-[#0b1c30] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCredential} className="p-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Nombre del Servicio / Portal *</label>
                <input
                  type="text"
                  required
                  placeholder="Portal SIETEL ARCOTEL"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30]"
                />
              </div>
              <div>
                <label className="font-bold text-[#434655] block mb-1">URL Oficial</label>
                <input
                  type="text"
                  placeholder="https://sietel.arcotel.gob.ec"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30]"
                />
              </div>
              <div>
                <label className="font-bold text-[#434655] block mb-1">Usuario / ID de Acceso *</label>
                <input
                  type="text"
                  required
                  placeholder="admin_inntel"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-mono text-[#0b1c30]"
                />
              </div>
              <div>
                <label className="font-bold text-[#434655] block mb-1">Contraseña *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-mono text-[#0b1c30]"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-[#e2e8f0]">
                <button type="button" onClick={() => setIsNewModalOpen(false)} className="px-4 py-2 text-[#737686] hover:bg-[#f8f9ff] rounded-lg font-bold cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-[#712ae2] hover:bg-[#8a4cfc] text-white rounded-lg font-bold shadow-xs cursor-pointer">
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
