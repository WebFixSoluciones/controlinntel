"use client";

import { useState } from "react";
import { useApp } from "@/lib/state";
import { ClientContractInfo } from "@/types";

type Draft = Omit<ClientContractInfo, "id">;

export function ContractsManager({ clientId }: { clientId?: string }) {
  const { clients, clientContracts, addClientContract, updateClientContract } = useApp();
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const field = "block mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
  const clientName = (id: string) => clients.find(c => c.id === id)?.businessName || "Abonado no disponible";
  const filtered = clientContracts.filter(c =>
    (!clientId || c.clientId === clientId) && (!clientFilter || c.clientId === clientFilter) &&
    (!status || c.status === status) && (!from || c.expirationDate >= from) && (!until || c.expirationDate <= until) &&
    `${clientName(c.clientId)} ${c.contractNumber} ${c.arcotelHomologationCode} ${c.planName}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  );
  function open(contract?: ClientContractInfo) {
    setEditingId(contract?.id || null);
    setDraft(contract ? { ...contract } : {
      clientId: clientId || clientFilter, contractNumber: "", arcotelHomologationCode: "", planName: "",
      signedDate: "", expirationDate: "", status: "vigente", monthlyPrice: 0, notes: "",
    });
    setError(""); setMessage("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    if (!draft.clientId || !draft.contractNumber.trim() || !draft.planName.trim() || !draft.signedDate || !draft.expirationDate || draft.expirationDate < draft.signedDate || !Number.isFinite(draft.monthlyPrice) || draft.monthlyPrice < 0) {
      setError("Completa abonado, número, servicio y fechas válidas. La fecha de fin debe ser igual o posterior al inicio y la tarifa no puede ser negativa."); return;
    }
    if (clientContracts.some(c => c.id !== editingId && c.clientId === draft.clientId && c.contractNumber.trim().toLocaleLowerCase() === draft.contractNumber.trim().toLocaleLowerCase())) {
      setError("Este abonado ya tiene un contrato con ese número."); return;
    }
    setBusy(true); setError("");
    try {
      const data = { ...draft, contractNumber: draft.contractNumber.trim(), planName: draft.planName.trim() };
      if (editingId) await updateClientContract(editingId, data);
      else await addClientContract(data);
      setDraft(null); setMessage("Contrato guardado. La ficha 360 y el listado utilizan este mismo registro.");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar el contrato."); }
    finally { setBusy(false); }
  }
  if (draft) return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-bold text-balance">{editingId ? `Administrar contrato ${draft.contractNumber}` : "Registrar contrato de abonado"}</h2>
      <form onSubmit={save} className="mt-5 space-y-4">
        <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2 disabled:opacity-60">
          <label>Abonado<select required disabled={!!clientId || !!editingId} className={field} value={draft.clientId} onChange={e => setDraft({ ...draft, clientId: e.target.value })}>
            <option value="">Selecciona un abonado</option>
            {!clients.some(c => c.id === draft.clientId) && draft.clientId && <option value={draft.clientId}>Abonado no disponible</option>}
            {clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}
          </select></label>
          <label>Número de contrato<input required className={field} value={draft.contractNumber} onChange={e => setDraft({ ...draft, contractNumber: e.target.value })} /></label>
          <label>Servicio / infraestructura contratada<input required className={field} value={draft.planName} onChange={e => setDraft({ ...draft, planName: e.target.value })} /></label>
          <label>Código de homologación<input className={field} value={draft.arcotelHomologationCode} onChange={e => setDraft({ ...draft, arcotelHomologationCode: e.target.value })} /></label>
          <label>Fecha de inicio<input required type="date" className={field} value={draft.signedDate} onChange={e => setDraft({ ...draft, signedDate: e.target.value })} /></label>
          <label>Fecha de fin<input required type="date" min={draft.signedDate} className={field} value={draft.expirationDate} onChange={e => setDraft({ ...draft, expirationDate: e.target.value })} /></label>
          <label>Tarifa mensual (USD)<input required type="number" min="0" step="0.01" className={field} value={draft.monthlyPrice} onChange={e => setDraft({ ...draft, monthlyPrice: Number(e.target.value) })} /></label>
          <label>Estado<select className={field} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as ClientContractInfo["status"] })}>
            <option value="vigente">Vigente</option><option value="por_renovar">Por renovar</option><option value="vencido">Vencido</option>
          </select></label>
          <label className="md:col-span-2">Qué incluye el servicio / condiciones del contrato<textarea rows={5} className={field} value={draft.notes || ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-3"><button disabled={busy} type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-60">{busy ? "Guardando…" : "Guardar contrato"}</button><button disabled={busy} type="button" onClick={() => setDraft(null)} className="rounded-lg border px-4 py-2">Volver al listado</button></div>
      </form>
    </section>
  );
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-balance">Contratos de abonados</h1><p className="text-sm text-slate-500 text-pretty">Seguimiento de servicios, infraestructura, adhesión y homologación de cada cliente.</p></div><button onClick={() => open()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Registrar contrato</button></div>
    {message && <p role="status" className="text-sm text-green-700">{message}</p>}
    <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4 text-xs">
      <label className="flex-1 min-w-48">Buscar<input className={field} placeholder="Cliente, número, servicio u homologación" value={query} onChange={e => setQuery(e.target.value)} /></label>
      {!clientId && <label>Abonado<select className={field} value={clientFilter} onChange={e => setClientFilter(e.target.value)}><option value="">Todos los abonados</option>{clients.map(c => <option key={c.id} value={c.id}>{c.businessName}</option>)}</select></label>}
      <label>Estado<select className={field} value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option><option value="vigente">Vigente</option><option value="por_renovar">Por renovar</option><option value="vencido">Vencido</option></select></label>
      <label>Vence desde<input type="date" className={field} value={from} onChange={e => setFrom(e.target.value)} /></label><label>Vence hasta<input type="date" className={field} value={until} onChange={e => setUntil(e.target.value)} /></label>
      <button onClick={() => { setQuery(""); setClientFilter(""); setStatus(""); setFrom(""); setUntil(""); }} className="self-end rounded-lg border px-3 py-2">Limpiar filtros</button>
    </div>
    <p className="text-xs text-slate-500" role="status">{filtered.length} contratos encontrados. Selecciona el número para administrar el contrato.</p>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[1000px] text-left text-xs tabular-nums">
      <caption className="sr-only">Contratos registrados en las fichas 360 de los abonados</caption>
      <thead className="bg-slate-50 text-slate-600"><tr>{["Abonado", "Número de contrato", "Servicio / infraestructura", "Homologación", "Inicio", "Fin", "Estado", "Mensualidad"].map(h => <th scope="col" key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
      <tbody className="divide-y">{filtered.map(c => <tr key={c.id} className="hover:bg-slate-50">
        <td className="px-4 py-4 font-semibold">{clientName(c.clientId)}</td><th scope="row" className="px-4 py-4"><button onClick={() => open(c)} className="font-bold text-blue-700 underline">{c.contractNumber}</button></th>
        <td className="px-4 py-4">{c.planName}</td><td className="px-4 py-4">{c.arcotelHomologationCode || "—"}</td><td className="px-4 py-4 whitespace-nowrap">{c.signedDate}</td><td className="px-4 py-4 whitespace-nowrap">{c.expirationDate}</td><td className="px-4 py-4">{c.status.replaceAll("_", " ")}</td><td className="px-4 py-4">${c.monthlyPrice.toFixed(2)}</td>
      </tr>)}{!filtered.length && <tr><td colSpan={8} className="p-8 text-center text-slate-500">No hay contratos para estos filtros. Puedes limpiar los filtros o registrar un contrato.</td></tr>}</tbody>
    </table></div>
  </section>;
}
