"use client";
import { ActionIconButton } from "@/components/ui/ActionIconButton";

import React, { useState, useEffect, useRef, useId } from "react";
import dynamic from "next/dynamic";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { nodeSchema, nodeField } from "@/lib/node-schema";
import { validationIssues, type FieldError } from "@/lib/validation-issues";
import { ApiError } from "@/lib/api-error";
import { NodeSystemCredentials } from "./NodeSystemCredentials";
import { canAccessModule, canUser } from "@/lib/permissions";
import { updateNodeSystem } from "@/lib/node-system-editor";
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
  Pencil,
  Building2,
  ShieldCheck,
  Globe,
} from "lucide-react";
import type { DetectedLocationData } from "./NodeLocationMapPicker";

const NodeLocationMapPicker = dynamic(
  () => import("./NodeLocationMapPicker"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[250px] bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
        <div className="w-5 h-5 border-2 border-[#004ac6] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold">Cargando mapa interactivo...</span>
      </div>
    ),
  }
);

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
  const { addNode, updateNode, currentUser } = useApp();
  const canEditCredentials = canAccessModule(currentUser, "red") && canUser(currentUser, "red", "canEditRouterCredentials");
  const { showSuccess, showError } = useToast();
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [saveError, setSaveError] = useState("");
  const errorSummary = useRef<HTMLDivElement>(null);
  useEffect(() => { if (saveError) errorSummary.current?.focus(); }, [saveError, fieldErrors]);

  const [activeTab, setActiveTab] = useState<"general" | "portadores" | "servicios">("general");

  // Identificación básica
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"activo" | "suspendido" | "retirado">("activo");
  const [isReportedArcotel, setIsReportedArcotel] = useState(false);
  const [notes, setNotes] = useState("");

  // Estructura Geográfica de Ecuador & Coordenadas GPS
  const [province, setProvince] = useState<string>("Pichincha");
  const [canton, setCanton] = useState("");
  const [parish, setParish] = useState("");
  const [detailedAddress, setDetailedAddress] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  // Enlaces Multi-Carrier del Nodo
  const [providers, setProviders] = useState<NodeCarrierProvider[]>([]);
  const [newProvName, setNewProvName] = useState("");
  const [newProvCapacity, setNewProvCapacity] = useState<number | "">("");
  const [newProvCircuit, setNewProvCircuit] = useState("");
  const [newProvIpv4List, setNewProvIpv4List] = useState<string[]>([""]);
  const [newProvIpv6, setNewProvIpv6] = useState("");
  const [newProvNotes, setNewProvNotes] = useState("");
  const [editingProvId, setEditingProvId] = useState<string | null>(null);

  // Servicios y Credenciales del Sistema (Separación de Usuario y Clave con temporizador de 20s)
  const [services, setServices] = useState<NodeSystemService[]>([]);
  const systemFieldId = useId();
  const [activeCredentialField, setActiveCredentialField] = useState<"user" | "password" | null>(null);
  const [newSysName, setNewSysName] = useState("");
  const [newSysLink, setNewSysLink] = useState("");
  const [newSysUsername, setNewSysUsername] = useState("");
  const [newSysPassword, setNewSysPassword] = useState("");
  const [newSysNotes, setNewSysNotes] = useState("");
  const [editingSysId, setEditingSysId] = useState<string | null>(null);
  const systemFormRef = useRef<HTMLDivElement>(null);
  const systemNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) { setNewSysPassword(""); setServices([]); setEditingSysId(null); return; }
    setFieldErrors([]); setSaveError(""); setSaving(false);

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
      setCoordinates(nodeToEdit.coordinates || null);

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
      setCoordinates(null);

      setProviders([]);
      setServices([]);
    }
    setEditingProvId(null);
    setNewProvName("");
    setNewProvCapacity("");
    setNewProvCircuit("");
    setNewProvIpv4List([""]);
    setNewProvIpv6("");
    setNewProvNotes("");
    setNewSysName("");
    setEditingSysId(null);
    setActiveCredentialField(null);
    setNewSysLink("");
    setNewSysUsername("");
    setNewSysPassword("");
    setNewSysNotes("");
    setActiveTab("general");
  }, [isOpen, nodeToEdit]);

  if (!isOpen) return null;

  // Manejador de sincronización de ubicación desde el mapa interactivo
  const handleAddressDetected = (data: DetectedLocationData) => {
    if (data.address) {
      setDetailedAddress(data.address);
    }
    if (data.canton) {
      setCanton(data.canton);
    }
    if (data.parish) {
      setParish(data.parish);
    }
    if (data.province && (ECUADOR_PROVINCES as readonly string[]).includes(data.province)) {
      setProvince(data.province);
    }
    showSuccess("Ubicación Sincronizada", "Campos actualizados según el punto del mapa.");
  };

  // Manejador de campos IPv4 dinámicos
  const handleAddIpv4Field = () => {
    setNewProvIpv4List((prev) => [...prev, ""]);
  };

  const handleRemoveIpv4Field = (index: number) => {
    setNewProvIpv4List((prev) => {
      if (prev.length <= 1) return [""];
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleIpv4Change = (index: number, value: string) => {
    // Si el usuario pega múltiples IPs separadas por coma
    if (value.includes(",")) {
      const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        setNewProvIpv4List((prev) => {
          const copy = [...prev];
          copy.splice(index, 1, ...parts);
          return copy;
        });
        return;
      }
    }
    setNewProvIpv4List((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  // Manejador de portadores
  const handleAddProvider = () => {
    if (!newProvName.trim()) {
      showError("Proveedor Requerido", "Ingresa el nombre del proveedor portador.");
      return;
    }

    const validIps = newProvIpv4List.map((ip) => ip.trim()).filter(Boolean);

    if (editingProvId) {
      setProviders(
        providers.map((p) =>
          p.id === editingProvId
            ? {
                ...p,
                providerName: newProvName.trim(),
                capacityMbps: Number(newProvCapacity) || 0,
                circuitId: newProvCircuit.trim() || undefined,
                ipv4Subnet: validIps.length > 0 ? validIps.join(", ") : undefined,
                ipv4Subnets: validIps.length > 0 ? validIps : undefined,
                ipv6Prefix: newProvIpv6.trim() || undefined,
                notes: newProvNotes.trim(),
              }
            : p
        )
      );
      setEditingProvId(null);
    } else {
      const newProv: NodeCarrierProvider = {
        id: "prov-" + Date.now(),
        providerName: newProvName.trim(),
        capacityMbps: Number(newProvCapacity) || 0,
        circuitId: newProvCircuit.trim() || undefined,
        ipv4Subnet: validIps.length > 0 ? validIps.join(", ") : undefined,
        ipv4Subnets: validIps.length > 0 ? validIps : undefined,
        ipv6Prefix: newProvIpv6.trim() || undefined,
        notes: newProvNotes.trim(),
      };
      setProviders([...providers, newProv]);
    }

    setNewProvName("");
    setNewProvCapacity("");
    setNewProvCircuit("");
    setNewProvIpv4List([""]);
    setNewProvIpv6("");
    setNewProvNotes("");
  };

  const handleStartEditProvider = (p: NodeCarrierProvider) => {
    setEditingProvId(p.id);
    setNewProvName(p.providerName);
    setNewProvCapacity(p.capacityMbps || "");
    setNewProvCircuit(p.circuitId || "");
    const ips = p.ipv4Subnets && p.ipv4Subnets.length > 0
      ? p.ipv4Subnets
      : (p.ipv4Subnet ? p.ipv4Subnet.split(",").map((s) => s.trim()).filter(Boolean) : [""]);
    setNewProvIpv4List(ips.length > 0 ? ips : [""]);
    setNewProvIpv6(p.ipv6Prefix || "");
    setNewProvNotes(p.notes || "");
  };

  const handleCancelEditProvider = () => {
    setEditingProvId(null);
    setNewProvName("");
    setNewProvCapacity("");
    setNewProvCircuit("");
    setNewProvIpv4List([""]);
    setNewProvIpv6("");
    setNewProvNotes("");
  };

  const handleRemoveProvider = (id: string) => {
    if (editingProvId === id) {
      handleCancelEditProvider();
    }
    setProviders(providers.filter((p) => p.id !== id));
  };

  // Manejador de servicios y credenciales
  const handleCancelEditService = () => {
    setEditingSysId(null);
    setNewSysName(""); setNewSysLink(""); setNewSysUsername(""); setNewSysPassword(""); setNewSysNotes("");
    setActiveCredentialField(null);
  };

  const handleEditService = (service: NodeSystemService) => {
    if (!canEditCredentials) return;
    if (editingSysId === service.id) { systemNameRef.current?.focus(); return; }
    if (editingSysId || newSysName.trim() || newSysLink.trim() || newSysUsername || newSysPassword || newSysNotes.trim()) {
      showError("Sistema pendiente", "Actualiza o cancela la edición actual, o agrega el sistema pendiente, antes de editar otro.");
      return;
    }
    setEditingSysId(service.id);
    setNewSysName(service.systemName);
    setNewSysLink(service.linkOrIp || "");
    setNewSysUsername(service.username || service.credentials?.split("/")[0]?.trim() || "");
    setNewSysPassword("");
    setNewSysNotes(service.notes || "");
    setActiveCredentialField(null);
    systemFormRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    systemNameRef.current?.focus({ preventScroll: true });
  };

  const handleAddService = () => {
    if (!newSysName.trim()) {
      showError("Sistema Requerido", "Ingresa el nombre del sistema o equipo.");
      return;
    }
    if (editingSysId) {
      if (!canEditCredentials) { showError("Acceso restringido", "No tienes permiso para editar credenciales."); return; }
      try {
        setServices(updateNodeSystem(services, editingSysId, { systemName: newSysName, linkOrIp: newSysLink, username: newSysUsername, password: newSysPassword, notes: newSysNotes }));
      } catch (error) {
        showError("No se pudo actualizar el sistema", error instanceof Error ? error.message : "Revisa el sistema seleccionado.");
        return;
      }
      handleCancelEditService();
      return;
    }
    const newSrv: NodeSystemService = {
      id: "srv-" + crypto.randomUUID(),
      systemName: newSysName.trim(),
      linkOrIp: newSysLink.trim(),
      username: newSysUsername.trim(),
      password: newSysPassword,
      notes: newSysNotes.trim(),
    };
    setServices([...services, newSrv]);
    setNewSysName("");
    setNewSysLink("");
    setNewSysUsername("");
    setNewSysPassword("");
    setNewSysNotes("");
  };

  const handleRemoveService = (id: string) => {
    if (editingSysId === id) handleCancelEditService();
    setServices(services.filter((s) => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (saving) return;
    setFieldErrors([]); setSaveError("");
    const providerPending = Boolean(editingProvId || newProvName.trim() || newProvNotes.trim());
    if (providerPending || editingSysId || newSysName.trim()) {
      setActiveTab(providerPending ? "portadores" : "servicios");
      setSaveError(providerPending ? "Agrega o actualiza el proveedor pendiente antes de guardar el nodo." : editingSysId ? "Pulsa Actualizar sistema o cancela su edición antes de guardar el nodo." : "Agrega el sistema que estás editando antes de guardar el nodo.");
      return;
    }

    setSaving(true);
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
        coordinates: coordinates ? { lat: Number(coordinates.lat), lng: Number(coordinates.lng) } : undefined,
        status: status as any,
        isReportedArcotel,
        totalCapacityMbps: totalCapacity,
        usedCapacityMbps: nodeToEdit?.usedCapacityMbps || 0,
        upstreamProvider,
        notes: notes.trim(),
        providers,
        services,
        ...(nodeToEdit?.version ? { version: nodeToEdit.version } : {}),
      };

      const validation = nodeSchema.safeParse(nodePayload);
      if (!validation.success) {
        const issues = validationIssues(validation.error.issues);
        setFieldErrors(issues); setSaveError("Revisa los campos indicados antes de guardar el nodo.");
        setActiveTab(nodeField(issues[0]).tab);
        return;
      }

      if (nodeToEdit) {
        await updateNode(nodeToEdit.id, nodePayload);
        showSuccess("Sede / Nodo Actualizado", `Se guardaron los cambios en "${name}".`);
      } else {
        await addNode(nodePayload);
        showSuccess("Sede / Nodo Registrado", `Se añadió "${name}" a las sedes de ${client.businessName}.`);
      }
      onClose();
    } catch (err) {
      const issues = err instanceof ApiError ? err.fieldErrors : [];
      setFieldErrors(issues);
      if (issues.length) setActiveTab(nodeField(issues[0]).tab);
      setSaveError(err instanceof Error ? err.message : "No se pudo guardar el nodo. Intenta nuevamente.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-[#e2e8f0] w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Encabezado Master Modal */}
        <div className="px-6 py-4 bg-[#004ac6] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 text-white flex items-center justify-center shadow-xs">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {nodeToEdit ? "Editar Sede / Nodo del Cliente" : "Registrar Nueva Sede / Nodo"}
              </h3>
              <p className="text-xs text-white/80 flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-white/80" />
                <span className="font-semibold text-white">{client.businessName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar formulario de nodo"
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas internas */}
        <div role="group" aria-label="Secciones del nodo" className="soft-tab-strip px-4 sm:px-6 py-2 border-b border-slate-100 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            aria-pressed={activeTab === "general"}
            className="soft-nav-item soft-tab"
          >
            <MapPin className="w-4 h-4" />
            <span>Nodo & Ubicación</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("portadores")}
            aria-pressed={activeTab === "portadores"}
            className="soft-nav-item soft-tab"
          >
            <Layers className="w-4 h-4" />
            <span>Proveedores & Enlaces</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("servicios")}
            aria-pressed={activeTab === "servicios"}
            className="soft-nav-item soft-tab"
          >
            <Server className="w-4 h-4" />
            <span>Sistemas, Servicios & Credenciales</span>
          </button>
        </div>

        {/* Formulario */}
        <form noValidate autoComplete="off" onSubmit={handleSubmit} aria-busy={saving} className="flex-1 overflow-y-auto p-6 space-y-5">
          {saveError && <div ref={errorSummary} tabIndex={-1} role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <p className="font-bold">{saveError}</p>
            {fieldErrors.length > 0 && <ul className="mt-2 space-y-1">{fieldErrors.map((issue, index) => {
              const field = nodeField(issue);
              return <li key={`${issue.path}-${index}`}><button type="button" className="text-left underline underline-offset-2" onClick={() => setActiveTab(field.tab)}>{field.label}: {field.message}</button></li>;
            })}</ul>}
          </div>}
          <fieldset disabled={saving} className="contents">
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
                    aria-label="Nombre de la sede o nodo"
                    aria-invalid={fieldErrors.some(issue => issue.path === "name")}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado *
                  </label>
                  <select
                    value={status}
                    aria-label="Estado del nodo"
                    aria-invalid={fieldErrors.some(issue => issue.path === "status")}
                    onChange={(e) => setStatus(e.target.value as "activo" | "suspendido" | "retirado")}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] font-bold"
                  >
                    <option value="activo">ACTIVO</option>
                    <option value="suspendido">SUSPENDIDO</option>
                    <option value="retirado">RETIRADO</option>
                  </select>
                </div>
              </div>

              {/* Toggle Reportado ARCOTEL */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
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
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#004ac6]" />
                    <span className="text-xs font-bold text-slate-800">
                      Ubicación Geográfica en Ecuador & Coordenadas
                    </span>
                  </div>
                  {coordinates && (
                    <span className="text-[10px] font-mono font-bold text-[#004ac6] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      GPS: {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Provincia
                    </label>
                    <select
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] font-semibold text-slate-800"
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
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
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
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
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
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                  />
                </div>

                {/* MAPA INTERACTIVO (GOOGLE MAPS / SATÉLITE / CALLES) */}
                <div className="pt-2 border-t border-slate-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#004ac6]" />
                      <span>Mapa Interactivo de Ubicación Exacta</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Haz clic en el mapa para capturar las coordenadas exactas
                    </span>
                  </div>

                  <NodeLocationMapPicker
                    coordinates={coordinates}
                    onChangeCoordinates={(coords) => setCoordinates(coords)}
                    onAddressDetected={handleAddressDetected}
                    province={province}
                    canton={canton}
                    detailedAddress={detailedAddress}
                  />
                </div>
              </div>

              {/* Observación */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observación
                </label>
                <textarea
                  rows={2}
                  placeholder="Observaciones de acceso, contactos de guardia en garita, horarios de mantenimiento..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>
            </div>
          )}

          {/* TAB 2: ENLACES & PORTADORES */}
          {activeTab === "portadores" && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    {editingProvId ? "Editar Proveedor" : "Añadir Proveedor"}
                  </span>
                  {editingProvId && (
                    <button
                      type="button"
                      onClick={handleCancelEditProvider}
                      className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-x-3 gap-y-4 items-start">
                  <div className="sm:col-span-2">
                    <label htmlFor={`${systemFieldId}-provider-name`} className="text-[10px] font-bold text-slate-600 block mb-0.5">Proveedor *</label>
                    <input
                      id={`${systemFieldId}-provider-name`}
                      type="text"
                      placeholder="Telconet, Lumen, Ufinet..."
                      value={newProvName}
                      onChange={(e) => setNewProvName(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`${systemFieldId}-provider-capacity`} className="text-[10px] font-bold text-slate-600 block mb-0.5">Capacidad (Mbps)</label>
                    <input
                      id={`${systemFieldId}-provider-capacity`}
                      type="number"
                      placeholder="Ej: 500"
                      value={newProvCapacity}
                      onChange={(e) => setNewProvCapacity(e.target.value === "" ? "" : parseInt(e.target.value) || 0)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`${systemFieldId}-provider-circuit`} className="text-[10px] font-bold text-slate-600 block mb-0.5">ID Circuito</label>
                    <input
                      id={`${systemFieldId}-provider-circuit`}
                      type="text"
                      placeholder="TCO-9921"
                      value={newProvCircuit}
                      onChange={(e) => setNewProvCircuit(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono focus:outline-hidden focus:border-[#004ac6]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <div className="mb-0.5 min-h-5 flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-600">
                        IPv4 {newProvIpv4List.length > 1 && `(${newProvIpv4List.length})`}
                      </label>
                    </div>
                    <div className="space-y-1.5">
                      {newProvIpv4List.map((ip, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <input
                            aria-label={`IPv4 ${idx + 1}`}
                            type="text"
                            placeholder={idx === 0 ? "181.198.112.112/30" : `IPv4 #${idx + 1}`}
                            value={ip}
                            onChange={(e) => handleIpv4Change(idx, e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono focus:outline-hidden focus:border-[#004ac6]"
                          />
                          {idx === 0 ? (
                            <button
                              type="button"
                              onClick={handleAddIpv4Field}
                              className="p-1.5 rounded-lg bg-blue-50 text-[#004ac6] hover:bg-[#004ac6] hover:text-white transition-colors cursor-pointer shrink-0 border border-blue-200"
                              title="Añadir otra IP v4"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveIpv4Field(idx)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer shrink-0 border border-rose-200"
                              title="Quitar esta IP"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor={`${systemFieldId}-provider-ipv6`} className="text-[10px] font-bold text-slate-600 block mb-0.5 min-h-5">IPv6</label>
                    <input
                      id={`${systemFieldId}-provider-ipv6`}
                      type="text"
                      placeholder="2800:3f0::/48"
                      value={newProvIpv6}
                      onChange={(e) => setNewProvIpv6(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono focus:outline-hidden focus:border-[#004ac6]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={`${systemFieldId}-provider-notes`} className="mb-1 block text-[10px] font-bold text-slate-600">Notas del proveedor <span className="font-normal text-slate-400">(opcional)</span></label>
                  <textarea id={`${systemFieldId}-provider-notes`} rows={2} maxLength={2000} value={newProvNotes} onChange={event => setNewProvNotes(event.target.value)} placeholder="Información adicional, contactos o detalles del enlace…" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-hidden focus:border-[#004ac6]" />
                </div>

                <p className="text-[10px] text-slate-500">Agrega o actualiza el proveedor y después pulsa Guardar Cambios para guardar el nodo.</p>
                <div className="flex justify-end gap-2 pt-1">
                  {editingProvId && (
                    <button
                      type="button"
                      onClick={handleCancelEditProvider}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddProvider}
                    className="px-4 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{editingProvId ? "Actualizar proveedor" : "Agregar Proveedor"}</span>
                  </button>
                </div>
              </div>

              {/* Lista de Proveedores Registrados */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Proveedores Portadores Configurados
                </span>
                {providers.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400">
                    No hay proveedores portadores registrados para este nodo. Usa el formulario superior para añadir proveedores (Proveedor 1, 2, 3...).
                  </div>
                ) : (
                  providers.map((p, index) => {
                    const ips = p.ipv4Subnets && p.ipv4Subnets.length > 0
                      ? p.ipv4Subnets
                      : (p.ipv4Subnet ? p.ipv4Subnet.split(",").map((s) => s.trim()).filter(Boolean) : []);

                    return (
                      <div
                        key={p.id}
                        className="p-3 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {index + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{p.providerName}</span>
                              {p.capacityMbps > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-[#004ac6] rounded-lg">
                                  {p.capacityMbps} Mbps
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-1 flex flex-wrap gap-x-3 gap-y-1 items-center">
                              {p.circuitId && <span>ID: <strong className="text-slate-700">{p.circuitId}</strong></span>}
                              {ips.length > 0 && (
                                <span className="flex items-center gap-1 flex-wrap">
                                  <span>IPv4:</span>
                                  {ips.map((ip, i) => (
                                    <strong key={i} className="text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 text-[10px]">
                                      {ip}
                                    </strong>
                                  ))}
                                </span>
                              )}
                              {p.ipv6Prefix && <span>IPv6: <strong className="text-slate-700">{p.ipv6Prefix}</strong></span>}
                            </div>
                            {p.notes && <p className="mt-2 whitespace-pre-wrap break-words text-[11px] text-slate-600">{p.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <ActionIconButton action="edit" type="button" onClick={() => handleStartEditProvider(p)} title="Editar proveedor" />
                          <ActionIconButton action="delete" type="button" onClick={() => handleRemoveProvider(p.id)} title="Eliminar proveedor" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SISTEMAS, SERVICIOS & CREDENCIALES */}
          {activeTab === "servicios" && (
            <div className="space-y-4">
              <div ref={systemFormRef} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  {editingSysId ? "Editar Sistema / Servicio & Credenciales de Acceso" : "Añadir Sistema / Servicio & Credenciales de Acceso"}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label htmlFor={`${systemFieldId}-name`} className="text-[10px] font-bold text-slate-600 block mb-0.5">Sistema *</label>
                    <input
                      id={`${systemFieldId}-name`}
                      ref={systemNameRef}
                      type="text"
                      placeholder="Ej: MIKROTIK CCR2116, SMART OLT, OLT ZTE..."
                      value={newSysName}
                      onChange={(e) => setNewSysName(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${systemFieldId}-link`} className="text-[10px] font-bold text-slate-600 block mb-0.5">Link / IP</label>
                    <input
                      id={`${systemFieldId}-link`}
                      type="text"
                      placeholder="Ej: 181.198.112.112:5258 o URL"
                      value={newSysLink}
                      onChange={(e) => setNewSysLink(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label htmlFor={`${systemFieldId}-user`} className="text-[10px] font-bold text-slate-600 block mb-0.5">Usuario</label>
                    <input
                      type="text"
                      id={`${systemFieldId}-user`}
                      name="node-system-username"
                      autoComplete="off"
                      readOnly={activeCredentialField !== "user"}
                      onFocus={() => setActiveCredentialField("user")}
                      onBlur={() => setActiveCredentialField(null)}
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="Usuario del sistema"
                      value={newSysUsername}
                      onChange={(e) => setNewSysUsername(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${systemFieldId}-secret`} className="text-[10px] font-bold text-slate-600 block mb-0.5">Contraseña</label>
                    <input
                      type="password"
                      id={`${systemFieldId}-secret`}
                      name="node-system-secret"
                      autoComplete="new-password"
                      readOnly={activeCredentialField !== "password"}
                      onFocus={() => setActiveCredentialField("password")}
                      onBlur={() => setActiveCredentialField(null)}
                      spellCheck={false}
                      placeholder={editingSysId ? "Dejar vacía para conservar la actual" : "Contraseña del sistema"}
                      value={newSysPassword}
                      onChange={(e) => setNewSysPassword(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                    {editingSysId && <p className="mt-1 text-[10px] text-slate-500">Escribe una contraseña nueva solo si deseas reemplazar la actual.</p>}
                  </div>
                </div>

                <div>
                  <label htmlFor={`${systemFieldId}-notes`} className="text-[10px] font-bold text-slate-600 block mb-0.5">Observación / Notas</label>
                  <input
                    id={`${systemFieldId}-notes`}
                    type="text"
                    placeholder="Detalles adicionales del equipo..."
                    value={newSysNotes}
                    onChange={(e) => setNewSysNotes(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>

                <p className="text-[10px] text-slate-500">{editingSysId ? "Actualiza el sistema y después pulsa Guardar Cambios para guardar el nodo." : "Los sistemas añadidos o actualizados se guardan al pulsar Guardar Cambios en el nodo."}</p>
                <div className="flex justify-end gap-2 pt-1">
                  {editingSysId && <button type="button" onClick={handleCancelEditService} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Cancelar edición</button>}
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="px-4 py-1.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {editingSysId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{editingSysId ? "Actualizar sistema" : "Agregar Sistema / Servicio"}</span>
                  </button>
                </div>
              </div>

              {/* Lista de Sistemas y Credenciales */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">
                  Sistemas y Credenciales Asociados
                </span>
                {services.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400">
                    No hay sistemas ni credenciales asociadas a este nodo.
                  </div>
                ) : (
                  services.map(service => (
                    <div key={service.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
                      <NodeSystemCredentials service={service} nodeId={nodeToEdit?.id} />
                      <div className="flex flex-col gap-1">
                        {canEditCredentials && <ActionIconButton action="edit" type="button" onClick={() => handleEditService(service)} title="Editar sistema y credenciales" aria-label={`Editar sistema ${service.systemName}`} aria-pressed={editingSysId === service.id} />}
                        <ActionIconButton action="delete" type="button" onClick={() => handleRemoveService(service.id)} title="Eliminar sistema" aria-label={`Eliminar sistema ${service.systemName}`} />
                      </div>
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
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold bg-[#004ac6] hover:bg-[#003ca0] text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              <span>{saving ? "Guardando…" : nodeToEdit ? "Guardar Cambios" : "Registrar Sede / Nodo"}</span>
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
