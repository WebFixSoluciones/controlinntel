"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { ArcotelPolicy } from "@/types";
import { validateDateRange, validateMonetaryAmount } from "@/lib/validation-engine";
import { X, ShieldPlus, Check } from "lucide-react";

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PolicyModal({ isOpen, onClose }: PolicyModalProps) {
  const { addPolicy } = useApp();
  const { showError, showSuccess } = useToast();

  const [policyNumber, setPolicyNumber] = useState("");
  const [insuranceCompany, setInsuranceCompany] = useState("Seguros Sucre / La Unión");
  const [policyType, setPolicyType] = useState<ArcotelPolicy["policyType"]>("fiel_cumplimiento");
  const [titleGrantCode, setTitleGrantCode] = useState("ARCOTEL-TH-ISP-2018-094");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [expirationDate, setExpirationDate] = useState("2027-09-01");
  const [insuredAmount, setInsuredAmount] = useState(25000);
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
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

    const amountVal = validateMonetaryAmount(insuredAmount, "Monto asegurado");
    if (!amountVal.isValid) {
      showError("Monto Inválido", amountVal.error || "El monto asegurado debe ser mayor a cero.");
      return;
    }

    const exp = new Date(expirationDate);
    const now = new Date();
    const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const status = days < 0 ? "vencida" : days <= 45 ? "por_vencer" : "vigente";

    addPolicy({
      policyNumber,
      insuranceCompany,
      policyType,
      titleGrantCode,
      startDate,
      expirationDate,
      insuredAmount: Number(insuredAmount),
      status,
      daysUntilExpiration: days,
      notes,
    });

    showSuccess("Póliza Registrada", `Póliza ${policyNumber} guardada en el registro regulatorio ARCOTEL.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#eff4ff] text-[#004ac6] flex items-center justify-center shadow-xs">
              <ShieldPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#0b1c30] text-sm">Registrar Póliza ARCOTEL</h3>
              <p className="text-[11px] text-[#737686]">Póliza de fiel cumplimiento o responsabilidad civil</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-[#eff4ff] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="font-bold text-[#434655] block mb-1">Número de Póliza *</label>
            <input
              type="text"
              required
              placeholder="POL-2026-99482"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-mono font-bold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[#434655] block mb-1">Aseguradora *</label>
              <input
                type="text"
                required
                placeholder="Chubb Seguros / Seguros Alianza"
                value={insuranceCompany}
                onChange={(e) => setInsuranceCompany(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
              />
            </div>

            <div>
              <label className="font-bold text-[#434655] block mb-1">Tipo de Cobertura</label>
              <select
                value={policyType}
                onChange={(e) => setPolicyType(e.target.value as any)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30]"
              >
                <option value="fiel_cumplimiento">Fiel Cumplimiento de Título</option>
                <option value="responsabilidad_civil">Responsabilidad Civil</option>
                <option value="buen_uso_anticipo">Buen Uso de Anticipo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[#434655] block mb-1">Monto Asegurado ($ USD) *</label>
              <input
                type="number"
                required
                value={insuredAmount}
                onChange={(e) => setInsuredAmount(Number(e.target.value))}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-bold text-[#004ac6]"
              />
            </div>

            <div>
              <label className="font-bold text-[#434655] block mb-1">Fecha de Expiración *</label>
              <input
                type="date"
                required
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-bold text-[#0b1c30]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-[#434655] block mb-1">Notas u Observaciones</label>
            <textarea
              rows={2}
              placeholder="Endoso número 3 remitido por QUIPUX..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#e2e8f0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[#737686] hover:bg-[#f1f5f9] font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
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
