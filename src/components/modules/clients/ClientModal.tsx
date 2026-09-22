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
import { X, UserPlus, Check, UserCheck, Shield } from "lucide-react";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientToEdit?: Client | null;
}

export function ClientModal({ isOpen, onClose, clientToEdit }: ClientModalProps) {
  const { addClient, updateClient, plans } = useApp();
  const { showError, showSuccess, showWarning } = useToast();

  // Datos Principales
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
  const [sector, setSector] = useState(clientToEdit?.sector || "El Empalme");
  const [requiresSriBilling, setRequiresSriBilling] = useState(
    clientToEdit?.requiresSriBilling ?? true
  );

  // Datos de Contacto de una Persona (Requerido según Observaciones)
  const [contactName, setContactName] = useState(clientToEdit?.contactName || "");
  const [contactRole, setContactRole] = useState(clientToEdit?.contactRole || "");
  const [contactPhone, setContactPhone] = useState(clientToEdit?.contactPhone || "");
  const [contactAddress, setContactAddress] = useState(clientToEdit?.contactAddress || "");

  // Asignación de Servicio Inicial
  const [planId, setPlanId] = useState(plans[0]?.id || "");
  const [customPrice, setCustomPrice] = useState(plans[0]?.defaultPrice || 28.0);
  const [billingType, setBillingType] = useState<ServiceBillingType>("pospago");
  const [cutoffDay, setCutoffDay] = useState(1);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Validar Identificación
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

      // 4. Validar Teléfono (Un solo número)
      const phoneValidation = validatePhoneEcuador(phone.trim());
      if (!phoneValidation.isValid) {
        showWarning("Advertencia de Teléfono", phoneValidation.error || "Ingresa un número telefónico válido (ej. 0989613811).");
      }

      // 5. Validar Dirección
      if (!address || address.trim().length < 4) {
        showError("Dirección Incompleta", "Por favor ingresa la dirección del cliente.");
        return;
      }

      // 6. Validar Tarifa (si es nuevo)
      if (!clientToEdit) {
        const priceVal = validateMonetaryAmount(customPrice, "Tarifa mensual");
        if (!priceVal.isValid) {
          showError("Tarifa Incorrecta", priceVal.error || "El precio pactado debe ser mayor o igual a cero.");
          return;
        }
      }

      if (clientToEdit) {
        await updateClient(clientToEdit.id, {
          identificationType,
          identificationNumber: identificationNumber.trim(),
          businessName: businessName.trim(),
          legalRepresentative: legalRepresentative.trim(),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          sector: sector.trim(),
          requiresSriBilling,
          contactName: contactName.trim(),
          contactRole: contactRole.trim(),
          contactPhone: contactPhone.trim(),
          contactAddress: contactAddress.trim(),
        });
        showSuccess("Cliente Actualizado", `Datos de ${businessName} actualizados con éxito.`);
      } else {
        await addClient(
          {
            identificationType,
            identificationNumber: identificationNumber.trim(),
            businessName: businessName.trim(),
            legalRepresentative: legalRepresentative.trim(),
            email: email.trim(),
            phone: phone.trim(),
            address: address.trim(),
            sector: sector.trim(),
            requiresSriBilling,
            status: "activo",
            totalActiveServices: 1,
            currentBalance: 0,
            contactName: contactName.trim(),
            contactRole: contactRole.trim(),
            contactPhone: contactPhone.trim(),
            contactAddress: contactAddress.trim(),
          },
          {
            planId,
            customPrice: Number(customPrice),
            billingType,
            cutoffDay: Number(cutoffDay),
          }
        );
        showSuccess("Abonado Registrado", `Nuevo cliente ${businessName} registrado con modalidad ${billingType.toUpperCase()}.`);
      }

      onClose();
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("inntel:error", {
          detail: error instanceof Error ? error.message : "No se pudo guardar.",
        })
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[92vh] my-4">
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#eff4ff] text-[#004ac6] flex items-center justify-center shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#0b1c30] text-sm">
                {clientToEdit ? "Editar Abonado / Cliente" : "Alta de Nuevo Abonado"}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-[#eff4ff] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* SECCIÓN 1: DATOS FISCALES DEL ABONADO */}
          <div className="space-y-3">
            <h4 className="font-bold text-[#004ac6] text-xs uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <span>1. Identificación & Datos de la Empresa / Abonado</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Tipo de Identificación *</label>
                <select
                  value={identificationType}
                  onChange={(e) => setIdentificationType(e.target.value as IdentificationType)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
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
                  placeholder={identificationType === "RUC" ? "0922365861001" : "0922365861"}
                  value={identificationNumber}
                  onChange={(e) => setIdentificationNumber(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-mono font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Razón Social o Nombres Completos *</label>
                <input
                  type="text"
                  required
                  placeholder="ARTEAGA MUÑOZ DANNY HERNAN"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Representante Legal (opcional)</label>
                <input
                  type="text"
                  placeholder="Ing. Juan Pérez"
                  value={legalRepresentative}
                  onChange={(e) => setLegalRepresentative(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Correo Electrónico (Cobranzas) *</label>
                <input
                  type="email"
                  required
                  placeholder="mauriciogoncar94@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Teléfono de Contacto *</label>
                <input
                  type="text"
                  required
                  placeholder="0989613811"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="font-bold text-[#434655] block mb-1">Dirección *</label>
                <input
                  type="text"
                  required
                  placeholder="El Empalme"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Sector / Zona</label>
                <input
                  type="text"
                  placeholder="El Empalme"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: DATOS DE PERSONA DE CONTACTO (REQUERIDO OBSERVACIONES PÁGINA 2) */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-[#004ac6] text-xs uppercase tracking-wider border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#004ac6]" />
              <span>2. Datos de Contacto de una Persona</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Nombre de la Persona de Contacto</label>
                <input
                  type="text"
                  placeholder="Ej: Lic. Carlos Mendoza"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Cargo</label>
                <input
                  type="text"
                  placeholder="Ej: Administrador / Jefe de Sistemas"
                  value={contactRole}
                  onChange={(e) => setContactRole(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Teléfono</label>
                <input
                  type="text"
                  placeholder="0990262239"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Dirección</label>
                <input
                  type="text"
                  placeholder="Dirección particular u oficina del contacto"
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: SERVICIO INICIAL & FACTURACIÓN (SIN MBPS, SIN NODO/POP) */}
          {!clientToEdit && (
            <div className="p-4 rounded-2xl bg-[#f8f9ff] border border-[#dce9ff] space-y-3">
              <h4 className="font-bold text-[#004ac6] text-xs flex items-center justify-between">
                <span>3. Asignación Inicial de Servicio Comercial</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-[#434655] block mb-1">Plan / Servicio</label>
                  <select
                    value={planId}
                    onChange={(e) => {
                      const p = plans.find((x) => x.id === e.target.value);
                      setPlanId(e.target.value);
                      if (p) setCustomPrice(p.defaultPrice);
                    }}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  >
                    {plans.length === 0 ? (
                      <option value="">-- Sin plan asignado --</option>
                    ) : (
                      plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Precio Pactado ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={customPrice}
                    onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-bold text-[#004ac6] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Modalidad de Facturación *</label>
                  <select
                    value={billingType}
                    onChange={(e) => setBillingType(e.target.value as ServiceBillingType)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  >
                    <option value="pospago">POSPAGO</option>
                    <option value="prepago">PREPAGO</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-[#e2e8f0]">
            <input
              type="checkbox"
              id="billingSwitch"
              checked={requiresSriBilling}
              onChange={(e) => setRequiresSriBilling(e.target.checked)}
              className="w-4 h-4 text-[#004ac6] rounded cursor-pointer"
            />
            <label htmlFor="billingSwitch" className="text-xs font-semibold text-[#0b1c30] cursor-pointer">
              Generar Orden de Pedido / Pre-Factura automáticamente el día 1 de cada mes
            </label>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#e2e8f0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-[#737686] hover:bg-[#f1f5f9] font-bold cursor-pointer transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Cliente</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
