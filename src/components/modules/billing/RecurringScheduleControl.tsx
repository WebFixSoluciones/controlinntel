"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api-client";
import { formatDateEC } from "@/lib/date-utils";
import { useToast } from "@/lib/toast-context";
import type { RenewalReminderHistoryEntry } from "@/lib/server/renewal-email";
import type { Client, ClientService } from "@/types";

const ROW_STATUSES = {
  ready: { label: "Por emitir", filterLabel: "Por emitir", tone: "Pendiente" },
  issued: { label: "Emitido", filterLabel: "Emitidos", tone: "Emitido" },
  review: { label: "En revisión", filterLabel: "En revisión", tone: "En revisión" },
  cancelled: { label: "Anulado", filterLabel: "Anulados", tone: "Anulado" },
  excluded: { label: "Excluido", filterLabel: "Excluidos", tone: "Excluido" },
} as const;
type RowStatus = keyof typeof ROW_STATUSES;
const ROW_STATUS_KEYS = Object.keys(ROW_STATUSES) as RowStatus[];

const RUN_STATUSES = {
  running: { label: "En proceso", tone: "Pendiente" },
  completed: { label: "Completada", tone: "Confirmada" },
  partial: { label: "Con incidencias", tone: "Pendiente" },
  failed: { label: "Fallida", tone: "Fallida" },
} as const;

interface ScheduleRow {
  clientId: string;
  clientName: string;
  serviceId: string;
  serviceName: string;
  periodStart: string;
  periodEnd: string | null;
  total: number | null;
  status: RowStatus;
  reason?: string;
  documentNumber?: string;
  candidateInvoiceId?: string;
}

interface RunSummary {
  date: string;
  issued: number;
  reviewCount: number;
  pendingCount: number;
  failures: { clientId: string; error: string }[];
  status: keyof typeof RUN_STATUSES;
  completedAt?: string;
}

interface ScheduleControlData {
  date: string;
  rows: ScheduleRow[];
  runs: RunSummary[];
  configuration: { schedulerConfigured: boolean; renewalEmailEnabled: boolean };
}

type LoadResult = { data: ScheduleControlData; error?: never } | { data?: never; error: string };

const REMINDER_STATUSES = {
  processing: { label: "En proceso", tone: "Pendiente" },
  accepted: { label: "Aceptado por el servidor", tone: "Aceptado" },
  unconfirmed: { label: "Sin confirmar", tone: "Pendiente" },
  failed: { label: "Fallido", tone: "Fallido" },
  skipped: { label: "Omitido", tone: "Excluido" },
} satisfies Record<RenewalReminderHistoryEntry["status"], { label: string; tone: string }>;

const REMINDER_REASONS = {
  client_missing: "Cliente sin registro",
  client_inactive: "Cliente inactivo",
  email_invalid: "Correo inválido o ausente",
  smtp_rejected: "Rechazado por el servidor de correo",
  smtp_unconfirmed: "Confirmación pendiente del servidor de correo",
  processing_expired: "El intento quedó sin confirmar",
} satisfies Record<NonNullable<RenewalReminderHistoryEntry["reason"]>, string>;

interface ControlProps {
  clients: Pick<Client, "id" | "businessName">[];
  services: Pick<ClientService, "id" | "planName">[];
  refresh: () => Promise<void>;
}

