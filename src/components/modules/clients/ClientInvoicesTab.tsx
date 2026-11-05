"use client";

import { useMemo, useState } from "react";
import { Search, FileText, Eye } from "lucide-react";
import type { Client } from "@/types";
import { useApp } from "@/lib/state";
import { canReadCollection } from "@/lib/persistence-contracts";
import { clientIssuedInvoices } from "@/lib/client-invoice-history";
import { safeNumber } from "@/lib/print-service";
import { RidePreviewModal } from "../billing/RidePreviewModal";

const statusLabels: Record<string, string> = { registrado: "Registrada", emitida: "Emitida", autorizada: "Autorizada" };

export function ClientInvoicesTab({ client }: { client: Client }) {
  const { billingInvoices, sriCompanyConfig, currentUser } = useApp();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const documents = useMemo(() => clientIssuedInvoices(billingInvoices, client.id), [billingInvoices, client.id]);
  const visible = documents.filter(document => {
    const query = search.trim().toLocaleLowerCase("es");
    return (type === "todos" || (document.documentType || "factura") === type)
      && (!query || `${document.documentNumber} ${(document.items || []).map(item => item.name).join(" ")}`.toLocaleLowerCase("es").includes(query));
  });
  const selected = documents.find(document => document.id === selectedId);
  if (!canReadCollection(currentUser, "billingInvoices")) return <p role="alert" className="text-sm text-slate-600">No tienes acceso al historial de facturación.</p>;

  return <section className="space-y-4">
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText className="w-4 h-4 text-[#004ac6]" />Historial de facturación</h2>
        <p className="text-xs text-slate-500">Facturas y notas de venta emitidas a {client.businessName}.</p>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input aria-label="Buscar comprobante emitido" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por número o concepto..." className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs" />
          </div>
          <select aria-label="Tipo de comprobante emitido" value={type} onChange={event => setType(event.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white">
            <option value="todos">Todos los comprobantes</option><option value="factura">Facturas</option><option value="nota_venta">Notas de venta</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-600"><tr>{["Comprobante", "Tipo", "Fecha de emisión", "Concepto", "Total", "Estado", "Acciones"].map(label => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map(document => <tr key={document.id} className="hover:bg-slate-50">
              <td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(document.id)} className="font-semibold text-[#004ac6] hover:underline whitespace-nowrap">{document.documentNumber}</button></td>
              <td className="px-4 py-3 whitespace-nowrap">{document.documentType === "nota_venta" ? "Nota de venta" : "Factura"}</td>
              <td className="px-4 py-3 whitespace-nowrap">{document.date?.slice(0, 10)}</td>
              <td className="px-4 py-3 max-w-xs"><p className="line-clamp-2">{(document.items || []).map(item => item.name).join(", ") || "Sin detalle"}</p></td>
              <td className="px-4 py-3 font-semibold whitespace-nowrap">${safeNumber(document.total)}</td>
              <td className="px-4 py-3">{statusLabels[document.status] || document.status}</td>
              <td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(document.id)} aria-label={`Ver comprobante ${document.documentNumber}`} className="inline-flex items-center gap-1.5 text-[#004ac6] font-semibold whitespace-nowrap"><Eye className="w-3.5 h-3.5" />Ver / Imprimir</button></td>
            </tr>)}
            {!visible.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">{documents.length ? "No hay comprobantes que coincidan con los filtros." : "Este cliente aún no tiene facturas ni notas de venta emitidas."}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">{visible.length} de {documents.length} comprobantes emitidos</p>
    </div>
    <RidePreviewModal isOpen={Boolean(selected)} invoice={selected} onClose={() => setSelectedId(null)} companyConfig={sriCompanyConfig} />
  </section>;
}
