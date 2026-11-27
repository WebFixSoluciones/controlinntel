import type { Client, ClientService } from "@/types";
import { validDate } from "./commercial-core.ts";
import { diffInCalendarDays } from "./date-utils.ts";

const RENEWAL_NOTICE_DAYS = 15;

type AlertClient = Pick<Client, "id" | "businessName" | "status">;
type AlertService = Pick<ClientService, "id" | "clientId" | "planName" | "status" | "contractEndDate" | "nextRenewalDate">;

export type RenewalDeadline = {
  kind: "contractEnd" | "renewal";
  date: string;
  daysRemaining: number;
};

type RenewalAlert = {
  serviceId: string;
  clientId: string;
  clientName: string;
  serviceName: string;
  deadlines: RenewalDeadline[];
};

export type RecurringRunSummary = {
  date: string;
  status: "completed" | "partial" | "failed" | "running";
  issued: number;
  reviewCount: number;
  failureCount: number;
};

type RunFields = Partial<Record<"date" | "status" | "issued" | "reviewCount" | "failures", unknown>>;

export function getRenewalAlerts(clients: AlertClient[], services: AlertService[], today: string): RenewalAlert[] {
  const activeClients = new Map(clients.filter(client => client.status === "activo").map(client => [client.id, client]));
  const alerts: RenewalAlert[] = [];

  for (const service of services) {
    if (service.status !== "activo" && service.status !== "por_renovar") continue;
    const client = activeClients.get(service.clientId);
    if (!client) continue;

    const deadlines: RenewalDeadline[] = [];
    const dates = [["contractEnd", service.contractEndDate], ["renewal", service.nextRenewalDate]] as const;
    for (const [kind, date] of dates) {
      if (!date || !validDate(date)) continue;
      const daysRemaining = diffInCalendarDays(today, date);
      if (daysRemaining <= RENEWAL_NOTICE_DAYS) deadlines.push({ kind, date, daysRemaining });
    }
    if (!deadlines.length) continue;

    alerts.push({
      serviceId: service.id,
      clientId: client.id,
      clientName: client.businessName || "Cliente sin nombre",
      serviceName: service.planName || "Servicio contratado",
      deadlines: deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining),
    });
  }

  return alerts.sort((a, b) => a.deadlines[0].daysRemaining - b.deadlines[0].daysRemaining || a.clientName.localeCompare(b.clientName, "es"));
}

export function getRecurringRunSummary(run: RunFields): RecurringRunSummary | null {
  const { date, status, issued, reviewCount, failures } = run;
  if (typeof date !== "string" || !validDate(date)) return null;
  if (status !== "completed" && status !== "partial" && status !== "failed" && status !== "running") return null;

  return {
    date,
    status,
    issued: typeof issued === "number" && Number.isSafeInteger(issued) && issued >= 0 ? issued : 0,
    reviewCount: typeof reviewCount === "number" && Number.isSafeInteger(reviewCount) && reviewCount >= 0 ? reviewCount : 0,
    failureCount: Array.isArray(failures) ? failures.length : 0,
  };
}
