"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  FileText,
  Plus,
  Layers,
  ArrowDownLeft,
  CheckCircle,
  AlertCircle,
  Boxes,
  X,
  Search,
} from "lucide-react";
import { PurchaseInvoice, SupplierCreditNote } from "@/types";

interface SupplierCreditNotesTabProps {
  initialInvoice?: PurchaseInvoice | null;
  onClearInitialInvoice?: () => void;
}

export function SupplierCreditNotesTab({
  initialInvoice,
  onClearInitialInvoice,
}: SupplierCreditNotesTabProps) {
  const {
    supplierCreditNotes,
    purchaseInvoices,
    inventoryWarehouses,
    inventoryProducts,
    addSupplierCreditNote,
  } = useApp();
  const { showSuccess, showError } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(!!initialInvoice);
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    initialInvoice?.id || ""
  );
  const [documentNumber, setDocumentNumber] = useState<string>("");
  const [claveAcceso, setClaveAcceso] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState<number>(0);
  const [reason, setReason] = useState<
    "devolucion_mercaderia" | "descuento_bonificacion" | "correccion_precio"
  >("devolucion_mercaderia");

  // Physical return item
  const [returnProductId, setReturnProductId] = useState<string>("");
  const [returnQuantity, setReturnQuantity] = useState<number>(1);
  const [returnWarehouseId, setReturnWarehouseId] = useState<string>(
    inventoryWarehouses[0]?.id || ""
  );
  const [notes, setNotes] = useState<string>("");

  const selectedInvoice = purchaseInvoices.find((inv) => inv.id === selectedInvoiceId);

  const handleOpenModal = (invoice?: PurchaseInvoice) => {
    if (invoice) {
      setSelectedInvoiceId(invoice.id);
      if (invoice.items && invoice.items.length > 0 && invoice.items[0].productId) {
        setReturnProductId(invoice.items[0].productId);
        setTotal(invoice.items[0].total);
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (onClearInitialInvoice) onClearInitialInvoice();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInvoice) {
      showError("Factura Requerida", "Debes seleccionar la factura de compra afectada.");
      return;
    }
    if (!documentNumber.trim()) {
      showError("Número Requerido", "Ingresa el número de la Nota de Crédito.");
      return;
    }
    if (total <= 0) {
      showError("Monto Inválido", "El valor de la nota de crédito debe ser mayor a 0.");
      return;
    }

    try {
      let returnItems = undefined;
      if (reason === "devolucion_mercaderia" && returnProductId) {
        const prod = inventoryProducts.find((p) => p.id === returnProductId);
        returnItems = [
          {
            productId: returnProductId,
            productName: prod ? prod.name : "Producto devuelto",
            warehouseId: returnWarehouseId || inventoryWarehouses[0]?.id || "bod-central",
            quantity: returnQuantity,
            unitCost: total / returnQuantity,
          },
        ];
      }

      await addSupplierCreditNote({
        purchaseInvoiceId: selectedInvoice.id,
        documentNumber: documentNumber.trim(),
        claveAcceso: claveAcceso.trim() || undefined,
        supplierId: selectedInvoice.supplierId,
        supplierName: selectedInvoice.supplierName,
        date,
        total: Number(total),
        reason,
        items: returnItems,
        notes: notes.trim() || undefined,
      });

      showSuccess(
        "Nota de Crédito Registrada",
        `Nota de Crédito ${documentNumber} por $${total.toFixed(2)} aplicada a la factura ${selectedInvoice.documentNumber}.`
      );

      handleCloseModal();
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo registrar la nota de crédito.");
    }
  };

  const filteredNotes = supplierCreditNotes.filter((n) => {
    const q = searchQuery.toLowerCase();
    return (
      n.supplierName.toLowerCase().includes(q) ||
      n.documentNumber.includes(q) ||
      (n.claveAcceso && n.claveAcceso.includes(q))
    );
  });

  return (
    <div className="space-y-6 select-none">
      {/* Header & New Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-[#0b1c30] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#004ac6]" />
            Notas de Crédito Recibidas de Proveedores
          </h2>
          <p className="text-xs text-[#737686]">
            Comprobantes de crédito emitidos por proveedores que reducen saldo en CxP y descuentan stock en devoluciones.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nota de Crédito</span>
        </button>
      </div>

      {/* Search */}
      <div className="p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor o número de nota de crédito..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
            <tr>
              <th className="py-3 px-4 font-bold">Fecha</th>
              <th className="py-3 px-4 font-bold">N° Nota Crédito</th>
              <th className="py-3 px-4 font-bold">Proveedor</th>
              <th className="py-3 px-4 font-bold">Motivo</th>
              <th className="py-3 px-4 font-bold text-center">Devolución Física</th>
              <th className="py-3 px-4 font-bold text-right">Valor Descontado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {filteredNotes.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs text-[#737686]">
                  No hay notas de crédito registradas de proveedores.
                </td>
              </tr>
            ) : (
              filteredNotes.map((note) => (
                <tr key={note.id} className="hover:bg-[#f8f9ff]/60 transition-colors">
                  <td className="py-3 px-4 text-[#0b1c30] font-medium">{note.date}</td>
                  <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">
                    {note.documentNumber}
                  </td>
                  <td className="py-3 px-4 font-bold text-[#0b1c30]">{note.supplierName}</td>
                  <td className="py-3 px-4 text-[#434655] capitalize">
                    {note.reason.replace(/_/g, " ")}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        note.items && note.items.length > 0
                          ? "bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]"
                          : "bg-[#f1f5f9] text-[#64748b] border border-[#cbd5e1]"
                      }`}
                    >
                      {note.items && note.items.length > 0 ? "Sí (Salida Kardex)" : "No (Financiero)"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-[#059669]">
                    -${note.total.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">
                  Registrar Nota de Crédito de Proveedor
                </h3>
                <p className="text-xs text-[#737686]">
                  Aplica una disminución a la deuda y opcionalmente descuenta mercadería de la bodega
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Invoice Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Factura de Compra Afectada *
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30]"
                >
                  <option value="">-- Seleccionar Factura --</option>
                  {purchaseInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.documentNumber} - {inv.supplierName} (${inv.total.toFixed(2)}) - Saldo: ${inv.balanceRemaining.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    N° Nota de Crédito *
                  </label>
                  <input
                    type="text"
                    placeholder="001-002-000004512"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-medium text-[#0b1c30]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Clave de Acceso SRI (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="49 dígitos si fue emitida electrónicamente por el SRI"
                  value={claveAcceso}
                  onChange={(e) => setClaveAcceso(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-medium text-[#0b1c30]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Motivo de Emisión *
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#0b1c30]"
                  >
                    <option value="devolucion_mercaderia">Devolución Física de Mercadería</option>
                    <option value="descuento_bonificacion">Descuento o Bonificación</option>
                    <option value="correccion_precio">Corrección de Precio</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Valor Total Nota Crédito ($) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={total || ""}
                    onChange={(e) => setTotal(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#059669]"
                  />
                </div>
              </div>

              {/* Physical return details */}
              {reason === "devolucion_mercaderia" && (
                <div className="p-3 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl space-y-3">
                  <div className="text-[11px] font-bold text-[#004ac6] uppercase tracking-wider flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5" />
                    <span>Salida de Mercadería en Kardex (SUPPLIER_RETURN)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] font-bold text-[#737686]">Producto a Devolver</label>
                      <select
                        value={returnProductId}
                        onChange={(e) => setReturnProductId(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs font-medium"
                      >
                        <option value="">-- Seleccionar producto --</option>
                        {inventoryProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#737686]">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        value={returnQuantity}
                        onChange={(e) => setReturnQuantity(parseFloat(e.target.value) || 1)}
                        className="w-full px-2 py-1.5 bg-white border border-[#cbd5e1] rounded text-xs text-center font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Notas / Observación
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalle o justificación..."
                  className="w-full p-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-semibold text-[#434655]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Guardar Nota de Crédito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
