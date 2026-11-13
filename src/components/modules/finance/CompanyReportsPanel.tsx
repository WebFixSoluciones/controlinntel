"use client";

import { useRef, useState, type ReactNode } from "react";
import { useApp } from "@/lib/state";
import { companyPeriodReport, reportNet, purchaseBalance, reportSearchText } from "@/lib/company-reporting";
import { getEcuadorDate } from "@/lib/date-utils";
import { canUser } from "@/lib/permissions";
import { canReadBillingDocument, canReadCollection } from "@/lib/persistence-contracts";
import { downloadReport, type ReportColumn } from "@/lib/report-export";
import { printHtmlElement } from "@/lib/print-service";
import { useToast } from "@/lib/toast-context";
import { ClientCommercialReport } from "../clients/ClientCommercialReport";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

type Tab = "resumen" | "clientes" | "ventas" | "compras" | "gastos" | "caja" | "detalle";
const button = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50";
const field = "min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs";
const cn = (...classes: Parameters<typeof clsx>) => twMerge(clsx(...classes));
export function CompanyReportsPanel({ from, to, onPeriodChange, children }: { from: string; to: string; onPeriodChange: (from: string, to: string) => void; children: ReactNode }) {
  const source = useApp(), { showError } = useToast();
  const [tab, setTab] = useState<Tab>("resumen"), [search, setSearch] = useState(""), [status, setStatus] = useState("");
  const root = useRef<HTMLDivElement>(null), report = companyPeriodReport(source, from, to);
  const canExport = canUser(source.currentUser, "finanzas", "canExportReports"), canCosts = canUser(source.currentUser, "inventarios", "canViewCosts");
  const partial = report.missingCosts > 0 || report.unknownPurchases > 0 || report.duplicateExpenses > 0 || report.needsExpenseReview;
  const canViewBalances = canUser(source.currentUser, "finanzas", "canViewBankBalances");
  const limited = !canViewBalances || !canReadBillingDocument(source.currentUser, { documentType: "nota_venta" })
    || !canReadBillingDocument(source.currentUser, { documentType: "factura" })
    || !["purchaseInvoices", "billingCreditNotes", "billingDebitNotes"].every(key => canReadCollection(source.currentUser, key as "purchaseInvoices" | "billingCreditNotes" | "billingDebitNotes"));
  const criteria = `Desde ${from || "el inicio"} hasta ${to || "sin límite"}; búsqueda: ${search || "todas"}; estado: ${status || "todos"}. Saldos globales actuales al ${getEcuadorDate()}.${limited ? " Vista limitada por permisos; no representa el estado completo de la empresa." : ""}${partial ? " Resultado operativo parcial: revisar costos y clasificaciones pendientes." : ""}`;
  let columns: ReportColumn[] = [{ key: "concept", label: "Concepto" }, { key: "amount", label: "Valor", money: true }];
  let rows: Record<string, unknown>[] = [
    { concept: "Ventas netas sin IVA y ajustes autorizados", amount: report.netSales },
    { concept: "Costo de inventario vendido", amount: canCosts ? report.cost : "Sin permiso de costos" },
    { concept: "Costos de catálogo de servicios / productos sin stock (referencia; no se restan de nuevo)", amount: canCosts ? report.referenceCost : "Sin permiso de costos" },
    { concept: "Compras sin inventario / servicios (sin IVA)", amount: report.directPurchaseCost },
    { concept: "Gastos registrados", amount: report.opex },
    { concept: `Resultado operativo estimado${partial ? " (parcial)" : ""}`, amount: canCosts ? report.operatingResult : "Sin permiso de costos" },
    { concept: "Entradas reales de dinero", amount: report.incoming }, { concept: "Salidas reales de dinero", amount: report.outgoing },
    { concept: "Flujo neto de caja del período", amount: report.cashFlow }, { concept: "Anticipos recibidos en el período (incluidos en entradas)", amount: report.advancesReceived },
    { concept: "Compras totales del período (incluyen inventario e IVA)", amount: report.purchaseTotal },
    { concept: "Deuda actual de clientes", amount: report.receivables }, { concept: "Deuda actual con proveedores", amount: report.payables },
    { concept: "Saldo a favor actual de clientes", amount: report.availableCredit }, { concept: "Bancos y cajas actuales", amount: canViewBalances ? report.liquidity : "Sin permiso de saldos" },
    { concept: "Partidas vendidas sin costo registrado", amount: `${report.missingCosts} partidas` },
  ];
  if (tab === "ventas") {
    columns = [{ key: "date", label: "Fecha", date: true }, { key: "documentNumber", label: "Comprobante" }, { key: "clientName", label: "Cliente" }, { key: "net", label: "Venta sin IVA", money: true }, { key: "total", label: "Total con IVA", money: true }, { key: "status", label: "Estado" }];
    rows = report.sales.map(sale => ({ ...sale, net: reportNet(sale) / 100 }));
  } else if (tab === "compras") {
    columns = [{ key: "date", label: "Fecha", date: true }, { key: "documentNumber", label: "Comprobante" }, { key: "supplierName", label: "Proveedor" }, { key: "net", label: "Compra sin IVA", money: true }, { key: "total", label: "Total con IVA", money: true }, { key: "paidAmount", label: "Pagado actual", money: true }, { key: "balanceRemaining", label: "Saldo actual", money: true }, { key: "paymentStatus", label: "Estado" }];
    rows = report.purchases.map(purchase => ({ ...purchase, net: reportNet(purchase) / 100, paidAmount: purchase.paidAmount || 0, balanceRemaining: purchaseBalance(purchase) }));
  } else if (tab === "gastos") {
    columns = [{ key: "expenseDate", label: "Fecha", date: true }, { key: "supplierName", label: "Proveedor / beneficiario" }, { key: "category", label: "Categoría" }, { key: "description", label: "Concepto" }, { key: "invoiceNumber", label: "Referencia" }, { key: "amount", label: "Gasto registrado", money: true }];
    rows = report.expenses;
  } else if (tab === "caja") {
    columns = [{ key: "date", label: "Fecha", date: true }, { key: "type", label: "Movimiento" }, { key: "category", label: "Categoría" }, { key: "description", label: "Concepto" }, { key: "bankAccountName", label: "Cuenta" }, { key: "amount", label: "Importe", money: true }];
    rows = report.movements;
  }
  const states = [...new Set(rows.map(row => String(row.status || row.paymentStatus || row.type || "")))].filter(Boolean);
  const filteredRows = rows.filter(row => (!status || String(row.status || row.paymentStatus || row.type) === status) && columns.some(column => reportSearchText(row[column.key]).includes(reportSearchText(search))));
  const exportFile = async (format: "csv" | "xlsx") => { try { await downloadReport(filteredRows, columns, `Reporte_empresa_${tab}`, format, criteria); } catch { showError("No se pudo exportar", "Inténtalo nuevamente."); } };
  const exportBanks = async () => { try { await downloadReport(report.banks, [{ key: "bankName", label: "Cuenta" }, { key: "accountNumber", label: "Número" }, { key: "status", label: "Estado" }, { key: "opening", label: "Saldo al inicio", money: true }, { key: "closing", label: "Saldo al cierre", money: true }, { key: "current", label: "Saldo actual", money: true }], "Reporte_saldos_bancos", "xlsx", `Desde ${from || "inicio"} hasta ${to || "sin límite"}; todas las cuentas. Saldos reconstruidos con movimientos registrados.${limited ? " Vista limitada por permisos." : ""}${report.undatedBankMovements ? " Hay movimientos sin fecha; reconstrucción incompleta." : ""}`); } catch { showError("No se pudo exportar", "Inténtalo nuevamente."); } };
  const invalid = Boolean(from && to && from > to);
  return <div ref={root} className="min-w-0 space-y-4 text-xs">
    {limited &&
      <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">Vista limitada por tus permisos. Los documentos de módulos restringidos no se incluyen; este reporte no representa el estado completo de la empresa.</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Reportes de la empresa</h2><p className="mt-1 text-slate-500">Ventas, compras, gastos, clientes y movimiento de dinero para revisar el negocio.</p></div>
        {canExport && tab !== "clientes" && tab !== "detalle" && <div className="flex flex-wrap gap-2 print:hidden"><button disabled={invalid} className={button} onClick={() => void exportFile("xlsx")}>Excel</button><button disabled={invalid} className={button} onClick={() => void exportFile("csv")}>CSV</button><button disabled={invalid} className={button} onClick={() => printHtmlElement(root.current, "Reporte de empresa", "a4", { orientation: "landscape", report: true })}>Imprimir / PDF</button></div>}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3 print:hidden">
        <label className="grid gap-1 font-semibold">Desde<input aria-label="Reportes desde" type="date" value={from} onChange={event => onPeriodChange(event.target.value, to)} className={field} /></label>
        <label className="grid gap-1 font-semibold">Hasta<input aria-label="Reportes hasta" type="date" value={to} onChange={event => onPeriodChange(from, event.target.value)} className={field} /></label>
        <button className={button} onClick={() => onPeriodChange(getEcuadorDate().slice(0, 7) + "-01", getEcuadorDate())}>Este mes</button><button className={button} onClick={() => onPeriodChange(getEcuadorDate().slice(0, 4) + "-01-01", getEcuadorDate())}>Este año</button><button className={button} onClick={() => onPeriodChange("", "")}>Todo el historial</button>
      </div>
      <p className="mt-3 text-slate-500">{criteria}</p>
    </section>
    <nav className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1 sm:flex-wrap print:hidden" aria-label="Secciones de reportes">{([ ["resumen", "Resultados"], ["clientes", "Clientes y servicios"], ["ventas", "Ventas"], ["compras", "Compras"], ["gastos", "Gastos"], ["caja", "Caja y bancos"], ["detalle", "Detalle financiero"] ] as [Tab, string][]).map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setStatus(""); setSearch(""); }} className={cn(button, "shrink-0", tab === id && "border-blue-600 bg-blue-50 text-[#004ac6]")}>{label}</button>)}</nav>
    {invalid ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">La fecha Desde no puede ser posterior a Hasta.</p> : tab === "clientes" ? <ClientCommercialReport from={from} to={to} /> : tab === "detalle" ? <><p className="text-slate-500">Los movimientos y documentos respetan el período. Las cuentas por cobrar y pagar de este detalle muestran el saldo actual de los documentos del período; el resumen global incluye toda la cartera actual.</p>{children}</> : <>
      {tab === "resumen" && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4 tabular-nums">{[["Ventas netas sin IVA", report.netSales], ["Gastos registrados", report.opex], [`Resultado operativo ${partial ? "parcial" : "estimado"}`, canCosts ? report.operatingResult : null], ["Flujo neto de caja", report.cashFlow]].map(([label, value]) => <div key={String(label)} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"><p className="text-slate-500">{label}</p><strong className={`mt-2 block text-xl [overflow-wrap:anywhere] ${typeof value === "number" && value < 0 ? "text-rose-700" : "text-[#004ac6]"}`}>{typeof value === "number" ? `$${value.toFixed(2)}` : "Sin permiso de costos"}</strong></div>)}</div>
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900">El resultado estimado resta el costo del inventario vendido, las compras de servicios y los gastos registrados. Los costos referenciales del catálogo se muestran aparte para no descontar dos veces el mismo servicio. Las compras de inventario se descuentan al venderlo. Los anticipos son dinero recibido a favor del cliente; no se suman como ventas. Ventas y compras se presentan sin IVA; gastos según el importe registrado.</p>
        {partial && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">Resultado parcial: {report.missingCosts} partida(s) vendida(s) sin costo registrado, {report.unknownPurchases} compra(s) sin clasificación de inventario y {report.duplicateExpenses} posible(s) gasto(s) repetido(s) en Compras. {report.needsExpenseReview ? " Hay costos referenciales de servicios, pero no gastos o compras directas cargados en este período." : ""} Revisa estos datos antes de concluir la ganancia o pérdida.</p>}
        <p className="text-slate-500">Es un resultado operativo de los registros cargados; los ajustes contables no registrados, como depreciación e impuesto a la renta, quedan fuera de este cálculo. Las notas convertidas en factura SRI se cuentan una sola vez.</p>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-semibold">Saldos globales actuales · {getEcuadorDate()}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 tabular-nums">{[["Clientes por cobrar", report.receivables], ["Proveedores por pagar", report.payables], ["Saldo a favor de clientes", report.availableCredit], ["Bancos y cajas", canViewBalances ? report.liquidity : "Restringido"]].map(([label, value]) => <p key={String(label)}>{label}<strong className="mt-1 block">{typeof value === "number" ? `$${value.toFixed(2)}` : value}</strong></p>)}</div><p className="mt-3 text-slate-500">Estos saldos muestran la situación actual completa; no son cierres contables históricos. Para bancos puedes revisar la reconstrucción del período en «Caja y bancos».</p></div>
      </>}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap gap-2 print:hidden"><input aria-label="Buscar en reporte de empresa" placeholder="Buscar en este reporte" value={search} onChange={event => setSearch(event.target.value)} className={`${field} flex-1`} />{states.length > 0 && <select aria-label="Estado del reporte" value={status} onChange={event => setStatus(event.target.value)} className={field}><option value="">Todos los estados</option>{states.map(value => <option key={value}>{value}</option>)}</select>}</div>
        <div role="region" aria-label="Datos del reporte de empresa" tabIndex={0} className="max-w-full overflow-x-auto"><table className="w-full min-w-[42rem] text-left print:min-w-0 print:table-fixed"><thead className="bg-slate-50"><tr>{columns.map(column => <th scope="col" key={column.key} className="p-3 print:p-1">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredRows.map((row, index) => <tr key={String(row.id || index)}>{columns.map(column => <td key={column.key} className="p-3 align-top [overflow-wrap:anywhere] print:break-words print:p-1">{column.money && typeof row[column.key] === "number" ? `$${Number(row[column.key]).toFixed(2)}` : column.date && row[column.key] ? String(row[column.key]).slice(0, 10) : String(row[column.key] ?? "—")}</td>)}</tr>)}{!filteredRows.length && <tr><td colSpan={columns.length} className="p-8 text-center">Sin registros con estos filtros.</td></tr>}</tbody></table></div>
        {tab !== "resumen" && <p className="mt-3 font-semibold">{filteredRows.length} registro(s) · {tab === "caja" ? <>Entradas: ${filteredRows.filter(row => row.type === "ingreso").reduce((sum, row) => sum + Number(row.amount), 0).toFixed(2)} · Salidas: ${filteredRows.filter(row => row.type === "egreso").reduce((sum, row) => sum + Number(row.amount), 0).toFixed(2)} · Neto: ${filteredRows.reduce((sum, row) => sum + (row.type === "ingreso" ? 1 : -1) * Number(row.amount), 0).toFixed(2)}</> : <>Total filtrado: ${filteredRows.reduce((sum, row) => sum + Number(row.total ?? row.amount ?? 0), 0).toFixed(2)}</>}</p>}
      </section>
      {tab === "caja" && report.undatedBankMovements > 0 && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">Hay {report.undatedBankMovements} movimiento(s) bancario(s) sin fecha válida. Los saldos históricos requieren conciliación.</p>}
      {tab === "caja" && canViewBalances && <section className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Saldos de bancos y cajas del período</h3>{canExport && <button className={`${button} print:hidden`} onClick={() => void exportBanks()}>Excel de saldos</button>}</div><p className="mb-3 text-slate-500">Reconstrucción desde el saldo actual y los movimientos registrados, incluidas transferencias y ajustes. Los registros históricos faltantes requieren conciliación.</p><div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-left"><thead><tr><th className="p-2">Cuenta</th><th>Estado</th><th>Al inicio</th><th>Al cierre</th><th>Actual</th></tr></thead><tbody>{report.banks.map(bank => <tr key={bank.id}><td className="p-2">{bank.bankName} · {bank.accountNumber}</td><td>{bank.status}</td><td>${bank.opening.toFixed(2)}</td><td>${bank.closing.toFixed(2)}</td><td>${bank.current.toFixed(2)}</td></tr>)}</tbody></table></div></section>}
    </>}
  </div>;
}
