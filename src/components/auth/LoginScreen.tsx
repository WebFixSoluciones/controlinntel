"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { SYSTEM_ACCOUNTS } from "@/lib/mock-data";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Shield,
  KeyRound,
  Radio,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";

export function LoginScreen() {
  const { login } = useApp();
  const { showError, showSuccess } = useToast();

  const [email, setEmail] = useState("admin@inntelcorp.ec");
  const [password, setPassword] = useState("Admin2026*");
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
          "El usuario o la contraseña son incorrectos. Puedes utilizar los accesos rápidos de prueba a continuación."
        );
      }
    }, 400);
  };

  const handleQuickLogin = (accEmail: string, accPass: string) => {
    setEmail(accEmail);
    setPassword(accPass);
    setIsLoading(true);
    setTimeout(() => {
      login(accEmail, accPass, rememberMe);
      setIsLoading(false);
      showSuccess("Sesión Iniciada", `Conectado como ${accEmail}`);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Branding */}
        <div className="p-6 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 text-center relative">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-md border border-slate-100 mb-3">
            <Image
              src="/logo-inntel.webp"
              alt="INNTEL CORP"
              width={64}
              height={64}
              className="object-contain"
              priority
            />
          </div>

          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            INNTEL CORP S.A.
          </h1>
          <p className="text-xs font-semibold text-sky-700 uppercase tracking-wider mt-0.5">
            Plataforma Integral ISP, ARCOTEL & SRI
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Ingresa tus credenciales autorizadas para acceder
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Contraseña de Acceso
              </label>
              <span className="text-[10px] text-sky-600 font-semibold">
                INNTEL Security
              </span>
            </div>
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

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <span className="text-[11px] font-medium">Recordar sesión</span>
            </label>

            <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Cifrado 256-bit
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

        {/* Demo Fast Access Role Selector */}
        <div className="p-5 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Accesos Rápidos por Rol
            </span>
            <span className="text-[9px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
              1-Click Demo
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-left">
            {SYSTEM_ACCOUNTS.map((acc) => (
              <button
                key={acc.user.uid}
                type="button"
                onClick={() => handleQuickLogin(acc.user.email, acc.passwordHash)}
                className="p-2 rounded-xl bg-white hover:bg-sky-50/80 border border-slate-200 hover:border-sky-300 transition-all text-left group cursor-pointer shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-800 group-hover:text-sky-800 truncate">
                    {acc.user.displayName.split(" ")[0]} {acc.user.displayName.split(" ")[1]}
                  </span>
                  <span className="text-[9px] font-bold uppercase px-1 rounded bg-slate-100 group-hover:bg-sky-200/60 text-slate-600">
                    {acc.user.role}
                  </span>
                </div>
                <p className="text-[9px] text-slate-400 truncate mt-0.5">{acc.user.email}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer System Disclaimer */}
      <div className="mt-6 text-center space-y-1">
        <p className="text-[11px] text-slate-400 font-medium">
          INNTEL CORP S.A. — Sistema Homologado para Operadores de Telecomunicaciones SAI
        </p>
        <p className="text-[10px] text-slate-500">
          Supervisión ARCOTEL • Conexión Cifrada MikroTik RouterOS API • Pre-Facturación SRI
        </p>
      </div>
    </div>
  );
}
