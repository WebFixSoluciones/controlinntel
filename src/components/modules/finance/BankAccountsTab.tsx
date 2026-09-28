"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  Building2,
  Plus,
  ArrowRightLeft,
  DollarSign,
  Wallet,
  CheckCircle,
  X,
  CreditCard,
} from "lucide-react";
import { BankAccount } from "@/types";

export function BankAccountsTab() {
  const { bankAccounts, addBankAccount, updateBankAccount, addFinancialMovement } = useApp();
  const { showSuccess, showError } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // New Account State
  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState<"corriente" | "ahorros" | "caja_efectivo">("corriente");
  const [accountNumber, setAccountNumber] = useState("");
  const [initialBalance, setInitialBalance] = useState<number>(0);

  // Transfer State
  const [originBankId, setOriginBankId] = useState<string>(bankAccounts[0]?.id || "");
  const [destBankId, setDestBankId] = useState<string>(bankAccounts[1]?.id || "");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferRef, setTransferRef] = useState<string>("");

  const handleCreateAccount = async (e: React.FormEvent) => {
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
      setIsAddModalOpen(false);
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

    const origin = bankAccounts.find((b) => b.id === originBankId);
    const dest = bankAccounts.find((b) => b.id === destBankId);

    if (!origin || !dest) return;

    if (origin.currentBalance < transferAmount) {
      showError("Saldo Insuficiente", `La cuenta ${origin.bankName} solo dispone de $${origin.currentBalance.toFixed(2)}.`);
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
        `Se transfirieron $${transferAmount.toFixed(2)} desde ${origin.bankName} hacia ${dest.bankName}.`
      );

      setIsTransferModalOpen(false);
      setTransferAmount(0);
      setTransferRef("");
    } catch (err: any) {
      showError("Error al Transferir", err?.message || "No se pudo ejecutar la transferencia.");
    }
  };

  const totalBalance = bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);

  return (
    <div className="space-y-6 select-none">
      {/* Header & Action buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-[#0b1c30] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#004ac6]" />
            Cuentas Bancarias & Cajas de INNTEL CORP
          </h2>
          <p className="text-xs text-[#737686]">
            Control de liquidez, cuentas corrientes, ahorros y caja chica operativa en USD.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#f8f9ff] hover:bg-[#eff4ff] text-[#004ac6] border border-[#dce9ff] rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Transferir entre Cuentas</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Cuenta</span>
          </button>
        </div>
      </div>

      {/* Grid of Bank Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {bankAccounts.map((account) => {
          const isCash = account.accountType === "caja_efectivo";

          return (
            <div
              key={account.id}
              className="p-5 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl ${isCash ? "bg-[#fffbeb] text-[#b45309]" : "bg-[#eff4ff] text-[#004ac6]"}`}>
                    {isCash ? <Wallet className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
                    {account.status}
                  </span>
                </div>

                <h3 className="mt-3 text-sm font-bold text-[#0b1c30] truncate" title={account.bankName}>
                  {account.bankName}
                </h3>
                <p className="text-[11px] text-[#737686] font-mono mt-0.5">
                  {account.accountType.replace(/_/g, " ")} • {account.accountNumber}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
                <div className="text-[10px] uppercase font-bold text-[#737686] tracking-wider">
                  Saldo Disponible
                </div>
                <div className="text-xl font-bold font-mono text-[#004ac6] mt-0.5">
                  ${account.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Nueva Cuenta */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">Añadir Cuenta Bancaria o Caja</h3>
                <p className="text-xs text-[#737686]">Registra una entidad financiera para los movimientos</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Nombre de la Entidad / Caja *
                </label>
                <input
                  type="text"
                  placeholder="ej. Banco Internacional, Caja Chica Norte"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    Tipo de Cuenta *
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs capitalize"
                  >
                    <option value="corriente">Cuenta Corriente</option>
                    <option value="ahorros">Cuenta de Ahorros</option>
                    <option value="caja_efectivo">Caja Efectivo</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                    N° de Cuenta / Identificador *
                  </label>
                  <input
                    type="text"
                    placeholder="2100492100"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Saldo Inicial ($ USD)
                </label>
                <input
                  type="number"
                  step="any"
                  value={initialBalance || ""}
                  onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8f0]">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-[#434655]">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer">
                  Guardar Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Transferencia entre Cuentas */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8f9ff]">
              <div>
                <h3 className="text-base font-bold text-[#0b1c30]">Transferir entre Cuentas Propias</h3>
                <p className="text-xs text-[#737686]">Mueve saldo entre bancos o reposición de caja chica</p>
              </div>
              <button onClick={() => setIsTransferModalOpen(false)} className="p-1.5 rounded-lg text-[#737686] hover:bg-[#e2e8f0]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Cuenta de Origen (Debitar) *
                </label>
                <select
                  value={originBankId}
                  onChange={(e) => setOriginBankId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} (${b.currentBalance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Cuenta de Destino (Acreditar) *
                </label>
                <select
                  value={destBankId}
                  onChange={(e) => setDestBankId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} (${b.currentBalance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  Monto a Transferir ($) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={transferAmount || ""}
                  onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono font-bold text-[#004ac6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  N° Comprobante / Referencia
                </label>
                <input
                  type="text"
                  placeholder="TRF-009182"
                  value={transferRef}
                  onChange={(e) => setTransferRef(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8f0]">
                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-[#434655]">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer">
                  Confirmar Transferencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
