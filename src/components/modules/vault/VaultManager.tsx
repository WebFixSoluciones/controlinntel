"use client";
import { useState } from "react";
import { useApp } from "@/lib/state";
import {SecureVault} from "./SecureVault";
export function VaultManager() {
  const { clients, clientVaultItems } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState(false);
  if (selected || system) return <div className="space-y-4">
    <button className="rounded-lg border bg-white px-4 py-2 text-sm" onClick={() => { setSelected(null); setSystem(false); }}>Volver a clientes</button>
    <h1 className="text-2xl font-bold">{system ? "Accesos internos del sistema" : clients.find(c => c.id === selected)?.businessName || "Cliente"}</h1>
    <SecureVault key={selected || "system"} clientId={selected || undefined} />
  </div>;
  const notes = (id: string) => clientVaultItems.filter(v => v.clientId === id && v.notes).map(v => `${v.serviceName}: ${v.notes}`).join(" · ");
  const filtered = clients.filter(c => `${c.businessName} ${c.identificationNumber} ${notes(c.id)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className="space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold">Credenciales por cliente</h1><p className="text-sm text-slate-500">Selecciona un abonado para administrar sus accesos guardados en la ficha 360.</p></div><button onClick={() => setSystem(true)} className="rounded-lg border bg-white px-4 py-2 text-sm">Accesos internos del sistema</button></div>
    <label className="block text-sm">Buscar cliente<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre, identificación o notas" className="mt-1 block w-full rounded-lg border p-3" /></label>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[700px] text-left text-sm"><caption className="sr-only">Credenciales agrupadas por abonado</caption>
      <thead className="bg-slate-50"><tr>{["Cliente", "Número de credenciales", "Notas de credenciales", "Acciones"].map(h => <th scope="col" key={h} className="p-4">{h}</th>)}</tr></thead>
      <tbody className="divide-y">{filtered.map(c => <tr key={c.id} className="hover:bg-slate-50">
        <th scope="row" className="p-4"><button onClick={() => setSelected(c.id)} className="font-bold text-blue-700 underline">{c.businessName}</button><div className="text-xs font-normal text-slate-500">{c.identificationNumber}</div></th>
        <td className="p-4 tabular-nums">{clientVaultItems.filter(v => v.clientId === c.id).length}</td><td className="p-4 whitespace-pre-wrap">{notes(c.id) || "—"}</td>
        <td className="p-4"><button onClick={() => setSelected(c.id)} className="text-blue-700 underline">Ver / editar</button></td>
      </tr>)}{!filtered.length && <tr><td colSpan={4} className="p-8 text-center text-slate-500">No se encontraron clientes.</td></tr>}</tbody>
    </table></div>
  </section>;
}
