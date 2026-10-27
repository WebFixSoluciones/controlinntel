"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useApp } from "@/lib/state";
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
  DollarSign,
  FileText,
  ShieldAlert,
  CreditCard,
  Calendar,
  Plus,
  ExternalLink,
} from "lucide-react";

interface ClientsTableProps {
  onSelectClient: (client: Client) => void;
  onOpenNewModal?: () => void;
  onEditClient?: (client: Client) => void;
}

export function ClientsTable({ onSelectClient, onOpenNewModal }: ClientsTableProps) {
  const { clients, clientServices, monthlyCharges, billingInvoices, deleteClient, currentUser } = useApp();
  const { showSuccess, showError } = useToast();

  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
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
  const [servicesModalTab, setServicesModalTab] = useState<"contratados" | "facturados">("contratados");
  const [blockedDeleteClient, setBlockedDeleteClient] = useState<{ client: Client; balance: number } | null>(null);
  const [confirmDeleteClient, setConfirmDeleteClient] = useState<Client | null>(null);
  const [confirmDeleteChecked, setConfirmDeleteChecked] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Servicios contratados del cliente seleccionado para el popup
  const clientContractedServices = useMemo(() => {
    if (!selectedServicesClient) return [];
    return clientServices.filter((s) => s.clientId === selectedServicesClient.id);
  }, [selectedServicesClient, clientServices]);

  // Servicios facturados (cobros mensuales y facturas) del cliente seleccionado
  const clientBilledServices = useMemo(() => {
    if (!selectedServicesClient) return [];
    const charges = monthlyCharges
      .filter(
        (ch) =>
          ch.clientId === selectedServicesClient.id ||
          ch.clientRuc === selectedServicesClient.identificationNumber
      )
      .map((ch) => ({
        id: ch.id,
        source: "charge" as const,
        docNumber: ch.invoiceNumber,
        date: ch.month && ch.year ? `${String(ch.month).padStart(2, "0")}/${ch.year}` : ch.saleDate || "-",
        description: ch.serviceDescription || "Servicio mensual",
        amount: ch.total,
        status: ch.status,
      }));

    const invoices = billingInvoices
      .filter(
        (inv) =>
          inv.clientId === selectedServicesClient.id ||
          inv.clientRuc === selectedServicesClient.identificationNumber
      )
      .map((inv) => ({
        id: inv.id,
        source: "invoice" as const,
        docNumber: inv.documentNumber,
        date: inv.date,
        description: inv.items.map((it) => `${it.quantity}x ${it.name}`).join(", ") || "Comprobante comercial",
        amount: inv.total,
        status: inv.status,
      }));

    return [...charges, ...invoices];
  }, [selectedServicesClient, monthlyCharges, billingInvoices]);

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
      const qNoSpaces = q.replace(/\s+/g, "");
      const cleanId = limpiarIdentificacion(c.identificationNumber).toLowerCase();
      const matchesQuery =
        !q ||
        c.businessName.toLowerCase().includes(q) ||
        (c.tradeName && c.tradeName.toLowerCase().includes(q)) ||
        cleanId.includes(qNoSpaces) ||
        c.email.toLowerCase().includes(qNoSpaces);

      const matchesStatus = statusFilter === "todos" || c.status === statusFilter;

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

  // Invoices for selected modal client
  const clientInvoices = useMemo(() => {
    if (!selectedInvoicesClient) return [];
    const targetCleanId = limpiarIdentificacion(selectedInvoicesClient.identificationNumber);
    return billingInvoices.filter(
      (inv) =>
        inv.clientId === selectedInvoicesClient.id ||
        (inv.clientRuc && limpiarIdentificacion(inv.clientRuc) === targetCleanId)
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
    <div className="w-full">
      {/* Main Container Card */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
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
                setStatusFilter("todos");
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
              <option value="todos">Estado</option>
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
                      </td>

                      {/* Columna Servicios: Botón minimalista no de burbuja */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedServicesClient(client);
                            setServicesModalTab("contratados");
                          }}
                          className="text-xs text-[#004ac6] hover:text-[#003da6] hover:underline font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                          title="Ver servicios contratados y facturados"
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
          <div className="bg-white rounded-xl shadow-2xl border border-[#e2e8f0] w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#004ac6] flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0b1c30] text-sm">
                    Historial de Facturas & Notas de Venta
                  </h3>
                  <p className="text-xs text-[#737686] font-medium">
                    {selectedInvoicesClient.businessName} •{" "}
                    <span className="font-mono text-[#0b1c30]">
                      RUC/CI: {selectedInvoicesClient.identificationNumber}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoicesClient(null)}
                className="p-1.5 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Summary Cards */}
            <div className="p-5 border-b border-[#e2e8f0] grid grid-cols-3 gap-3 bg-white text-xs">
              <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                <span className="text-xs font-bold text-[#737686] uppercase tracking-wider block">
                  Total Facturado
                </span>
                <span className="text-base font-black font-mono text-[#0b1c30]">
                  ${modalTotalFacturado.toFixed(2)}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                <span className="text-xs font-bold text-[#737686] uppercase tracking-wider block">
                  Comprobantes Emitidos
                </span>
                <span className="text-base font-black font-mono text-[#0b1c30]">
                  {clientInvoices.length + clientCharges.length}
                </span>
              </div>

              <div className={`p-3 rounded-lg border ${
                getClientPendingBalance(selectedInvoicesClient) > 0
                  ? "bg-rose-50 border-rose-200"
                  : "bg-emerald-50 border-emerald-200"
              }`}>
                <span className={`text-xs font-bold uppercase tracking-wider block ${
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
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-[#0b1c30] text-xs">Sin Comprobantes Registrados</h4>
                  <p className="text-xs text-[#737686] max-w-sm mx-auto">
                    Aún no se han emitido facturas electrónicas o notas de venta para este cliente.
                  </p>
                </div>
              ) : (
                <div className="border border-[#e2e8f0] rounded-xl overflow-hidden shadow-2xs">
                  <table className="table-fixed w-full text-left text-xs">
                    <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                      <tr>
                        <th className="py-2.5 px-3 w-3/12">Comprobante</th>
                        <th className="py-2.5 px-3 w-2/12">Tipo</th>
                        <th className="py-2.5 px-3 w-2/12">Fecha</th>
                        <th className="py-2.5 px-3 w-2/12">Forma de Pago</th>
                        <th className="py-2.5 px-3 w-2/12 text-right">Total</th>
                        <th className="py-2.5 px-3 w-1/12 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {/* Facturas Electrónicas SRI */}
                      {clientInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-[#f8f9ff] transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#0b1c30]">
                            {inv.documentNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-[#004ac6] border border-blue-200">
                              Factura SRI
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#475569]">
                            {inv.date}
                          </td>
                          <td className="py-2.5 px-3 capitalize text-[#475569]">
                            {inv.paymentMethod}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0b1c30]">
                            ${inv.total.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase ${
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
                        <tr key={ch.id} className="hover:bg-[#f8f9ff] transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#0b1c30]">
                            {ch.invoiceNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-[#475569] border border-slate-200">
                              Cobro Mensual
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#475569]">
                            {ch.month}/{ch.year}
                          </td>
                          <td className="py-2.5 px-3 capitalize text-[#475569]">
                            {ch.paymentMethod || "Transferencia"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0b1c30]">
                            ${ch.total.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase ${
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
            <div className="px-6 py-3 border-t border-[#e2e8f0] flex items-center justify-end bg-[#f8f9ff]">
              <button
                type="button"
                onClick={() => setSelectedInvoicesClient(null)}
                className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white font-bold rounded-lg text-xs transition cursor-pointer"
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

      {/* Modal Minimalista de Servicios Contratados y Facturados */}
      {selectedServicesClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header Minimalista */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-[#0b1c30]">
                    Servicios del Cliente
                  </h3>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                    {limpiarIdentificacion(selectedServicesClient.identificationNumber)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                  {selectedServicesClient.businessName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedServicesClient(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector de Pestañas Minimalista */}
            <div className="px-5 pt-3 pb-0 flex items-center gap-4 border-b border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setServicesModalTab("contratados")}
                className={`pb-2.5 font-semibold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  servicesModalTab === "contratados"
                    ? "border-[#004ac6] text-[#004ac6]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>Servicios Contratados</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                  {clientContractedServices.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setServicesModalTab("facturados")}
                className={`pb-2.5 font-semibold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  servicesModalTab === "facturados"
                    ? "border-[#004ac6] text-[#004ac6]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>Servicios Facturados</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                  {clientBilledServices.length}
                </span>
              </button>
            </div>

            {/* Contenido con scroll */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {servicesModalTab === "contratados" ? (
                clientContractedServices.length === 0 ? (
                  <div className="py-10 text-center space-y-1">
                    <p className="text-xs font-semibold text-slate-600">
                      Sin servicios contratados registrados
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Este cliente no tiene planes o servicios asignados en su ficha.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Servicio / Plan</th>
                          <th className="py-2.5 px-3">Categoría</th>
                          <th className="py-2.5 px-3 text-right">Tarifa</th>
                          <th className="py-2.5 px-3">Frecuencia</th>
                          <th className="py-2.5 px-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[#434655]">
                        {clientContractedServices.map((srv) => (
                          <tr key={srv.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900 text-xs">
                                {srv.planName || "Servicio"}
                              </div>
                              {srv.downloadMbps > 0 && (
                                <div className="text-[10px] font-mono text-slate-500">
                                  {srv.downloadMbps} Mbps Bajada / {srv.uploadMbps} Mbps Subida
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 uppercase text-[10px] font-semibold text-slate-500">
                              {srv.serviceCategory || "Internet"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              ${(srv.customPrice || srv.basePrice || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 capitalize text-slate-600">
                              {srv.billingFrequency || "Mensual"}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  srv.status === "activo"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}
                              >
                                {srv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                clientBilledServices.length === 0 ? (
                  <div className="py-10 text-center space-y-1">
                    <p className="text-xs font-semibold text-slate-600">
                      Sin servicios facturados registrados
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Aún no se registran comprobantes o cobros generados para este cliente.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-[26%]">Comprobante</th>
                          <th className="py-2.5 px-3 w-[16%]">Fecha / Período</th>
                          <th className="py-2.5 px-3 w-[36%]">Concepto Facturado</th>
                          <th className="py-2.5 px-3 w-[12%] text-right">Total</th>
                          <th className="py-2.5 px-3 w-[10%] text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[#434655]">
                        {clientBilledServices.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {b.docNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {b.date}
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 truncate max-w-xs" title={b.description}>
                              {b.description}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              ${b.amount.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  b.status === "pagado" || b.status === "autorizada"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>

            {/* Footer Minimalista */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const targetClient = selectedServicesClient;
                  setSelectedServicesClient(null);
                  onSelectClient(targetClient);
                }}
                className="text-xs text-[#004ac6] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Administrar en Ficha del Cliente</span>
                <ExternalLink className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedServicesClient(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
