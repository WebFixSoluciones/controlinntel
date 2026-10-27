"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "@/lib/state";
import { externalCash } from "@/lib/commercial-core";
import { getEcuadorDate, addMonthsSafely } from "@/lib/date-utils";
import { useToast } from "@/lib/toast-context";
import { safeFloat, safeNumber } from "@/lib/print-service";
import {
  BarChart3,
  DollarSign,
  PieChart,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Receipt,
  Search,
  Printer,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatFinanceCategory } from "./FinanceDashboard";

type ReportTab = "resumen" | "cobranzas" | "gastos" | "cxc" | "cxp" | "bancos";

export function FinancialReportsTab() {
  const {
    monthlyCharges = [],
    expenses = [],
    financialMovements = [],
    bankAccounts = [],
    purchaseInvoices = [],
    clientAdvances = [],
  } = useApp();
  const { showSuccess } = useToast();

  const [activeTab, setActiveTab] = useState<ReportTab>("resumen");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterCategory, setFilterCategory] = useState("todas");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. CÁLCULO DE COBRANZAS (Monthly Charges)
  const cobranzasMetrics = useMemo(() => {
    const activeCharges = monthlyCharges.filter(c => c.status !== "anulado");
    const totalFacturado = activeCharges.reduce((sum, c) => sum + safeFloat(c.total), 0);
    const totalRecaudado = activeCharges.reduce((sum, c) => {
      if (c.status === "pagado") return sum + safeFloat(c.total);
      if (c.paidAmount !== undefined) return sum + safeFloat(c.paidAmount);
      return sum;
    }, 0);
    const totalPendiente = activeCharges.reduce((sum, c) => {
      if (c.status === "pagado") return sum;
      if (c.balanceRemaining !== undefined) return sum + safeFloat(c.balanceRemaining);
      return sum + safeFloat(c.total);
    }, 0);
    const tasaEfectividad = totalFacturado > 0 ? (totalRecaudado / totalFacturado) * 100 : 0;
    const pagadosCount = monthlyCharges.filter((c) => c.status === "pagado").length;
    const pendientesCount = monthlyCharges.filter((c) => c.status !== "pagado").length;

    return {
      totalFacturado,
      totalRecaudado,
      totalPendiente,
      tasaEfectividad,
      pagadosCount,
      pendientesCount,
    };
  }, [monthlyCharges]);

  // Cash flow has one source: confirmed external financial movements.
  const cashMovements = useMemo(() => externalCash(financialMovements), [financialMovements]);
  const gastosMetrics = useMemo(() => {
    const outgoing = cashMovements.filter(m => m.type === "egreso");
    const byCategory: Record<string, number> = {};
    outgoing.forEach(m => { byCategory[m.category || "otro"] = (byCategory[m.category || "otro"] || 0) + safeFloat(m.amount); });
    const totalEgresos = outgoing.reduce((sum, m) => sum + safeFloat(m.amount), 0);
    return { totalOpex: expenses.reduce((sum,e) => sum + safeFloat(e.amount),0), movEgresos: totalEgresos, totalEgresos, byCategory };
  }, [expenses, cashMovements]);

  const flujoMetrics = useMemo(() => {
    const totalIngresos = cashMovements.filter(m => m.type === "ingreso").reduce((sum,m) => sum + safeFloat(m.amount),0);
    const totalEgresos = gastosMetrics.totalEgresos;
    return { movIngresos: totalIngresos, totalIngresos, totalEgresos, saldoNeto: totalIngresos-totalEgresos,
      margenNeto: totalIngresos ? (totalIngresos-totalEgresos)/totalIngresos*100 : 0 };
  }, [cashMovements, gastosMetrics]);

  // 4. CÁLCULO DE CUENTAS POR COBRAR (CxC)
  const cxcList = useMemo(() => {
    return monthlyCharges
      .filter((c) => {
        const bal = c.balanceRemaining !== undefined ? c.balanceRemaining : c.status === "pagado" ? 0 : c.total;
        return bal > 0 && c.status !== "pagado" && c.status !== "anulado";
      })
      .map((c) => ({
        id: c.id,
        invoiceNumber: c.invoiceNumber || "S/N",
        clientName: c.clientName,
        clientRuc: c.clientRuc,
        saleDate: c.saleDate || `${c.year || 2026}-${String(c.month || 1).padStart(2, "0")}-01`,
        dueDate: c.maxPaymentDate || c.saleDate || "-",
        total: safeFloat(c.total),
        paidAmount: safeFloat(c.paidAmount || 0),
        balanceRemaining: safeFloat(c.balanceRemaining !== undefined ? c.balanceRemaining : c.total),
        status: c.status,
      }));
  }, [monthlyCharges]);

  const totalCxCPendiente = useMemo(() => {
    return cxcList.reduce((sum, item) => sum + item.balanceRemaining, 0);
  }, [cxcList]);

  // 5. CÁLCULO DE CUENTAS POR PAGAR (CxP Proveedores)
  const cxpList = useMemo(() => {
    return purchaseInvoices
      .filter((inv) => {
        const bal = inv.balanceRemaining !== undefined ? inv.balanceRemaining : inv.paymentStatus === "pagado" ? 0 : inv.total;
        return bal > 0 && inv.paymentStatus !== "pagado";
      })
      .map((inv) => ({
        id: inv.id,
        documentNumber: inv.documentNumber,
        supplierName: inv.supplierName,
        supplierRuc: inv.supplierRuc,
        date: inv.date,
        dueDate: inv.dueDate || "-",
        total: safeFloat(inv.total),
        paidAmount: safeFloat(inv.paidAmount || 0),
        balanceRemaining: safeFloat(inv.balanceRemaining !== undefined ? inv.balanceRemaining : inv.total),
        paymentStatus: inv.paymentStatus,
      }));
  }, [purchaseInvoices]);

  const totalCxPPendiente = useMemo(() => {
    return cxpList.reduce((sum, item) => sum + item.balanceRemaining, 0);
  }, [cxpList]);

  // 6. CÁLCULO DE BANCOS Y DISPONIBILIDAD
  const bancosMetrics = useMemo(() => {
    const accounts = (bankAccounts || []).filter((b) => b && b.status === "activa");
    const totalLiquidez = accounts.reduce((sum, b) => sum + safeFloat(b.currentBalance), 0);

    const withShare = accounts.map((b) => {
      const bal = safeFloat(b.currentBalance);
      const pct = totalLiquidez > 0 ? (bal / totalLiquidez) * 100 : 0;
      return {
        ...b,
        balanceFloat: bal,
        sharePct: pct,
      };
    });

    return {
      accounts: withShare,
      totalLiquidez,
    };
  }, [bankAccounts]);

  const chartData = useMemo(() => {
    const current = getEcuadorDate().slice(0,7) + "-01";
    return Array.from({length:6}, (_, index) => {
      const month=addMonthsSafely(current,index-5).slice(0,7);
      const movements=cashMovements.filter(m => String(m.date).startsWith(month));
      const ingresos=movements.filter(m=>m.type==="ingreso").reduce((sum,m)=>sum+safeFloat(m.amount),0);
      const egresos=movements.filter(m=>m.type==="egreso").reduce((sum,m)=>sum+safeFloat(m.amount),0);
      return { mes: month, ingresos, egresos, neto: ingresos-egresos };
    });
  }, [cashMovements]);

  // EXPORTACIÓN DINÁMICA A CSV SEGÚN EL REPORTE ACTIVO
  const handleExportCsv = async (format: "csv" | "xlsx" = "csv") => {
    let filename = `Reporte_Financiero_${activeTab}_${getEcuadorDate()}.csv`;
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (activeTab === "cobranzas") {
      headers = ["Comprobante", "Fecha Venta", "Cliente", "RUC", "Total Venta", "Abonado", "Saldo Pendiente", "Estado"];
      rows = monthlyCharges.map((c) => [
        c.invoiceNumber || "S/N",
        c.saleDate || `${c.year}-${c.month}-01`,
        `"${c.clientName.replace(/"/g, '""')}"`,
        c.clientRuc || "Consumidor Final",
        safeNumber(c.total),
        safeNumber(c.paidAmount || (c.status === "pagado" ? c.total : 0)),
        safeNumber(c.balanceRemaining !== undefined ? c.balanceRemaining : c.status === "pagado" ? 0 : c.total),
        c.status,
      ]);
    } else if (activeTab === "gastos") {
      headers = ["Fecha", "Proveedor", "Categoria", "Concepto", "Metodo", "Monto USD"];
      rows = expenses.map((e) => [
        e.expenseDate,
        `"${e.supplierName.replace(/"/g, '""')}"`,
        `"${formatFinanceCategory(e.category)}"`,
        `"${(e.description || "").replace(/"/g, '""')}"`,
        e.paymentMethod,
        safeNumber(e.amount),
      ]);
    } else if (activeTab === "cxc") {
      headers = ["Cliente", "RUC", "Comprobante", "Fecha Emision", "Fecha Vencimiento", "Total Factura", "Saldo Pendiente"];
      rows = cxcList.map((c) => [
        `"${c.clientName.replace(/"/g, '""')}"`,
        c.clientRuc,
        c.invoiceNumber,
        c.saleDate,
        c.dueDate,
        safeNumber(c.total),
        safeNumber(c.balanceRemaining),
      ]);
    } else if (activeTab === "cxp") {
      headers = ["Proveedor", "RUC", "Factura Compra", "Fecha Compra", "Fecha Vencimiento", "Total Factura", "Saldo Pendiente"];
      rows = cxpList.map((i) => [
        `"${i.supplierName.replace(/"/g, '""')}"`,
        i.supplierRuc,
        i.documentNumber,
        i.date,
        i.dueDate,
        safeNumber(i.total),
        safeNumber(i.balanceRemaining),
      ]);
    } else if (activeTab === "bancos") {
      headers = ["Banco / Caja", "Tipo Cuenta", "Numero Cuenta", "Saldo Actual USD", "Participacion %"];
      rows = bancosMetrics.accounts.map((b) => [
        `"${b.bankName.replace(/"/g, '""')}"`,
        b.accountType,
        b.accountNumber,
        safeNumber(b.balanceFloat),
        `${b.sharePct.toFixed(1)}%`,
      ]);
    } else {
      // Resumen Consolidado General
      headers = ["Metrica", "Monto USD / Detalle"];
      rows = [
        ["Ingresos Totales Recaudados", safeNumber(flujoMetrics.totalIngresos)],
        ["Cobranzas Clientes", safeNumber(cobranzasMetrics.totalRecaudado)],
        ["Movimientos Bancarios Ingreso", safeNumber(flujoMetrics.movIngresos)],
        ["Gastos Totales OPEX & Egresos", safeNumber(flujoMetrics.totalEgresos)],
        ["Flujo de Caja Neto", safeNumber(flujoMetrics.saldoNeto)],
        ["Margen Operativo", `${flujoMetrics.margenNeto.toFixed(1)}%`],
        ["Cuentas por Cobrar (Cartera Abierta)", safeNumber(totalCxCPendiente)],
        ["Cuentas por Pagar (Proveedores)", safeNumber(totalCxPPendiente)],
        ["Disponibilidad Liquidez en Bancos", safeNumber(bancosMetrics.totalLiquidez)],
      ];
    }

    const q = searchQuery.toLowerCase().trim();
    if (q) rows = rows.filter(row => row.some(value => String(value).toLowerCase().includes(q)));
    if (activeTab === "cobranzas" && filterStatus !== "todos") rows = rows.filter(row => row[7] === filterStatus);
    if (activeTab === "gastos" && filterCategory !== "todas") rows = rows.filter(row => String(row[2]).includes(formatFinanceCategory(filterCategory)));
    const cleanRows = rows.map(row => row.map((value,index) => {
      if (typeof value === "number") return value;
      const text = String(value).replace(/^"([\s\S]*)"$/, "$1").replace(/""/g, '"');
      return /Monto|Total|Abonado|Saldo|Participacion/i.test(headers[index]) && text.trim() !== "" && Number.isFinite(Number(text)) ? Number(text) : text;
    }));
    let blob: Blob;
    if (format === "xlsx") {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("Reporte");
      sheet.addRow(headers);
      cleanRows.forEach(row => sheet.addRow(row));
      sheet.columns.forEach(column => { column.width = 25; });
      sheet.eachRow(row => row.eachCell(cell => { if (typeof cell.value === "string") cell.numFmt = "@"; }));
      blob = new Blob([await workbook.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      filename = filename.replace(/\.csv$/, ".xlsx");
    } else {
      const escape = (value: string | number) => {
        const text = String(value);
        const safe = typeof value === "string" && /^[=+@-]/.test(text) ? "'" + text : text;
        return '"' + safe.replace(/"/g, '""') + '"';
      };
      blob = new Blob(["\uFEFF" + [headers, ...cleanRows].map(row => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    }
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);

    showSuccess("Reporte Exportado", `Archivo ${filename} generado exitosamente.`);
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. BARRA SUPERIOR DE ACCIONES Y ENCABEZADO */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-[#e2e8f0] shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#004ac6]" />
            <h2 className="text-base font-bold text-[#0b1c30]">
              Centro de Reportes Financieros & Auditoría
            </h2>
          </div>
          <p className="text-xs text-[#737686] mt-0.5">
            Analítica de cobranzas, gastos operativos, cartera por cobrar, pasivos y liquidez en bancos.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Imprimir reporte formal"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          <button
            type="button"
            onClick={() => { void handleExportCsv("csv"); }}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            title="Exportar reporte activo a CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
          <button type="button" onClick={() => { void handleExportCsv("xlsx"); }} className="px-3 py-2 rounded-lg border text-xs font-bold text-blue-700">Exportar Excel</button>
        </div>
      </div>

      {/* 2. TARJETAS KPI RESUMEN EJECUTIVO (SIEMPRE VISIBLES ARRIBA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        {/* Ingresos Totales */}
        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs hover:border-emerald-300 transition">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            <span>Ingresos Totales</span>
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black font-mono text-emerald-700">
            ${safeNumber(flujoMetrics.totalIngresos)}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            Cobranzas + depósitos
          </div>
        </div>

        {/* Gastos Totales OPEX */}
        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs hover:border-rose-300 transition">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            <span>Gastos OPEX</span>
            <div className="p-1.5 rounded-md bg-rose-50 text-rose-600">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black font-mono text-rose-600">
            ${safeNumber(flujoMetrics.totalEgresos)}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            Costos de red y egresos
          </div>
        </div>

        {/* Flujo Neto */}
        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs hover:border-blue-300 transition">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            <span>Flujo Neto</span>
            <div className="p-1.5 rounded-md bg-blue-50 text-[#004ac6]">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`mt-2 text-xl font-black font-mono ${flujoMetrics.saldoNeto >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
            {flujoMetrics.saldoNeto >= 0 ? "+" : "-"}${safeNumber(Math.abs(flujoMetrics.saldoNeto))}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            Margen: {flujoMetrics.margenNeto.toFixed(1)}%
          </div>
        </div>

        {/* Cuentas por Cobrar (CxC) */}
        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs hover:border-amber-300 transition">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            <span>Por Cobrar (CxC)</span>
            <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black font-mono text-amber-700">
            ${safeNumber(totalCxCPendiente)}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            {cxcList.length} cuentas en cartera
          </div>
        </div>

        {/* Cuentas por Pagar (CxP) */}
        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs hover:border-purple-300 transition">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            <span>Por Pagar (CxP)</span>
            <div className="p-1.5 rounded-md bg-purple-50 text-purple-600">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black font-mono text-purple-700">
            ${safeNumber(totalCxPPendiente)}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            {cxpList.length} compras a crédito
          </div>
        </div>

        {/* Liquidez Bancos */}
        <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs hover:border-indigo-300 transition">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#737686] uppercase tracking-wider">
            <span>Bancos & Cajas</span>
            <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black font-mono text-[#004ac6]">
            ${safeNumber(bancosMetrics.totalLiquidez)}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            {bancosMetrics.accounts.length} cuentas activas
          </div>
        </div>
      </div>

      {/* 3. SELECTOR DE VISTAS DE REPORTES ESPECIALIZADOS */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200 overflow-x-auto scrollbar-thin">
        <button
          type="button"
          onClick={() => setActiveTab("resumen")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === "resumen"
              ? "bg-white text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Resumen & Gráficas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("cobranzas")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === "cobranzas"
              ? "bg-white text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Reporte Cobranzas ({monthlyCharges.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("gastos")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === "gastos"
              ? "bg-white text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Reporte Gastos OPEX ({expenses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("cxc")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === "cxc"
              ? "bg-white text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Cuentas por Cobrar ({cxcList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("cxp")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === "cxp"
              ? "bg-white text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Cuentas por Pagar ({cxpList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("bancos")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === "bancos"
              ? "bg-white text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Bancos & Liquidez ({bancosMetrics.accounts.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: RESUMEN EJECUTIVO & GRÁFICAS VISIBLES EN PANTALLA                */}
      {/* ========================================================================= */}
      {activeTab === "resumen" && (
        <div className="space-y-6">
          {/* Bloque de 2 Gráficas Grandes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Gráfica 1: Ingresos vs Egresos Históricos */}
            <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#0b1c30] flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Comparativa de Flujo: Ingresos vs Egresos
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Comportamiento mensual del flujo operativo consolidado
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600"></span> Ingresos
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Egresos
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <span className="w-2.5 h-0.5 bg-[#004ac6]"></span> Neto
                  </span>
                </div>
              </div>

              <div className="h-64 mt-4 w-full relative">
                {isMounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#737686" }} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "#737686" }}
                        tickFormatter={(val) => `$${val}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          fontSize: "11px",
                        }}
                        formatter={(value: any) => [`$${value}`, ""]}
                      />
                      <Bar dataKey="ingresos" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="egresos" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Line type="monotone" dataKey="neto" stroke="#004ac6" strokeWidth={2.5} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Cargando gráfica analítica...
                  </div>
                )}
              </div>
            </div>

            {/* Gráfica 2: Desglose de Gastos OPEX por Categoría */}
            <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#0b1c30] flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-purple-600" />
                    Distribución de Gastos OPEX por Categoría
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Inversión en conectividad, infraestructura y mantenimiento
                  </p>
                </div>
                <span className="font-mono font-bold text-xs text-rose-600">
                  Total: ${safeNumber(gastosMetrics.totalEgresos)}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {Object.keys(gastosMetrics.byCategory).length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 italic">
                    Sin gastos OPEX registrados hasta el momento.
                  </div>
                ) : (
                  Object.entries(gastosMetrics.byCategory).map(([cat, val]) => {
                    const pct = gastosMetrics.totalEgresos > 0 ? (val / gastosMetrics.totalEgresos) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{formatFinanceCategory(cat)}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-500 text-[11px]">{pct.toFixed(1)}%</span>
                            <span className="font-mono font-bold text-slate-900">${safeNumber(val)}</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-purple-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Bloque de 2 Paneles de Análisis (Cobranzas vs Liquidez) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Panel de Eficiencia de Cobranzas */}
            <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#0b1c30] flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#004ac6]" />
                    Efectividad y Recuperación de Cartera
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Relación entre ventas emitidas, cobros realizados y saldo pendiente
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-50 text-[#004ac6] border border-blue-200">
                  {cobranzasMetrics.tasaEfectividad.toFixed(1)}% Cobrado
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 font-medium">Recaudado / Cobrado</span>
                    <span className="font-mono font-bold text-emerald-700">${safeNumber(cobranzasMetrics.totalRecaudado)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, cobranzasMetrics.tasaEfectividad)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 font-medium">Pendiente en Cartera (CxC)</span>
                    <span className="font-mono font-bold text-amber-700">${safeNumber(cobranzasMetrics.totalPendiente)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          cobranzasMetrics.totalFacturado > 0
                            ? Math.min(100, (cobranzasMetrics.totalPendiente / cobranzasMetrics.totalFacturado) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">Total Facturado</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">${safeNumber(cobranzasMetrics.totalFacturado)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                    <span className="text-[10px] text-emerald-700 block">Comprobantes Pagados</span>
                    <span className="font-mono font-bold text-emerald-800 text-xs">{cobranzasMetrics.pagadosCount}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-100">
                    <span className="text-[10px] text-amber-700 block">Comprobantes Pendientes</span>
                    <span className="font-mono font-bold text-amber-800 text-xs">{cobranzasMetrics.pendientesCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel de Concentración de Liquidez en Bancos */}
            <div className="p-5 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#0b1c30] flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    Distribución de Fondos y Liquidez Bancaria
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Participación porcentual y disponibilidad por cuenta / caja
                  </p>
                </div>
                <span className="font-mono font-bold text-xs text-[#004ac6]">
                  Total: ${safeNumber(bancosMetrics.totalLiquidez)}
                </span>
              </div>

              <div className="space-y-3">
                {bancosMetrics.accounts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center italic">
                    Sin cuentas bancarias registradas.
                  </p>
                ) : (
                  bancosMetrics.accounts.map((b) => (
                    <div key={b.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{b.bankName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({b.accountNumber})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-mono text-[11px]">{b.sharePct.toFixed(1)}%</span>
                          <span className="font-mono font-bold text-[#004ac6]">${safeNumber(b.balanceFloat)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, b.sharePct)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: REPORTE DETALLADO DE COBRANZAS                                   */}
      {/* ========================================================================= */}
      {activeTab === "cobranzas" && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden space-y-0">
          <div className="p-4 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 bg-[#fcfdff]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente, RUC o comprobante..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] text-xs text-[#0b1c30] rounded-lg border border-[#e2e8f0] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#434655] focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
              >
                <option value="todos">Todos los Estados</option>
                <option value="pagado">Pagados</option>
                <option value="parcial">Abono Parcial</option>
                <option value="pendiente">Pendientes</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="w-[18%] py-3 px-4">Comprobante</th>
                  <th className="w-[11%] py-3 px-3">Fecha Venta</th>
                  <th className="w-[27%] py-3 px-4">Cliente / RUC</th>
                  <th className="w-[12%] py-3 px-3 text-right">Total Emitido</th>
                  <th className="w-[11%] py-3 px-3 text-right">Cobrado / Abonado</th>
                  <th className="w-[11%] py-3 px-3 text-right">Saldo Pendiente</th>
                  <th className="w-[10%] py-3 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {monthlyCharges
                  .filter((c) => {
                    const q = searchQuery.toLowerCase();
                    const matchesQuery =
                      c.clientName.toLowerCase().includes(q) ||
                      (c.clientRuc || "").includes(q) ||
                      (c.invoiceNumber || "").toLowerCase().includes(q);
                    const matchesStatus = filterStatus === "todos" || c.status === filterStatus;
                    return matchesQuery && matchesStatus;
                  })
                  .map((c) => {
                    const isPaid = c.status === "pagado";
                    const paid = c.paidAmount !== undefined ? c.paidAmount : isPaid ? c.total : 0;
                    const bal = c.balanceRemaining !== undefined ? c.balanceRemaining : isPaid ? 0 : c.total;

                    return (
                      <tr key={c.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {c.invoiceNumber || "S/N"}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {c.saleDate || `${c.year}-${String(c.month).padStart(2, "0")}-01`}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block truncate">{c.clientName}</span>
                          <span className="text-[11px] font-mono text-slate-500">{c.clientRuc || "Consumidor Final"}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                          ${safeNumber(c.total)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          ${safeNumber(paid)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span className={bal > 0 ? "text-amber-700" : "text-slate-400"}>
                            ${safeNumber(bal)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                              isPaid
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : c.status === "parcial"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: REPORTE DETALLADO DE GASTOS OPEX                                 */}
      {/* ========================================================================= */}
      {activeTab === "gastos" && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden space-y-0">
          <div className="p-4 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 bg-[#fcfdff]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por proveedor o detalle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] text-xs text-[#0b1c30] rounded-lg border border-[#e2e8f0] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-xs bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg px-3 py-2 text-[#434655] focus:outline-hidden focus:border-[#004ac6] cursor-pointer"
            >
              <option value="todas">Todas las Categorías</option>
              <option value="enlace_transito">Tránsito IP & Conectividad</option>
              <option value="alquiler_nodo">Alquiler de Nodo / Torres</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="equipos">Equipos & Materiales</option>
              <option value="servicios_basicos">Servicios Básicos</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-purple-800 font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="w-[12%] py-3 px-4">Fecha</th>
                  <th className="w-[26%] py-3 px-4">Proveedor / Beneficiario</th>
                  <th className="w-[22%] py-3 px-4">Categoría</th>
                  <th className="w-[26%] py-3 px-4">Detalle / Concepto</th>
                  <th className="w-[14%] py-3 px-4 text-right">Monto (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {expenses
                  .filter((e) => {
                    const q = searchQuery.toLowerCase();
                    const matchesQuery =
                      e.supplierName.toLowerCase().includes(q) ||
                      (e.description || "").toLowerCase().includes(q);
                    const matchesCategory = filterCategory === "todas" || e.category === filterCategory;
                    return matchesQuery && matchesCategory;
                  })
                  .map((e) => (
                    <tr key={e.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600">{e.expenseDate}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{e.supplierName}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          {formatFinanceCategory(e.category)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 truncate" title={e.description}>
                        {e.description || "Gasto Operativo"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                        ${safeNumber(e.amount)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 4: REPORTE DE CUENTAS POR COBRAR (CxC / CARTERA)                    */}
      {/* ========================================================================= */}
      {activeTab === "cxc" && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden space-y-0">
          <div className="p-4 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 bg-[#fcfdff]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar cliente en cartera..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] text-xs text-[#0b1c30] rounded-lg border border-[#e2e8f0] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div className="text-xs font-bold text-amber-800">
              Cartera Total Abierta: ${safeNumber(totalCxCPendiente)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-amber-800 font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="w-[18%] py-3 px-4">Comprobante</th>
                  <th className="w-[12%] py-3 px-3">Fecha Emisión</th>
                  <th className="w-[12%] py-3 px-3">Vencimiento</th>
                  <th className="w-[30%] py-3 px-4">Cliente / RUC</th>
                  <th className="w-[14%] py-3 px-3 text-right">Total Factura</th>
                  <th className="w-[14%] py-3 px-4 text-right">Saldo en Cartera</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {cxcList
                  .filter((c) => {
                    const q = searchQuery.toLowerCase();
                    return (
                      c.clientName.toLowerCase().includes(q) ||
                      (c.clientRuc || "").includes(q) ||
                      c.invoiceNumber.toLowerCase().includes(q)
                    );
                  })
                  .map((c) => (
                    <tr key={c.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{c.invoiceNumber}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{c.saleDate}</td>
                      <td className="py-3 px-3 font-mono text-amber-700">{c.dueDate}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block truncate">{c.clientName}</span>
                        <span className="text-[11px] font-mono text-slate-500">{c.clientRuc || "Consumidor Final"}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 font-semibold">
                        ${safeNumber(c.total)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                        ${safeNumber(c.balanceRemaining)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 5: REPORTE DE CUENTAS POR PAGAR (CxP PROVEEDORES)                   */}
      {/* ========================================================================= */}
      {activeTab === "cxp" && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden space-y-0">
          <div className="p-4 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 bg-[#fcfdff]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar proveedor o comprobante de compra..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] text-xs text-[#0b1c30] rounded-lg border border-[#e2e8f0] focus:bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div className="text-xs font-bold text-purple-800">
              Total por Pagar: ${safeNumber(totalCxPPendiente)}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-xs border-collapse">
              <thead className="bg-[#f8f9ff] text-purple-800 font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                <tr>
                  <th className="w-[18%] py-3 px-4">Factura Compra</th>
                  <th className="w-[12%] py-3 px-3">Fecha Compra</th>
                  <th className="w-[12%] py-3 px-3">Vencimiento</th>
                  <th className="w-[30%] py-3 px-4">Proveedor / RUC</th>
                  <th className="w-[14%] py-3 px-3 text-right">Total Factura</th>
                  <th className="w-[14%] py-3 px-4 text-right">Saldo Adeudado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {cxpList
                  .filter((i) => {
                    const q = searchQuery.toLowerCase();
                    return (
                      i.supplierName.toLowerCase().includes(q) ||
                      (i.supplierRuc || "").includes(q) ||
                      i.documentNumber.toLowerCase().includes(q)
                    );
                  })
                  .map((i) => (
                    <tr key={i.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{i.documentNumber}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{i.date}</td>
                      <td className="py-3 px-3 font-mono text-purple-700">{i.dueDate}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block truncate">{i.supplierName}</span>
                        <span className="text-[11px] font-mono text-slate-500">{i.supplierRuc}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 font-semibold">
                        ${safeNumber(i.total)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-purple-700">
                        ${safeNumber(i.balanceRemaining)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 6: REPORTE DE BANCOS & DISPONIBILIDAD DE LIQUIDEZ                   */}
      {/* ========================================================================= */}
      {activeTab === "bancos" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#fcfdff]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#004ac6]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Cuentas Bancarias y Cajas Activas
                </h3>
              </div>
              <span className="font-mono font-bold text-xs text-[#004ac6]">
                Liquidez Total: ${safeNumber(bancosMetrics.totalLiquidez)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="table-fixed w-full text-left text-xs border-collapse">
                <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="w-[30%] py-3 px-4">Institución / Banco</th>
                    <th className="w-[20%] py-3 px-4">Tipo de Cuenta</th>
                    <th className="w-[25%] py-3 px-4">Número de Cuenta</th>
                    <th className="w-[15%] py-3 px-4 text-right">Saldo Actual</th>
                    <th className="w-[10%] py-3 px-4 text-center">Participación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {bancosMetrics.accounts.map((b) => (
                    <tr key={b.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{b.bankName}</td>
                      <td className="py-3 px-4 capitalize text-slate-600">{b.accountType.replace("_", " ")}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{b.accountNumber}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#004ac6]">
                        ${safeNumber(b.balanceFloat)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#004ac6] border border-blue-200">
                          {b.sharePct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historial de Movimientos Bancarios de Ingreso */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#fcfdff]">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Historial de Ingresos Bancarios Asentados
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table-fixed w-full text-left text-xs border-collapse">
                <thead className="bg-[#f8f9ff] text-emerald-800 font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                  <tr>
                    <th className="w-[14%] py-3 px-4">Fecha</th>
                    <th className="w-[22%] py-3 px-4">Banco / Cuenta</th>
                    <th className="w-[34%] py-3 px-4">Concepto</th>
                    <th className="w-[16%] py-3 px-4">Referencia</th>
                    <th className="w-[14%] py-3 px-4 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {financialMovements
                    .filter((m) => m.type === "ingreso")
                    .map((m) => (
                      <tr key={m.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600">{m.date}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{m.bankAccountName || "Caja General"}</td>
                        <td className="py-3 px-4 text-slate-800 truncate" title={m.description}>{m.description}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{m.referenceNumber || "-"}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          +${safeNumber(m.amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
