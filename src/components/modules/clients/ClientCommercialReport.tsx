"use client";

import { useRef, useState } from "react";
import { useApp } from "@/lib/state";
import { clientCommercialRows } from "@/lib/company-reporting";
import { canUser, canViewServicePrices } from "@/lib/permissions";
import { canReadCollection } from "@/lib/persistence-contracts";
import { downloadReport } from "@/lib/report-export";
import { printHtmlElement } from "@/lib/print-service";
import { useToast } from "@/lib/toast-context";

const field = "min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs";
const button = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50";
export function ClientCommercialReport({ clientId, from: controlledFrom, to: controlledTo }: { clientId?: string; from?: string; to?: string }) {
  const source = useApp(), { showError } = useToast();
  const [localFrom, setFrom] = useState(""), [localTo, setTo] = useState("");
  const from = controlledFrom ?? localFrom, to = controlledTo ?? localTo;
  const [search, setSearch] = useState(""), [status, setStatus] = useState(""), [balance, setBalance] = useState(""), [service, setService] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const financial = Boolean(source.currentUser && canViewServicePrices(source.currentUser) && canReadCollection(source.currentUser, "monthlyCharges"));
  const canExport = canUser(source.currentUser, "finanzas", "canExportReports");
  const rows = clientCommercialRows(source, from, to).filter(row => (!clientId || row.id === clientId) &&
    (!status || row.status === status) && (!service || row.services.some(item => item.planName === service)) &&
    (!balance || balance === "deuda" && row.pending > 0 || balance === "sin_deuda" && row.pending === 0 || balance === "favor" && row.credit > 0) &&
    `${row.name} ${row.ruc} ${row.services.map(item => item.planName).join(" ")}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  const serviceNames = [...new Set((source.clientServices || []).filter(item => !clientId || item.clientId === clientId).map(item => item.planName))].sort();
  const criteria = `Desde: ${from || "inicio"}; hasta: ${to || "sin límite"}; búsqueda: ${search || "todas"}; estado: ${status || "todos"}; saldo: ${balance || "todos"}; servicio: ${service || "todos"}`;
  const columns = [{ key: "name", label: "Cliente" }, { key: "ruc", label: "RUC / CI" }, { key: "status", label: "Estado" }, { key: "servicesText", label: "Servicios actuales" },
    ...(financial ? [{ key: "monthlyFee", label: "Tarifa mensual equivalente con IVA", money: true }, { key: "charged", label: "Vendido en el período", money: true }, { key: "paid", label: "Cobros aplicados en el período", money: true }, { key: "pending", label: "Deuda actual total", money: true }, { key: "periodPending", label: "Pendiente de documentos del período", money: true }, { key: "credit", label: "Saldo a favor actual", money: true }] : [])];
  const exportRows = rows.map(row => ({ ...row, servicesText: row.services.map(item => `${item.planName} (${item.status}${financial ? `, $${Number(item.priceConIva ?? Number(item.customPrice ?? item.basePrice ?? 0) * (1 + Number(item.ivaRate ?? 0) / 100)).toFixed(2)} por ciclo ${item.billingFrequency || "mensual"}` : ""})`).join("; ") }));
  const exportFile = async (format: "csv" | "xlsx") => { try { await downloadReport(exportRows, columns, "Reporte_clientes", format, criteria); } catch { showError("No se pudo exportar", "Inténtalo nuevamente."); } };
  return <section ref={printRef} className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold">Reporte comercial de clientes</h3>
      {canExport && <div className="flex flex-wrap gap-2 print:hidden"><button disabled={Boolean(from && to && from > to)} className={button} onClick={() => void exportFile("xlsx")}>Excel</button><button disabled={Boolean(from && to && from > to)} className={button} onClick={() => void exportFile("csv")}>CSV</button><button disabled={Boolean(from && to && from > to)} className={button} onClick={() => printHtmlElement(printRef.current, "Reporte de clientes")}>Imprimir / PDF</button></div>}
    </div>
    <p className="text-slate-500">{criteria}</p>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
      {controlledFrom === undefined && <><label className="grid gap-1">Desde<input aria-label="Clientes desde" type="date" value={from} onChange={event => setFrom(event.target.value)} className={field} /></label><label className="grid gap-1">Hasta<input aria-label="Clientes hasta" type="date" value={to} onChange={event => setTo(event.target.value)} className={field} /></label></>}
      <input aria-label="Buscar clientes o servicios" placeholder="Cliente, RUC o servicio" value={search} onChange={event => setSearch(event.target.value)} className={field} />
      <select aria-label="Estado del cliente" value={status} onChange={event => setStatus(event.target.value)} className={field}><option value="">Todos los estados</option>{["activo", "suspendido", "retirado", "inactivo", "en_instalacion"].map(value => <option key={value}>{value}</option>)}</select>
      {financial && <select aria-label="Filtrar saldo del cliente" value={balance} onChange={event => setBalance(event.target.value)} className={field}><option value="">Todos los saldos</option><option value="deuda">Con deuda</option><option value="sin_deuda">Sin deuda</option><option value="favor">Con saldo a favor</option></select>}
      <select aria-label="Filtrar servicio del cliente" value={service} onChange={event => setService(event.target.value)} className={field}><option value="">Todos los servicios</option>{serviceNames.map(name => <option key={name}>{name}</option>)}</select>
    </div>
    {from && to && from > to ? <p role="alert" className="text-rose-700">La fecha Desde no puede ser posterior a Hasta.</p> : <>
      {financial && <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5 tabular-nums">{[["Clientes", rows.length], ["Tarifa mensual equivalente", `$${rows.reduce((sum, row) => sum + row.monthlyFee, 0).toFixed(2)}`], ["Cobros aplicados en período", `$${rows.reduce((sum, row) => sum + row.paid, 0).toFixed(2)}`], ["Deuda actual", `$${rows.reduce((sum, row) => sum + row.pending, 0).toFixed(2)}`], ["Saldo a favor actual", `$${rows.reduce((sum, row) => sum + row.credit, 0).toFixed(2)}`]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">{label}</p><strong className="mt-1 block">{value}</strong></div>)}</div>}
      <p className="text-slate-500">Servicios, tarifa equivalente, deuda y saldo a favor muestran el estado actual. Ventas y cobros aplicados respetan las fechas seleccionadas; los cobros pueden incluir anticipos ya recibidos.</p>
      {financial && (from || to) && rows.some(row => row.undatedPaid > 0) && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">Hay ${rows.reduce((sum, row) => sum + row.undatedPaid, 0).toFixed(2)} de cobros históricos sin fecha. Se incluyen al consultar todo el historial, pero no se asignan a un período sin evidencia de la fecha.</p>}
      <div role="region" aria-label="Reporte de clientes" tabIndex={0} className="max-w-full overflow-x-auto"><table className="w-full min-w-[68rem] text-left print:min-w-0 print:table-fixed print:text-[8px]">
        <thead className="bg-slate-50"><tr>{columns.map(column => <th key={column.key} className="p-3 print:p-1">{column.label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{exportRows.map(row => <tr key={row.id}>{columns.map(column => <td key={column.key} className={`p-3 align-top print:break-words print:p-1 ${column.money ? "whitespace-nowrap font-mono" : ""}`}>{column.money ? `$${Number(row[column.key as keyof typeof row] || 0).toFixed(2)}` : String(row[column.key as keyof typeof row] ?? "")}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={columns.length} className="p-8 text-center text-slate-500">No hay clientes con estos filtros.</td></tr>}
        </tbody></table></div>
    </>}
  </section>;
}
