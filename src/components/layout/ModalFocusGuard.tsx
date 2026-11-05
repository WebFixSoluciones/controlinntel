"use client";

import { useEffect } from "react";
import { useToast } from "@/lib/toast-context";

export function ModalFocusGuard() {
  const { showAlert } = useToast();
  useEffect(() => {
    let active: HTMLElement | null = null;
    let pendingClose = false;
    let validationScheduled = false;
    const modified = new WeakSet<HTMLElement>();
    const returnFocus = new WeakMap<HTMLElement, HTMLElement>();
    const controls = (dialog: HTMLElement) => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    )).filter(element => element.getClientRects().length > 0);

    function observe() {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(
        '[role="dialog"],[role="alertdialog"],.fixed.inset-0',
      )).filter(element => element.getClientRects().length > 0 && element.querySelector("form,h2,h3"));
      const next = candidates.find(element => element.getAttribute("role") === "alertdialog")
        || candidates[candidates.length - 1] || null;
      if (next === active) return;
      const previous = active;
      active = next;
      if (next?.getAttribute("role") !== "alertdialog") pendingClose = false;
      if (previous && !previous.isConnected) {
        const target = returnFocus.get(previous);
        if (target?.isConnected && (!next || next.contains(target))) target.focus();
      }
      if (!next) return;
      if (!returnFocus.has(next) && document.activeElement instanceof HTMLElement) returnFocus.set(next, document.activeElement);
      if (next.getAttribute("role") !== "alertdialog") next.setAttribute("role", "dialog");
      next.setAttribute("aria-modal", "true");
      if (!next.hasAttribute("aria-label") && !next.hasAttribute("aria-labelledby")) {
        next.setAttribute("aria-label", next.querySelector("h2,h3")?.textContent?.trim() || "Formulario");
      }
      if (!next.contains(document.activeElement)) {
        const first = next.querySelector<HTMLElement>("[data-dialog-autofocus]") || controls(next)[0];
        if (first) first.focus();
        else { next.tabIndex = -1; next.focus(); }
      }
    }
    function input(event: Event) {
      if (active && active.getAttribute("role") !== "alertdialog" && active.contains(event.target as Node)
        && !(event.target instanceof HTMLInputElement && ["search", "file"].includes(event.target.type))) modified.add(active);
    }
    function close(event: MouseEvent) {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!active || !button || !active.contains(button) || !modified.has(active)) return;
      const label = button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent?.trim();
      if (!["Cerrar", "Cancelar"].includes(label || "") && !button.hasAttribute("data-back-button")) return;
      event.preventDefault(); event.stopPropagation();
      if (pendingClose) return;
      pendingClose = true;
      const dialog = active;
      showAlert({
        type: "confirm", title: "Cambios sin guardar",
        message: "Tienes cambios sin guardar. Si cierras este formulario, se perderán.",
        confirmText: "Descartar cambios", cancelText: "Seguir editando",
        onCancel: () => { pendingClose = false; },
        onConfirm: () => {
          pendingClose = false;
          modified.delete(dialog);
          // Replay the original close after the confirmation has unmounted.
          requestAnimationFrame(() => { if (button.isConnected && dialog.isConnected) button.click(); });
        },
      });
    }
    function invalid(event: Event) {
      // Preserve HTML constraints, replacing only the browser validation bubble.
      event.preventDefault();
      const field = event.target;
      if (validationScheduled || !(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
      validationScheduled = true;
      const label = field.labels?.[0]?.textContent?.replace(/\s+/g, " ").replace(/\s*\*\s*$/, "").trim()
        || field.getAttribute("aria-label") || field.name || "Campo del formulario";
      queueMicrotask(() => {
        validationScheduled = false;
        showAlert({
          type: "warning", title: "Revisa los datos del formulario",
          message: `${label}: ${field.validity.valueMissing ? "completa este campo obligatorio." : field.validationMessage || "revisa el valor ingresado."}`,
          confirmText: "Revisar campo",
          onConfirm: () => { requestAnimationFrame(() => { if (field.isConnected) field.focus(); }); },
        });
      });
    }
    function keyboard(event: KeyboardEvent) {
      if (!active || event.key !== "Tab") return;
      const fields = controls(active);
      if (!fields.length) { event.preventDefault(); active.focus(); return; }
      const first = fields[0], last = fields[fields.length - 1];
      if (event.shiftKey && (document.activeElement === first || !active.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !active.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
    function unload(event: BeforeUnloadEvent) {
      if (Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).some(dialog => modified.has(dialog) && dialog.getClientRects().length > 0)) {
        event.preventDefault(); event.returnValue = "";
      }
    }
    const observer = new MutationObserver(observe);
    observer.observe(document.body, { childList: true, subtree: true }); observe();
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("input", input, true);
    document.addEventListener("change", input, true);
    document.addEventListener("click", close, true);
    document.addEventListener("invalid", invalid, true);
    window.addEventListener("beforeunload", unload);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("input", input, true);
      document.removeEventListener("change", input, true);
      document.removeEventListener("click", close, true);
      document.removeEventListener("invalid", invalid, true);
      window.removeEventListener("beforeunload", unload);
    };
  }, [showAlert]);
  return null;
}
