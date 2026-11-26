"use client";

import { createSearchMatcher } from "@/lib/search";
import { clientSearchFields } from "@/lib/client-search";
import { DocumentTablePagination, useDocumentPagination } from "@/components/ui/DocumentTablePagination";
import { ActionIconButton } from "@/components/ui/ActionIconButton";
import { ClientServicesQuickView } from "./ClientServicesQuickView";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { canViewClientServicePart, canViewClientSalesHistory } from "@/lib/permissions";
import { api } from "@/lib/api-client";
import { clientSalesHistory } from "@/lib/client-sales-history";
import { useApp } from "@/lib/state";
import { matchesClientStatus, clientStatusLabel } from "@/lib/client-status";
import { useToast } from "@/lib/toast-context";
import { Client } from "@/types";
import { limpiarIdentificacion } from "@/lib/sri-service";
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
  ShieldAlert,
  Plus,
} from "lucide-react";

interface ClientsTableProps {
  onSelectClient: (client: Client) => void;
  onOpenNewModal?: () => void;
  onEditClient?: (client: Client) => void;
}

export function ClientsTable({ onSelectClient, onOpenNewModal }: ClientsTableProps) {
  const { clients, clientServices, monthlyCharges, deleteClient, currentUser } = useApp();
  const canHistory = canViewClientSalesHistory(currentUser);
  const showContracted = canViewClientServicePart(currentUser, "contratados");
  const showBilled = canViewClientServicePart(currentUser, "facturados");
  const { showSuccess, showError } = useToast();

  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("vigentes");
  const [recurrenceFilter, setRecurrenceFilter] = useState<"todos" | "recurrentes" | "mensual" | "anual" | "ocasional">("todos");
  const [balanceFilter, setBalanceFilter] = useState<"todos" | "con_saldo" | "al_dia">("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Helper: get recurrence info for a client
  const getClientRecurrenceInfo = useCallback((client: Client) => {
    const services = clientServices.filter((s) => s.clientId === client.id && s.status !== "retirado");
    const totalServices = services.length;
    const billableServices = services.filter(
      (s) => s.status === "activo" && s.isBillableInCurrentCycle !== false
    ).length;
    const hasMonthly =
      services.some((s) => (s.billingFrequency || "mensual") === "mensual") ||
      client.billingRecurrence === "mensual";
    const hasAnnual =
      services.some((s) => s.billingFrequency === "anual") ||
      client.billingRecurrence === "anual";
    const isRecurrent = totalServices > 0 || client.billingRecurrence === "mensual" || client.billingRecurrence === "anual";

    return {
      totalServices,
      billableServices,
      hasMonthly,
      hasAnnual,
      isRecurrent,
      label: hasMonthly && hasAnnual
        ? "Mensual / Anual"
        : hasAnnual
        ? "Anual"
        : isRecurrent
        ? "Mensual"
        : "Ocasional",
    };
  }, [clientServices]);

  // Modals state
  const [selectedInvoicesClient, setSelectedInvoicesClient] = useState<Client | null>(null);
  const [selectedServicesClient, setSelectedServicesClient] = useState<Client | null>(null);
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
    const matches = createSearchMatcher(filter);
    return clients.filter((c) => {
      const matchesQuery = matches(...clientSearchFields(c), c.email);

      const matchesStatus = matchesClientStatus(c, statusFilter);

      const pendingBal = getClientPendingBalance(c);
      const matchesBalance =
        balanceFilter === "todos" ||
        (balanceFilter === "con_saldo" && pendingBal > 0) ||
        (balanceFilter === "al_dia" && pendingBal === 0);

      const rec = getClientRecurrenceInfo(c);
      const matchesRecurrence =
        recurrenceFilter === "todos" ||
        (recurrenceFilter === "recurrentes" && rec.isRecurrent) ||
        (recurrenceFilter === "mensual" && rec.hasMonthly) ||
        (recurrenceFilter === "anual" && rec.hasAnnual) ||
        (recurrenceFilter === "ocasional" && !rec.isRecurrent);

      return matchesQuery && matchesStatus && matchesBalance && matchesRecurrence;
    });
  }, [clients, filter, statusFilter, balanceFilter, recurrenceFilter, getClientPendingBalance, getClientRecurrenceInfo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedClients = filtered.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);
  const startIndex = filtered.length === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(safeCurrentPage * itemsPerPage, filtered.length);

  const [historyData, setHistoryData] = useState<ReturnType<typeof clientSalesHistory> | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyDialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!selectedInvoicesClient || !canHistory) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    historyDialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedInvoicesClient(null);
      if (event.key !== "Tab") return;
      const buttons = historyDialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); if (previous?.isConnected) previous.focus(); };
  }, [selectedInvoicesClient, canHistory]);
  useEffect(() => {
    let cancelled = false;
    setHistoryData(null); setHistoryError("");
    if (!selectedInvoicesClient || !canHistory) return;
    setHistoryLoading(true);
    api<ReturnType<typeof clientSalesHistory>>(`/api/clients/history?clientId=${encodeURIComponent(selectedInvoicesClient.id)}`)
      .then(data => { if (!cancelled) setHistoryData(data); })
      .catch(error => { if (!cancelled) setHistoryError(error.message); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [selectedInvoicesClient, canHistory]);
  const history = historyData || clientSalesHistory([], []);
  const historyPage = useDocumentPagination(history.rows, [selectedInvoicesClient?.id]);


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
    <div className="w-full">
      {/* Main Container Card */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex flex-wrap items-center gap-2 flex-1 basis-56 min-w-0">
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 text-[#737686] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por RUC, Razón Social o Nombre Comercial..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-[#f8f9ff] text-xs text-[#0b1c30] rounded-lg pl-9 pr-3 py-2 border border-[#e2e8f0] focus:outline-hidden focus:bg-white focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] transition-colors"
              />
            </div>

            <button
              onClick={() => {
                setFilter("");
                setStatusFilter("vigentes");
                setRecurrenceFilter("todos");
                setBalanceFilter("todos");
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8f9ff] text-xs font-semibold text-[#434655] hover:bg-white hover:text-[#0b1c30] cursor-pointer transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#737686]" />
              <span>Limpiar</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={recurrenceFilter}
              onChange={(e) => setRecurrenceFilter(e.target.value as any)}
              className="bg-[#f8f9ff] text-xs font-semibold text-[#004ac6] rounded-lg px-3 py-2 border border-blue-200 focus:outline-hidden focus:bg-white cursor-pointer"
            >
              <option value="todos">Recurrencia</option>
              <option value="recurrentes">Recurrentes</option>
              <option value="mensual">Mensuales</option>
              <option value="anual">Anuales</option>
              <option value="ocasional">Ocasionales</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#f8f9ff] text-xs font-medium text-[#434655] rounded-lg px-3 py-2 border border-[#e2e8f0] focus:outline-hidden focus:bg-white cursor-pointer"
            >
              <option value="vigentes">No retirados</option>
              <option value="todos">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="suspendido">Suspendido</option>
              <option value="retirado">Retirado</option>
              <option value="inactivo">Inactivo</option>
            </select>

            <select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value as any)}
              className="bg-[#f8f9ff] text-xs font-medium text-[#434655] rounded-lg px-3 py-2 border border-[#e2e8f0] focus:outline-hidden focus:bg-white cursor-pointer"
            >
              <option value="todos">Saldo</option>
              <option value="con_saldo">Con Saldo</option>
              <option value="al_dia">Al Día</option>
            </select>

            {onOpenNewModal && (
              <button
                onClick={onOpenNewModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer whitespace-nowrap ml-1"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Cliente</span>
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="table-fixed w-full text-left text-xs">
            <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
              <tr>
                <th className="py-3 px-5 w-[30%]">Cliente / Razón Social</th>
                <th className="py-3 px-4 w-[16%]">Servicios</th>
                <th className="py-3 px-5 w-[22%]">Nombre Comercial</th>
                <th className="py-3 px-5 w-[18%]">RUC / CI</th>
                <th className="py-3 px-5 w-[14%] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] font-medium text-[#434655]">
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#737686] italic">
                    No se encontraron clientes con el filtro aplicado.
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  return (
                    <tr
                      key={client.id}
                      onClick={() => onSelectClient(client)}
                      className="hover:bg-[#f8f9ff] transition-colors cursor-pointer group"
                    >
                      {/* Cliente (Razón Social) */}
                      <td className="py-3.5 px-5">
                        <span className="text-xs font-semibold text-[#0b1c30] group-hover:text-[#004ac6] transition-colors">
                          {client.businessName}
                        </span>
                        <span className={`block w-fit mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${client.status === "retirado" ? "bg-rose-50 text-rose-700" : client.status === "activo" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                          {clientStatusLabel(client.status)}
                        </span>
                      </td>

                      {/* Columna Servicios: Botón minimalista no de burbuja */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedServicesClient(client);
                          }}
                          className="text-xs text-[#004ac6] hover:text-[#003da6] hover:underline font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                          disabled={!showContracted && !showBilled}
                          title="Ver servicios activos e historial de comprobantes"
                        >
                          Ver servicios
                        </button>
                      </td>

                      {/* Nombre Comercial */}
                      <td className="py-3.5 px-5">
                        {client.tradeName && client.tradeName.trim() ? (
                          <span className="font-semibold text-xs text-[#0b1c30]">
                            {client.tradeName}
                          </span>
                        ) : (
                          <span className="text-[#94a3b8] font-normal italic text-xs">
                            Sin nombre comercial
                          </span>
                        )}
                      </td>

                      {/* RUC / CI (Solo el número limpio sin espacios) */}
                      <td className="py-3.5 px-5 font-tnum">
                        <span className="font-mono text-xs font-semibold text-[#0b1c30]">
                          {limpiarIdentificacion(client.identificationNumber)}
                        </span>
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
                          {canHistory && <button
                            onClick={() => setSelectedInvoicesClient(client)}
                            className="p-1.5 text-[#737686] hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
                            title="Ver Facturas y Notas de Venta del Cliente"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>}

                          {/* 3. Eliminar Cliente con Validación */}
                          <ActionIconButton action="delete" onClick={(e) => handleRequestDelete(client, e)} title="Eliminar Cliente" />
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
      {selectedInvoicesClient && canHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 backdrop-blur-xs sm:p-5">
          <section ref={historyDialog} role="dialog" aria-modal="true" aria-label="Historial de ventas del cliente" className="flex max-h-[92dvh] w-full min-w-0 max-w-6xl flex-col overflow-hidden rounded-xl border bg-white shadow-2xl">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b bg-slate-50 px-4 py-4 sm:px-6">
              <div className="min-w-0"><h3 className="text-sm font-semibold text-slate-900">Historial de Facturas &amp; Notas de Venta</h3><p className="mt-1 break-words text-xs text-slate-500">{selectedInvoicesClient.businessName} · RUC/CI: {selectedInvoicesClient.identificationNumber}</p></div>
              <button type="button" aria-label="Cerrar historial" className="shrink-0 rounded-lg p-2 hover:bg-slate-200" onClick={() => setSelectedInvoicesClient(null)}><X className="size-4" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 gap-2 border-b p-4 text-xs sm:grid-cols-3">
              <div className="rounded-lg border bg-slate-50 p-3">Total de operaciones vigentes<strong className="mt-1 block font-mono text-base">${history.total.toFixed(2)}</strong></div>
              <div className="rounded-lg border bg-slate-50 p-3">Operaciones vigentes<strong className="mt-1 block font-mono text-base">{history.count}</strong></div>
              <div className="rounded-lg border bg-amber-50 p-3">Saldo pendiente registrado<strong className="mt-1 block font-mono text-base">${history.pending.toFixed(2)}</strong>{history.reconciliationCount > 0 && <span className="mt-1 block text-amber-800">{history.reconciliationCount} registro(s) requieren conciliación.</span>}</div>
            </div>
            <div className="overflow-x-auto p-3 sm:p-5">
              {historyLoading ? <p className="p-6 text-center text-sm text-slate-500">Cargando historial…</p> : historyError ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{historyError}</p> : history.rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Sin comprobantes vigentes para este cliente.</p> : (
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-blue-700"><tr>{["Comprobante", "Tipo", "Fecha", "Forma de pago", "Total", "Saldo", "Estado"].map(label => <th key={label} className="whitespace-nowrap border-b px-3 py-3 font-semibold">{label}</th>)}</tr></thead>
                  <tbody className="divide-y">{historyPage.rows.map(row => <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono font-semibold">{row.documentNumber}{row.sourceNumber && <span className="mt-1 block text-[10px] font-normal text-slate-500">Origen: {row.sourceNumber}</span>}{row.testDocuments?.length > 0 && <span className="mt-1 block max-w-64 text-[10px] font-normal text-slate-500">Pruebas SRI: {row.testDocuments.join(", ")}</span>}</td>
                    <td className="px-3 py-3">{row.kind}</td><td className="whitespace-nowrap px-3 py-3">{row.date}</td><td className="px-3 py-3 capitalize">{row.paymentMethod}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono">${row.total.toFixed(2)}</td><td className="whitespace-nowrap px-3 py-3 text-right font-mono">{row.pending === null ? "Por conciliar" : `$${row.pending.toFixed(2)}`}</td>
                    <td className="px-3 py-3"><span className="inline-block rounded border bg-slate-50 px-2 py-1 text-[10px] font-semibold">{row.status}</span>{row.needsReconciliation && <span className="mt-1 block text-amber-700">Revisar cartera vinculada</span>}</td>
                  </tr>)}</tbody>
                </table>
              )}
            </div>
            <DocumentTablePagination {...historyPage.controls} />
            </div>
            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-slate-50 px-4 py-3"><span className="text-[11px] text-slate-500">Las facturas de prueba y los documentos anulados no forman parte de los totales.</span><button type="button" className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white" onClick={() => setSelectedInvoicesClient(null)}>Cerrar</button></footer>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BLOQUEO DE ELIMINACIÓN POR CUENTAS POR COBRAR / SALDO PENDIENTE */}
      {/* ========================================================================= */}
      {blockedDeleteClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-200 w-full max-w-md overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
                <ShieldAlert className="w-6 h-6" />
              </div>

              <div>
                <h3 className="font-bold text-[#0b1c30] text-base">
                  No es posible eliminar al cliente
                </h3>
                <p className="text-xs text-[#737686] mt-1">
                  Acción bloqueada por control de saldos y cuentas por cobrar
                </p>
              </div>

              {/* Client & Debt Info Card */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-rose-200/60 pb-2">
                  <span className="font-bold text-[#0b1c30] truncate max-w-[220px]">
                    {blockedDeleteClient.client.businessName}
                  </span>
                  <span className="font-mono text-[#737686] text-xs">
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
              <div className="bg-[#f8f9ff] rounded-lg p-3.5 border border-[#e2e8f0] text-left text-xs text-[#475569] space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[#0b1c30]">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>¿Por qué no se puede eliminar?</span>
                </div>
                <p>
                  El cliente mantiene obligaciones financieras activas. Por normativa contable y auditoría tributaria del SRI, <strong>no se pueden dejar cuentas por cobrar huérfanas</strong>.
                </p>
                <p className="text-[#737686]">
                  Para proceder con la baja definitiva, primero liquide los saldos pendientes en Finanzas o anule las facturas emitiendo una Nota de Crédito en Ventas hasta que el saldo sea <strong>$0.00</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0] flex-wrap">
                {(currentUser.role === "admin" ||
                  currentUser.role === "superadmin" ||
                  currentUser.permissions?.includes("all") ||
                  currentUser.permissions?.includes("delete_clients")) && (
                  <button
                    type="button"
                    onClick={() => {
                      const client = blockedDeleteClient.client;
                      setBlockedDeleteClient(null);
                      setConfirmDeleteClient(client);
                      setConfirmDeleteChecked(false);
                    }}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 rounded-lg text-xs transition cursor-pointer"
                  >
                    Forzar Baja (Admin)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBlockedDeleteClient(null)}
                  className="px-4 py-2 border border-[#e2e8f0] text-[#475569] hover:bg-slate-100 font-semibold rounded-lg text-xs transition cursor-pointer"
                >
                  Entendido
                </button>
                <button
                  type="button"
                  disabled={!canHistory}
                  onClick={() => {
                    const client = blockedDeleteClient.client;
                    setBlockedDeleteClient(null);
                    setSelectedInvoicesClient(client);
                  }}
                  className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
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
          <div className="bg-white rounded-xl shadow-2xl border border-[#e2e8f0] w-full max-w-md overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="font-bold text-[#0b1c30] text-base">
                  ¿Dar de baja definitiva al cliente?
                </h3>
                <p className="text-xs text-[#737686] mt-1">
                  Verificación de solvencia completada (Saldo al día)
                </p>
              </div>

              <div className="bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-[#e2e8f0] pb-2">
                  <span className="font-bold text-[#0b1c30] truncate max-w-[220px]">
                    {confirmDeleteClient.businessName}
                  </span>
                  <span className="font-mono text-[#737686] text-xs">
                    {confirmDeleteClient.identificationNumber}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1 text-xs">
                  <span className="text-[#475569] font-semibold">Estado de Cuentas:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Al Día (Saldo $0.00)
                  </span>
                </div>
              </div>

              <div className="text-left text-xs text-[#737686] bg-[#f8f9ff] p-3 rounded-lg border border-[#e2e8f0] space-y-1">
                <p>
                  • Al confirmar, se dará de baja la ficha del cliente y sus servicios activos.
                </p>
                <p>
                  • Los comprobantes electrónicos e historial tributario previamente emitidos en el SRI permanecerán archivados para cumplimiento legal.
                </p>
              </div>

              <label className="flex items-start gap-2.5 text-left text-xs text-[#475569] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={confirmDeleteChecked}
                  onChange={(e) => setConfirmDeleteChecked(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="font-medium text-xs leading-tight">
                  Confirmo que deseo dar de baja definitiva a este cliente de la base activa.
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteClient(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-[#e2e8f0] text-[#475569] hover:bg-slate-100 font-semibold rounded-lg text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={!confirmDeleteChecked || isDeleting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
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

      {selectedServicesClient && (showContracted || showBilled) && (
        <ClientServicesQuickView key={selectedServicesClient.id} client={selectedServicesClient}
          onClose={() => setSelectedServicesClient(null)}
          onOpenHistory={canHistory ? () => {
            setSelectedServicesClient(null);
            setSelectedInvoicesClient(selectedServicesClient);
          } : undefined}
        />
      )}
    </div>
  );
}
