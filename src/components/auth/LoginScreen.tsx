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

export function LoginScreen() {
  const { login } = useApp();
  const { showError, showSuccess } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      showError("Correo Inválido", "Por favor ingresa un correo electrónico corporativo válido.");
      return;
    }

    if (!password || password.length < 4) {
      showError("Contraseña Incompleta", "Por favor ingresa tu contraseña de acceso.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const success = login(email, password, rememberMe);
      setIsLoading(false);

      if (success) {
        showSuccess("Acceso Concedido", `Bienvenido al panel central de INNTEL CORP S.A.`);
      } else {
        showError(
          "Credenciales Inválidas",
          "El usuario o la contraseña ingresados no coinciden con los registros autorizados."
        );
      }
    }, 400);
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
            INNTEL CORP S.A.
          </h1>
          <p className="text-xs text-[#737686] mt-1 font-medium">Lumina ERP — Sistema de Gestión ISP</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#434655] mb-1.5">
              Correo Electrónico / Usuario
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#737686]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@inntelcorp.ec"
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
      </div>
    </div>
  );
}
