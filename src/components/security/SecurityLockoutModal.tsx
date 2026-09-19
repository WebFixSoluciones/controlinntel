"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, AlertTriangle, Lock, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { getLockoutState, SecurityIncident } from "@/lib/security-shield";

interface SecurityLockoutModalProps {
  onUnlock?: () => void;
}

export function SecurityLockoutModal({ onUnlock }: SecurityLockoutModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [incident, setIncident] = useState<SecurityIncident | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Comprobar bloqueo activo al montar
  useEffect(() => {
    const checkState = () => {
      const state = getLockoutState();
      if (state.isLocked) {
        const secondsLeft = Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 1000));
        if (secondsLeft > 0) {
          setIsOpen(true);
          setReason(state.reason);
          setRemainingSeconds(secondsLeft);
        }
      }
    };

    checkState();

    // Escuchar evento de detonación de seguridad
    const handleLockdown = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsOpen(true);
      setReason(customEvent.detail?.reason || "Violación de seguridad crítica detectada.");
      setIncident(customEvent.detail?.incident || null);

      const state = getLockoutState();
      if (state.isLocked) {
        setRemainingSeconds(Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 1000)));
      } else {
        setRemainingSeconds(900); // 15 minutos default
      }
    };

    window.addEventListener("inntel:security-lockdown", handleLockdown);
    return () => window.removeEventListener("inntel:security-lockdown", handleLockdown);
  }, []);

  // Timer de cuenta regresiva para desbloqueo automático
  useEffect(() => {
    if (!isOpen || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsOpen(false);
          if (onUnlock) onUnlock();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, remainingSeconds, onUnlock]);

  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0b1c30]/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border-2 border-red-500 overflow-hidden relative">
        {/* Banner Superior Rojo Alerta */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 p-6 text-white text-center relative">
          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-full mb-3 backdrop-blur-sm ring-4 ring-white/20 animate-pulse">
            <ShieldAlert className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-black tracking-tight uppercase">
            Escudo de Ciberseguridad Activado
          </h2>
          <p className="text-xs text-red-100 mt-1 font-medium">
            INNTEL CORP S.A. — Protocolo de Aislamiento Inmediato
          </p>
        </div>

        {/* Contenido del Incidente */}
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-red-900 uppercase">
                Violación de Seguridad Detectada
              </h3>
              <p className="text-xs text-red-700 leading-relaxed font-medium">
                {reason || "Se ha detectado una actividad anómala o intento de vulneración que infringe las políticas de seguridad del sistema."}
              </p>
            </div>
          </div>

          {/* Temporizador de Bloqueo */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-500 mb-1">
              <Clock className="w-4 h-4 text-red-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Tiempo de Suspensión Preventiva
              </span>
            </div>
            <div className="text-3xl font-black text-red-600 font-mono tracking-wider">
              {timeFormatted}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Las solicitudes hacia el portal quedan bloqueadas hasta que finalice el contador.
            </p>
          </div>

          {/* Detalle Técnico Forense */}
          <div className="text-[11px] text-slate-500 bg-slate-100 p-3 rounded-lg font-mono space-y-1 border border-slate-200">
            <div>
              <strong className="text-slate-700">Dominio Autorizado:</strong> https://www.inntelcorp.com/
            </div>
            <div>
              <strong className="text-slate-700">Código de Incidente:</strong> {incident?.id || `SEC-${Date.now().toString().slice(-8)}`}
            </div>
            <div>
              <strong className="text-slate-700">Estado de Sesión:</strong> TOKENS PURGADOS / AISLAMIENTO COMPLETO
            </div>
          </div>

          {/* Acciones */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <a
              href="https://www.inntelcorp.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Portal Oficial INNTEL</span>
            </a>

            {remainingSeconds === 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onUnlock) onUnlock();
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Restablecer Acceso</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400">
          Supervisión de Seguridad NOC & ARCOTEL • Cifrado TLS 1.3 & HSTS Preload
        </div>
      </div>
    </div>
  );
}
