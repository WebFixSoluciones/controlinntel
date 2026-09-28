"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  CheckCircle,
  X,
  Clock,
  Filter,
} from "lucide-react";
import { Supplier, SupplierCategory } from "@/types";

export function SuppliersManager() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("todas");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form State
  const [ruc, setRuc] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [nombreComercial, setNombreComercial] = useState("");
  const [category, setCategory] = useState<SupplierCategory>("fibra_optica");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Quito");
  const [creditDaysDefault, setCreditDaysDefault] = useState<number>(30);
  const [bankName, setBankName] = useState("Banco Pichincha");
  const [bankAccountType, setBankAccountType] = useState<"corriente" | "ahorros">("corriente");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountOwner, setBankAccountOwner] = useState("");
  const [notes, setNotes] = useState("");

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setRuc(supplier.ruc);
      setRazonSocial(supplier.razonSocial);
      setNombreComercial(supplier.nombreComercial || "");
      setCategory(supplier.category);
      setEmail(supplier.email);
      setPhone(supplier.phone);
      setAddress(supplier.address);
      setCity(supplier.city || "Quito");
      setCreditDaysDefault(supplier.creditDaysDefault || 0);
      setBankName(supplier.bankName || "Banco Pichincha");
      setBankAccountType(supplier.bankAccountType || "corriente");
      setBankAccountNumber(supplier.bankAccountNumber || "");
      setBankAccountOwner(supplier.bankAccountOwner || "");
      setNotes(supplier.notes || "");
    } else {
      setEditingSupplier(null);
      setRuc("");
      setRazonSocial("");
      setNombreComercial("");
      setCategory("fibra_optica");
      setEmail("");
      setPhone("");
      setAddress("");
      setCity("Quito");
      setCreditDaysDefault(30);
      setBankName("Banco Pichincha");
      setBankAccountType("corriente");
      setBankAccountNumber("");
      setBankAccountOwner("");
      setNotes("");
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ruc.trim() || ruc.trim().length < 10) {
      showError("RUC Inválido", "Ingresa un número de RUC de 13 dígitos o cédula válida.");
      return;
    }
    if (!razonSocial.trim()) {
      showError("Razón Social Requerida", "Ingresa la razón social del proveedor.");
      return;
    }

    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          ruc: ruc.trim(),
          razonSocial: razonSocial.trim(),
          nombreComercial: nombreComercial.trim() || undefined,
          category,
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          creditDaysDefault: Number(creditDaysDefault) || 0,
          bankName: bankName.trim() || undefined,
          bankAccountType,
          bankAccountNumber: bankAccountNumber.trim() || undefined,
          bankAccountOwner: bankAccountOwner.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        showSuccess("Proveedor Actualizado", `Datos de ${razonSocial} modificados con éxito.`);
      } else {
        await addSupplier({
          ruc: ruc.trim(),
          razonSocial: razonSocial.trim(),
          nombreComercial: nombreComercial.trim() || undefined,
          category,
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          creditDaysDefault: Number(creditDaysDefault) || 0,
          bankName: bankName.trim() || undefined,
          bankAccountType,
          bankAccountNumber: bankAccountNumber.trim() || undefined,
          bankAccountOwner: bankAccountOwner.trim() || undefined,
          notes: notes.trim() || undefined,
          status: "activo",
        });
        showSuccess("Proveedor Creado", `Proveedor ${razonSocial} incorporado al directorio.`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo guardar el proveedor.");
    }
  };

  const handleDelete = (s: Supplier) => {
    showConfirm(
      "Eliminar Proveedor",
      `¿Estás seguro de eliminar a ${s.razonSocial}? No afectará las compras ya emitidas.`,
      async () => {
        try {
          await deleteSupplier(s.id);
          showSuccess("Eliminado", `Proveedor ${s.razonSocial} eliminado.`);
        } catch (err: any) {
          showError("Error al Eliminar", err?.message || "No se pudo eliminar.");
        }
      }
    );
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      s.razonSocial.toLowerCase().includes(q) ||
      (s.nombreComercial && s.nombreComercial.toLowerCase().includes(q)) ||
      s.ruc.includes(q) ||
      s.city?.toLowerCase().includes(q);

    const matchCat = filterCategory === "todas" || s.category === filterCategory;

    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-6 select-none">
      {/* Unified Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por RUC, razón social o ciudad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
          >
            <option value="todas">Todas las Categorías</option>
            <option value="fibra_optica">Fibra Óptica & Pasivos</option>
            <option value="equipos_networking">Equipos Networking & ONTs</option>
            <option value="transito_ip">Tránsito IP & Upstream</option>
            <option value="ferreteria_infraestructura">Ferretería & Postería</option>
            <option value="servicios_profesionales">Servicios Profesionales</option>
            <option value="general">General / Varios</option>
          </select>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Proveedor</span>
          </button>
        </div>
      </div>

      {/* Grid of Suppliers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((supplier) => (
          <div
            key={supplier.id}
            className="p-5 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eff4ff] text-[#004ac6] border border-[#bfdbfe] capitalize">
                    {supplier.category.replace(/_/g, " ")}
                  </span>
                  <h3 className="mt-2 text-sm font-bold text-[#0b1c30] leading-snug">
                    {supplier.razonSocial}
                  </h3>
                  {supplier.nombreComercial && (
                    <p className="text-xs text-[#737686] font-medium">{supplier.nombreComercial}</p>
                  )}
                  <p className="text-xs font-mono text-[#004ac6] mt-1 font-semibold">
                    RUC: {supplier.ruc}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenModal(supplier)}
                    className="p-1.5 text-[#737686] hover:text-[#004ac6] hover:bg-[#eff4ff] rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(supplier)}
                    className="p-1.5 text-[#737686] hover:text-[#ef4444] hover:bg-[#fef2f2] rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Contact info */}
              <div className="mt-4 pt-3 border-t border-[#f1f5f9] space-y-1.5 text-xs text-[#434655]">
                {supplier.email && (
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-[#737686] shrink-0" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#737686] shrink-0" />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-2 truncate">
                    <MapPin className="w-3.5 h-3.5 text-[#737686] shrink-0" />
                    <span className="truncate">{supplier.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Commercial terms & bank info */}
            <div className="mt-4 pt-3 border-t border-[#e2e8f0] bg-[#f8f9ff] -mx-5 -mb-5 p-4 rounded-b-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-[#434655]">
                <Clock className="w-3.5 h-3.5 text-[#004ac6]" />
                <span>
                  {supplier.creditDaysDefault > 0
                    ? `${supplier.creditDaysDefault} días de crédito`
                    : "Contado inmediato"}
                </span>
              </div>

              {supplier.bankAccountNumber ? (
                <div className="text-[11px] font-mono text-[#004ac6] font-semibold truncate max-w-[140px]" title={`${supplier.bankName}: ${supplier.bankAccountNumber}`}>
                  {supplier.bankName}: {supplier.bankAccountNumber}
                </div>
              ) : (
                <span className="text-[11px] text-[#94a3b8]">Sin cuenta reg.</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Crear / Editar Proveedor */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  {editingSupplier ? "Editar Proveedor" : "Registrar Nuevo Proveedor"}
                </h3>
                <p className="text-xs text-[#737686]">
                  Información fiscal, contactos y datos bancarios para pagos
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    RUC / Identificación Fiscal *
                  </label>
                  <input
                    type="text"
                    placeholder="1792189421001"
                    value={ruc}
                    onChange={(e) => setRuc(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg font-mono font-medium text-[#0b1c30]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Categoría de Proveedor *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                  >
                    <option value="fibra_optica">Fibra Óptica & Pasivos</option>
                    <option value="equipos_networking">Equipos Networking & ONTs</option>
                    <option value="transito_ip">Tránsito IP & Upstream</option>
                    <option value="ferreteria_infraestructura">Ferretería & Postería</option>
                    <option value="servicios_profesionales">Servicios Profesionales</option>
                    <option value="arriendo_espacio_nodo">Arriendo de Espacio / Nodo</option>
                    <option value="general">General / Varios</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    placeholder="ej. FIBERLUX ECUADOR S.A."
                    value={razonSocial}
                    onChange={(e) => setRazonSocial(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-[#0b1c30] font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Nombre Comercial
                  </label>
                  <input
                    type="text"
                    placeholder="ej. FIBERLUX"
                    value={nombreComercial}
                    onChange={(e) => setNombreComercial(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-[#0b1c30]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Email de Contacto</label>
                  <input
                    type="email"
                    placeholder="ventas@proveedor.ec"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Teléfono</label>
                  <input
                    type="text"
                    placeholder="+593 2 394 5000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Ciudad</label>
                  <input
                    type="text"
                    placeholder="Quito, Guayaquil, etc."
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Dirección Matriz</label>
                <input
                  type="text"
                  placeholder="Av. Principal N° 123 y Secundaria"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg"
                />
              </div>

              {/* Commercial and Banking */}
              <div className="p-4 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] space-y-3">
                <div className="text-[11px] font-bold text-[#004ac6] uppercase tracking-wider">
                  Condiciones Comerciales & Cuentas para Pago
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#737686]">Días de Crédito Habituales (0 = Contado)</label>
                    <input
                      type="number"
                      min="0"
                      value={creditDaysDefault}
                      onChange={(e) => setCreditDaysDefault(parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-white border border-[#cbd5e1] rounded font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#737686]">Banco</label>
                    <input
                      type="text"
                      placeholder="Banco Pichincha, Guayaquil..."
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-[#cbd5e1] rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#737686]">Tipo y N° de Cuenta Bancaria</label>
                    <div className="flex gap-2">
                      <select
                        value={bankAccountType}
                        onChange={(e) => setBankAccountType(e.target.value as any)}
                        className="w-1/3 px-2 py-1.5 bg-white border border-[#cbd5e1] rounded text-[11px]"
                      >
                        <option value="corriente">Cta. Cte</option>
                        <option value="ahorros">Ahorros</option>
                      </select>
                      <input
                        type="text"
                        placeholder="N° de Cuenta"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        className="w-2/3 px-2 py-1.5 bg-white border border-[#cbd5e1] rounded font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#737686]">Titular de la Cuenta</label>
                    <input
                      type="text"
                      placeholder="Nombre del beneficiario"
                      value={bankAccountOwner}
                      onChange={(e) => setBankAccountOwner(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-[#cbd5e1] rounded"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Notas Internas</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalles sobre acuerdos comerciales, ejecutivos de cuenta, etc."
                  className="w-full p-2 bg-white border border-[#cbd5e1] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8f0]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-semibold text-[#434655]">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl font-bold shadow-xs cursor-pointer">
                  {editingSupplier ? "Guardar Cambios" : "Crear Proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
