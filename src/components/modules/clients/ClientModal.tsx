"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, IdentificationType, ServiceBillingType } from "@/types";
import {
  validateIdentification,
  validateEmail,
  validatePhoneEcuador,
  validateMonetaryAmount,
} from "@/lib/validation-engine";
import { X, UserPlus, Check } from "lucide-react";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientToEdit?: Client | null;
}

export function ClientModal({ isOpen, onClose, clientToEdit }: ClientModalProps) {
  const { addClient, updateClient, plans, nodes } = useApp();
  const { showError, showSuccess, showWarning } = useToast();

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
  const [sector, setSector] = useState(clientToEdit?.sector || "Quito Norte");
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

    // 1. Validar Identificación con Motor Ecuatoriano
    const idValidation = validateIdentification(identificationType, identificationNumber);
    if (!idValidation.isValid) {
      showError("Validación de Identificación Fallida", idValidation.error || "El número de identificación no es válido.");
      return;
    }

    // 2. Validar Razón Social
    if (!businessName || businessName.trim().length < 3) {
      showError("Razón Social Inválida", "La razón social o nombre debe tener al menos 3 caracteres.");
      return;
    }

    // 3. Validar Email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      showError("Correo Electrónico Inválido", emailValidation.error || "Formato de email no válido.");
      return;
    }

    // 4. Validar Teléfono
    const phoneValidation = validatePhoneEcuador(phone);
    if (!phoneValidation.isValid) {
      showWarning("Advertencia de Teléfono", phoneValidation.error || "Verifica el número telefónico.");
    }

    // 5. Validar Dirección
    if (!address || address.trim().length < 5) {
      showError("Dirección Incompleta", "Por favor ingresa una dirección de instalación detallada (mínimo 5 caracteres).");
      return;
    }

    // 6. Validar Tarifa (si es nuevo)
    if (!clientToEdit) {
      const priceVal = validateMonetaryAmount(customPrice, "Tarifa mensual");
      if (!priceVal.isValid) {
        showError("Tarifa Incorrecta", priceVal.error || "El precio pactado debe ser mayor a cero.");
        return;
      }
    }

    // Guardar
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
      showSuccess("Cliente Actualizado", `Los datos de ${businessName} han sido guardados con éxito.`);
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
      showSuccess("Abonado Registrado", `Nuevo cliente ${businessName} dado de alta con plan y servicio ISP.`);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#eff4ff] text-[#004ac6] flex items-center justify-center shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#0b1c30] text-sm">
                {clientToEdit ? "Editar Abonado / Cliente" : "Alta de Nuevo Abonado & Servicio ISP"}
              </h3>
              <p className="text-[11px] text-[#737686]">Validación de RUC/Cédula y configuración técnica</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-[#eff4ff] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-[#434655] block mb-1">Tipo de Identificación *</label>
              <select
                value={identificationType}
                onChange={(e) => setIdentificationType(e.target.value as IdentificationType)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              >
                <option value="RUC">RUC (13 Dígitos)</option>
                <option value="CEDULA">Cédula (10 Dígitos)</option>
                <option value="PASAPORTE">Pasaporte</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-[#434655] block mb-1">
                Número de Identificación ({identificationType}) *
              </label>
              <input
                type="text"
                required
                placeholder={identificationType === "RUC" ? "1792841092001" : "1718293041"}
                value={identificationNumber}
                onChange={(e) => setIdentificationNumber(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-mono font-bold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[#434655] block mb-1">Razón Social o Nombres Completos *</label>
              <input
                type="text"
                required
                placeholder="DISTRIBUIDORA ANDINA S.A."
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 font-semibold text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>

            <div>
              <label className="font-bold text-[#434655] block mb-1">Representante Legal (opcional)</label>
              <input
                type="text"
                placeholder="Ing. Juan Pérez"
                value={legalRepresentative}
                onChange={(e) => setLegalRepresentative(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-[#434655] block mb-1">Correo Electrónico (Cobranzas) *</label>
              <input
                type="email"
                required
                placeholder="facturacion@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>

            <div>
              <label className="font-bold text-[#434655] block mb-1">Teléfonos de Contacto *</label>
              <input
                type="text"
                required
                placeholder="022548900 / 0998451234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="font-bold text-[#434655] block mb-1">Dirección de Instalación *</label>
              <input
                type="text"
                required
                placeholder="Av. 10 de Agosto N34-12 y Mariana de Jesús"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>

            <div>
              <label className="font-bold text-[#434655] block mb-1">Sector / Zona</label>
              <input
                type="text"
                placeholder="Quito Norte / Valles"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#0b1c30] focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>
          </div>

          {!clientToEdit && (
            <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#dce9ff] space-y-3">
              <h4 className="font-bold text-[#004ac6] text-xs">Asignación Inicial de Plan y Red ISP</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-[#434655] block mb-1">Plan de Internet</label>
                  <select
                    value={planId}
                    onChange={(e) => {
                      const p = plans.find((x) => x.id === e.target.value);
                      setPlanId(e.target.value);
                      if (p) setCustomPrice(p.defaultPrice);
                    }}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs font-semibold text-[#0b1c30]"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.downloadMbps}M)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Precio Pactado ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={customPrice}
                    onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs font-bold text-[#004ac6]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Nodo / POP</label>
                  <select
                    value={nodeId}
                    onChange={(e) => setNodeId(e.target.value)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs font-semibold text-[#0b1c30]"
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

          <div className="flex items-center gap-2 p-3 bg-[#f8f9ff] rounded-lg border border-[#e2e8f0]">
            <input
              type="checkbox"
              id="sriSwitch"
              checked={requiresSriBilling}
              onChange={(e) => setRequiresSriBilling(e.target.checked)}
              className="w-4 h-4 text-[#004ac6] rounded cursor-pointer"
            />
            <label htmlFor="sriSwitch" className="text-xs font-semibold text-[#0b1c30] cursor-pointer">
              Generar Orden de Pedido / Pre-Factura automáticamente el día 1 de cada mes
            </label>
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
              Guardar Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
