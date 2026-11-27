"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Bell, ChevronRight } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { validDate } from "@/lib/commercial-core";
import { diffInCalendarDays, formatDateEC, getEcuadorDate } from "@/lib/date-utils";
import { can, canAccessRoute, canAccessSubmodule } from "@/lib/permissions";
import { canReadCollection } from "@/lib/persistence-contracts";
import { getRenewalAlerts, type RecurringRunSummary } from "@/lib/renewal-alerts";
import { useApp } from "@/lib/state";
import { isClosedTicketStatus } from "@/lib/ticket-status";

const runStatusLabels: Record<RecurringRunSummary["status"], string> = {
  completed: "Completada",
  partial: "Parcial",
  failed: "Con errores",
  running: "Sin cierre registrado",
};

type RunResult = { latestRun: RecurringRunSummary | null } | { error: true };

function deadlineLabel(days: number) {
  if (days === 0) return "Hoy";
  if (days === -1) return "Hace 1 día";
  if (days === 1) return "En 1 día";
  return days < 0 ? `Hace ${-days} días` : `En ${days} días`;
}

export function RenewalNotificationMenu() {
  const { currentUser, clients, clientServices, policies, tickets } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = useId();
  const titleId = useId();
  const today = getEcuadorDate();

  const canReadRenewals = canReadCollection(currentUser, "clients") && canReadCollection(currentUser, "clientServices");
  const canAccessRecurring = canAccessSubmodule(currentUser, "ventas", "recurrentes");
  const canReadRun = canAccessRecurring && can(currentUser, "manage_finance");
  const canReadPolicies = canReadCollection(currentUser, "policies");
  const canReadTickets = canReadCollection(currentUser, "tickets");

  const renewals = useMemo(() => canReadRenewals ? getRenewalAlerts(clients, clientServices, today) : [],
    [canReadRenewals, clients, clientServices, today]);
  const policyAlerts = useMemo(() => canReadPolicies ? policies
    .filter(policy => validDate(policy.expirationDate))
    .map(policy => ({ ...policy, remaining: diffInCalendarDays(today, policy.expirationDate) }))
    .filter(policy => policy.remaining <= 30)
    .sort((a, b) => a.remaining - b.remaining) : [], [canReadPolicies, policies, today]);
  const urgentTickets = useMemo(() => canReadTickets ? tickets.filter(ticket =>
    !isClosedTicketStatus(ticket.status) && (ticket.priority === "alta" || ticket.priority === "critica")) : [],
    [canReadTickets, tickets]);
  const latestRun = canReadRun && runResult && "latestRun" in runResult ? runResult.latestRun : null;
  const runNeedsAttention = !!latestRun && (latestRun.status === "partial" || latestRun.status === "failed"
    || latestRun.reviewCount > 0 || latestRun.failureCount > 0);
  const alertCount = renewals.length + policyAlerts.length + urgentTickets.length + Number(runNeedsAttention);

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();

    const handleOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !canReadRun) return;
    let active = true;
    setRunResult(null);
    api<{ latestRun: RecurringRunSummary | null }>("/api/commercial/renewal-alerts").then(result => {
      if (active) setRunResult(result);
    }).catch(() => {
      if (active) setRunResult({ error: true });
    });
    return () => { active = false; };
  }, [isOpen, canReadRun, currentUser.uid]);

  return (
    <div className="relative" ref={containerRef} onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setIsOpen(false);
    }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(open => !open)}
        aria-label={alertCount ? `Notificaciones, ${alertCount} ${alertCount === 1 ? "alerta" : "alertas"}` : "Notificaciones"}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        title="Notificaciones"
        className="relative cursor-pointer rounded-lg p-2 text-[#434655] transition-colors hover:bg-[#eff4ff] hover:text-[#004ac6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <Bell aria-hidden="true" className="h-4 w-4" />
        {alertCount > 0 && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
      </button>

      {isOpen && (
        <section
          ref={panelRef}
          id={panelId}
          aria-labelledby={titleId}
          tabIndex={-1}
          className="fixed inset-x-2 top-[4.5rem] z-50 max-h-[min(28rem,calc(100dvh_-_5rem))] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-xl outline-none sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <h2 id={titleId} className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 py-3 text-sm font-bold text-slate-900">Notificaciones</h2>
          <div className="text-xs">
            {alertCount === 0 && (!canReadRun || runResult) && <p className="px-4 py-3 text-slate-600">No hay alertas pendientes.</p>}

            {renewals.length > 0 && (
              <div className="border-b border-slate-100 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-1">
                  <h3 className="font-bold text-slate-800">Renovaciones de servicios</h3>
                  {canAccessRecurring && <Link href="/ventas?sub=recurrentes" onClick={() => setIsOpen(false)} className="font-semibold text-blue-700 hover:underline">Ver recurrentes</Link>}
                </div>
                <ul>
                  {renewals.map(alert => (
                    <li key={alert.serviceId}>
                      <Link
                        href={{ pathname: "/clientes", query: { id: alert.clientId, tab: "contratos" } }}
                        prefetch={false}
                        onClick={() => setIsOpen(false)}
                        className="flex items-start gap-2 px-4 py-2.5 hover:bg-slate-50 focus-visible:bg-blue-50 focus-visible:outline-none"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-semibold text-slate-900">{alert.clientName}</p>
                          <p className="break-words text-slate-600">{alert.serviceName}</p>
                          <ul className="mt-1.5 space-y-1">
                            {alert.deadlines.map(deadline => (
                              <li key={deadline.kind} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-slate-700">
                                <span>{deadline.kind === "contractEnd" ? "Fin de contrato" : "Próxima renovación o cobro"}</span>
                                <time dateTime={deadline.date} className="tabular-nums">{formatDateEC(deadline.date)}</time>
                                <span className={deadline.daysRemaining < 0 ? "font-semibold text-rose-700" : "font-semibold text-amber-800"}>
                                  {deadlineLabel(deadline.daysRemaining)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <ChevronRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {policyAlerts.length > 0 && (
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="font-bold text-slate-800">Pólizas ARCOTEL</h3>
                  {canAccessRoute(currentUser, "/tramites") && <Link href="/tramites" onClick={() => setIsOpen(false)} className="font-semibold text-blue-700 hover:underline">Ver trámites</Link>}
                </div>
                <ul className="mt-1.5 space-y-1.5">
                  {policyAlerts.map(policy => (
                    <li key={policy.id} className="flex flex-wrap gap-x-2 gap-y-0.5 text-slate-700">
                      <span className="break-all font-semibold">{policy.policyNumber}</span>
                      <time dateTime={policy.expirationDate} className="tabular-nums">{formatDateEC(policy.expirationDate)}</time>
                      <span className={policy.remaining < 0 ? "text-rose-700" : "text-amber-800"}>{deadlineLabel(policy.remaining)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {urgentTickets.length > 0 && (
              <Link href="/tickets" onClick={() => setIsOpen(false)} className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 font-semibold text-slate-800 hover:bg-slate-50 focus-visible:bg-blue-50 focus-visible:outline-none">
                {urgentTickets.length === 1 ? "1 ticket de prioridad alta o crítica" : `${urgentTickets.length} tickets de prioridad alta o crítica`}
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
              </Link>
            )}

            {canReadRun && (
              <div className="px-4 py-3" aria-live="polite">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="font-bold text-slate-800">Última facturación automática</h3>
                  {renewals.length === 0 && <Link href="/ventas?sub=recurrentes" onClick={() => setIsOpen(false)} className="font-semibold text-blue-700 hover:underline">Ver recurrentes</Link>}
                </div>
                {!runResult && <p className="mt-1 text-slate-600">Consultando el resultado…</p>}
                {runResult && "error" in runResult && <p className="mt-1 text-rose-700">No se pudo consultar la última ejecución.</p>}
                {runResult && "latestRun" in runResult && !latestRun && <p className="mt-1 text-slate-600">Aún no hay ejecuciones registradas.</p>}
                {latestRun && (
                  <div className="mt-1 space-y-1 text-slate-700">
                    <p className="flex flex-wrap gap-x-2">
                      <time dateTime={latestRun.date} className="tabular-nums">{formatDateEC(latestRun.date)}</time>
                      <span className={runNeedsAttention ? "font-semibold text-rose-700" : "font-semibold"}>{runStatusLabels[latestRun.status]}</span>
                    </p>
                    {latestRun.status !== "running" && <p>{latestRun.issued} emitidos · {latestRun.reviewCount} para revisar · {latestRun.failureCount} errores</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
