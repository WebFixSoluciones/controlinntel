"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import {
  detectSecurityThreat,
  recordFailedAttempt,
  clearFailedAttempts,
  getLockoutState,
  triggerSecurityExplosion,
} from "@/lib/security-shield";

export function LoginScreen() {
  const { login } = useApp();
  const { showError, showSuccess, showWarning } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Limpiar cualquier bloqueo previo al cargar para garantizar acceso al administrador
  useEffect(() => {
    clearFailedAttempts("superadmin@inntelcorp.com");
    clearFailedAttempts("global");
  }, []);

  const handleQuickAdminLogin = async () => {
    setIsLoading(true);
    setEmail("superadmin@inntelcorp.com");
    setPassword("Inntel2026*");
    clearFailedAttempts("superadmin@inntelcorp.com");
    clearFailedAttempts("global");
    try {
      const ok = await login("superadmin@inntelcorp.com", "Inntel2026*", true);
      setIsLoading(false);
      if (ok) {
        showSuccess("Acceso Concedido", "Bienvenido al panel central de INNTEL CORP.");
      } else {
        showError("Error de Acceso", "No se pudo validar la sesión maestra.");
      }
    } catch {
      setIsLoading(false);
      showError("Error", "Error al procesar el inicio de sesión.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    // 1. CAPA 1: Escaneo Perimetral de Inyección (SQLi, XSS, Path Traversal)
    const emailThreat = detectSecurityThreat(cleanEmail);
    const passThreat = detectSecurityThreat(password);

    if (emailThreat.isThreat || passThreat.isThreat) {
      const threatName = emailThreat.threatName || passThreat.threatName || "Inyección Maliciosa";
      triggerSecurityExplosion(
        `Intento de ataque detectado en formulario de acceso: ${threatName}. Aislamiento preventivo activado.`,
        {
          type: emailThreat.threatType || passThreat.threatType,
          targetInput: emailThreat.isThreat ? "email" : "password",
        }
      );
      showError(
        "Alerta de Seguridad",
        "Se detectaron caracteres o patrones no autorizados. El intento ha sido neutralizado."
      );
      return;
    }

    // 2. CAPA 2: Escudo Anti-Fuerza Bruta (Excluye cuentas maestras)
    const isMaster = cleanEmail.includes("superadmin") || cleanEmail === "admin" || cleanEmail.startsWith("admin@");
    if (!isMaster) {
      const lockoutState = getLockoutState(cleanEmail);
      if (lockoutState.isLocked) {
        const secondsLeft = Math.max(0, Math.ceil((lockoutState.expiresAt - Date.now()) / 1000));
        const minutesLeft = Math.ceil(secondsLeft / 60);
        triggerSecurityExplosion(lockoutState.reason);
        showError(
          "Cuenta Temporalmente Bloqueada",
          `Esta cuenta ha excedido el límite de intentos fallidos. Intente nuevamente en ${minutesLeft} minuto(s).`
        );
        return;
      }
    }

    if (!cleanEmail) {
      showError("Campo Requerido", "Por favor ingresa tu correo de usuario.");
      return;
    }

    if (!password) {
      showError("Contraseña Incompleta", "Por favor ingresa tu contraseña de acceso.");
      return;
    }

    setIsLoading(true);

    try {
      const success = await login(cleanEmail, password, rememberMe);
      setIsLoading(false);

      if (success) {
        clearFailedAttempts(cleanEmail);
        clearFailedAttempts("global");
        showSuccess("Acceso Concedido", `Bienvenido al panel central de INNTEL CORP S.A.`);
      } else {
        const attempt = recordFailedAttempt(cleanEmail);
        if (attempt.isLocked) {
          showError(
            "Cuenta Bloqueada por Seguridad",
            "Has alcanzado el límite de 5 intentos fallidos. El acceso ha sido suspendido por 15 minutos."
          );
        } else {
          showWarning(
            "Credenciales Inválidas",
            `Usuario o contraseña erróneos. Usa superadmin@inntelcorp.com con Inntel2026* o SuperAdmin2026*.`
          );
        }
      }
    } catch {
      setIsLoading(false);
      showError("Error de Conexión", "No se pudo validar la sesión. Por favor reintente.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#2563eb]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#712ae2]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Branding */}
        <div className="p-8 pb-6 bg-[#f8f9ff] border-b border-[#e2e8f0] text-center relative">
          <div className="inline-flex items-center justify-center p-3.5 bg-white rounded-xl shadow-xs border border-[#e2e8f0] mb-3">
            <Image
              src="/logo-inntel.webp"
              alt="INNTEL CORP"
              width={68}
              height={68}
              className="object-contain"
              priority
            />
          </div>

          <h1 className="text-xl font-bold text-[#0b1c30] tracking-tight">
            INNTEL CORP
          </h1>
          <p className="text-xs text-[#737686] mt-1 font-medium">Sistema de Control IPS</p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-semibold text-emerald-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Capa de Ciberseguridad Activa</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#434655] mb-1.5">
              Correo Electrónico / Usuario Corporativo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#737686]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="superadmin@inntelcorp.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30] placeholder:text-[#737686] focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#434655] mb-1.5">
              Contraseña de Acceso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#737686]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30] placeholder:text-[#737686] focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#737686] hover:text-[#0b1c30] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center text-xs pt-1">
            <label className="flex items-center gap-2 text-[#434655] cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-[#cbd5e1] text-[#004ac6] focus:ring-[#004ac6] cursor-pointer"
              />
              <span className="text-[11px] font-medium">Recordar sesión</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-[#004ac6] hover:bg-[#2563eb] text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Iniciar Sesión Segura</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Botón de Acceso Rápido SuperAdmin */}
          <div className="pt-3 border-t border-[#f1f5f9] space-y-2">
            <button
              type="button"
              onClick={handleQuickAdminLogin}
              disabled={isLoading}
              className="w-full py-2 px-3 bg-[#eff4ff] hover:bg-[#dbeafe] text-[#004ac6] font-bold text-xs rounded-lg border border-[#bfdbfe] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Ingresar como Administrador (1 Clic)</span>
            </button>
            <p className="text-[10px] text-center text-[#737686]">
              Credenciales: <strong className="text-slate-800">superadmin@inntelcorp.com</strong> • Clave: <strong className="text-slate-800">Inntel2026*</strong> o <strong className="text-slate-800">SuperAdmin2026*</strong>
            </p>
          </div>
        </form>
      </div>

      {/* Footer System Disclaimer */}
      <div className="mt-6 text-center space-y-1">
        <p className="text-[11px] text-[#737686] font-medium">
          INNTEL CORP S.A. — Sistema Homologado para Operadores de Telecomunicaciones SAI
        </p>
        <p className="text-[10px] text-[#737686]">
          Supervisión ARCOTEL • Conexión Cifrada MikroTik RouterOS API • Órdenes de Pedido & Cobranzas
        </p>
        <div className="pt-1">
          <a
            href="https://www.inntelcorp.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-[#004ac6] hover:underline"
          >
            Portal Corporativo Oficial: www.inntelcorp.com
          </a>
        </div>
      </div>
    </div>
  );
}
