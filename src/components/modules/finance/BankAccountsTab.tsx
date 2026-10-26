"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { safeNumber, safeFloat } from "@/lib/print-service";
import {
  Building2,
  Plus,
  ArrowRightLeft,
  Wallet,
  X,
  Edit2,
  Power,
} from "lucide-react";
import { BankAccount } from "@/types";

export function BankAccountsTab() {
  const { bankAccounts = [], addBankAccount, updateBankAccount, addFinancialMovement } = useApp();
  const { showSuccess, showError } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Account Form State
  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState<"corriente" | "ahorros" | "caja_efectivo">("corriente");
  const [accountNumber, setAccountNumber] = useState("");
  const [initialBalance, setInitialBalance] = useState<number>(0);

  // Transfer State
  const [originBankId, setOriginBankId] = useState<string>("");
  const [destBankId, setDestBankId] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferRef, setTransferRef] = useState<string>("");

  const handleOpenTransfer = () => {
    const list = bankAccounts || [];
    const firstId = list[0]?.id || "";
    const secondId = list.find((b) => b.id !== firstId)?.id || list[1]?.id || "";
    setOriginBankId(firstId);
    setDestBankId(secondId);
    setTransferAmount(0);
    setTransferRef("");
    setIsTransferModalOpen(true);
  };

  const handleOriginChange = (id: string) => {
    setOriginBankId(id);
    if (destBankId === id) {
      const list = bankAccounts || [];
      const alternative = list.find((b) => b.id !== id)?.id || "";
      setDestBankId(alternative);
    }
  };

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setBankName("");
    setAccountType("corriente");
    setAccountNumber("");
    setInitialBalance(0);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setBankName(account.bankName);
    setAccountType(account.accountType);
    setAccountNumber(account.accountNumber);
    setInitialBalance(account.currentBalance);
    setIsAddModalOpen(true);
  };

  const handleToggleStatus = async (account: BankAccount) => {
    const newStatus = account.status === "activa" ? "inactiva" : "activa";
    try {
      await updateBankAccount(account.id, { status: newStatus });
      showSuccess(
        "Estado Actualizado",
        `La cuenta ${account.bankName} ahora está ${newStatus}.`
      );
    } catch (err: any) {
      showError("Error al Actualizar", err?.message || "No se pudo cambiar el estado de la cuenta.");
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim()) {
      showError("Nombre Requerido", "Ingresa la entidad bancaria o nombre de la caja.");
      return;
    }
    if (!accountNumber.trim()) {
      showError("Número Requerido", "Ingresa el número de cuenta o identificador.");
      return;
    }

    try {
      if (editingAccount) {
        await updateBankAccount(editingAccount.id, {
          bankName: bankName.trim(),
          accountType,
          accountNumber: accountNumber.trim(),
          currentBalance: Number(initialBalance) || 0,
        });
        showSuccess("Cuenta Actualizada", `Datos de ${bankName.trim()} actualizados con éxito.`);
      } else {
        await addBankAccount({
          bankName: bankName.trim(),
          accountType,
          accountNumber: accountNumber.trim(),
          currency: "USD",
          initialBalance: Number(initialBalance) || 0,
          currentBalance: Number(initialBalance) || 0,
          status: "activa",
        });
        showSuccess("Cuenta Creada", `Cuenta ${bankName} (${accountNumber}) registrada con éxito.`);
      }

      setIsAddModalOpen(false);
      setEditingAccount(null);
      setBankName("");
      setAccountNumber("");
      setInitialBalance(0);
    } catch (err: any) {
      showError("Error al Guardar", err?.message || "No se pudo registrar la cuenta.");
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (originBankId === destBankId) {
      showError("Cuentas Iguales", "La cuenta de origen y destino deben ser distintas.");
      return;
    }
    if (transferAmount <= 0) {
      showError("Monto Inválido", "El monto de transferencia debe ser mayor a 0.");
      return;
    }

    const origin = (bankAccounts || []).find((b) => b.id === originBankId);
    const dest = (bankAccounts || []).find((b) => b.id === destBankId);

    if (!origin || !dest) return;

    const originBalance = safeFloat(origin.currentBalance);
    if (originBalance < transferAmount) {
      showError("Saldo Insuficiente", `La cuenta ${origin.bankName} solo dispone de $${safeNumber(originBalance)}.`);
      return;
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      const ref = transferRef.trim() || `TRF-INT-${Date.now().toString().slice(-6)}`;

      // 1. Egreso origen
      await addFinancialMovement({
        type: "egreso",
        date: today,
        amount: transferAmount,
        category: "transferencia_interna",
        description: `Transferencia hacia ${dest.bankName}`,
        bankAccountId: origin.id,
        bankAccountName: origin.bankName,
        paymentMethod: "transferencia",
        referenceNumber: ref,
      });

      // 2. Ingreso destino
      await addFinancialMovement({
        type: "ingreso",
        date: today,
        amount: transferAmount,
        category: "transferencia_interna",
        description: `Transferencia recibida desde ${origin.bankName}`,
        bankAccountId: dest.id,
        bankAccountName: dest.bankName,
        paymentMethod: "transferencia",
        referenceNumber: ref,
      });

      showSuccess(
        "Transferencia Realizada",
        `Se transfirieron $${safeNumber(transferAmount)} desde ${origin.bankName} hacia ${dest.bankName}.`
      );

      setIsTransferModalOpen(false);
      setTransferAmount(0);
      setTransferRef("");
    } catch (err: any) {
      showError("Error al Transferir", err?.message || "No se pudo ejecutar la transferencia.");
    }
  };

  const activeAccounts = (bankAccounts || []).filter((b) => b && b.status === "activa");
  const totalBalance = activeAccounts.reduce((sum, b) => sum + (safeFloat(b.currentBalance) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Resumen de Saldo y Acciones */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#eff4ff] text-[#004ac6] rounded-xl">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-semibold">Saldo Total Disponible:</span>
              <span className="text-base font-bold font-mono text-[#004ac6]">
                ${safeNumber(totalBalance)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {activeAccounts.length} cuentas activas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {bankAccounts.length >= 2 && (
            <button
              type="button"
              onClick={handleOpenTransfer}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-blue-50 text-[#004ac6] border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Transferir</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Cuenta</span>
          </button>
        </div>
      </div>

      {/* Grid of Bank Accounts */}
      {bankAccounts.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-xl border border-dashed border-[#cbd5e1] space-y-3">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="font-bold text-slate-800 text-sm">No hay cuentas bancarias registradas</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Registra una cuenta corriente, de ahorros o caja de efectivo para conciliar cobranzas y pagos.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Primera Cuenta</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bankAccounts.map((account) => {
            const isCash = account.accountType === "caja_efectivo";
            const isActive = account.status === "activa";
            const balanceNum = safeFloat(account.currentBalance);
            const typeLabel = (account.accountType || "corriente").replace(/_/g, " ");

            return (
              <div
                key={account.id}
                className={`p-5 bg-white rounded-xl border transition-all flex flex-col justify-between ${
                  isActive
                    ? "border-[#e2e8f0] shadow-2xs hover:shadow-md"
                    : "border-slate-200/70 opacity-75 bg-slate-50/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`p-2.5 rounded-lg ${
                        isCash ? "bg-[#fffbeb] text-[#b45309]" : "bg-[#eff4ff] text-[#004ac6]"
                      }`}
                    >
                      {isCash ? <Wallet className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${
                          isActive
                            ? "bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]"
                            : "bg-slate-100 text-slate-500 border-slate-300"
                        }`}
                      >
                        {account.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(account)}
                        className="p-1.5 text-slate-400 hover:text-[#004ac6] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        title="Editar cuenta bancaria"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(account)}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          isActive
                            ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                            : "text-emerald-600 hover:bg-emerald-50"
                        }`}
                        title={isActive ? "Desactivar cuenta" : "Reactivar cuenta"}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-[#0b1c30] truncate" title={account.bankName}>
                    {account.bankName}
                  </h3>
                  <p className="text-[11px] text-[#737686] font-mono mt-0.5 capitalize">
                    {typeLabel} • {account.accountNumber}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-[#e2e8f0] flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-[#737686] tracking-wider">
                      Saldo Disponible
                    </div>
                    <div className="text-xl font-bold font-mono text-[#004ac6] mt-0.5">
                      ${safeNumber(balanceNum)}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                    {account.currency || "USD"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nueva / Editar Cuenta */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-[#004ac6] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <h3 className="text-sm font-bold">
                  {editingAccount ? "Editar Cuenta Bancaria" : "Nueva Cuenta Bancaria / Caja"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingAccount(null);
                }}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nombre del Banco o Caja *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Banco Pichincha, Caja General..."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Tipo de Cuenta *
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="corriente">Cuenta Corriente</option>
                    <option value="ahorros">Cuenta de Ahorros</option>
                    <option value="caja_efectivo">Caja Efectivo</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    N° de Cuenta *
                  </label>
                  <input
                    type="text"
                    placeholder="2100492100"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {editingAccount ? "Saldo Actual ($)" : "Saldo Inicial ($)"}
                </label>
                <input
                  type="number"
                  step="any"
                  value={initialBalance || ""}
                  onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingAccount(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Transferir entre Cuentas */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-[#004ac6] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                <h3 className="text-sm font-bold">Transferir entre Cuentas</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Desde Cuenta *
                </label>
                <select
                  value={originBankId}
                  onChange={(e) => handleOriginChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  {(bankAccounts || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName || "Cuenta"} • ${safeNumber(b.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Hacia Cuenta *
                </label>
                <select
                  value={destBankId}
                  onChange={(e) => setDestBankId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  {(bankAccounts || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName || "Cuenta"} • ${safeNumber(b.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Monto ($) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={transferAmount || ""}
                    onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-[#004ac6]"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    N° Referencia
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 009182"
                    value={transferRef}
                    onChange={(e) => setTransferRef(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Transferir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
