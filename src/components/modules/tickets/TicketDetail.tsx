"use client";
import { useState } from "react";
import { useApp } from "@/lib/state";
import { TicketStatus } from "@/types";

export function TicketDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { tickets, replyToTicket, updateTicketStatus } = useApp();
  const ticket = tickets.find(t => t.id === id);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function send(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await replyToTicket(id, body); setBody(""); setNotice("Respuesta guardada en el historial del ticket."); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar la respuesta."); }
    finally { setBusy(false); }
  }
  async function changeStatus(value: TicketStatus) {
    setBusy(true); setError("");
    try { await updateTicketStatus(id, value); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo actualizar el estado."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <button disabled={busy} onClick={onBack} className="rounded-lg border bg-white px-4 py-2">Volver a tickets</button>
    {!ticket ? <p>Ticket no disponible.</p> : <>
      <div className="rounded-xl border bg-white p-5 space-y-3">
        <h1 className="text-xl font-bold">{ticket.ticketNumber} — {ticket.title}</h1>
        <p>{ticket.clientName} · {new Date(ticket.createdAt).toLocaleString("es-EC")}</p>
        <p className="text-sm text-slate-600">Asignado a: {ticket.assignedToName || "NOC Central"} · Prioridad: {ticket.priority}{ticket.nodeName ? ` · Nodo: ${ticket.nodeName}` : ""}</p>
        <label className="block">Estado<select disabled={busy} value={ticket.status} onChange={e => void changeStatus(e.target.value as TicketStatus)} className="ml-3 rounded-lg border p-2">{["abierto","en_progreso","resuelto","cerrado"].map(s => <option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></label>
      </div>
      <div className="rounded-xl border bg-white p-5 space-y-4"><h2 className="font-bold">Conversación del ticket</h2>
        <article className="border-l-2 border-blue-600 pl-4"><p className="text-xs text-slate-500">Solicitud inicial · {ticket.clientName}</p><p className="whitespace-pre-wrap break-words">{ticket.description}</p></article>
        {ticket.resolutionNotes && <article className="border-l-2 pl-4"><p className="text-xs text-slate-500">Nota de resolución registrada</p><p className="whitespace-pre-wrap">{ticket.resolutionNotes}</p></article>}
        {[...(ticket.messages || [])].sort((a,b) => a.createdAt.localeCompare(b.createdAt)).map(m => <article key={m.id} className="border-l-2 border-blue-200 pl-4"><p className="text-xs text-slate-500">{m.authorName} · {new Date(m.createdAt).toLocaleString("es-EC")}</p><p className="whitespace-pre-wrap break-words">{m.body}</p></article>)}
        <form onSubmit={send} className="space-y-3"><label className="block text-sm">Respuesta<textarea required maxLength={5000} disabled={busy} rows={4} value={body} onChange={e => setBody(e.target.value)} className="mt-1 block w-full rounded-lg border p-3" /></label><button disabled={busy || !body.trim()} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{busy ? "Guardando…" : "Guardar respuesta"}</button><p className="text-xs text-slate-500">Se registra en el historial interno del ticket.</p></form>
      </div>
    </>}
    {error && <p role="alert" className="text-red-700">{error}</p>}{notice && <p role="status" className="text-green-700">{notice}</p>}
  </section>;
}
