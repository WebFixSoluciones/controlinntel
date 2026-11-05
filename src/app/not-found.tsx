import React from "react";
import { BackButton } from "@/components/ui/BackButton";
import Image from "next/image";
import { ShieldAlert } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white rounded-xl p-8 shadow-2xl border border-slate-200 space-y-6">
        {/* Brand */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-center shadow-xs">
            <Image
              src="/logo-inntel.webp"
              alt="INNTEL CORP"
              width={52}
              height={52}
              className="object-contain"
            />
          </div>
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Error 404 — Ruta No Encontrada
          </span>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Módulo o Página Inexistente
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            La ruta solicitada no se encuentra disponible en la plataforma o fue movida. Por favor retorna al panel de control central.
          </p>
        </div>

        <div className="pt-2">
          <BackButton href="/" label="Volver al Dashboard Principal" />
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-6 font-medium">
        INNTEL CORP S.A. — Sistema de Gestión & ARCOTEL
      </p>
    </div>
  );
}
