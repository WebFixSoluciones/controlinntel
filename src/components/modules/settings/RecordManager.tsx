"use client";
import { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import type { Entity } from "@/lib/permissions";
import { Plus, Edit2, Trash2, Check, X } from "lucide-react";

export type Field = {
  key: string;
  label: string;
  type?: "number" | "date" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
};

export function RecordManager({
  entity,
  title,
  fields,
  defaults = {},
  filter,
}: {
  entity: Entity;
  title: string;
  fields: Field[];
  defaults?: Record<string, unknown>;
  filter?: (row: Record<string, unknown>) => boolean;
}) {
  const app = useApp(),
    { showSuccess, showError } = useToast();
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const source = app[entity as keyof typeof app];
  const records = (Array.isArray(source) ? source : []) as unknown as Record<string, unknown>[];
  const rows = filter ? records.filter(filter) : records;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const values = new FormData(event.currentTarget),
      data: Record<string, unknown> = { ...defaults };
    for (const field of fields)
      data[field.key] =
        field.type === "number"
          ? Number(values.get(field.key))
          : String(values.get(field.key) || "");
    try {
      await app.saveRecord(entity, data, selected?.id as string | undefined);
      setSelected(null);
      showSuccess("Guardado", "Registro actualizado correctamente.");
    } catch (e) {
      showError("No se guardó", e instanceof Error ? e.message : "Revisa los datos.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (confirm("¿Confirmas la eliminación de este registro?")) {
      try {
        await app.deleteRecord(entity, id);
        showSuccess("Eliminado", "Registro removido del sistema.");
      } catch (e) {
        showError("Error", "No se pudo eliminar el registro.");
      }
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-[#e2e8f0] p-6 space-y-4 shadow-lumina-card select-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-[#0b1c30]">{title}</h2>
        <button
          onClick={() => setSelected({ ...defaults })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#004ac6] hover:bg-[#2563eb] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agregar</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[#f8f9ff] text-[#004ac6] font-bold text-[11px] uppercase tracking-wider border-b border-[#e2e8f0]">
            <tr>
              {fields.slice(0, 4).map((f) => (
                <th key={f.key} className="text-left py-3 px-4 font-bold">
                  {f.label}
                </th>
              ))}
              <th className="text-right py-3 px-4 font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-[#0b1c30]">
            {rows.map((row) => (
              <tr key={String(row.id)} className="hover:bg-[#f8f9ff] transition-colors">
                {fields.slice(0, 4).map((f) => (
                  <td key={f.key} className="py-3 px-4 font-medium text-[#0b1c30]">
                    {f.options?.find((o) => o.value === row[f.key])?.label ||
                      String(row[f.key] ?? "—")}
                  </td>
                ))}
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    onClick={() => setSelected(row)}
                    className="inline-flex items-center gap-1 text-[#004ac6] hover:text-[#2563eb] font-bold cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(String(row.id))}
                    className="inline-flex items-center gap-1 text-[#737686] hover:text-red-600 font-bold cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!rows.length && <p className="text-xs text-[#737686] italic py-3 text-center">Sin registros configurados.</p>}

      {selected && (
        <form
          key={String(selected.id || "new")}
          onSubmit={submit}
          className="grid md:grid-cols-2 gap-4 border-t border-[#e2e8f0] pt-4"
        >
          {fields.map((f) => (
            <label key={f.key} className="text-xs font-bold text-[#434655]">
              {f.label}
              {f.type === "select" ? (
                <select
                  name={f.key}
                  required={f.required !== false}
                  defaultValue={String(selected[f.key] ?? "")}
                  className="mt-1 block w-full border border-[#cbd5e1] rounded-lg p-2 text-xs font-medium text-[#0b1c30]"
                >
                  <option value="">Selecciona...</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={f.key}
                  type={f.type || "text"}
                  step={f.type === "number" ? "any" : undefined}
                  required={f.required !== false}
                  defaultValue={String(selected[f.key] ?? "")}
                  className="mt-1 block w-full border border-[#cbd5e1] rounded-lg p-2 text-xs font-medium text-[#0b1c30]"
                />
              )}
            </label>
          ))}
          <div className="md:col-span-2 flex gap-3 items-center pt-2">
            <button
              disabled={busy}
              className="bg-[#004ac6] hover:bg-[#2563eb] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              {busy ? "Guardando…" : "Guardar Cambios"}
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="px-4 py-2 rounded-lg text-xs font-bold text-[#737686] hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export function PlansManager() {
  return (
    <RecordManager
      entity="plans"
      title="Catálogo Institucional de Planes de Servicio"
      defaults={{ description: "", billingType: "pospago" }}
      fields={[
        { key: "name", label: "Nombre del Plan" },
        { key: "defaultPrice", label: "Tarifa Mensual ($ USD)", type: "number" },
        {
          key: "billingType",
          label: "Modalidad de Facturación",
          type: "select",
          options: [
            { value: "pospago", label: "Pospago" },
            { value: "prepago", label: "Prepago" },
          ],
        },
        { key: "description", label: "Descripción Comercial", required: false },
      ]}
    />
  );
}
export function PoolsEditor(){
 const {nodes}=useApp();
 return <RecordManager entity="ipPools" title="Administrar pools IP" defaults={{assignedIpsCount:0}} fields={[
 {key:"name",label:"Nombre"},{key:"subnetCidr",label:"Subred CIDR"},{key:"gateway",label:"Puerta de enlace"},
 {key:"nodeId",label:"Nodo",type:"select",options:nodes.map(n=>({value:n.id,label:n.name}))},
 {key:"type",label:"Tipo",type:"select",options:[{value:"cgnat",label:"CGNAT"},{value:"publica_fija",label:"IP pública fija"},{value:"ipv6_pool",label:"IPv6"}]},
 {key:"totalIpsCount",label:"Direcciones totales",type:"number"},{key:"usableIpsCount",label:"Disponibles",type:"number"},{key:"assignedIpsCount",label:"Asignadas",type:"number"}
 ]}/>;
}
export function ServiceEditor({clientId}:{clientId:string}){
 const {plans,nodes}=useApp();
 return <RecordManager entity="clientServices" title="Servicios y estado de instalación" defaults={{clientId,status:"en_instalacion",billingType:"pospago",cutoffDay:1,ipv4Address:"",pppoeUser:"",installationDate:new Date().toISOString().slice(0,10)}} filter={r=>r.clientId===clientId} fields={[
 {key:"planId",label:"Plan",type:"select",options:plans.map(p=>({value:p.id,label:p.name}))},
 {key:"nodeId",label:"Nodo",type:"select",options:nodes.map(n=>({value:n.id,label:n.name}))},
 {key:"customPrice",label:"Tarifa mensual",type:"number"},{key:"ipv4Address",label:"IPv4",required:false},{key:"ipv6Prefix",label:"Prefijo IPv6",required:false},{key:"pppoeUser",label:"Usuario PPPoE",required:false},
 {key:"status",label:"Estado",type:"select",options:["en_instalacion","activo","suspendido","retirado"].map(v=>({value:v,label:v.replaceAll("_"," ")}))}
 ]}/>;
}