function RenewalReminderHistory({ clientNames, serviceNames }: {
  clientNames: ReadonlyMap<string, string>;
  serviceNames: ReadonlyMap<string, string>;
}) {
  const [events, setEvents] = useState<RenewalReminderHistoryEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    api<{ events: RenewalReminderHistoryEntry[] }>("/api/commercial/renewal-reminders/history").then(
      ({ events }) => { if (!ignore) setEvents(events); },
      error => { if (!ignore) setError(error instanceof Error ? error.message : "No se pudo consultar el historial de avisos."); },
    );
    return () => { ignore = true; };
  }, []);

  if (error) return <p role="alert" className="px-4 pb-4 text-sm text-rose-700">{error}</p>;
  if (events === null) return <p role="status" className="px-4 pb-4 text-sm text-slate-600">Consultando avisos…</p>;
  if (events.length === 0) return <p className="px-4 pb-4 text-sm text-slate-600">Aún no hay resultados de avisos automáticos.</p>;

  return (
    <div role="region" aria-label="Resultados de avisos automáticos" tabIndex={0} className="max-h-80 overflow-auto border-t border-slate-200">
      <ul className="divide-y divide-slate-100">
        {events.map(event => (
          <li key={event.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-xs text-slate-700">
            <div>
              <strong className="block text-slate-900">{clientNames.get(event.clientId) || event.clientId}</strong>
              <span>{serviceNames.get(event.serviceId) || event.serviceId}</span>
            </div>
            <div>
              <span className="block">{event.kind === "contract_expiration" ? "Vencimiento de contrato" : "Renovación del ciclo"}</span>
              <time dateTime={event.targetDate}>{formatDateEC(event.targetDate, "human")}</time>
            </div>
            <span>Programado <time dateTime={event.scheduledDate}>{formatDateEC(event.scheduledDate, "human")}</time></span>
            <div className="min-w-32">
              <Badge status={REMINDER_STATUSES[event.status].tone}>{REMINDER_STATUSES[event.status].label}</Badge>
              {event.reason && <span className="mt-1 block">{REMINDER_REASONS[event.reason]}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const usd = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const runTime = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Guayaquil",
});
const filterClass = "rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export function RecurringScheduleControl({ clients, services, refresh }: ControlProps) {
  const { showConfirm, showSuccess, showError } = useToast();
  const [month, setMonth] = useState("");
  const [filter, setFilter] = useState<RowStatus | "all">("all");
  const [requestVersion, setRequestVersion] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [linkingNote, setLinkingNote] = useState(false);
  const linkOperations = useRef(new Map<string, string>());

  useEffect(() => {
    let ignore = false;
    const query = month ? `?date=${month}-01` : "";
    api<ScheduleControlData>(`/api/commercial/recurring-control${query}`).then(
      data => { if (!ignore) setResult({ data }); },
      error => { if (!ignore) setResult({ error: error instanceof Error ? error.message : "No se pudo consultar la emisión automática." }); },
    );
    return () => { ignore = true; };
  }, [month, requestVersion]);

  const changeMonth = (value: string) => {
    if (value === month || (value && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value))) return;
    setResult(null);
    setFilter("all");
    setMonth(value);
  };
  const refreshPreview = () => {
    setResult(null);
    setRequestVersion(version => version + 1);
  };
  const confirmLink = (row: ScheduleRow) => {
    const { candidateInvoiceId, documentNumber, periodStart, periodEnd, serviceId } = row;
    if (!candidateInvoiceId || !documentNumber || !periodEnd || linkingNote) return;
    showConfirm(
      "Vincular nota existente",
      `Vincularás la nota ${documentNumber} a ${row.serviceName}, del ${formatDateEC(periodStart)} al ${formatDateEC(periodEnd)}. Se reutilizará el documento existente.`,
      async () => {
        setLinkingNote(true);
        const key = `${candidateInvoiceId}:${serviceId}:${periodStart}`;
        try {
          const operationId = linkOperations.current.get(key) ?? crypto.randomUUID();
          linkOperations.current.set(key, operationId);
          await api("/api/commercial", {
            action: "reconcileRecurringPeriod", operationId,
            data: { serviceId, periodStart, invoiceId: candidateInvoiceId },
          });
          linkOperations.current.delete(key);
          showSuccess("Nota vinculada", `La nota ${documentNumber} quedó vinculada al período.`);
          refreshPreview();
          void refresh().catch(() => showError("Vista sin actualizar", "Vuelve a cargar la página para consultar el lote actualizado."));
        } catch (error) {
          showError("No se pudo vincular la nota", error instanceof Error ? error.message : "Consulta el estado de la nota y vuelve a intentar.");
        } finally {
          setLinkingNote(false);
        }
      },
      "Vincular nota",
    );
  };

  const data = result?.data;
  const counts: Record<RowStatus, number> = { ready: 0, issued: 0, review: 0, cancelled: 0, excluded: 0 };
  for (const row of data?.rows ?? []) counts[row.status]++;
  const rows = data?.rows.filter(row => filter === "all" || row.status === filter) ?? [];
  const runs = data?.runs.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.completedAt ?? "").localeCompare(a.completedAt ?? "")) ?? [];
  const clientNames = new Map(clients.map(client => [client.id, client.businessName]));
  for (const row of data?.rows ?? []) clientNames.set(row.clientId, row.clientName);
  const serviceNames = new Map(services.map(service => [service.id, service.planName]));

  return (
    <div className="space-y-4">
      <section aria-labelledby="recurring-preview-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 p-4">
          <div>
            <h2 id="recurring-preview-title" className="text-base font-bold text-slate-900">Previsualización de la emisión automática</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              La emisión de notas de venta se programa para el día 1. Los posibles duplicados quedan en revisión.
            </p>
            {data && (
              <p className="mt-2 text-xs text-slate-700">
                {data.configuration.schedulerConfigured ? "Credencial de la tarea configurada" : "Falta configurar la credencial de la tarea"}
                {" · "}{data.configuration.renewalEmailEnabled ? "Avisos por correo habilitados" : "Avisos por correo desactivados"}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-700">
              Mes de ejecución
              <input
                type="month"
                value={month || data?.date.slice(0, 7) || ""}
                onChange={event => changeMonth(event.currentTarget.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-normal text-slate-800"
              />
            </label>
            <button
              type="button"
              disabled={result === null}
              onClick={refreshPreview}
              className={`${filterClass} inline-flex items-center gap-1.5 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50`}
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Actualizar
            </button>
          </div>
        </div>

        {result === null && <p role="status" className="px-4 pb-4 text-sm text-slate-600">Consultando la emisión automática…</p>}
        {result?.error && <p role="alert" className="px-4 pb-4 text-sm text-rose-700">{result.error}</p>}

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 text-sm">
              <span className="font-semibold text-slate-800">
                {month ? "Fecha consultada" : "Próxima ejecución"}{" "}
                <time dateTime={data.date}>{formatDateEC(data.date, "human")}</time>
              </span>
              {month && (
                <button type="button" onClick={() => changeMonth("")} className="text-xs font-semibold text-blue-700 underline">
                  Ver próxima ejecución
                </button>
              )}
            </div>
            <div role="group" aria-label="Filtrar servicios por estado" className="flex flex-wrap gap-2 px-4 pb-4">
              {(["all", ...ROW_STATUS_KEYS] as const).map(status => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={filter === status}
                  onClick={() => setFilter(status)}
                  className={`${filterClass} ${filter === status
                    ? "border-blue-300 bg-blue-50 text-blue-800"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  {status === "all" ? "Todos" : ROW_STATUSES[status].filterLabel}{" "}
                  <span className="ml-0.5 tabular-nums">{status === "all" ? data.rows.length : counts[status]}</span>
                </button>
              ))}
            </div>
            {rows.length ? (
              <div role="region" aria-label="Servicios de la emisión automática" tabIndex={0} className="max-h-[28rem] overflow-auto border-t border-slate-200">
                <table className="w-full min-w-[43rem] border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 font-semibold text-slate-700">
                    <tr>
                      <th scope="col" className="px-4 py-2.5">Cliente y servicio</th>
                      <th scope="col" className="px-3 py-2.5">Período</th>
                      <th scope="col" className="px-3 py-2.5 text-right">Total</th>
                      <th scope="col" className="px-3 py-2.5">Estado</th>
                      <th scope="col" className="px-4 py-2.5">Nota o motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {rows.map(row => (
                      <tr key={`${row.clientId}:${row.serviceId}:${row.periodStart}`}>
                        <th scope="row" className="px-4 py-2.5 align-top font-semibold text-slate-900">
                          {row.clientName}
                          <span className="mt-0.5 block font-normal text-slate-600">{row.serviceName}</span>
                        </th>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top">
                          {row.periodStart && row.periodEnd ? (
                            `${formatDateEC(row.periodStart)} – ${formatDateEC(row.periodEnd)}`
                          ) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums">{row.total === null ? "—" : usd.format(row.total)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-top">
                          <Badge status={ROW_STATUSES[row.status].tone}>{ROW_STATUSES[row.status].label}</Badge>
                        </td>
                        <td className="max-w-xs break-words px-4 py-2.5 align-top">
                          {row.documentNumber && <span className="block font-mono text-slate-900">{row.documentNumber}</span>}
                          {row.reason || (!row.documentNumber && "—")}
                          {row.status === "review" && row.candidateInvoiceId && row.documentNumber && (
                            <button
                              type="button"
                              disabled={linkingNote}
                              onClick={() => confirmLink(row)}
                              className="mt-1 block text-left font-semibold text-blue-700 underline disabled:opacity-50"
                            >
                              Vincular nota existente
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="border-t border-slate-200 p-4 text-sm text-slate-600">
                {filter === "all" ? "No hay servicios para el mes consultado." : "No hay servicios con el estado seleccionado."}
              </p>
            )}
          </>
        )}
      </section>

      {data && (
        <section aria-labelledby="recurring-runs-title" className="rounded-xl border border-slate-200 bg-white">
          <h2 id="recurring-runs-title" className="px-4 pt-4 text-base font-bold text-slate-900">Ejecuciones recientes</h2>
          {runs.length ? (
            <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
              {runs.map(run => (
                <li key={`${run.date}:${run.completedAt}`} className="px-4 py-3 text-sm text-slate-700">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <time dateTime={run.date} className="font-semibold text-slate-900">{formatDateEC(run.date, "human")}</time>
                    <Badge status={RUN_STATUSES[run.status].tone}>{RUN_STATUSES[run.status].label}</Badge>
                    <span>Notas emitidas <strong>{run.issued}</strong></span>
                    <span>Servicios en revisión <strong>{run.reviewCount}</strong></span>
                    {run.pendingCount > 0 && <span>Clientes por procesar <strong>{run.pendingCount}</strong></span>}
                    {run.completedAt && Number.isFinite(Date.parse(run.completedAt)) && (
                      <span className="text-xs text-slate-600">
                        Registro del resultado <time dateTime={run.completedAt}>{runTime.format(new Date(run.completedAt))}</time>
                      </span>
                    )}
                  </div>
                  {run.failures.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="w-fit cursor-pointer font-semibold text-rose-700">
                        {run.failures.length} {run.failures.length === 1 ? "incidencia" : "incidencias"}
                      </summary>
                      <ul className="mt-1 space-y-1 pl-4">
                        {run.failures.map((failure, index) => (
                          <li key={`${failure.clientId}:${index}`}>
                            <span className="font-semibold">{clientNames.get(failure.clientId) || failure.clientId}</span>
                            {" · "}{failure.error}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="p-4 text-sm text-slate-600">Aún no hay resultados de ejecuciones automáticas.</p>}
        </section>
      )}

      <details onToggle={event => setHistoryOpen(event.currentTarget.open)} className="rounded-xl border border-slate-200 bg-white">
        <summary className="cursor-pointer p-4 text-base font-bold text-slate-900">Historial de avisos de renovación</summary>
        {historyOpen && <RenewalReminderHistory key={requestVersion} clientNames={clientNames} serviceNames={serviceNames} />}
      </details>
    </div>
  );
}
