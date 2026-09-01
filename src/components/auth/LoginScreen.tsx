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
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Branding */}
        <div className="p-8 pb-6 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 text-center relative">
          <div className="inline-flex items-center justify-center p-3.5 bg-white rounded-2xl shadow-md border border-slate-100 mb-3">
            <Image
              src="/logo-inntel.webp"
              alt="INNTEL CORP"
              width={68}
              height={68}
              className="object-contain"
              priority
            />
          </div>

          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            INNTEL CORP S.A.
          </h1>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Correo Electrónico / Usuario
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@inntelcorp.ec"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Contraseña de Acceso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center text-xs pt-1">
            <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <span className="text-[11px] font-medium">Recordar sesión</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
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
        <p className="text-[11px] text-slate-400 font-medium">
          INNTEL CORP S.A. — Sistema Homologado para Operadores de Telecomunicaciones SAI
        </p>
        <p className="text-[10px] text-slate-500">
          Supervisión ARCOTEL • Conexión Cifrada MikroTik RouterOS API • Órdenes de Pedido & Cobranzas
        </p>
      </div>
    </div>
  );
}
