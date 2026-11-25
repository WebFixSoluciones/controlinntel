"use client";

import { createSearchMatcher } from "@/lib/search";

import { useMemo, useState } from "react";
import { DocumentTablePagination, useDocumentPagination } from "@/components/ui/DocumentTablePagination";
import { inReportPeriod } from "@/lib/company-reporting";
import { cents, money } from "@/lib/commercial-core";
import { receivedPayments } from "@/lib/payment-report";
import { canUser } from "@/lib/permissions";
import { canReadCollection } from "@/lib/persistence-contracts";
import { downloadReport, type ReportColumn } from "@/lib/report-export";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";

const columns: ReportColumn[] = [
  { key: "date", label: "Fecha del pago", date: true },
  { key: "account", label: "Cuenta de recepción" },
  { key: "reference", label: "N.º de comprobante del pago" },
  { key: "amount", label: "Importe en USD", money: true },
  { key: "method", label: "Forma de pago" },
  { key: "kind", label: "Tipo" },
  { key: "client", label: "Cliente" },
  { key: "ruc", label: "RUC o cédula" },
  { key: "originDocument", label: "Comprobante de venta de origen" },
  { key: "documents", label: "Comprobantes aplicados" },
  { key: "status", label: "Estado de referencia" },
  { key: "movementId", label: "ID del movimiento" },
];
const field = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs";
const action = "rounded-lg border border-slate-300 px-3 py-2 font-semibold hover:bg-slate-50 disabled:opacity-50";

export function ReceivedPaymentsReport({ from, to }: { from: string; to: string }) {
  const { currentUser, financialMovements, monthlyCharges, clientAdvances, bankAccounts } = useApp();
  const { showError } = useToast();
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);
  const receipts = useMemo(() => receivedPayments({ financialMovements, monthlyCharges, clientAdvances, bankAccounts }),
    [financialMovements, monthlyCharges, clientAdvances, bankAccounts]);
  const accounts = [...new Map(receipts.filter(row => row.accountId).map(row => [row.accountId, row.account || row.accountId])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "es"));
  const matches = createSearchMatcher(search);
  const results = receipts.filter(row => inReportPeriod(row.date, from, to)
    && (!accountId || row.accountId === accountId) && (!status || row.status === status)
    && matches(row.reference, row.originDocument, row.documents, row.client, row.ruc));
  const page = useDocumentPagination(results, [from, to, accountId, status, search]);
  const total = money(results.reduce((sum, row) => sum + (row.movementId ? cents(row.amount) : 0), 0));
  const canExport = canUser(currentUser, "finanzas", "canExportReports");

  async function exportPayments(format: "xlsx" | "csv") {
    setExporting(true);
    try {
      await downloadReport(results, columns, "Pagos_recibidos", format,
        `Desde ${from || "inicio"} hasta ${to || "sin límite"} | Cuenta ${accounts.find(([id]) => id === accountId)?.[1] || "todas"} | Estado ${status || "todos"} | Búsqueda ${search || "todas"}`);
    } catch {
      showError("No se pudo exportar", "Inténtalo nuevamente.");
    } finally {
      setExporting(false);
    }
  }

  if (!canReadCollection(currentUser, "financialMovements")) return <p role="status">Tu perfil no tiene acceso a los movimientos financieros.</p>;

  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white text-xs">
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-base font-semibold">Pagos recibidos</h2><p className="mt-1 text-slate-600">Cruza la cuenta, fecha, importe y comprobante del pago con el extracto bancario.</p></div>
        {canExport && <div className="flex flex-wrap gap-2"><button type="button" disabled={exporting || !results.length} className={action} onClick={() => void exportPayments("xlsx")}>Exportar Excel</button><button type="button" disabled={exporting || !results.length} className={action} onClick={() => void exportPayments("csv")}>Exportar CSV</button></div>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 font-medium">Buscar pago<input className={field} type="search" value={search} placeholder="Comprobante, cliente o RUC" onChange={event => setSearch(event.target.value)} /></label>
        <label className="grid gap-1 font-medium">Cuenta de recepción<select className={field} value={accountId} onChange={event => setAccountId(event.target.value)}><option value="">Todas las cuentas y cajas</option>{accounts.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="grid gap-1 font-medium">Estado de referencia<select className={field} value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos los estados</option>{["Con comprobante", "Sin comprobante", "Revisar referencia de venta", "Sin movimiento vinculado"].map(label => <option key={label}>{label}</option>)}</select></label>
      </div>
      <p className="text-slate-600 tabular-nums">{results.length} resultados · Total de ingresos con movimiento <strong>${total.toFixed(2)}</strong></p>
    </div>
    <div role="region" aria-label="Listado de pagos recibidos" tabIndex={0} className="overflow-x-auto">
      <table className="w-full min-w-[60rem] text-left">
        <thead className="bg-[#f8f9ff] text-[#004ac6]"><tr>{["Fecha", "Cuenta / Forma de pago", "Comprobante del pago", "Cliente / RUC", "Comprobantes de venta", "Importe", "Estado de referencia"].map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {page.rows.map(row => <tr key={row.id} className="hover:bg-slate-50">
            <td className="whitespace-nowrap px-4 py-3">{row.date || "—"}</td>
            <td className="px-4 py-3">{row.account || "—"}<small className="block text-slate-500">{row.method}</small></td>
            <td className="px-4 py-3 font-mono [overflow-wrap:anywhere]">{row.reference || "—"}</td>
            <td className="px-4 py-3">{row.client || "—"}<small className="block text-slate-500">{row.ruc}</small></td>
            <td className="px-4 py-3">{row.documents || row.kind}{row.originDocument && row.originDocument !== row.documents && <small className="block text-slate-500">Origen {row.originDocument}</small>}</td>
            <td className="whitespace-nowrap px-4 py-3 text-right font-mono">${row.amount.toFixed(2)}</td>
            <td className="px-4 py-3">{row.status}</td>
          </tr>)}
          {!results.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No hay pagos con estos filtros.</td></tr>}
        </tbody>
      </table>
    </div>
    <DocumentTablePagination {...page.controls} />
  </section>;
}
