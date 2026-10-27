"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { Receipt, ArrowRight } from "lucide-react";

export function RecentSalesCard() {
  const { billingInvoices } = useApp();

  const recentInvoices = (billingInvoices || []).filter(i => i.documentType === "nota_venta").sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "autorizada":
      case "registrado":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            {status === "registrado" ? "Registrada" : "Autorizada"}
          </span>
        );
      case "anulada":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            Anulada
          </span>
        );
      case "emitida":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200">
            Emitida
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
      <div className="p-4 px-5 border-b border-[#f1f5f9] flex items-center justify-between">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#0b1c30] flex items-center gap-2">
          <Receipt className="w-4 h-4 text-[#004ac6]" />
          Últimas Ventas
        </h3>
        <Link
          href="/ventas?sub=notas_venta"
          className="text-xs font-bold text-[#004ac6] hover:underline flex items-center gap-1"
        >
          <span>Ver todas</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="table-fixed w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
            <tr>
              <th className="py-2.5 px-4 w-[24%]">Comprobante</th>
              <th className="py-2.5 px-4 w-[36%]">Cliente</th>
              <th className="py-2.5 px-3 w-[16%]">Fecha</th>
              <th className="py-2.5 px-3 text-right w-[12%]">Total</th>
              <th className="py-2.5 px-4 text-center w-[12%]">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
            {recentInvoices.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                  No hay ventas registradas aún.
                </td>
              </tr>
            ) : (
              recentInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#f8f9ff] transition-colors">
                  <td className="py-2.5 px-4 font-mono font-bold text-xs text-slate-900">
                    {inv.documentNumber}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="font-semibold text-slate-800 truncate max-w-[200px] block">
                      {inv.clientName}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                    {inv.date}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    ${inv.total.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {getStatusBadge(inv.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
