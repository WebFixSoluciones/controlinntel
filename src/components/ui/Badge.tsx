import { isValidElement, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { badgeTone } from "@/lib/badge-tone";

function labelText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(labelText).filter(Boolean).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return labelText(node.props.children);
  return "";
}

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  status?: string;
};

export function Badge({ children, className, status, ...props }: BadgeProps) {
  return (
    <span {...props} className={className ? `ui-badge ${className}` : "ui-badge"} data-badge-tone={badgeTone(status ?? labelText(children))}>
      {children}
    </span>
  );
}
