"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { canUser } from "@/lib/permissions";
import { chargeBalance, money } from "@/lib/commercial-core";
import { activeReceivables, summarizeReceivables } from "@/lib/financial-summary";
import { ChargePaymentModal } from "./ChargePaymentModal";
import { safeNumber } from "@/lib/print-service";
import {
  Search,
  CheckCircle,
  Clock,
  DollarSign,
} from "lucide-react";
import type { MonthlyCharge } from "@/types";

export function AccountsReceivableTab() {
  const { currentUser, monthlyCharges } = useApp();
  const canCollect = canUser(currentUser, "finanzas", "canRegisterReceipts");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [selectedCharge, setSelectedCharge] = useState<MonthlyCharge | null>(null);

  const q = searchQuery.trim().toLowerCase();
  const filteredCharges = activeReceivables(monthlyCharges).filter(charge => {
    const matchesSearch = [charge.clientName, charge.clientRuc, charge.invoiceNumber]
      .some(value => String(value || "").toLowerCase().includes(q));
    const matchesStatus = filterStatus === "todos" ||
      (filterStatus === "pendiente" && chargeBalance(charge) > 0) ||
      (filterStatus === "pagado" && charge.status === "pagado");
    return matchesSearch && matchesStatus;
  });
  const { totalFacturado, totalRecaudado, totalPendiente } = summarizeReceivables(monthlyCharges);

  return (
    <div className="space-y-5">
      {/* 3 Tarjetas Directas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Total por Cobrar</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-amber-600">
            ${safeNumber(totalPendiente)}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Total Cobrado</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-emerald-600">
            ${safeNumber(totalRecaudado)}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Total Emitido</span>
            <div className="p-1.5 bg-blue-50 text-[#004ac6] rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono text-[#004ac6]">
            ${safeNumber(totalFacturado)}
          </div>
        </div>
      </div>

      {/* Búsqueda y Filtro */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar cliente, RUC o N° comprobante..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
        >
          <option value="todos">Comprobantes vigentes</option>
          <option value="pendiente">Pendientes</option>
          <option value="pagado">Cobrados</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-x-auto">
        <table className="table-fixed min-w-[52rem] w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
            <tr>
              <th className="w-2/12 py-3 px-4">Comprobante</th>
              <th className="w-3/12 py-3 px-4">Cliente</th>
              <th className="w-2/12 py-3 px-4">Servicio</th>
              <th className="w-1/12 py-3 px-4 text-center">Periodo</th>
              <th className="w-1/12 py-3 px-4 text-right">Total</th>
              <th className="w-1/12 py-3 px-4 text-right">Saldo</th>
              <th className="w-1/12 py-3 px-4 text-center">Estado</th>
              <th className="w-1/12 py-3 px-4 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {filteredCharges.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
                  No se encontraron cuentas por cobrar.
                </td>
              </tr>
            ) : (
              filteredCharges.map((c) => {
                const isPaid = c.status === "pagado";
                const balance = money(chargeBalance(c));

                return (
                  <tr key={c.id} className="hover:bg-[#f8f9ff] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">{c.invoiceNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 truncate">{c.clientName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{c.clientRuc}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 truncate">{c.serviceDescription}</td>
                    <td className="py-3 px-4 text-center text-slate-500 font-mono">
                      {c.month}/{c.year}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      ${safeNumber(c.total)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ${safeNumber(balance)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          isPaid
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {isPaid ? "Cobrado" : c.status === "parcial" ? "Parcial" : balance > 0 ? "Pendiente" : "Sin saldo"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!isPaid && balance > 0 && canCollect ? (
                        <button
                          onClick={() => setSelectedCharge(c)}
                          className="px-3 py-1 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                        >
                          Cobrar
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedCharge && (
        <ChargePaymentModal charge={selectedCharge} onClose={() => setSelectedCharge(null)} />
      )}
    </div>
  );
}
