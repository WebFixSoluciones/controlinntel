"use client";

import type { ButtonHTMLAttributes } from "react";
import { Pencil, Trash2 } from "lucide-react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  action: "edit" | "delete";
  label?: string;
};
const cn = (...classes: Parameters<typeof clsx>) => twMerge(clsx(...classes));

/** Shared row actions; permissions and confirmation stay with each caller. */
export function ActionIconButton({ action, label, title, className, type = "button", ...props }: Props) {
  const text = label || props["aria-label"] || title || (action === "edit" ? "Editar" : "Eliminar");
  const Icon = action === "edit" ? Pencil : Trash2;
  return <button {...props} type={type} title={title || text} aria-label={text}
    data-action-icon={action}
    className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40", action === "edit" ? "text-[#004ac6] hover:border-blue-200 hover:bg-blue-50 focus-visible:ring-blue-600" : "text-rose-600 hover:border-rose-200 hover:bg-rose-50 focus-visible:ring-rose-600", className)}>
    <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
  </button>;
}
