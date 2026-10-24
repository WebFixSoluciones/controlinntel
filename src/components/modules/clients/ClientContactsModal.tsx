"use client";

import React, { useState, useEffect } from "react";
import { Client, ClientContactPerson } from "@/types";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Users,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Trash2,
  Edit2,
  Plus,
  X,
  Check,
  User,
  AlertCircle,
} from "lucide-react";

interface ClientContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  onSuccess?: () => void;
}

export function ClientContactsModal({
  isOpen,
  onClose,
  client,
  onSuccess,
}: ClientContactsModalProps) {
  const { updateClient } = useApp();
  const { showSuccess, showError } = useToast();

  const [contacts, setContacts] = useState<ClientContactPerson[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields for adding/editing a contact
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load contacts whenever modal opens or client changes
  useEffect(() => {
    if (isOpen && client) {
      if (client.contacts && client.contacts.length > 0) {
        setContacts(client.contacts);
      } else if (client.contactName && client.contactName.trim()) {
        setContacts([
          {
            id: `ct-${Date.now()}`,
            name: client.contactName,
            role: client.contactRole || "Contacto Principal",
            phone: client.contactPhone || client.phone || "",
            email: client.email || "",
            address: client.contactAddress || client.address || "",
          },
        ]);
      } else {
        setContacts([]);
      }
      resetForm();
    }
  }, [isOpen, client]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setRole("");
    setPhone("");
    setEmail("");
    setAddress("");
  };

  if (!isOpen) return null;

  const handleEditContact = (c: ClientContactPerson) => {
    setEditingId(c.id);
    setName(c.name);
    setRole(c.role || "");
    setPhone(c.phone || "");
    setEmail(c.email || "");
    setAddress(c.address || "");
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    if (editingId === id) resetForm();
  };

  const handleAddOrUpdateContact = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      showError("Nombre Requerido", "Ingresa el nombre de la persona de contacto.");
      return;
    }

    if (editingId) {
      // Update existing
      setContacts((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? {
                ...c,
                name: cleanName,
                role: role.trim() || undefined,
                phone: phone.trim(),
                email: email.trim().toLowerCase() || undefined,
                address: address.trim() || undefined,
              }
            : c
        )
      );
      showSuccess("Contacto Modificado", `Se actualizaron los datos de ${cleanName} en la lista.`);
    } else {
      // Add new
      const newContact: ClientContactPerson = {
        id: `ct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        role: role.trim() || undefined,
        phone: phone.trim(),
        email: email.trim().toLowerCase() || undefined,
        address: address.trim() || undefined,
      };
      setContacts((prev) => [...prev, newContact]);
      showSuccess("Contacto Añadido", `Se agregó a ${cleanName} a la lista de contactos.`);
    }

    resetForm();
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const cleanContacts = contacts.filter((c) => c.name && c.name.trim() !== "");
      const primary = cleanContacts[0];

      await updateClient(client.id, {
        contacts: cleanContacts,
        contactName: primary?.name || "",
        contactRole: primary?.role || "",
        contactPhone: primary?.phone || "",
        contactAddress: primary?.address || "",
      });

      showSuccess(
        "Contactos Guardados",
        `Se guardaron ${cleanContacts.length} persona(s) de contacto para ${client.businessName}.`
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      showError("Error", err?.message || "No se pudieron guardar los contactos.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-blue-50 border border-blue-200/60 text-[#004ac6] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Gestionar Personas de Contacto
              </h3>
              <p className="text-[11px] text-slate-500 truncate max-w-md">
                {client.businessName} • <span className="font-mono">RUC/CI: {client.identificationNumber}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Scrollable */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* 1. Formulario para Agregar / Editar Contacto */}
          <form
            onSubmit={handleAddOrUpdateContact}
            className="p-4.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3.5"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-[#004ac6]" />
                {editingId ? "Editar Persona de Contacto" : "Agregar Persona de Contacto"}
              </span>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Cancelar Edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Nombre Completo */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nombre Completo *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. Ing. Carlos Mendoza"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-[6px] text-xs text-slate-900 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>

              {/* Cargo / Rol */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Cargo / Rol
                </label>
                <div className="relative">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Ej. Administrador / Gerente de TI"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-[6px] text-xs text-slate-900 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>

              {/* Teléfono / WhatsApp */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Teléfono / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="tel"
                    placeholder="Ej. 0991234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-[6px] text-xs text-slate-900 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>

              {/* Correo Electrónico */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="email"
                    placeholder="contacto@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-[6px] text-xs text-slate-900 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>

              {/* Dirección / Ubicación */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Ubicación / Dirección Específica
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Ej. Oficina Matriz, Piso 2, Dpto Sistemas"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-[6px] text-xs text-slate-900 focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{editingId ? "Actualizar en Lista" : "Agregar a la Lista"}</span>
              </button>
            </div>
          </form>

          {/* 2. Lista de Contactos Registrados */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">
                Contactos Registrados ({contacts.length})
              </h4>
              <span className="text-[11px] text-slate-500">
                El primer contacto de la lista se considerará el <strong>Contacto Principal</strong>.
              </span>
            </div>

            {contacts.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                Aún no has agregado personas de contacto para este cliente.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contacts.map((c, idx) => (
                  <div
                    key={c.id}
                    className={`p-3.5 bg-white rounded-xl border transition space-y-2 relative ${
                      editingId === c.id
                        ? "border-[#004ac6] ring-2 ring-[#004ac6]/15 shadow-sm"
                        : "border-slate-200 hover:border-blue-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-xs block truncate">
                          {c.name}
                        </span>
                        <span className="text-[11px] text-[#004ac6] font-semibold block truncate">
                          {c.role || "Sin cargo especificado"}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0">
                        {idx === 0 ? "Principal" : `#${idx + 1}`}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-600 pt-1.5 border-t border-slate-100">
                      {c.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-mono text-slate-700">{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate text-slate-600">{c.email}</span>
                        </div>
                      )}
                      {c.address && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate text-slate-500">{c.address}</span>
                        </div>
                      )}
                    </div>

                    {/* Botones de acción individual */}
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleEditContact(c)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:text-[#004ac6] hover:bg-blue-50 rounded-[4px] transition cursor-pointer"
                        title="Editar datos del contacto"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(c.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 rounded-[4px] transition cursor-pointer"
                        title="Quitar de la lista"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Total contactos: <strong>{contacts.length}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-[6px] border border-slate-300 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAll}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[6px] bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? "Guardando..." : "Guardar Contactos"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
