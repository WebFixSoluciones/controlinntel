"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { DocumentTablePagination, useDocumentPagination } from "@/components/ui/DocumentTablePagination";
import { activeClientServices } from "@/lib/client-status";
import { clientSalesHistory } from "@/lib/client-sales-history";
import { formatDateEC } from "@/lib/date-utils";
import { canViewClientServicePart } from "@/lib/permissions";
import { safeNumber } from "@/lib/print-service";
import { useApp } from "@/lib/state";
import type { Client } from "@/types";

const heading = "bg-[#f8f9ff] text-[11px] font-semibold uppercase text-[#004ac6]";
const cell = "px-3 py-2.5 align-top";
const table = "w-full table-fixed border-collapse text-left text-xs";

function DocumentStatus({ status }: { status?: string }) {
  const key = status?.toLowerCase();
  const valid = key === "pagado" || key === "autorizada" || key === "autorizado";
  return <span className={`inline-block max-w-full break-words rounded border px-1.5 py-0.5 text-[11px] font-semibold capitalize ${valid
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-slate-200 bg-slate-50 text-slate-700"}`}>
    {key === "autorizada" ? "Autorizado" : key?.replaceAll("_", " ") || "Sin estado"}
  </span>;
}

export function ClientServicesQuickView({ client, onClose, onOpenHistory }: {
  client: Client;
  onClose: () => void;
  onOpenHistory?: () => void;
}) {
  const { currentUser, clientServices, billingInvoices, monthlyCharges } = useApp();
  const showActive = canViewClientServicePart(currentUser, "contratados");
  const showHistory = canViewClientServicePart(currentUser, "facturados");
  const showPrices = canViewClientServicePart(currentUser, "tarifas");
  const [tab, setTab] = useState<"active" | "history">(showActive ? "active" : "history");
  const activeTab = showActive && (tab === "active" || !showHistory);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);

  const services = showActive ? activeClientServices(clientServices, client.id) : [];
  const matchesClient = (row: { clientId?: string; clientRuc?: string }) =>
    row.clientId === client.id || Boolean(client.identificationNumber && row.clientRuc === client.identificationNumber);
  const history = showHistory
    ? clientSalesHistory(billingInvoices.filter(matchesClient), monthlyCharges.filter(matchesClient)).rows.filter(row => !row.isTest)
    : [];
  const page = useDocumentPagination(history, [client.id]);

  return <dialog ref={dialog} aria-labelledby="client-services-overview-title" onCancel={event => { event.preventDefault(); onClose(); }}
    className="m-auto max-h-[89dvh] w-[calc(100%-1.5rem)] max-w-5xl overflow-hidden rounded-xl border border-slate-200 p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50">
    <div className="flex max-h-[89dvh] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:px-5">
        <div className="min-w-0">
          <h2 id="client-services-overview-title" className="font-semibold">Servicios del cliente</h2>
          <p className="mt-1 break-words text-xs text-slate-600">{client.businessName}</p>
        </div>
        <button type="button" aria-label="Cerrar servicios" onClick={onClose} className="shrink-0 rounded-lg p-1.5 hover:bg-slate-200">
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>
      <div role="group" aria-label="Vistas de servicios" className="soft-tab-strip shrink-0 border-b border-slate-100 px-4 py-2 sm:px-5">
        {showActive && <button type="button" aria-pressed={activeTab} className="soft-nav-item soft-tab" onClick={() => setTab("active")}>
          Servicios activos <span className="rounded-full bg-slate-100 px-1.5 text-[10px] tabular-nums text-slate-600">{services.length}</span>
        </button>}
        {showHistory && <button type="button" aria-pressed={!activeTab} className="soft-nav-item soft-tab" onClick={() => setTab("history")}>
          Historial de comprobantes <span className="rounded-full bg-slate-100 px-1.5 text-[10px] tabular-nums text-slate-600">{history.length}</span>
        </button>}
      </div>
      <section className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {activeTab ? services.length > 0 ? (
          <div role="region" tabIndex={0} aria-label="Servicios activos" className="overflow-x-auto rounded-lg border border-slate-200">
            <table className={`${table} min-w-[30rem]`}>
              <thead className={heading}><tr>
                <th scope="col" className={cell}>Servicio / plan</th>
                <th scope="col" className={`${cell} w-24`}>Categoría</th>
                <th scope="col" className={`${cell} w-28`}>Frecuencia</th>
                {showPrices && <th scope="col" className={`${cell} w-24 text-right`}>Tarifa</th>}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {services.map(service => <tr key={service.id}>
                  <td className={`${cell} break-words font-semibold`}>{service.planName || "Servicio"}
                    {service.downloadMbps > 0 && <p className="mt-0.5 text-[11px] font-normal text-slate-500">
                      {service.downloadMbps} Mbps de bajada · {service.uploadMbps} Mbps de subida
                    </p>}
                  </td>
                  <td className={`${cell} break-words capitalize`}>{service.serviceCategory || "Internet"}</td>
                  <td className={`${cell} capitalize`}>{service.billingFrequency || "Mensual"}</td>
                  {showPrices && <td className={`${cell} text-right font-semibold tabular-nums`}>${safeNumber(service.customPrice ?? service.basePrice)}</td>}
                </tr>)}
              </tbody>
            </table>
          </div>
        ) : <p className="py-8 text-center text-xs text-slate-600">Este cliente no tiene servicios activos.</p> : (
          <>
            <p className="text-xs text-slate-600">Facturas, notas de venta y cargos registrados para este cliente.</p>
            {history.length > 0 ? (
              <div className="rounded-lg border border-slate-200">
                <div role="region" tabIndex={0} aria-label="Historial de comprobantes" className="overflow-x-auto rounded-t-lg">
                  <table className={`${table} min-w-[40rem]`}>
                    <thead className={heading}><tr>
                      <th scope="col" className={`${cell} w-40`}>Comprobante</th>
                      <th scope="col" className={`${cell} w-28`}>Fecha</th>
                      <th scope="col" className={cell}>Concepto</th>
                      {showPrices && <th scope="col" className={`${cell} w-24 text-right`}>Total</th>}
                      <th scope="col" className={`${cell} w-28`}>Estado</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {page.rows.map(row => <tr key={row.id}>
                        <td className={cell}>
                          <span className="break-words font-mono font-semibold">{row.documentNumber || "—"}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">{row.kind}</span>
                        </td>
                        <td className={`${cell} whitespace-nowrap tabular-nums`}>{formatDateEC(row.issuedDate || row.date || "") || "—"}</td>
                        <td className={`${cell} break-words`}>{row.description || "—"}</td>
                        {showPrices && <td className={`${cell} text-right font-semibold tabular-nums`}>${safeNumber(row.total)}</td>}
                        <td className={cell}><DocumentStatus status={row.status} /></td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
                {history.length > 10 && <DocumentTablePagination {...page.controls} />}
              </div>
            ) : <p className="py-7 text-center text-xs text-slate-600">Sin comprobantes disponibles para este cliente.</p>}
          </>
        )}
      </section>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4 text-xs font-semibold sm:px-5">
        {activeTab ? <Link href={`/clientes?id=${encodeURIComponent(client.id)}&tab=contratos`} onClick={onClose}
          className="inline-flex items-center gap-1.5 text-[#004ac6] hover:underline">
          Abrir Servicios en la ficha <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link> : onOpenHistory && <button type="button" onClick={onOpenHistory} className="inline-flex items-center gap-1.5 text-[#004ac6] hover:underline">
          Ver historial completo <ArrowRight aria-hidden="true" className="size-3.5" />
        </button>}
        <button type="button" onClick={onClose} className="ml-auto rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50">Cerrar</button>
      </footer>
    </div>
  </dialog>;
}
