"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Client,
  NodeLocation,
  NodeCarrierProvider,
  NodeSystemService,
  ECUADOR_PROVINCES,
  EcuadorProvince,
} from "@/types";
import {
  X,
  Radio,
  MapPin,
  Server,
  Layers,
  Shield,
  Plus,
  Trash2,
  Globe,
  Key,
  Info,
  Building2,
} from "lucide-react";

interface ClientNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  nodeToEdit?: NodeLocation | null;
}

export function ClientNodeModal({
  isOpen,
  onClose,
  client,
  nodeToEdit,
}: ClientNodeModalProps) {
  const { addNode, updateNode } = useApp();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState<"general" | "portadores" | "servicios">("general");

  // Identificación básica
  const [name, setName] = useState("");
  const [status, setStatus] = useState<NodeLocation["status"]>("online");
  const [mikrotikIp, setMikrotikIp] = useState("10.200.1.1");
  const [totalCapacityMbps, setTotalCapacityMbps] = useState<number>(1000);
  const [notes, setNotes] = useState("");

  // Estructura Geográfica de Ecuador
  const [province, setProvince] = useState<string>("Pichincha");
  const [canton, setCanton] = useState("Quito");
  const [parish, setParish] = useState("Iñaquito");
  const [detailedAddress, setDetailedAddress] = useState("");

  // Enlaces Multi-Carrier del Nodo
  const [providers, setProviders] = useState<NodeCarrierProvider[]>([]);
  const [newProvName, setNewProvName] = useState("");
  const [newProvCapacity, setNewProvCapacity] = useState<number>(500);
  const [newProvCircuit, setNewProvCircuit] = useState("");
  const [newProvIpv4, setNewProvIpv4] = useState("");

  // Servicios y Credenciales del Sistema
  const [services, setServices] = useState<NodeSystemService[]>([]);
  const [newSysName, setNewSysName] = useState("");
  const [newSysLink, setNewSysLink] = useState("");
  const [newSysCreds, setNewSysCreds] = useState("");
  const [newSysNotes, setNewSysNotes] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    if (nodeToEdit) {
      setName(nodeToEdit.name || "");
      setStatus(nodeToEdit.status || "online");
      setMikrotikIp(nodeToEdit.mikrotikIp || "10.200.1.1");
      setTotalCapacityMbps(nodeToEdit.totalCapacityMbps || 1000);
      setNotes(nodeToEdit.notes || "");

      setProvince(nodeToEdit.province || "Pichincha");
      setCanton(nodeToEdit.canton || "Quito");
      setParish(nodeToEdit.parish || "Iñaquito");
      setDetailedAddress(nodeToEdit.detailedAddress || nodeToEdit.address || "");

      setProviders(nodeToEdit.providers ? [...nodeToEdit.providers] : []);
      setServices(nodeToEdit.services ? [...nodeToEdit.services] : []);
    } else {
      setName("");
      setStatus("online");
      setMikrotikIp("10.200.1.1");
      setTotalCapacityMbps(1000);
      setNotes("");

      setProvince("Pichincha");
      setCanton("Quito");
      setParish("Iñaquito");
      setDetailedAddress(client.address || "");

      setProviders([
        {
          id: "prov-" + Date.now(),
          providerName: "Telconet Latam",
          capacityMbps: 1000,
          circuitId: "TCO-" + Math.floor(1000 + Math.random() * 9000),
          ipv4Subnet: "181.198.112.112/30",
        },
      ]);
      setServices([]);
    }
    setActiveTab("general");
  }, [isOpen, nodeToEdit, client]);

  if (!isOpen) return null;

  // Manejador de portadores
  const handleAddProvider = () => {
    if (!newProvName.trim()) return;
    const newProv: NodeCarrierProvider = {
      id: "prov-" + Date.now(),
      providerName: newProvName.trim(),
      capacityMbps: Number(newProvCapacity) || 100,
      circuitId: newProvCircuit.trim() || undefined,
      ipv4Subnet: newProvIpv4.trim() || undefined,
    };
    setProviders([...providers, newProv]);
    setNewProvName("");
    setNewProvCircuit("");
    setNewProvIpv4("");
  };

  const handleRemoveProvider = (id: string) => {
    setProviders(providers.filter((p) => p.id !== id));
  };

  // Manejador de servicios
  const handleAddService = () => {
    if (!newSysName.trim()) return;
    const newSrv: NodeSystemService = {
      id: "srv-" + Date.now(),
      systemName: newSysName.trim(),
      linkOrIp: newSysLink.trim() || "192.168.1.1",
      credentials: newSysCreds.trim() || "admin",
      notes: newSysNotes.trim() || undefined,
    };
    setServices([...services, newSrv]);
    setNewSysName("");
    setNewSysLink("");
    setNewSysCreds("");
    setNewSysNotes("");
  };

  const handleRemoveService = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showError("Campo Obligatorio", "Por favor ingresa el nombre de la sede o nodo.");
      setActiveTab("general");
      return;
    }

    if (!detailedAddress.trim()) {
      showError("Dirección Requerida", "Por favor ingresa la dirección detallada o referencia de la sede.");
      setActiveTab("general");
      return;
    }

    try {
      const fullAddress = `${detailedAddress.trim()}, ${parish.trim()}, ${canton.trim()}, ${province}`;
      const upstreamProvider = providers.map((p) => p.providerName).join(" / ") || "Enlace Directo";

      const nodePayload = {
        clientId: client.id,
        clientName: client.businessName,
        name: name.trim(),
        province,
        canton: canton.trim(),
        parish: parish.trim(),
        detailedAddress: detailedAddress.trim(),
        address: fullAddress,
        status,
        mikrotikIp: mikrotikIp.trim(),
        totalCapacityMbps: Number(totalCapacityMbps) || 1000,
        usedCapacityMbps: nodeToEdit?.usedCapacityMbps || 0,
        upstreamProvider,
        notes: notes.trim(),
        providers,
        services,
      };

      if (nodeToEdit) {
        await updateNode(nodeToEdit.id, nodePayload);
        showSuccess("Sede / Nodo Actualizado", `Se guardaron los cambios en "${name}".`);
      } else {
        await addNode(nodePayload);
        showSuccess("Sede / Nodo Registrado", `Se añadió "${name}" a las sedes de ${client.businessName}.`);
      }
      onClose();
    } catch (err) {
      showError("Error al Guardar", err instanceof Error ? err.message : "No se pudo procesar la solicitud.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Encabezado */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {nodeToEdit ? "Editar Sede / Nodo del Cliente" : "Registrar Nueva Sede / Nodo"}
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-700">{client.businessName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas internas */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-100 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "general"
                ? "border-[#004ac6] text-[#004ac6]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Datos & Localización Ecuador</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("portadores")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "portadores"
                ? "border-[#004ac6] text-[#004ac6]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Enlaces & Portadores</span>
            {providers.length > 0 && (
              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
                {providers.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("servicios")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "servicios"
                ? "border-[#004ac6] text-[#004ac6]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Equipos & Credenciales</span>
            {services.length > 0 && (
              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
                {services.length}
              </span>
            )}
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: DATOS & LOCALIZACIÓN ECUADOR */}
          {activeTab === "general" && (
            <div className="space-y-4">
              {/* Identificación y Estado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre de la Sede / Nodo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Sede Matriz Corporativa, Sucursal Guayaquil Muelle 4..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado Operativo
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as NodeLocation["status"])}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                  >
                    <option value="online">Online (Operativo)</option>
                    <option value="warning">Advertencia (Alerta NOC)</option>
                    <option value="offline">Offline (Sin Señal)</option>
                  </select>
                </div>
              </div>

              {/* SECCIÓN GEOGRÁFICA DE ECUADOR */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3.5">
                <div className="flex items-center gap-2 border-b border-slate-200/70 pb-2">
                  <MapPin className="w-4 h-4 text-[#004ac6]" />
                  <span className="text-xs font-bold text-slate-800">
                    Ubicación Geográfica en Ecuador (División Política)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Selector de Provincias de Ecuador */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Provincia <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] font-bold text-slate-800"
                    >
                      {ECUADOR_PROVINCES.map((prov) => (
                        <option key={prov} value={prov}>
                          {prov}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cantón */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Cantón <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Quito, Guayaquil, Cuenca..."
                      value={canton}
                      onChange={(e) => setCanton(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                    />
                  </div>

                  {/* Parroquia */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Parroquia <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Iñaquito, Tarqui, Cumbayá..."
                      value={parish}
                      onChange={(e) => setParish(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                    />
                  </div>
                </div>

                {/* Dirección Detallada */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Dirección Detallada, Calle & Referencia <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Av. República de El Salvador N36-140 y Naciones Unidas, Edificio Platinum Plaza Piso 8"
                    value={detailedAddress}
                    onChange={(e) => setDetailedAddress(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Se consolidará automáticamente en el expediente: {detailedAddress || "(Dirección)"}, {parish}, {canton}, {province}
                  </p>
                </div>
              </div>

              {/* Parámetros de Red del Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    IP MikroTik / Router de Sede
                  </label>
                  <input
                    type="text"
                    placeholder="10.200.1.1 o IP pública de gestión"
                    value={mikrotikIp}
                    onChange={(e) => setMikrotikIp(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Capacidad Contratada / Asignada (Mbps)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={totalCapacityMbps}
                    onChange={(e) => setTotalCapacityMbps(parseInt(e.target.value) || 0)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notas Técnicas de la Sede
                </label>
                <textarea
                  rows={2}
                  placeholder="Observaciones de acceso, contactos de guardia en garita, horarios de mantenimiento..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>
            </div>
          )}

          {/* TAB 2: ENLACES & PORTADORES */}
          {activeTab === "portadores" && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Añadir Enlace Portador (Multi-Carrier)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Proveedor (Telconet, Lumen...)"
                    value={newProvName}
                    onChange={(e) => setNewProvName(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                  <input
                    type="number"
                    placeholder="Capacidad Mbps"
                    value={newProvCapacity || ""}
                    onChange={(e) => setNewProvCapacity(parseInt(e.target.value) || 0)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Circuit ID"
                    value={newProvCircuit}
                    onChange={(e) => setNewProvCircuit(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddProvider}
                    className="px-3 py-1.5 bg-[#004ac6] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir</span>
                  </button>
                </div>
              </div>

              {/* Lista de Portadores */}
              <div className="space-y-2">
                {providers.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                    No hay enlaces portadores registrados en esta sede.
                  </div>
                ) : (
                  providers.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-xs">
                          {p.capacityMbps}M
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-xs">{p.providerName}</span>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {p.circuitId ? `Circuito: ${p.circuitId}` : "Sin ID de circuito"}
                            {p.ipv4Subnet ? ` · IP: ${p.ipv4Subnet}` : ""}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveProvider(p.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        title="Eliminar enlace"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: EQUIPOS & CREDENCIALES */}
          {activeTab === "servicios" && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Añadir Equipo o Servicio de Acceso a la Sede
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Equipo (ej: MikroTik RB5009)"
                    value={newSysName}
                    onChange={(e) => setNewSysName(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="IP / Puerto Winbox"
                    value={newSysLink}
                    onChange={(e) => setNewSysLink(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Credenciales (user / pass)"
                    value={newSysCreds}
                    onChange={(e) => setNewSysCreds(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Notas o función del equipo..."
                    value={newSysNotes}
                    onChange={(e) => setNewSysNotes(e.target.value)}
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="px-4 py-1.5 bg-[#004ac6] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Equipo</span>
                  </button>
                </div>
              </div>

              {/* Lista de Servicios */}
              <div className="space-y-2">
                {services.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                    No hay equipos de red ni credenciales registradas.
                  </div>
                ) : (
                  services.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 text-xs">{s.systemName}</span>
                        <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                          IP/Host: {s.linkOrIp} · Credenciales: {s.credentials}
                        </div>
                        {s.notes && <p className="text-[10px] text-slate-400 mt-0.5">{s.notes}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(s.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        title="Eliminar equipo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Botones inferiores */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              <span>{nodeToEdit ? "Guardar Cambios" : "Registrar Sede / Nodo"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
