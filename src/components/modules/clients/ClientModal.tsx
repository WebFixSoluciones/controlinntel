"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Client, ClientContactPerson, IdentificationType, ServiceBillingType } from "@/types";
import {
  validateIdentification,
  validateEmail,
  validatePhoneEcuador,
  validateMonetaryAmount,
} from "@/lib/validation-engine";
import { X, UserPlus, Check, UserCheck, Shield, Plus, Trash2, Edit2, Phone, Mail, MapPin } from "lucide-react";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientToEdit?: Client | null;
}

export function ClientModal({ isOpen, onClose, clientToEdit }: ClientModalProps) {
  const { addClient, updateClient, plans } = useApp();
  const { showError, showSuccess, showWarning } = useToast();

  // Datos Principales
  const [identificationType, setIdentificationType] = useState<IdentificationType>("RUC");
  const [identificationNumber, setIdentificationNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [legalRepresentative, setLegalRepresentative] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [sector, setSector] = useState("");
  const [status, setStatus] = useState<Client["status"]>("activo");
  const [requiresSriBilling, setRequiresSriBilling] = useState(true);

  // Múltiples Personas de Contacto
  const [contacts, setContacts] = useState<ClientContactPerson[]>([]);

  // Asignación de Servicio Inicial
  const [planId, setPlanId] = useState(plans[0]?.id || "");
  const [customPrice, setCustomPrice] = useState(plans[0]?.defaultPrice || 28.0);
  const [billingType, setBillingType] = useState<ServiceBillingType>("pospago");
  const [cutoffDay, setCutoffDay] = useState(1);
  const [busy, setBusy] = useState(false);

  // Sincronizar y extraer los datos guardados del cliente cada vez que cambie o se abra el modal
  useEffect(() => {
    if (clientToEdit) {
      setIdentificationType(clientToEdit.identificationType || "RUC");
      setIdentificationNumber(clientToEdit.identificationNumber || "");
      setBusinessName(clientToEdit.businessName || "");
      setLegalRepresentative(clientToEdit.legalRepresentative || "");
      setEmail(clientToEdit.email || "");
      setPhone(clientToEdit.phone || "");
      setAddress(clientToEdit.address || "");
      setSector(clientToEdit.sector || "");
      setStatus(clientToEdit.status || "activo");
      setRequiresSriBilling(clientToEdit.requiresSriBilling ?? true);

      // Cargar contactos existentes
      if (clientToEdit.contacts && clientToEdit.contacts.length > 0) {
        setContacts(clientToEdit.contacts);
      } else if (clientToEdit.contactName && clientToEdit.contactName.trim()) {
        setContacts([
          {
            id: `ct-${Date.now()}`,
            name: clientToEdit.contactName,
            role: clientToEdit.contactRole || "",
            phone: clientToEdit.contactPhone || clientToEdit.phone || "",
            email: "",
            address: clientToEdit.contactAddress || "",
          },
        ]);
      } else {
        setContacts([]);
      }
    } else {
      // Valores iniciales limpios al crear un nuevo cliente
      setIdentificationType("RUC");
      setIdentificationNumber("");
      setBusinessName("");
      setLegalRepresentative("");
      setEmail("");
      setPhone("");
      setAddress("");
      setSector("");
      setStatus("activo");
      setRequiresSriBilling(true);
      setContacts([]);
      setPlanId(plans[0]?.id || "");
      setCustomPrice(plans[0]?.defaultPrice || 28.0);
      setBillingType("pospago");
      setCutoffDay(1);
    }
  }, [clientToEdit, isOpen, plans]);

  if (!isOpen) return null;

  const handleAddContact = () => {
    const newContact: ClientContactPerson = {
      id: `ct-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: "",
      role: "",
      phone: "",
      email: "",
      address: "",
    };
    setContacts((prev) => [...prev, newContact]);
  };

  const handleUpdateContact = (id: string, field: keyof ClientContactPerson, value: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleRemoveContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);

      // 1. Validar Identificación
      const idValidation = validateIdentification(identificationType, identificationNumber);
      if (!idValidation.isValid) {
        showError("Validación de Identificación Fallida", idValidation.error || "El número de identificación no es válido.");
        setBusy(false);
        return;
      }

      // 2. Validar Razón Social
      if (!businessName || businessName.trim().length < 3) {
        showError("Razón Social Inválida", "La razón social o nombre debe tener al menos 3 caracteres.");
        setBusy(false);
        return;
      }

      // 3. Validar Email
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        showError("Correo Electrónico Inválido", emailValidation.error || "Formato de email no válido.");
        setBusy(false);
        return;
      }

      // 4. Validar Teléfono (permite múltiples números separados por /, -, o comas)
      const phoneClean = phone.trim();
      if (phoneClean) {
        const phoneParts = phoneClean.split(/[\/,;\-]+/).map((p) => p.trim()).filter(Boolean);
        const hasAtLeastOneValid = phoneParts.some((p) => {
          const digits = p.replace(/\D/g, "");
          return digits.length >= 7 && digits.length <= 15;
        });
        if (!hasAtLeastOneValid && phoneClean.replace(/\D/g, "").length < 7) {
          showWarning("Advertencia de Teléfono", "Ingresa al menos un número telefónico válido (ej. 0989613811 o 022456789).");
        }
      }

      // 5. Validar Dirección
      if (!address || address.trim().length < 4) {
        showError("Dirección Incompleta", "Por favor ingresa la dirección del cliente.");
        setBusy(false);
        return;
      }

      // 6. Validar Tarifa (si es nuevo)
      if (!clientToEdit) {
        const priceVal = validateMonetaryAmount(customPrice, "Tarifa mensual");
        if (!priceVal.isValid) {
          showError("Tarifa Incorrecta", priceVal.error || "El precio pactado debe ser mayor o igual a cero.");
          setBusy(false);
          return;
        }
      }

      // Preparar lista depurada de contactos
      const cleanContacts = contacts
        .filter((c) => c.name.trim() !== "")
        .map((c) => ({
          ...c,
          name: c.name.trim(),
          role: c.role?.trim() || "",
          phone: c.phone.trim(),
          email: c.email?.trim() || "",
          address: c.address?.trim() || "",
        }));

      const primaryContact = cleanContacts[0];

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
          status,
          requiresSriBilling,
          contactName: primaryContact?.name || "",
          contactRole: primaryContact?.role || "",
          contactPhone: primaryContact?.phone || "",
          contactAddress: primaryContact?.address || "",
          contacts: cleanContacts,
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
            status,
            totalActiveServices: 1,
            currentBalance: 0,
            contactName: primaryContact?.name || "",
            contactRole: primaryContact?.role || "",
            contactPhone: primaryContact?.phone || "",
            contactAddress: primaryContact?.address || "",
            contacts: cleanContacts,
          },
          {
            planId,
            customPrice: Number(customPrice),
            billingType,
            cutoffDay: Number(cutoffDay),
          }
        );
        showSuccess("Cliente Registrado", `Nuevo cliente ${businessName} registrado con modalidad ${billingType.toUpperCase()}.`);
      }

      onClose();
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("inntel:error", {
          detail: error instanceof Error ? error.message : "No se pudo guardar.",
        })
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-4xl bg-white rounded-[6px] shadow-lumina-dropdown border border-[#e2e8f0] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 px-6 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[#eff4ff] text-[#004ac6] flex items-center justify-center shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#0b1c30] text-sm md:text-base">
                {clientToEdit ? `Editar Ficha de Cliente: ${clientToEdit.businessName}` : "Registrar Nuevo Cliente"}
              </h3>
              <p className="text-[11px] text-[#737686]">
                {clientToEdit
                  ? "Modifica los datos guardados del cliente y gestiona sus personas de contacto"
                  : "Ingreso al catálogo centralizado cumpliendo normas ARCOTEL y SRI"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-[#737686] hover:text-[#0b1c30] hover:bg-white border border-transparent hover:border-slate-200 cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto text-xs">
          {/* SECCIÓN 1: DATOS FISCALES & UBICACIÓN */}
          <div className="space-y-4">
            <h4 className="font-bold text-[#004ac6] text-xs uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-[#004ac6]" />
              <span>1. Identificación Tributaria & Ubicación</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Tipo de Identificación *</label>
                <select
                  value={identificationType}
                  onChange={(e) => setIdentificationType(e.target.value as IdentificationType)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
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
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 font-mono font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
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
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Representante Legal (opcional)</label>
                <input
                  type="text"
                  placeholder="Ing. Juan Pérez"
                  value={legalRepresentative}
                  onChange={(e) => setLegalRepresentative(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
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
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Teléfono Principal de Contacto *</label>
                <input
                  type="text"
                  required
                  placeholder="0989613811"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-[#434655] block mb-1">Dirección *</label>
                <input
                  type="text"
                  required
                  placeholder="Av. Amazonas y Gaspar de Villarroel"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Sector / Zona</label>
                <input
                  type="text"
                  placeholder="Sector / Parroquia"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                />
              </div>

              <div>
                <label className="font-bold text-[#434655] block mb-1">Estado de Vigencia *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Client["status"])}
                  className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="suspendido">Suspendido</option>
                  <option value="retirado">Retirado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: PERSONAS DE CONTACTO (MÚLTIPLES CONTACTOS POR CLIENTE) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="font-bold text-[#004ac6] text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#004ac6]" />
                  <span>2. Personas de Contacto del Cliente</span>
                </h4>
                <p className="text-[11px] text-[#737686] mt-0.5">
                  El cliente puede tener múltiples contactos (Administrador, Pagos, Soporte Técnico, etc.)
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddContact}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eff4ff] hover:bg-[#dbeafe] text-[#004ac6] rounded-[6px] text-xs font-bold transition border border-[#bfdbfe] cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Contacto</span>
              </button>
            </div>

            {contacts.length === 0 ? (
              <div className="p-5 rounded-[6px] bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
                <p className="text-xs text-slate-600 font-semibold">
                  No hay personas de contacto registradas aún.
                </p>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  Agrega una o más personas de contacto para mantener actualizados los responsables de administración, pagos y soporte técnico.
                </p>
                <button
                  type="button"
                  onClick={handleAddContact}
                  className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-[6px] text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Primera Persona de Contacto</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact, index) => (
                  <div
                    key={contact.id}
                    className="p-4 bg-slate-50/90 rounded-[6px] border border-slate-200 space-y-3 relative transition hover:border-[#bfdbfe]"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#004ac6] text-white flex items-center justify-center text-[10px] font-bold">
                          {index + 1}
                        </span>
                        <span className="font-bold text-xs text-slate-800">
                          {contact.name || `Contacto #${index + 1}`}
                        </span>
                        {contact.role && (
                          <span className="text-[10px] text-[#004ac6] bg-blue-50 px-2 py-0.5 rounded-[4px] font-semibold border border-blue-200">
                            {contact.role}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(contact.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-[6px] transition cursor-pointer"
                        title="Eliminar este contacto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-[#434655] block mb-1">
                          Nombre Completo de la Persona *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Lic. Carlos Mendoza"
                          value={contact.name}
                          onChange={(e) => handleUpdateContact(contact.id, "name", e.target.value)}
                          className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-[#0b1c30] font-semibold focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-[#434655] block mb-1">
                          Cargo / Función en la Empresa
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Administrador, Pagos, Jefe de Sistemas"
                          value={contact.role || ""}
                          onChange={(e) => handleUpdateContact(contact.id, "role", e.target.value)}
                          className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-[#434655] block mb-1">
                          Teléfono / WhatsApp *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="0990262239"
                          value={contact.phone}
                          onChange={(e) => handleUpdateContact(contact.id, "phone", e.target.value)}
                          className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-[#0b1c30] font-mono focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-[#434655] block mb-1">
                          Correo Electrónico (opcional)
                        </label>
                        <input
                          type="email"
                          placeholder="carlos.mendoza@empresa.com"
                          value={contact.email || ""}
                          onChange={(e) => handleUpdateContact(contact.id, "email", e.target.value)}
                          className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-[#434655] block mb-1">
                          Dirección Particular u Oficina (opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Oficina 402, Torre B"
                          value={contact.address || ""}
                          onChange={(e) => handleUpdateContact(contact.id, "address", e.target.value)}
                          className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECCIÓN 3: SERVICIO INICIAL & FACTURACIÓN (SOLO AL CREAR NUEVO CLIENTE) */}
          {!clientToEdit && (
            <div className="p-4 rounded-[6px] bg-[#f8f9ff] border border-[#dce9ff] space-y-3">
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
                    className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-xs font-semibold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
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
                    className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-xs font-bold text-[#004ac6] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#434655] block mb-1">Modalidad de Facturación *</label>
                  <select
                    value={billingType}
                    onChange={(e) => setBillingType(e.target.value as ServiceBillingType)}
                    className="w-full bg-white border border-[#cbd5e1] rounded-[6px] px-3 py-2 text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#004ac6] focus:border-transparent"
                  >
                    <option value="pospago">POSPAGO</option>
                    <option value="prepago">PREPAGO</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-white rounded-[6px] border border-[#e2e8f0]">
            <input
              type="checkbox"
              id="billingSwitch"
              checked={requiresSriBilling}
              onChange={(e) => setRequiresSriBilling(e.target.checked)}
              className="w-4 h-4 text-[#004ac6] rounded-[4px] cursor-pointer"
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
              disabled={busy}
              className="px-4 py-2.5 rounded-[6px] text-[#737686] hover:bg-[#f1f5f9] font-bold cursor-pointer transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-[6px] font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>{busy ? "Guardando..." : clientToEdit ? "Guardar Cambios de Ficha" : "Registrar Cliente"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
