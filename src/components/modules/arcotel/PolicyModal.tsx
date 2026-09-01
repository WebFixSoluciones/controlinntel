"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { ArcotelPolicy } from "@/types";
import { X, ShieldPlus, Check } from "lucide-react";

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PolicyModal({ isOpen, onClose }: PolicyModalProps) {
  const { addPolicy } = useApp();

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
    if (!policyNumber || !insuranceCompany) {
      alert("Completa los campos obligatorios");
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

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <ShieldPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Registrar Póliza ARCOTEL</h3>
              <p className="text-[11px] text-slate-400">Póliza de fiel cumplimiento o responsabilidad civil</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Número de Póliza *</label>
            <input
              type="text"
              required
              placeholder="POL-2026-99482"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Aseguradora *</label>
              <input
                type="text"
                required
                placeholder="Chubb Seguros / Seguros Alianza"
                value={insuranceCompany}
                onChange={(e) => setInsuranceCompany(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Tipo de Cobertura</label>
              <select
                value={policyType}
                onChange={(e) => setPolicyType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
              >
                <option value="fiel_cumplimiento">Fiel Cumplimiento de Título</option>
                <option value="responsabilidad_civil">Responsabilidad Civil</option>
                <option value="buen_uso_anticipo">Buen Uso de Anticipo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Monto Asegurado ($ USD) *</label>
              <input
                type="number"
                required
                value={insuredAmount}
                onChange={(e) => setInsuredAmount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-emerald-700"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Fecha de Expiración *</label>
              <input
                type="date"
                required
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Notas u Observaciones</label>
            <textarea
              rows={2}
              placeholder="Endoso número 3 remitido por QUIPUX..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
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
