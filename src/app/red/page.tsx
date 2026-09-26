"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Radio, Users, ArrowRight, Building2 } from "lucide-react";

export default function RedRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/clientes");
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-6 md:p-8 flex-1 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/90 shadow-lumina-card text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#004ac6] flex items-center justify-center mx-auto">
              <Radio className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Módulo Reorganizado en Clientes
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                El control de sedes y nodos ahora es un submódulo exclusivo de cada abonado. Puedes consultar y registrar los nodos del cliente directamente desde su <strong>Ficha 360°</strong> (pestaña Sedes & Nodos).
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/clientes"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Ir al Módulo de Clientes</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <p className="text-[10px] text-slate-400">
              Redirigiendo automáticamente en unos segundos...
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
