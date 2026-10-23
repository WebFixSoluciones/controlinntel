"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface ClientTabHeaderProps {
  title: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * Standard Header for all Client Profile 360 Tabs.
 * Ensures 100% consistent sizing, spacing, typography, and action alignment.
 */
export function ClientTabHeader({
  title,
  icon: Icon,
  badge,
  actions,
}: ClientTabHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 px-4 bg-slate-50 rounded-xl border border-slate-200/80 mb-4 select-none">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#004ac6] flex items-center justify-center border border-blue-100/60">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <h3 className="font-bold text-sm text-slate-900 tracking-tight">
          {title}
        </h3>
        {badge && <div className="ml-1">{badge}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Standard Sub-section Header for inner cards within a tab (e.g. Contactos, Documentos).
 */
export function ClientSectionHeader({
  title,
  icon: Icon,
  actions,
}: {
  title: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 select-none">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-[#004ac6]" />}
        <h4 className="font-bold text-xs text-slate-800 tracking-tight">
          {title}
        </h4>
      </div>
      {actions && <div>{actions}</div>}
    </div>
  );
}
