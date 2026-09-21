"use client";
import { useState } from "react";
import { useApp } from "@/lib/state";
import { NodeLocation } from "@/types";
import { validateIpv4OrCidr } from "@/lib/validation-engine";
import { NodesList } from "./NodesList";
import { IpPoolsManager } from "./IpPoolsManager";
import { PoolsEditor } from "../settings/RecordManager";

export function ClientNodesManager() {
  const { clients, clientServices, nodes, addNode, updateNode } = useApp();
  const [clientId, setClientId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [nodeQuery, setNodeQuery] = useState("");
  const [status, setStatus] = useState("");
  const [network, setNetwork] = useState(false);
  const [draft, setDraft] = useState<NodeLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const related = (id: string) => nodes.filter(n => n.clientIds?.includes(id) || clientServices.some(s => s.clientId === id && s.nodeId === n.id));
  const input = "mt-1 block w-full rounded-lg border bg-white p-2 text-sm";
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!draft || busy || !clientId) return;
    if (!draft.name.trim() || !draft.address.trim() || !Number.isFinite(draft.totalCapacityMbps) || draft.totalCapacityMbps <= 0 || !Number.isFinite(draft.usedCapacityMbps) || draft.usedCapacityMbps < 0 || draft.usedCapacityMbps > draft.totalCapacityMbps) { setError("Revisa nombre, dirección y capacidad. El uso debe estar entre cero y la capacidad total."); return; }
    if (draft.mikrotikIp && !validateIpv4OrCidr(draft.mikrotikIp).isValid) { setError("La IP del nodo no es válida."); return; }
    setBusy(true); setError("");
    try {
      if (draft.id) { const { id, ...data } = draft; await updateNode(id, data); }
      else { const { id, ...data } = draft; await addNode({ ...data, clientIds: [clientId] }); }
      setDraft(null); setNotice("Nodo guardado correctamente.");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar el nodo."); }
    finally { setBusy(false); }
  }
  if (network) return <div className="space-y-5"><button className="rounded-lg border bg-white p-2" onClick={() => setNetwork(false)}>Volver a clientes</button><NodesList /><IpPoolsManager /><PoolsEditor /></div>;
  if (draft) return <section className="rounded-xl border bg-white p-5 space-y-4">
    <h1 className="text-xl font-bold">{draft.id ? "Editar nodo" : "Registrar nodo"} — {clients.find(c => c.id === clientId)?.businessName}</h1>
    {draft.id && <p className="text-sm text-slate-600">Los cambios actualizan el nodo compartido por todos los servicios que lo utilizan.</p>}
    <form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
      <label>Nombre<input required className={input} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>Dirección<input required className={input} value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} /></label>
      <label>Proveedor<input className={input} value={draft.upstreamProvider} onChange={e => setDraft({ ...draft, upstreamProvider: e.target.value })} /></label>
      <label>IP del nodo<input className={input} value={draft.mikrotikIp || ""} onChange={e => setDraft({ ...draft, mikrotikIp: e.target.value })} /></label>
      <label>Capacidad total (Mbps)<input required min="1" type="number" className={input} value={draft.totalCapacityMbps} onChange={e => setDraft({ ...draft, totalCapacityMbps: Number(e.target.value) })} /></label>
      <label>Capacidad utilizada (Mbps)<input required min="0" max={draft.totalCapacityMbps} type="number" className={input} value={draft.usedCapacityMbps} onChange={e => setDraft({ ...draft, usedCapacityMbps: Number(e.target.value) })} /></label>
      <label>Estado<select className={input} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as NodeLocation["status"] })}><option value="online">En línea</option><option value="warning">Alerta</option><option value="offline">Fuera de línea</option></select></label>
      <label>Notas<textarea rows={3} className={input} value={draft.notes || ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
    </fieldset>{error && <p role="alert" className="text-red-700">{error}</p>}<div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-white">{busy ? "Guardando…" : "Guardar nodo"}</button><button disabled={busy} type="button" className="rounded-lg border px-4 py-2" onClick={() => setDraft(null)}>Cancelar</button></div></form>
  </section>;
  if (clientId) {
    const filtered = related(clientId).filter(n => (!status || n.status === status) && `${n.name} ${n.address} ${n.mikrotikIp || ""}`.toLowerCase().includes(nodeQuery.trim().toLowerCase()));
    return <section className="space-y-4">
      <button className="rounded-lg border bg-white p-2" onClick={() => { setClientId(null); setNotice(""); }}>Volver a clientes</button>
      <div className="flex flex-wrap justify-between gap-3"><h1 className="text-xl font-bold">Nodos de {clients.find(c => c.id === clientId)?.businessName}</h1><button className="rounded-lg bg-blue-700 px-4 py-2 text-white" onClick={() => { setError(""); setDraft({ id: "", name: "", address: "", upstreamProvider: "", totalCapacityMbps: 1000, usedCapacityMbps: 0, status: "online", activeClientsCount: 0, clientIds: [clientId] }); }}>Registrar nodo</button></div>
      {notice && <p role="status" className="text-green-700">{notice}</p>}
      <div className="flex flex-wrap gap-3"><label>Buscar nodo<input className={input} placeholder="Nombre, dirección o IP" value={nodeQuery} onChange={e => setNodeQuery(e.target.value)} /></label><label>Estado<select className={input} value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option><option value="online">En línea</option><option value="warning">Alerta</option><option value="offline">Fuera de línea</option></select></label></div>
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[900px] text-left text-sm"><caption className="sr-only">Nodos asociados al cliente</caption><thead className="bg-slate-50"><tr>{["Nodo","Dirección","IP","Proveedor","Capacidad / uso (Mbps)","Estado","Acciones"].map(h => <th scope="col" className="p-4" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y">{filtered.map(n => <tr key={n.id}><th scope="row" className="p-4">{n.name}</th><td className="p-4">{n.address}</td><td className="p-4">{n.mikrotikIp || "—"}</td><td className="p-4">{n.upstreamProvider}</td><td className="p-4 tabular-nums">{n.totalCapacityMbps} / {n.usedCapacityMbps}</td><td className="p-4">{n.status}</td><td className="p-4"><button className="text-blue-700 underline" onClick={() => { setDraft({ ...n }); setError(""); }}>Ver / editar</button></td></tr>)}{!filtered.length && <tr><td colSpan={7} className="p-8 text-center">No hay nodos para estos filtros. Puedes registrar un nodo.</td></tr>}</tbody></table></div>
    </section>;
  }
  const filtered = clients.filter(c => `${c.businessName} ${c.identificationNumber}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><h1 className="text-2xl font-bold">Nodos por cliente</h1><button onClick={() => setNetwork(true)} className="rounded-lg border bg-white p-2">Infraestructura general y pools IP</button></div>
    <label className="block">Buscar cliente<input className={input} placeholder="Nombre o identificación" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[600px] text-left text-sm"><caption className="sr-only">Cantidad de nodos por abonado</caption><thead className="bg-slate-50"><tr><th scope="col" className="p-4">Cliente</th><th scope="col" className="p-4">Número de nodos</th><th scope="col" className="p-4">Acciones</th></tr></thead><tbody className="divide-y">{filtered.map(c => <tr key={c.id}><th scope="row" className="p-4">{c.businessName}<div className="text-xs font-normal text-slate-500">{c.identificationNumber}</div></th><td className="p-4 tabular-nums">{related(c.id).length}</td><td className="p-4"><button className="text-blue-700 underline" onClick={() => { setClientId(c.id); setNodeQuery(""); setStatus(""); }}>Ver / editar</button></td></tr>)}{!filtered.length && <tr><td colSpan={3} className="p-8 text-center">No se encontraron clientes.</td></tr>}</tbody></table></div>
  </section>;
}
