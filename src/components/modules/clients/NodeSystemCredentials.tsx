"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff, Loader2, Server } from "lucide-react";
import { api } from "@/lib/api-client";
import { useApp } from "@/lib/state";
import { canAccessModule, canUser } from "@/lib/permissions";
import { useToast } from "@/lib/toast-context";
import type { NodeSystemService } from "@/types";

export function NodeSystemCredentials({ service, nodeId }: { service: NodeSystemService; nodeId?: string }) {
  const { currentUser } = useApp();
  const { showError, showSuccess } = useToast();
  const canReveal = canAccessModule(currentUser, "red") && canUser(currentUser, "red", "canEditRouterCredentials");
  const username = service.username || service.credentials?.split("/")[0]?.trim() || "";
  const draftPassword = service.password || service.credentials?.split("/").slice(1).join("/").trim() || "";
  const hasPassword = Boolean(service.hasPassword || draftPassword);
  const [revealed, setRevealed] = useState<{ password: string; expiresAt: number } | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const mounted = useRef(false);
  const pending = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    setRevealed(null);
  }, [service.id, service.password, service.hasPassword, nodeId, canReveal]);

  useEffect(() => {
    if (!revealed) return;
    const update = () => {
      const seconds = Math.ceil((revealed.expiresAt - Date.now()) / 1000);
      if (seconds <= 0 || document.hidden) setRevealed(null);
      else setRemaining(seconds);
    };
    update();
    const interval = setInterval(update, 250);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [revealed]);

  const loadPassword = async () => {
    if (!canReveal) throw new Error("No tienes permiso para ver esta contraseña.");
    if (draftPassword) return draftPassword;
    if (!nodeId) throw new Error("Guarda el nodo antes de consultar su contraseña.");
    return (await api<{ result: string }>("/api/data", {
      action: "reveal", entity: "nodes", id: nodeId, serviceId: service.id,
    })).result;
  };

  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    if (!mounted.current) return;
    setCopied(key);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(""), 2000);
    showSuccess("Copiado", "El dato se copió al portapapeles.");
  };

  const handleCopy = async (value: string, key: string) => {
    try { await copy(value, key); }
    catch { showError("No se pudo copiar", "Revisa el permiso del portapapeles en tu navegador."); }
  };

  const handlePassword = async (copyOnly = false) => {
    if (pending.current) return;
    if (!copyOnly && revealed) { setRevealed(null); return; }
    pending.current = true;
    setBusy(true);
    try {
      const password = revealed?.password || await loadPassword();
      if (!mounted.current) return;
      if (copyOnly) await copy(password, "password");
      else {
        setRemaining(20);
        setRevealed({ password, expiresAt: Date.now() + 20000 });
      }
    } catch (error) {
      showError("Contraseña del sistema", error instanceof Error ? error.message : "No se pudo consultar la contraseña.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const copyButton = (value: string, key: string, label: string) => (
    <button type="button" onClick={() => void handleCopy(value, key)} title={label} aria-label={label}
      className="shrink-0 rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-[#004ac6]">
      {copied === key ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
    </button>
  );

  return (
    <div className="min-w-0 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px]">
      <div className="flex min-w-0 items-start gap-1.5 font-semibold text-slate-900">
        <Server className="mt-0.5 size-3.5 shrink-0 text-[#004ac6]" />
        <span className="min-w-0 break-words">{service.systemName}</span>
      </div>
      {service.linkOrIp && <div className="flex min-w-0 items-start gap-1 rounded bg-white px-1.5 py-0.5">
        <span className="shrink-0 pt-1 text-slate-500">IP / URL</span>
        <span className="min-w-0 flex-1 break-all pt-1 font-mono text-slate-800">{service.linkOrIp}</span>
        {copyButton(service.linkOrIp, "ip", "Copiar IP o enlace")}
      </div>}
      <div className="flex min-w-0 items-start gap-1 rounded bg-white px-1.5 py-0.5">
        <span className="shrink-0 pt-1 text-slate-500">Usuario</span>
        <span className="min-w-0 flex-1 break-all pt-1 font-mono text-slate-800">{username || "Sin usuario"}</span>
        {username && copyButton(username, "username", "Copiar usuario")}
      </div>
      <div className="flex min-w-0 items-start gap-1 rounded bg-white px-1.5 py-0.5">
        <span className="shrink-0 pt-1 text-slate-500">Clave</span>
        <span className="min-w-0 flex-1 break-all pt-1 font-mono text-slate-800">
          {!hasPassword ? "Sin clave" : !canReveal ? "Acceso restringido" : revealed ? revealed.password : "••••••••"}
        </span>
        {hasPassword && canReveal && <div className="flex shrink-0 items-center gap-0.5">
          {revealed && <span className="text-[10px] text-amber-700">{remaining}s</span>}
          <button type="button" disabled={busy} onClick={() => void handlePassword()}
            title={revealed ? "Ocultar contraseña" : "Mostrar contraseña por 20 segundos"}
            aria-label={revealed ? "Ocultar contraseña" : "Mostrar contraseña por 20 segundos"}
            className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-[#004ac6] disabled:opacity-50">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
          <button type="button" disabled={busy} onClick={() => void handlePassword(true)} title="Copiar contraseña" aria-label="Copiar contraseña"
            className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-[#004ac6] disabled:opacity-50">
            {copied === "password" ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          </button>
        </div>}
      </div>
      {service.notes && <p className="break-words pt-0.5 text-slate-500">{service.notes}</p>}
    </div>
  );
}
