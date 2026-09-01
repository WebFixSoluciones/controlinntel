"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-200 space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 p-2 flex items-center justify-center shadow-xs">
            <AlertTriangle className="w-8 h-8" />
          </div>
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold uppercase tracking-wider inline-block">
            Diagnóstico Operativo
          </span>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Interrupción Inesperada
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Se detectó una excepción en la vista actual. Puedes reintentar la operación o volver al inicio.
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            onClick={() => reset()}
            className="w-full py-3 px-5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reintentar Operación</span>
          </button>

          <Link
            href="/"
            className="w-full py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Regresar al Inicio</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
