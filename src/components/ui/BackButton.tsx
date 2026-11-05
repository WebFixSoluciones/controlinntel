"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type CommonProps = { label?: string; className?: string };
type BackButtonProps = CommonProps & (
  | ({ href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href">)
  | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">)
);

const appearance = "group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#004ac6] bg-white text-[#004ac6] transition-[background-color,box-shadow,transform] duration-200 hover:bg-[#eff4ff] hover:shadow-md motion-safe:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004ac6] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none motion-reduce:transform-none";
const icon = <ArrowLeft aria-hidden="true" className="h-5 w-5 transition-transform duration-200 motion-safe:group-hover:-translate-x-0.5 motion-reduce:transition-none" strokeWidth={1.8} />;

/** One visual treatment for returning to a previous view, preserving its destination. */
export function BackButton(props: BackButtonProps) {
  if (typeof props.href === "string") {
    const { label, className = "", title, ...linkProps } = props;
    const name = label || props["aria-label"] || title || "Volver";
    return <Link {...linkProps} data-back-button aria-label={name} title={title || name} className={`${appearance} ${className}`}>{icon}</Link>;
  }
  const { label, className = "", title, type = "button", ...buttonProps } = props;
  const name = label || props["aria-label"] || title || "Volver";
  return <button {...buttonProps} type={type} data-back-button aria-label={name} title={title || name} className={`${appearance} ${className}`}>{icon}</button>;
}
