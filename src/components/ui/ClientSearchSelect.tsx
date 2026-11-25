"use client";

import React, { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { searchClients, type SearchableClient } from "@/lib/client-search";

interface ClientSearchSelectProps {
  clients: readonly SearchableClient[];
  value: string;
  onChange: (clientId: string) => void;
  required?: boolean;
  disabled?: boolean;
  label?: string;
}

export function ClientSearchSelect({ clients, value, onChange, required, disabled, label = "Cliente Asignado" }: ClientSearchSelectProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchClients(clients, query), [clients, query]);
  const selected = clients.find(client => client.id === value);
  const keepSelection = selected && !matches.some(client => client.id === value);
  const searching = !!query.trim();

  return (
    <div className="space-y-2 min-w-0">
      <label htmlFor={`${id}-search`} className="sr-only">Buscar cliente por nombre, RUC o cédula</label>
      <div className="relative">
        <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-slate-400 pointer-events-none" />
        <input id={`${id}-search`} type="search" value={query} disabled={disabled} autoComplete="off"
          onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre, RUC o cédula..."
          aria-controls={`${id}-clients`} aria-describedby={`${id}-results`}
          className="w-full min-w-0 rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004ac6]" />
      </div>
      <label htmlFor={`${id}-clients`} className="sr-only">{label}</label>
      <select id={`${id}-clients`} value={value} required={required} disabled={disabled}
        size={searching ? Math.min(5, Math.max(2, matches.length + 1 + (keepSelection ? 1 : 0))) : 1}
        onChange={event => { onChange(event.target.value); setQuery(""); }}
        className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004ac6]">
        <option value="">-- Seleccionar cliente --</option>
        {keepSelection && <option value={selected.id}>{selected.businessName} ({selected.identificationNumber}) — seleccionado</option>}
        {matches.map(client => <option key={client.id} value={client.id}>{client.businessName} ({client.identificationNumber})</option>)}
      </select>
      <p id={`${id}-results`} role="status" className="text-xs text-slate-500">
        {searching ? matches.length ? `${matches.length} coincidencia(s). Selecciona un cliente.` : "No se encontraron clientes."
          : "Puedes buscar por parte del nombre, nombre comercial, RUC o cédula."}
      </p>
    </div>
  );
}
