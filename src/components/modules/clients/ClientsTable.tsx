"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client } from "@/types";
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  X,
  DollarSign,
  FileText,
  ShieldAlert,
  CreditCard,
  Calendar,
} from "lucide-react";

interface ClientsTableProps {
  onSelectClient: (client: Client) => void;
  onOpenNewModal: () => void;
  onEditClient?: (client: Client) => void;
}

export function ClientsTable({ onSelectClient }: ClientsTableProps) {
  const { clients, clientServices, monthlyCharges, billingInvoices, deleteClient } = useApp();
  const { showSuccess, showError } = useToast();

  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [balanceFilter, setBalanceFilter] = useState<"todos" | "con_saldo" | "al_dia">("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals state
  const [selectedInvoicesClient, setSelectedInvoicesClient] = useState<Client | null>(null);
  const [blockedDeleteClient, setBlockedDeleteClient] = useState<{ client: Client; balance: number } | null>(null);
  const [confirmDeleteClient, setConfirmDeleteClient] = useState<Client | null>(null);
  const [confirmDeleteChecked, setConfirmDeleteChecked] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper: calculate pending balance for any client
  const getClientPendingBalance = useCallback((client: Client): number => {
    const pendingChargesSum = monthlyCharges
      .filter((c) => c.clientId === client.id && c.status === "pendiente")
      .reduce((sum, c) => sum + (c.balanceRemaining !== undefined ? c.balanceRemaining : c.total), 0);

    const clientBal = Number(client.currentBalance) || 0;
    return Math.round(Math.max(clientBal, pendingChargesSum) * 100) / 100;
  }, [monthlyCharges]);

  // Filtered clients list
  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const q = filter.toLowerCase().trim();
      const matchesQuery =
        !q ||
        c.businessName.toLowerCase().includes(q) ||
        c.identificationNumber.includes(q) ||
        c.email.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "todos" || c.status === statusFilter;

      const pendingBal = getClientPendingBalance(c);
      const matchesBalance =
        balanceFilter === "todos" ||
        (balanceFilter === "con_saldo" && pendingBal > 0) ||
        (balanceFilter === "al_dia" && pendingBal === 0);

      return matchesQuery && matchesStatus && matchesBalance;
    });
  }, [clients, filter, statusFilter, balanceFilter, getClientPendingBalance]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedClients = filtered.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);
  const startIndex = filtered.length === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(safeCurrentPage * itemsPerPage, filtered.length);

  // Invoices for selected modal client
  const clientInvoices = useMemo(() => {
    if (!selectedInvoicesClient) return [];
    return billingInvoices.filter(
      (inv) =>
        inv.clientId === selectedInvoicesClient.id ||
        (inv.clientRuc && inv.clientRuc === selectedInvoicesClient.identificationNumber)
    );
  }, [selectedInvoicesClient, billingInvoices]);

  const clientCharges = useMemo(() => {
    if (!selectedInvoicesClient) return [];
    return monthlyCharges.filter((c) => c.clientId === selectedInvoicesClient.id);
  }, [selectedInvoicesClient, monthlyCharges]);

  const modalTotalFacturado = useMemo(() => {
    const invTotal = clientInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const chargeTotal = clientCharges.reduce((sum, c) => sum + (c.total || 0), 0);
    return invTotal + chargeTotal;
  }, [clientInvoices, clientCharges]);

  // Handle client delete request with strict validation
  const handleRequestDelete = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const pendingBalance = getClientPendingBalance(client);

    if (pendingBalance > 0) {
      // Bloqueo: No se puede eliminar por saldo pendiente
      setBlockedDeleteClient({ client, balance: pendingBalance });
    } else {
      // Confirmación segura: Saldo $0.00
      setConfirmDeleteClient(client);
      setConfirmDeleteChecked(false);
    }
  };

  // Perform confirmed deletion
  const handleConfirmDelete = async () => {
    if (!confirmDeleteClient) return;
    setIsDeleting(true);
    try {
      await deleteClient(confirmDeleteClient.id);
      showSuccess(
        "Cliente Eliminado",
        `El cliente "${confirmDeleteClient.businessName}" ha sido dado de baja exitosamente.`
      );
      setConfirmDeleteClient(null);
    } catch (error) {
      showError("Error al Eliminar", error instanceof Error ? error.message : "No se pudo eliminar el cliente.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full select-none">
      {/* Main Container Card */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-lumina-card overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 bg-[#ffffff]">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por RUC o Razón Social..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-white text-xs text-[#0b1c30] rounded-lg pl-9 pr-3 py-2 border border-[#cbd5e1] focus:outline-hidden focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>

            <button
              onClick={() => {
                setFilter("");
                setStatusFilter("todos");
                setBalanceFilter("todos");
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#cbd5e1] text-xs font-semibold text-[#434655] hover:bg-[#f8f9ff] cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#737686]" />
              <span>Limpiar Filtros</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white text-xs font-medium text-[#434655] rounded-lg px-3 py-2 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
            >
              <option value="todos">Todos los Estados</option>
              <option value="activo">Activo</option>
              <option value="suspendido">Suspendido</option>
              <option value="retirado">Retirado</option>
              <option value="inactivo">Inactivo</option>
            </select>

            <select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value as any)}
              className="bg-white text-xs font-medium text-[#434655] rounded-lg px-3 py-2 border border-[#cbd5e1] focus:outline-hidden cursor-pointer"
            >
              <option value="todos">Todos los Saldos</option>
              <option value="con_saldo">Con Saldo Pendiente</option>
              <option value="al_dia">Al Día ($0.00)</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3.5 px-5">Cliente / Razón Social</th>
                <th className="py-3.5 px-5">RUC / CI</th>
                <th className="py-3.5 px-5">Servicio Contratado</th>
                <th className="py-3.5 px-5 text-right">Saldos</th>
                <th className="py-3.5 px-5 text-center">Estado</th>
                <th className="py-3.5 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] font-medium text-[#434655]">
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#737686] italic">
                    No se encontraron clientes con el filtro aplicado.
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const srv = clientServices.find((s) => s.clientId === client.id && s.status === "activo");
                  const pendingBalance = getClientPendingBalance(client);

                  return (
                    <tr
                      key={client.id}
                      onClick={() => onSelectClient(client)}
                      className="hover:bg-[#f8f9ff] transition-colors cursor-pointer group"
                    >
                      {/* Cliente / Razón Social (Limpio sin iconos ni textos pequeños grises) */}
                      <td className="py-3.5 px-5">
                        <span className="font-bold text-[#0b1c30] group-hover:text-[#004ac6] transition-colors block">
                          {client.businessName}
                        </span>
                      </td>

                      {/* RUC / CI (Solo el número limpio) */}
                      <td className="py-3.5 px-5 font-tnum">
                        <span className="font-mono text-xs font-semibold text-[#0b1c30]">
                          {client.identificationNumber}
                        </span>
                      </td>

                      {/* Servicio Contratado */}
                      <td className="py-3.5 px-5">
                        {srv ? (
                          <span className="font-semibold text-[#0b1c30] block">
                            {srv.planName}
                          </span>
                        ) : (
                          <span className="text-[#737686] italic">Sin servicio activo</span>
                        )}
                      </td>

                      {/* Saldos (Saldo pendiente del cliente) */}
                      <td className="py-3.5 px-5 text-right font-tnum">
                        {pendingBalance > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                            ${pendingBalance.toFixed(2)}
                          </span>
                        ) : (
                          <span className="font-mono font-semibold text-xs text-slate-500">
                            $0.00
                          </span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-5 text-center">
                        {client.status === "activo" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                            ACTIVO
                          </span>
                        ) : client.status === "inactivo" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#64748b]"></span>
                            INACTIVO
                          </span>
                        ) : client.status === "suspendido" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fffbeb] text-[#92400e] border border-[#fde68a]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
                            SUSPENDIDO
                          </span>
                        ) : client.status === "retirado" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fff7ed] text-[#9a3412] border border-[#fed7aa]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#f97316]"></span>
                            RETIRADO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></span>
                            CANCELADO
                          </span>
                        )}
                      </td>

                      {/* Acciones: Ver Cliente, Ver Facturas, Eliminar */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* 1. Ver Ficha del Cliente */}
                          <button
                            onClick={() => onSelectClient(client)}
                            className="p-1.5 text-[#737686] hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                            title="Ver Ficha del Cliente"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* 2. Ver Facturas y Notas de Venta */}
                          <button
                            onClick={() => setSelectedInvoicesClient(client)}
                            className="p-1.5 text-[#737686] hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                            title="Ver Facturas y Notas de Venta del Cliente"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>

                          {/* 3. Eliminar Cliente con Validación */}
                          <button
                            onClick={(e) => handleRequestDelete(client, e)}
                            className="p-1.5 text-[#737686] hover:text-[#ef4444] hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar Cliente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination Footer */}
        <div className="p-4 border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#737686] bg-[#ffffff]">
          <span className="font-medium">
            Mostrando <strong className="text-[#0b1c30]">{startIndex}</strong> a{" "}
            <strong className="text-[#0b1c30]">{endIndex}</strong> de{" "}
            <strong className="text-[#0b1c30]">{filtered.length}</strong> clientes
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-md border border-[#cbd5e1] hover:bg-[#f8f9ff] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Página anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`px-3 py-1 rounded-md font-bold text-xs transition-colors ${
                  safeCurrentPage === pageNum
                    ? "bg-[#004ac6] text-white"
                    : "border border-[#cbd5e1] hover:bg-[#f8f9ff] text-[#0b1c30]"
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-md border border-[#cbd5e1] hover:bg-[#f8f9ff] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Página siguiente"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: HISTORIAL DE FACTURAS Y NOTAS DE VENTA DEL CLIENTE              */}
      {/* ========================================================================= */}
      {selectedInvoicesClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#004ac6] flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Historial de Facturas & Notas de Venta
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedInvoicesClient.businessName} •{" "}
                    <span className="font-mono text-slate-700">
                      RUC/CI: {selectedInvoicesClient.identificationNumber}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoicesClient(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Summary Cards */}
            <div className="p-5 border-b border-slate-100 grid grid-cols-3 gap-3 bg-white text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Facturado
                </span>
                <span className="text-base font-black font-mono text-slate-900">
                  ${modalTotalFacturado.toFixed(2)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Comprobantes Emitidos
                </span>
                <span className="text-base font-black font-mono text-slate-900">
                  {clientInvoices.length + clientCharges.length}
                </span>
              </div>

              <div className={`p-3 rounded-xl border ${
                getClientPendingBalance(selectedInvoicesClient) > 0
                  ? "bg-rose-50 border-rose-200"
                  : "bg-emerald-50 border-emerald-200"
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                  getClientPendingBalance(selectedInvoicesClient) > 0
                    ? "text-rose-600"
                    : "text-emerald-600"
                }`}>
                  Saldo Pendiente
                </span>
                <span className={`text-base font-black font-mono ${
                  getClientPendingBalance(selectedInvoicesClient) > 0
                    ? "text-rose-700"
                    : "text-emerald-700"
                }`}>
                  ${getClientPendingBalance(selectedInvoicesClient).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Invoices List / Table */}
            <div className="flex-1 overflow-y-auto p-5">
              {clientInvoices.length === 0 && clientCharges.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-700 text-xs">Sin Comprobantes Registrados</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Aún no se han emitido facturas electrónicas o notas de venta para este cliente.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Comprobante</th>
                        <th className="py-2.5 px-3">Tipo</th>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Forma de Pago</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Facturas Electrónicas SRI */}
                      {clientInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {inv.documentNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#004ac6] border border-blue-200">
                              Factura SRI
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {inv.date}
                          </td>
                          <td className="py-2.5 px-3 capitalize text-slate-700">
                            {inv.paymentMethod}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            ${inv.total.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              inv.status === "autorizada"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : inv.status === "anulada"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {/* Cobros y Pre-Facturas */}
                      {clientCharges.map((ch) => (
                        <tr key={ch.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {ch.invoiceNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Cobro Mensual
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {ch.month}/{ch.year}
                          </td>
                          <td className="py-2.5 px-3 capitalize text-slate-700">
                            {ch.paymentMethod || "Transferencia"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            ${ch.total.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              ch.status === "pagado"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {ch.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-end bg-slate-50/70">
              <button
                type="button"
                onClick={() => setSelectedInvoicesClient(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BLOQUEO DE ELIMINACIÓN POR CUENTAS POR COBRAR / SALDO PENDIENTE */}
      {/* ========================================================================= */}
      {blockedDeleteClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-md overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
                <ShieldAlert className="w-7 h-7" />
              </div>

              <div>
                <h3 className="font-black text-slate-900 text-base">
                  No es posible eliminar al cliente
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Acción bloqueada por control de saldos y cuentas por cobrar
                </p>
              </div>

              {/* Client & Debt Info Card */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-rose-200/60 pb-2">
                  <span className="font-bold text-slate-700 truncate max-w-[220px]">
                    {blockedDeleteClient.client.businessName}
                  </span>
                  <span className="font-mono text-slate-500 text-[11px]">
                    {blockedDeleteClient.client.identificationNumber}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-rose-800">Saldo Pendiente por Cobrar:</span>
                  <span className="text-base font-black font-mono text-rose-600">
                    ${blockedDeleteClient.balance.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Explanatory Note regarding Accounting / Debt */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-left text-[11px] text-slate-600 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>¿Por qué no se puede eliminar?</span>
                </div>
                <p>
                  El cliente mantiene obligaciones financieras activas. Por normativa contable y auditoría tributaria del SRI, <strong>no se pueden dejar cuentas por cobrar huérfanas</strong>.
                </p>
                <p className="text-slate-500">
                  Para proceder con la baja definitiva, primero liquide los saldos pendientes en Finanzas o anule las facturas emitiendo una Nota de Crédito en Ventas hasta que el saldo sea <strong>$0.00</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBlockedDeleteClient(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold rounded-xl text-xs transition cursor-pointer"
                >
                  Entendido
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const client = blockedDeleteClient.client;
                    setBlockedDeleteClient(null);
                    setSelectedInvoicesClient(client);
                  }}
                  className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Ver Facturas y Deudas</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CONFIRMACIÓN SEGURA DE BAJA DE CLIENTE (CUANDO SALDO ES $0.00)   */}
      {/* ========================================================================= */}
      {confirmDeleteClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div>
                <h3 className="font-black text-slate-900 text-base">
                  ¿Dar de baja definitiva al cliente?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Verificación de solvencia completada (Saldo al día)
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-800 truncate max-w-[220px]">
                    {confirmDeleteClient.businessName}
                  </span>
                  <span className="font-mono text-slate-500 text-[11px]">
                    {confirmDeleteClient.identificationNumber}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1 text-xs">
                  <span className="text-slate-600 font-semibold">Estado de Cuentas:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Al Día (Saldo $0.00)
                  </span>
                </div>
              </div>

              <div className="text-left text-[11px] text-slate-500 bg-slate-50/70 p-3 rounded-xl border border-slate-200 space-y-1">
                <p>
                  • Al confirmar, se dará de baja la ficha del cliente y sus servicios activos.
                </p>
                <p>
                  • Los comprobantes electrónicos e historial tributario previamente emitidos en el SRI permanecerán archivados para cumplimiento legal.
                </p>
              </div>

              <label className="flex items-start gap-2.5 text-left text-xs text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={confirmDeleteChecked}
                  onChange={(e) => setConfirmDeleteChecked(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="font-medium text-[11px] leading-tight select-none">
                  Confirmo que deseo dar de baja definitiva a este cliente de la base activa.
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteClient(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={!confirmDeleteChecked || isDeleting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Sí, Eliminar Cliente</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
