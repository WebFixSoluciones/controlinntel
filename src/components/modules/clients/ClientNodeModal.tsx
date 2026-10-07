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
} from "@/types";
import {
  X,
  Radio,
  MapPin,
  Server,
  Layers,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Building2,
  Copy,
  Check,
  ShieldCheck,
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
  const [status, setStatus] = useState<"activo" | "suspendido" | "retirado">("activo");
  const [isReportedArcotel, setIsReportedArcotel] = useState(false);
  const [notes, setNotes] = useState("");

  // Estructura Geográfica de Ecuador
  const [province, setProvince] = useState<string>("Pichincha");
  const [canton, setCanton] = useState("");
  const [parish, setParish] = useState("");
  const [detailedAddress, setDetailedAddress] = useState("");

  // Enlaces Multi-Carrier del Nodo
  const [providers, setProviders] = useState<NodeCarrierProvider[]>([]);
  const [newProvName, setNewProvName] = useState("");
  const [newProvCapacity, setNewProvCapacity] = useState<number | "">("");
  const [newProvCircuit, setNewProvCircuit] = useState("");
  const [newProvIpv4, setNewProvIpv4] = useState("");
  const [newProvIpv6, setNewProvIpv6] = useState("");

  // Servicios y Credenciales del Sistema (Separación de Usuario y Clave con temporizador de 20s)
  const [services, setServices] = useState<NodeSystemService[]>([]);
  const [newSysName, setNewSysName] = useState("");
  const [newSysLink, setNewSysLink] = useState("");
  const [newSysUsername, setNewSysUsername] = useState("");
  const [newSysPassword, setNewSysPassword] = useState("");
  const [newSysNotes, setNewSysNotes] = useState("");

  // Visualización temporal de contraseñas (20s)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, number>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setRevealedPasswords((prev) => {
        const next: Record<string, number> = {};
        let changed = false;
        for (const [id, count] of Object.entries(prev)) {
          if (count > 1) {
            next[id] = count - 1;
            changed = true;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRevealPasswordFor20s = (serviceId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [serviceId]: 20,
    }));
  };

  const handleCopyText = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    showSuccess("Copiado", "Texto copiado al portapapeles.");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    if (!isOpen) return;

    if (nodeToEdit) {
      setName(nodeToEdit.name || "");
      const st = nodeToEdit.status;
      setStatus(st === "suspendido" || st === "retirado" ? st : "activo");
      setIsReportedArcotel(nodeToEdit.isReportedArcotel ?? (nodeToEdit.status === "reportado"));
      setNotes(nodeToEdit.notes || "");

      setProvince(nodeToEdit.province || "Pichincha");
      setCanton(nodeToEdit.canton || "");
      setParish(nodeToEdit.parish || "");
      setDetailedAddress(nodeToEdit.detailedAddress || "");

      setProviders(nodeToEdit.providers ? [...nodeToEdit.providers] : []);
      setServices(
        nodeToEdit.services
          ? nodeToEdit.services.map((s) => {
              if (!s.username && !s.password && s.credentials) {
                const parts = s.credentials.split("/");
                return {
                  ...s,
                  username: parts[0]?.trim() || "",
                  password: parts.slice(1).join("/").trim() || "",
                };
              }
              return s;
            })
          : []
      );
    } else {
      // Sin valores precargados por defecto: abre completamente limpio
      setName("");
      setStatus("activo");
      setIsReportedArcotel(false);
      setNotes("");

      setProvince("Pichincha");
      setCanton("");
      setParish("");
      setDetailedAddress("");

      setProviders([]);
      setServices([]);
    }
    setActiveTab("general");
  }, [isOpen, nodeToEdit]);

  if (!isOpen) return null;

  // Manejador de portadores
  const handleAddProvider = () => {
    if (!newProvName.trim()) {
      showError("Proveedor Requerido", "Ingresa el nombre del proveedor portador.");
      return;
    }
    const newProv: NodeCarrierProvider = {
      id: "prov-" + Date.now(),
      providerName: newProvName.trim(),
      capacityMbps: Number(newProvCapacity) || 0,
      circuitId: newProvCircuit.trim() || undefined,
      ipv4Subnet: newProvIpv4.trim() || undefined,
      ipv6Prefix: newProvIpv6.trim() || undefined,
    };
    setProviders([...providers, newProv]);
    setNewProvName("");
    setNewProvCapacity("");
    setNewProvCircuit("");
    setNewProvIpv4("");
    setNewProvIpv6("");
  };

  const handleRemoveProvider = (id: string) => {
    setProviders(providers.filter((p) => p.id !== id));
  };

  // Manejador de servicios y credenciales
  const handleAddService = () => {
    if (!newSysName.trim()) {
      showError("Sistema Requerido", "Ingresa el nombre del sistema o equipo.");
      return;
    }
    const newSrv: NodeSystemService = {
      id: "srv-" + Date.now(),
      systemName: newSysName.trim(),
      linkOrIp: newSysLink.trim(),
      username: newSysUsername.trim(),
      password: newSysPassword.trim(),
      credentials: `${newSysUsername.trim()} / ${newSysPassword.trim()}`,
      notes: newSysNotes.trim() || undefined,
    };
    setServices([...services, newSrv]);
    setNewSysName("");
    setNewSysLink("");
    setNewSysUsername("");
    setNewSysPassword("");
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

    try {
      const fullAddressParts = [detailedAddress.trim(), parish.trim(), canton.trim(), province].filter(Boolean);
      const fullAddress = fullAddressParts.join(", ");
      const upstreamProvider = providers.map((p) => p.providerName).join(" / ") || "Sin proveedor asignado";
      const totalCapacity = providers.reduce((sum, p) => sum + (Number(p.capacityMbps) || 0), 0);

      const nodePayload = {
        clientId: client.id,
        clientName: client.businessName,
        name: name.trim(),
        province,
        canton: canton.trim(),
        parish: parish.trim(),
        detailedAddress: detailedAddress.trim(),
        address: fullAddress,
        status: status as any,
        isReportedArcotel,
        totalCapacityMbps: totalCapacity,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-[6px] shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Encabezado */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center">
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
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-[6px] transition-colors cursor-pointer"
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
            <span>Nodo & Ubicación</span>
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
            <span>Proveedores & Enlaces</span>
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
            <span>Sistemas, Servicios & Credenciales</span>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: DATOS & LOCALIZACIÓN */}
          {activeTab === "general" && (
            <div className="space-y-4">
              {/* Identificación y Estado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nodo / Nombre de Sede <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Sede Principal, Sucursal Norte, Nodo POP Central..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-[6px] border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "activo" | "suspendido" | "retirado")}
                    className="w-full text-xs px-3 py-2 rounded-[6px] border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] font-bold"
                  >
                    <option value="activo">ACTIVO</option>
                    <option value="suspendido">SUSPENDIDO</option>
                    <option value="retirado">RETIRADO</option>
                  </select>
                </div>
              </div>

              {/* Toggle Reportado ARCOTEL */}
              <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#004ac6]" />
                  <div>
                    <span className="text-xs font-bold text-slate-800">Reportado ARCOTEL</span>
                    <p className="text-[11px] text-slate-500">
                      Indica si esta sede o nodo se encuentra formalmente reportado ante la Agencia de Regulación (SIETEL)
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isReportedArcotel}
                    onChange={(e) => setIsReportedArcotel(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#004ac6]"></div>
                </label>
              </div>

              {/* SECCIÓN GEOGRÁFICA DE ECUADOR */}
              <div className="p-4 bg-slate-50 rounded-[6px] border border-slate-200/80 space-y-3.5">
                <div className="flex items-center gap-2 border-b border-slate-200/70 pb-2">
                  <MapPin className="w-4 h-4 text-[#004ac6]" />
                  <span className="text-xs font-bold text-slate-800">
                    Ubicación Geográfica en Ecuador
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Provincia
                    </label>
                    <select
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-[6px] border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] font-semibold text-slate-800"
                    >
                      {ECUADOR_PROVINCES.map((prov) => (
                        <option key={prov} value={prov}>
                          {prov}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Cantón
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Quito, Guayaquil, Cuenca..."
                      value={canton}
                      onChange={(e) => setCanton(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-[6px] border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Parroquia
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Iñaquito, Tarqui, Cumbayá..."
                      value={parish}
                      onChange={(e) => setParish(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-[6px] border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Dirección Detallada o Referencia
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Av. Principal y Secundaria, Edificio Piso 3..."
                    value={detailedAddress}
                    onChange={(e) => setDetailedAddress(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-[6px] border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>
              </div>

              {/* Observación */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observación
                </label>
                <textarea
                  rows={3}
                  placeholder="Observaciones de acceso, contactos de guardia en garita, horarios de mantenimiento..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-[6px] border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>
            </div>
          )}

          {/* TAB 2: ENLACES & PORTADORES */}
          {activeTab === "portadores" && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-[6px] border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  Añadir Proveedor Portador (Multi-Carrier)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Proveedor *</label>
                    <input
                      type="text"
                      placeholder="Telconet, Lumen, Ufinet..."
                      value={newProvName}
                      onChange={(e) => setNewProvName(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Capacidad (Mbps)</label>
                    <input
                      type="number"
                      placeholder="Ej: 500"
                      value={newProvCapacity}
                      onChange={(e) => setNewProvCapacity(e.target.value === "" ? "" : parseInt(e.target.value) || 0)}
                      className="w-full text-xs px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">ID Circuito</label>
                    <input
                      type="text"
                      placeholder="TCO-9921"
                      value={newProvCircuit}
                      onChange={(e) => setNewProvCircuit(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">IPv4</label>
                    <input
                      type="text"
                      placeholder="181.198.112.112/30"
                      value={newProvIpv4}
                      onChange={(e) => setNewProvIpv4(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">IPv6</label>
                    <input
                      type="text"
                      placeholder="2800:3f0::/48"
                      value={newProvIpv6}
                      onChange={(e) => setNewProvIpv6(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddProvider}
                    className="px-4 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Proveedor</span>
                  </button>
                </div>
              </div>

              {/* Lista de Proveedores Registrados */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Proveedores Portadores Configurados
                </span>
                {providers.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-[6px] text-xs text-slate-400">
                    No hay proveedores portadores registrados para este nodo. Usa el formulario superior para añadir proveedores (Proveedor 1, 2, 3...).
                  </div>
                ) : (
                  providers.map((p, index) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white rounded-[6px] border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-[6px] bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                          {index + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">{p.providerName}</span>
                            {p.capacityMbps > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-[#004ac6] rounded-[6px]">
                                {p.capacityMbps} Mbps
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex flex-wrap gap-x-3">
                            {p.circuitId && <span>ID: <strong className="text-slate-700">{p.circuitId}</strong></span>}
                            {p.ipv4Subnet && <span>IPv4: <strong className="text-slate-700">{p.ipv4Subnet}</strong></span>}
                            {p.ipv6Prefix && <span>IPv6: <strong className="text-slate-700">{p.ipv6Prefix}</strong></span>}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveProvider(p.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-[6px] hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Eliminar proveedor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SISTEMAS, SERVICIOS & CREDENCIALES */}
          {activeTab === "servicios" && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-[6px] border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  Añadir Sistema / Servicio & Credenciales de Acceso
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Sistema *</label>
                    <input
                      type="text"
                      placeholder="Ej: MIKROTIK CCR2116, SMART OLT, OLT ZTE..."
                      value={newSysName}
                      onChange={(e) => setNewSysName(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Link / IP</label>
                    <input
                      type="text"
                      placeholder="Ej: 181.198.112.112:5258 o URL"
                      value={newSysLink}
                      onChange={(e) => setNewSysLink(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Usuario</label>
                    <input
                      type="text"
                      placeholder="admin / usuario"
                      value={newSysUsername}
                      onChange={(e) => setNewSysUsername(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Contraseña</label>
                    <input
                      type="password"
                      placeholder="Contraseña del sistema"
                      value={newSysPassword}
                      onChange={(e) => setNewSysPassword(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Observación / Notas</label>
                  <input
                    type="text"
                    placeholder="Detalles adicionales del equipo..."
                    value={newSysNotes}
                    onChange={(e) => setNewSysNotes(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 rounded-[6px] border border-slate-200 bg-white"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="px-4 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Sistema / Servicio</span>
                  </button>
                </div>
              </div>

              {/* Lista de Sistemas y Credenciales */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Sistemas y Credenciales Asociados
                </span>
                {services.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-[6px] text-xs text-slate-400">
                    No hay sistemas ni credenciales asociadas a este nodo.
                  </div>
                ) : (
                  services.map((s) => {
                    const timeLeft = revealedPasswords[s.id] || 0;
                    const isRevealed = timeLeft > 0;
                    const userVal = s.username || (s.credentials ? s.credentials.split("/")[0]?.trim() : "");
                    const passVal = s.password || (s.credentials ? s.credentials.split("/").slice(1).join("/").trim() : "");

                    return (
                      <div
                        key={s.id}
                        className="p-3.5 bg-white rounded-[6px] border border-slate-200 space-y-2 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-[#004ac6]" />
                            <span className="font-bold text-slate-900 text-xs">{s.systemName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveService(s.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-[6px] hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Eliminar sistema"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {s.linkOrIp && (
                          <div className="text-[11px] text-slate-600 font-mono">
                            <span className="font-bold text-slate-500 font-sans mr-1">Link / IP:</span>
                            {s.linkOrIp}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-xs">
                          {/* Campo Usuario */}
                          <div className="flex items-center justify-between p-2 rounded-[6px] bg-slate-50 border border-slate-200">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block uppercase">Usuario</span>
                              <span className="font-mono font-semibold text-slate-800">{userVal || "(Sin usuario)"}</span>
                            </div>
                            {userVal && (
                              <button
                                type="button"
                                onClick={() => handleCopyText(userVal, `user-${s.id}`)}
                                className="p-1 text-slate-400 hover:text-[#004ac6] cursor-pointer"
                                title="Copiar usuario"
                              >
                                {copiedKey === `user-${s.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Campo Clave cifrada con reveal por 20 segundos */}
                          <div className="flex items-center justify-between p-2 rounded-[6px] bg-slate-50 border border-slate-200">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Contraseña</span>
                                {isRevealed && (
                                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded">
                                    {timeLeft}s
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-semibold text-slate-800">
                                {isRevealed ? passVal || "(Sin clave)" : "••••••••••••"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleRevealPasswordFor20s(s.id)}
                                className={`p-1 rounded-[6px] transition-colors cursor-pointer ${
                                  isRevealed ? "text-amber-600 bg-amber-100" : "text-slate-400 hover:text-slate-700"
                                }`}
                                title="Mostrar contraseña por 20 segundos"
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              {passVal && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(passVal, `pass-${s.id}`)}
                                  className="p-1 text-slate-400 hover:text-[#004ac6] cursor-pointer"
                                  title="Copiar contraseña"
                                >
                                  {copiedKey === `pass-${s.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {s.notes && (
                          <p className="text-[11px] text-slate-500 italic pt-1">{s.notes}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Botones inferiores */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-[6px] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-[6px] shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
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
