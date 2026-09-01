"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { Client, IdentificationType, ServiceBillingType } from "@/types";
import { X, UserPlus, Check } from "lucide-react";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientToEdit?: Client | null;
}

export function ClientModal({ isOpen, onClose, clientToEdit }: ClientModalProps) {
  const { addClient, updateClient, plans, nodes } = useApp();

  const [identificationType, setIdentificationType] = useState<IdentificationType>(
    clientToEdit?.identificationType || "RUC"
  );
  const [identificationNumber, setIdentificationNumber] = useState(
    clientToEdit?.identificationNumber || ""
  );
  const [businessName, setBusinessName] = useState(clientToEdit?.businessName || "");
  const [legalRepresentative, setLegalRepresentative] = useState(
    clientToEdit?.legalRepresentative || ""
  );
  const [email, setEmail] = useState(clientToEdit?.email || "");
  const [phone, setPhone] = useState(clientToEdit?.phone || "");
  const [address, setAddress] = useState(clientToEdit?.address || "");
  const [sector, setSector] = useState(clientToEdit?.sector || "Norte");
  const [requiresSriBilling, setRequiresSriBilling] = useState(
    clientToEdit?.requiresSriBilling ?? true
  );

  const [planId, setPlanId] = useState(plans[1]?.id || plans[0]?.id);
  const [customPrice, setCustomPrice] = useState(28.0);
  const [billingType, setBillingType] = useState<ServiceBillingType>("pospago");
  const [cutoffDay, setCutoffDay] = useState(1);
  const [nodeId, setNodeId] = useState(nodes[0]?.id);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !identificationNumber || !phone) {
      alert("Por favor completa los campos requeridos.");
      return;
    }

    if (clientToEdit) {
      updateClient(clientToEdit.id, {
        identificationType,
        identificationNumber,
        businessName,
        legalRepresentative,
        email,
        phone,
        address,
        sector,
        requiresSriBilling,
      });
    } else {
      addClient(
        {
          identificationType,
          identificationNumber,
          businessName,
          legalRepresentative,
          email,
          phone,
          address,
          sector,
          requiresSriBilling,
          status: "activo",
          totalActiveServices: 1,
          currentBalance: 0,
        },
        {
          planId,
          customPrice: Number(customPrice),
          billingType,
          cutoffDay: Number(cutoffDay),
          nodeId,
        }
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {clientToEdit ? "Editar Cliente" : "Alta de Nuevo Cliente & Servicio"}
              </h3>
              <p className="text-[11px] text-slate-400">Datos fiscales SRI y configuración de conectividad ISP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Tipo de Identificación *</label>
              <select
                value={identificationType}
                onChange={(e) => setIdentificationType(e.target.value as IdentificationType)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800"
              >
                <option value="RUC">RUC</option>
                <option value="CEDULA">Cédula</option>
                <option value="PASAPORTE">Pasaporte</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Número de Identificación (RUC/CI) *</label>
              <input
                type="text"
                required
                placeholder="1792841092001"
                value={identificationNumber}
                onChange={(e) => setIdentificationNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Razón Social o Nombres Completos *</label>
              <input
                type="text"
                required
                placeholder="DISTRIBUIDORA ANDINA S.A."
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Representante Legal (opcional)</label>
              <input
                type="text"
                placeholder="Ing. Juan Pérez"
                value={legalRepresentative}
                onChange={(e) => setLegalRepresentative(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Correo Electrónico *</label>
              <input
                type="email"
                required
                placeholder="facturacion@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Teléfonos de Contacto *</label>
              <input
                type="text"
                required
                placeholder="022548900 / 0998451234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Dirección de Instalación *</label>
            <input
              type="text"
              required
              placeholder="Av. 10 de Agosto N34-12 y Mariana de Jesús"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
            />
          </div>

          {!clientToEdit && (
            <div className="p-4 rounded-xl bg-sky-50/50 border border-sky-100 space-y-3">
              <h4 className="font-bold text-sky-900 text-xs">Asignación Inicial de Plan y Red ISP</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Plan de Internet</label>
                  <select
                    value={planId}
                    onChange={(e) => {
                      const p = plans.find((x) => x.id === e.target.value);
                      setPlanId(e.target.value);
                      if (p) setCustomPrice(p.defaultPrice);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.downloadMbps}M)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Precio Pactado ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={customPrice}
                    onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nodo / POP</label>
                  <select
                    value={nodeId}
                    onChange={(e) => setNodeId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              id="sriSwitch"
              checked={requiresSriBilling}
              onChange={(e) => setRequiresSriBilling(e.target.checked)}
              className="w-4 h-4 text-sky-600 rounded cursor-pointer"
            />
            <label htmlFor="sriSwitch" className="text-xs font-bold text-slate-800 cursor-pointer">
              Generar Lote de Facturación Electrónica SRI automáticamente el día 1 de cada mes
            </label>
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
              Guardar Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
