"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  MapPin,
  Calendar,
} from "lucide-react";
import { useApp } from "@/lib/state";
import { RemissionGuide, RemissionGuideItem, SriInvoice } from "@/types";

interface RemissionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialInvoice?: SriInvoice | null;
  onSuccess?: (guide: RemissionGuide) => void;
}

export function RemissionGuideModal({
  isOpen,
  onClose,
  initialInvoice,
  onSuccess,
}: RemissionGuideModalProps) {
  const { clients, createRemissionGuide, sriCompanyConfig } = useApp();

  const [carrierName, setCarrierName] = useState("Transportes Rápidos Pichincha S.A.");
  const [carrierRuc, setCarrierRuc] = useState("1791234567001");
  const [licensePlate, setLicensePlate] = useState("PCX-4820");

  const [originAddress, setOriginAddress] = useState(
    sriCompanyConfig?.direccionMatriz || "Av. Amazonas N45-12 y Gaspar de Villarroel, Quito"
  );
  const [destAddress, setDestAddress] = useState("");
  const [destClientName, setDestClientName] = useState("");
  const [destClientRuc, setDestClientRuc] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [route, setRoute] = useState("Quito Norte - Iñaquito - Plataforma Financiera");
  const [reason, setReason] = useState("Traslado de equipamiento de red para entrega a cliente corporativo");

  const [items, setItems] = useState<RemissionGuideItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState("unidad");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setStartDate(today);
      setEndDate(tomorrow);

      if (initialInvoice) {
        setDestClientName(initialInvoice.clientName);
        setDestClientRuc(initialInvoice.clientRuc);
        setDestAddress(initialInvoice.clientAddress || "Quito");
        setItems(
          initialInvoice.items.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            sku: it.sku,
          }))
        );
      } else if (clients.length > 0) {
        setDestClientName(clients[0].businessName);
        setDestClientRuc(clients[0].identificationNumber);
        setDestAddress(clients[0].address);
        setItems([
          {
            name: "ONT Huawei EchoLife EG8145V5 Dual Band AC GPON",
            quantity: 2,
            unit: "unidad",
            sku: "ONT-HW-EG8145V5",
          },
        ]);
      }
      setErrorMsg("");
    }
  }, [isOpen, initialInvoice, clients, sriCompanyConfig]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    if (!newItemName.trim() || newItemQty <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        name: newItemName.trim(),
        quantity: newItemQty,
        unit: newItemUnit,
      },
    ]);
    setNewItemName("");
    setNewItemQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carrierName.trim() || !carrierRuc.trim() || !licensePlate.trim()) {
      setErrorMsg("Debe especificar los datos del transportista y placa del vehículo.");
      return;
    }
    if (!destClientName.trim() || !destAddress.trim()) {
      setErrorMsg("Debe indicar el destinatario y la dirección de entrega.");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Debe agregar al menos un ítem al traslado.");
      return;
    }

    setIsSubmitting(true);
    try {
      const guide = await createRemissionGuide({
        date: new Date().toISOString().slice(0, 10),
        startDate,
        endDate,
        invoiceNumber: initialInvoice ? initialInvoice.documentNumber : undefined,
        carrierName,
        carrierRuc,
        licensePlate,
        originAddress,
        destAddress,
        destClientName,
        destClientRuc,
        route,
        reason,
        items,
        status: "emitida",
      });

      if (onSuccess) onSuccess(guide);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al emitir la guía de remisión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-[#e2e8f0] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#004ac6] text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white shadow-xs">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Nueva Guía de Remisión SRI • 06
              </h2>
              <p className="text-xs text-blue-100">
                Sustento electrónico para el transporte y traslado de mercadería autorizada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fila 1: Transportista */}
          <div className="p-4 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0] space-y-3">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#004ac6]" />
              Datos del Transportista
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Razón Social / Conductor *:
                </label>
                <input
                  type="text"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  required
                  className="w-full text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  RUC del Transportista *:
                </label>
                <input
                  type="text"
                  value={carrierRuc}
                  onChange={(e) => setCarrierRuc(e.target.value)}
                  required
                  className="w-full text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white font-mono focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Placa del Vehículo *:
                </label>
                <input
                  type="text"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  required
                  className="w-full text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white font-mono uppercase focus:outline-hidden focus:border-[#004ac6]"
                />
              </div>
            </div>
          </div>

          {/* Fila 2: Origen, Destino y Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Punto de Partida (Origen):
              </label>
              <input
                type="text"
                value={originAddress}
                onChange={(e) => setOriginAddress(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Punto de Llegada (Destino):
              </label>
              <input
                type="text"
                value={destAddress}
                onChange={(e) => setDestAddress(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Destinatario (Cliente):
              </label>
              <input
                type="text"
                value={destClientName}
                onChange={(e) => setDestClientName(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                RUC / Cédula Destinatario:
              </label>
              <input
                type="text"
                value={destClientRuc}
                onChange={(e) => setDestClientRuc(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white font-mono focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Fecha Inicio Traslado:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-[#e2e8f0] p-2 bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Fecha Fin Traslado:
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full text-xs rounded-lg border border-[#e2e8f0] p-2 bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Ruta del Traslado:
              </label>
              <input
                type="text"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Motivo del Traslado:
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
            </div>
          </div>

          {/* Fila 3: Mercadería Transportada */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Mercadería Transportada
            </span>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Descripción del equipo o material..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="flex-1 text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
              <input
                type="number"
                min="1"
                placeholder="Cant."
                value={newItemQty}
                onChange={(e) => setNewItemQty(parseFloat(e.target.value) || 1)}
                className="w-20 text-center text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white font-bold"
              />
              <input
                type="text"
                placeholder="Unidad"
                value={newItemUnit}
                onChange={(e) => setNewItemUnit(e.target.value)}
                className="w-24 text-xs rounded-lg border border-[#e2e8f0] p-2.5 bg-white focus:outline-hidden focus:border-[#004ac6]"
              />
              <button
                type="button"
                onClick={handleAddItem}
                className="px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>

            <div className="rounded-xl border border-[#e2e8f0] overflow-hidden bg-white shadow-2xs">
              <table className="table-fixed w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f8f9ff] text-[#004ac6] font-bold text-xs uppercase tracking-wider border-b border-[#e2e8f0]">
                    <th className="py-2.5 px-3 w-7/12">Descripción de la Mercadería</th>
                    <th className="py-2.5 px-2 text-center w-2/12">Cantidad</th>
                    <th className="py-2.5 px-2 text-center w-2/12">Unidad</th>
                    <th className="py-2.5 px-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className="py-2 px-3 font-medium text-slate-900 truncate">{it.name}</td>
                      <td className="py-2 px-2 text-center font-bold text-slate-800">{it.quantity}</td>
                      <td className="py-2 px-2 text-center text-slate-600">{it.unit}</td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-[#e2e8f0] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="px-6 py-2.5 rounded-lg bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Emitir Guía de Remisión SRI</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
