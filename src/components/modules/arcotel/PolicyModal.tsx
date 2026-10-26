"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { ArcotelPolicy } from "@/types";
import { validateDateRange, validateMonetaryAmount } from "@/lib/validation-engine";
import { getEcuadorDate, diffInCalendarDays } from "@/lib/date-utils";
import { X, ShieldPlus, Check } from "lucide-react";

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PolicyModal({ isOpen, onClose }: PolicyModalProps) {
  const { addPolicy } = useApp();
  const { showError, showSuccess } = useToast();

  const [policyNumber, setPolicyNumber] = useState("");
  const [insuranceCompany, setInsuranceCompany] = useState("");
  const [policyType, setPolicyType] = useState<ArcotelPolicy["policyType"]>("fiel_cumplimiento");
  const [titleGrantCode, setTitleGrantCode] = useState("");
  const [startDate, setStartDate] = useState(getEcuadorDate());
  const [expirationDate, setExpirationDate] = useState("");
  const [insuredAmount, setInsuredAmount] = useState<number | "">("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault();

      if (!policyNumber || policyNumber.trim().length < 4) {
        showError("Número de Póliza Inválido", "Por favor ingresa un número de póliza válido (ej. POL-2026-99482).");
        return;
      }

      if (!insuranceCompany || insuranceCompany.trim().length < 3) {
        showError("Aseguradora Requerida", "Indica la compañía de seguros emisora de la garantía.");
        return;
      }

      const dateVal = validateDateRange(startDate, expirationDate);
      if (!dateVal.isValid) {
        showError("Fechas Inválidas", dateVal.error || "La fecha de vencimiento no es coherente.");
        return;
      }

      const numAmount = Number(insuredAmount) || 0;
      const amountVal = validateMonetaryAmount(numAmount, "Monto asegurado");
      if (!amountVal.isValid) {
        showError("Monto Inválido", amountVal.error || "El monto asegurado debe ser mayor a cero.");
        return;
      }

      const days = diffInCalendarDays(getEcuadorDate(), expirationDate);
      const status = days < 0 ? "vencida" : days <= 30 ? "por_vencer" : "vigente";

      await addPolicy({
        policyNumber: policyNumber.trim(),
        insuranceCompany: insuranceCompany.trim(),
        policyType,
        titleGrantCode: titleGrantCode.trim(),
        startDate,
        expirationDate,
        insuredAmount: numAmount,
        status,
        daysUntilExpiration: days,
      });

      showSuccess("Póliza Registrada", `Póliza ${policyNumber} guardada en el registro regulatorio ARCOTEL.`);
      onClose();
    } catch (error) {
      window.dispatchEvent(new CustomEvent("inntel:error", { detail: error instanceof Error ? error.message : "No se pudo guardar." }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-[#e2e8f0] overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-[#004ac6] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 text-white flex items-center justify-center shadow-xs">
              <ShieldPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Registrar Póliza ARCOTEL</h3>
              <p className="text-xs text-blue-100">Garantías y títulos habilitantes de telecomunicaciones</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="font-bold text-[#434655] block mb-1">Número de Póliza *</label>
            <input
              type="text"
              required
              placeholder="POL-2026-99482"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              className="w-full bg-slate-50 border border-[#cbd5e1] rounded-lg px-3 py-2 font-mono font-bold text-[#0b1c30] focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#434655] block mb-1">Aseguradora *</label>
              <input
                type="text"
                required
                placeholder="Chubb Seguros / Seguros Alianza"
                value={insuranceCompany}
                onChange={(e) => setInsuranceCompany(e.target.value)}
                className="w-full bg-slate-50 border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30] focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div>
              <label className="font-bold text-[#434655] block mb-1">Tipo de Cobertura</label>
              <select
                value={policyType}
                onChange={(e) => setPolicyType(e.target.value as any)}
                className="w-full bg-slate-50 border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30] focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden cursor-pointer"
              >
                <option value="fiel_cumplimiento">Fiel Cumplimiento de Título</option>
                <option value="responsabilidad_civil">Responsabilidad Civil</option>
                <option value="buen_uso_anticipo">Buen Uso de Anticipo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#434655] block mb-1">Monto Asegurado ($ USD) *</label>
              <input
                type="number"
                required
                placeholder="25000"
                value={insuredAmount}
                onChange={(e) => setInsuredAmount(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full bg-slate-50 border border-[#cbd5e1] rounded-lg px-3 py-2 font-bold text-[#004ac6] focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>

            <div>
              <label className="font-bold text-[#434655] block mb-1">Fecha de Expiración *</label>
              <input
                type="date"
                required
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full bg-slate-50 border border-[#cbd5e1] rounded-lg px-3 py-2 font-bold text-[#0b1c30] focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#e2e8f0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[#737686] hover:bg-[#f1f5f9] font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Check className="w-4 h-4" />
              Guardar Póliza
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
