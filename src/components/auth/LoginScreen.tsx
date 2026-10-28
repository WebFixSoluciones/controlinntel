"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import styles from "./LoginScreen.module.css";
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
  const [isLockedOut, setIsLockedOut] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // 1. CAPA 1: Escaneo Perimetral de Inyección (SQLi, XSS, Path Traversal)
    const emailThreat = detectSecurityThreat(cleanEmail);
    // Passwords are opaque credentials; valid symbols must reach Firebase unchanged.
    const passThreat = { isThreat: false, threatName: "", threatType: undefined };

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

    // 2. CAPA 2: Escudo Anti-Fuerza Bruta
    const lockoutState = getLockoutState(cleanEmail);
    if (lockoutState.isLocked) {
      setIsLockedOut(true);
      const secondsLeft = Math.max(0, Math.ceil((lockoutState.expiresAt - Date.now()) / 1000));
      const minutesLeft = Math.ceil(secondsLeft / 60);
      showError(
        "Cuenta Temporalmente Bloqueada",
        `Esta cuenta ha alcanzado el límite de intentos fallidos. Intente nuevamente en ${minutesLeft} minuto(s) o use el botón inferior para restablecer.`
      );
      return;
    }

    if (!cleanEmail) {
      showError("Campo Requerido", "Por favor ingresa tu correo de usuario.");
      return;
    }

    if (!cleanPassword) {
      showError("Contraseña Incompleta", "Por favor ingresa tu contraseña de acceso.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(cleanEmail, cleanPassword, rememberMe);
      setIsLoading(false);

      if (result.success) {
        clearFailedAttempts(cleanEmail);
        clearFailedAttempts("global");
        setIsLockedOut(false);
        showSuccess("Acceso Concedido", `Bienvenido al panel central de INNTEL CORP S.A.`);
      } else {
        const attempt = recordFailedAttempt(cleanEmail);
        if (attempt.isLocked) {
          setIsLockedOut(true);
          showError(
            "Cuenta Bloqueada por Seguridad",
            "Has alcanzado el límite de 5 intentos fallidos. Puedes restablecer los intentos o esperar 15 minutos."
          );
        } else {
          showWarning(
            "Credenciales Inválidas",
            result.error || `Usuario o contraseña erróneos. Te quedan ${attempt.remainingAttempts} intento(s) antes del bloqueo de seguridad.`
          );
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      showError("Error de Conexión", err?.message || "No se pudo validar la sesión. Por favor reintente.");
    }
  };

  return (
    <main className={styles.screen} aria-label="Acceso a INNTEL">
      <div className={styles.liquid} aria-hidden="true">
        <div className={`${styles.blob} ${styles.blue}`} />
        <div className={`${styles.blob} ${styles.purple}`} />
        <div className={`${styles.blob} ${styles.indigo}`} />
        <div className={`${styles.blob} ${styles.highlight}`} />
      </div>

      <div className={styles.panel}>
        <div className={styles.brand}>
            <Image
              src="/logo-inntel.webp"
              alt="INNTEL CORP"
              width={112}
              height={96}
              className={styles.logo}
              priority
            />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="login-email" className="block text-xs font-bold text-[#434655] mb-1.5">
              Correo Electrónico / Usuario Corporativo
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#737686]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30] placeholder:text-[#737686] focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-bold text-[#434655] mb-1.5">
              Contraseña de Acceso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#737686]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="login-password"
                name="password"
                autoComplete="current-password"
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
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                aria-controls="login-password"
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

          {isLockedOut && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
              <span>Intentos de acceso temporalmente pausados.</span>
              <button
                type="button"
                onClick={() => {
                  clearFailedAttempts(email.trim().toLowerCase());
                  clearFailedAttempts("global");
                  setIsLockedOut(false);
                  showSuccess("Intentos Restablecidos", "El contador de intentos ha sido desbloqueado.");
                }}
                className="text-xs font-bold text-[#004ac6] hover:underline cursor-pointer"
              >
                Restablecer intentos
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            className="w-full py-2.5 px-4 bg-[#004ac6] hover:bg-[#2563eb] text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <>
                <span aria-hidden="true" className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Ingresando…</span>
              </>
            ) : (
              <>
                <span>Iniciar sesión</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

    </main>
  );
}
