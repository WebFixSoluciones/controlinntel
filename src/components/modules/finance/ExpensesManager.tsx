"use client";

import { useRef, useState, type FormEvent } from "react";
import { Plus, Settings2, X } from "lucide-react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { validateMonetaryAmount } from "@/lib/validation-engine";
import { getEcuadorDate } from "@/lib/date-utils";
import { canUser } from "@/lib/permissions";
import { canManageExpenseCategories, expenseCategoriesWithDefaults, expenseCategoryKey, type ExpenseCategory } from "@/lib/expense-categories";
import { summarizeOperatingExpenses } from "@/lib/financial-summary";

const field = "block w-full mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2";
const primary = "rounded-lg bg-[#004ac6] px-4 py-2 font-semibold text-white hover:bg-[#003da6] disabled:opacity-50";
const secondary = "rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold hover:bg-slate-50 disabled:opacity-50";

export function ExpensesManager() {
  const { currentUser, expenses, expenseCategories, suppliers, addExpense, bankAccounts, saveRecord } = useApp();
  const { showSuccess } = useToast();
  const canRegister = canUser(currentUser, "finanzas", "canRegisterExpenses");
  const canManage = canManageExpenseCategories(currentUser);
  const categories = expenseCategoriesWithDefaults(expenseCategories);
  const categoryNames = new Map(categories.map(item => [item.id, item.name]));
  const activeCategories = categories.filter(item => item.active);
  const activeAccounts = bankAccounts.filter(account => account.status === "activa");
  const [modal, setModal] = useState<"expense" | "categories" | null>(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [expenseDate, setExpenseDate] = useState(getEcuadorDate);
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [categoryDraft, setCategoryDraft] = useState<ExpenseCategory | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const selectedSupplier = suppliers.find(supplier => supplier.id === supplierId);
  const supplierKey = expenseCategoryKey(supplierQuery);
  const supplierMatches = suppliers.filter(supplier => supplier.status !== "inactivo" && supplierKey.length >= 2 &&
    [supplier.razonSocial, supplier.nombreComercial, supplier.ruc].some(value => value && expenseCategoryKey(value).includes(supplierKey))
  ).slice(0, 8);

  const filteredExpenses = expenses.filter(expense => (!categoryFilter || expense.category === categoryFilter) &&
    [expense.supplierName, expense.supplierRuc, expense.description, expense.invoiceNumber]
      .some(value => value && expenseCategoryKey(value).includes(expenseCategoryKey(filterQuery)))
  ).sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  const accountNames = new Map(bankAccounts.map(account => [account.id, account.bankName]));
  const filterCategories = new Map([...expenses.map(expense => [expense.category, expense.category.replaceAll("_", " ")] as const), ...categoryNames]);

  const openExpense = () => {
    setSupplierQuery(""); setSupplierId(""); setShowSuppliers(false);
    setAmount(""); setCategory(""); setBankAccountId(activeAccounts.length === 1 ? activeAccounts[0].id : "");
    setExpenseDate(getEcuadorDate()); setReference(""); setDescription(""); setError(""); setModal("expense");
  };

  const save = async (action: () => Promise<void>) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el registro.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const registerExpense = async (event: FormEvent) => {
    event.preventDefault();
    const account = activeAccounts.find(item => item.id === bankAccountId);
    const validation = validateMonetaryAmount(Number(amount), "Valor del gasto");
    if (!account || !validation.isValid || !activeCategories.some(item => item.id === category) || !supplierQuery.trim() || !description.trim()) {
      setError(!validation.isValid ? validation.error || "Ingresa un importe válido." : "Completa los campos obligatorios.");
      return;
    }
    await save(async () => {
      await addExpense({
        supplierName: selectedSupplier?.razonSocial || supplierQuery.trim(),
        ...(selectedSupplier ? { supplierId: selectedSupplier.id } : {}),
        category, amount: Number(amount), expenseDate, bankAccountId,
        invoiceNumber: reference.trim() || undefined,
        description: description.trim(),
        paymentMethod: account.accountType === "caja_efectivo" ? "efectivo" : "transferencia",
      });
      setModal(null);
      showSuccess("Gasto registrado", `Se registró la salida de $${Number(amount).toFixed(2)} en ${account.bankName}.`);
    });
  };

  const saveCategory = (item: ExpenseCategory) => save(async () => {
    const name = item.name.trim();
    if (name.length < 2) throw new Error("Escribe un nombre de al menos dos caracteres.");
    await saveRecord("expenseCategories", { name, active: item.active }, item.id || crypto.randomUUID());
    setCategoryDraft(null);
    showSuccess("Categoría actualizada", name);
  });

  return (
    <div className="space-y-4 text-xs">
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <input aria-label="Buscar gastos" placeholder="Proveedor, RUC, referencia o detalle" value={filterQuery} onChange={e => setFilterQuery(e.target.value)} className={`${field} max-w-sm flex-1 min-w-44`} />
          <select aria-label="Filtrar por categoría" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={`${field} w-auto`}>
            <option value="">Todas las categorías</option>
            {[...filterCategories].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <span className="mr-auto font-semibold">Total filtrado: ${summarizeOperatingExpenses(filteredExpenses).total.toFixed(2)}</span>
          {canManage && <button type="button" className={`inline-flex items-center gap-1.5 ${secondary}`} onClick={() => { setCategoryDraft(null); setError(""); setModal("categories"); }}><Settings2 className="size-4" /> Categorías</button>}
          {canRegister && <button type="button" className={`inline-flex items-center gap-1.5 ${primary}`} onClick={openExpense}><Plus className="size-4" /> Registrar gasto</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left">
            <thead className="bg-[#f8f9ff] uppercase text-[#004ac6]">
              <tr><th className="p-3">Fecha</th><th className="p-3">Proveedor / Beneficiario</th><th className="p-3">Categoría</th><th className="p-3">Concepto / Referencia</th><th className="p-3">Cuenta</th><th className="p-3 text-right">Monto</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map(expense => (
                <tr key={expense.id}>
                  <td className="p-3 whitespace-nowrap">{expense.expenseDate}</td>
                  <td className="p-3 font-semibold">{expense.supplierName}{expense.supplierRuc && <span className="block font-normal text-slate-500">{expense.supplierRuc}</span>}</td>
                  <td className="p-3">{categoryNames.get(expense.category) || expense.category.replaceAll("_", " ")}</td>
                  <td className="p-3">{expense.description}{expense.invoiceNumber && <span className="block text-slate-500">{expense.invoiceNumber}</span>}</td>
                  <td className="p-3">{accountNames.get(expense.bankAccountId || "") || "—"}</td>
                  <td className="p-3 text-right font-mono font-semibold">${expense.amount.toFixed(2)}</td>
                </tr>
              ))}
              {!filteredExpenses.length && <tr><td colSpan={6} className="p-10 text-center text-slate-500">Sin gastos con los filtros seleccionados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="expenses-dialog-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8f9ff] p-4">
            <h2 id="expenses-dialog-title" className="text-sm font-bold">{modal === "expense" ? "Registrar gasto" : "Categorías de gastos"}</h2>
            <button type="button" aria-label="Cerrar" disabled={busy} onClick={() => setModal(null)} className="p-1"><X className="size-4" /></button>
          </div>
          {modal === "expense" ? <form onSubmit={registerExpense} className="space-y-3 p-4">
            <p className="text-slate-600">Registra aquí una salida ya pagada. Las facturas de proveedores con saldo pendiente se gestionan en Compras.</p>
            <div>
              <label htmlFor="expense-supplier" className="font-semibold">Proveedor / Beneficiario *</label>
              <input id="expense-supplier" required maxLength={500} value={supplierQuery} autoComplete="off" placeholder="Buscar por nombre, razón social o RUC" className={field}
                onFocus={() => setShowSuppliers(true)} onChange={e => { setSupplierQuery(e.target.value); setSupplierId(""); setShowSuppliers(true); }} />
              {selectedSupplier ? <p className="mt-1 text-slate-600">Proveedor vinculado · {selectedSupplier.ruc}</p> :
                showSuppliers && supplierKey.length >= 2 ? <div aria-label="Resultados de proveedores" className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-200">
                  {supplierMatches.map(supplier => <button key={supplier.id} type="button" className="block w-full px-3 py-2 text-left hover:bg-blue-50"
                    onClick={() => { setSupplierId(supplier.id); setSupplierQuery(supplier.razonSocial); setShowSuppliers(false); }}>
                    <strong>{supplier.razonSocial}</strong> <span className="text-slate-600">{supplier.ruc}</span>{supplier.nombreComercial && <span className="block text-slate-500">{supplier.nombreComercial}</span>}
                  </button>)}
                  <button type="button" className="block w-full border-t border-slate-200 px-3 py-2 text-left text-[#004ac6]" onClick={() => setShowSuppliers(false)}>Usar como beneficiario manual</button>
                </div> : <p className="mt-1 text-slate-500">También puedes escribir un beneficiario ocasional.</p>}
            </div>
            <label className="block font-semibold">Cuenta de salida *
              <select required value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className={field}>
                <option value="">Seleccionar banco o caja</option>
                {activeAccounts.map(account => <option key={account.id} value={account.id}>{account.bankName} · {account.accountNumber}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="font-semibold">Fecha de pago *<input type="date" required max={getEcuadorDate()} value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className={field} /></label>
              <label className="font-semibold">Importe ($) *<input type="number" min="0.01" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={field} /></label>
              <label className="font-semibold">Categoría *
                <select required value={category} onChange={e => setCategory(e.target.value)} className={field}>
                  <option value="">Seleccionar categoría</option>
                  {activeCategories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="font-semibold">Referencia o comprobante<input value={reference} maxLength={100} onChange={e => setReference(e.target.value)} className={field} /></label>
            </div>
            <label className="block font-semibold">Concepto *<textarea required rows={2} maxLength={500} value={description} onChange={e => setDescription(e.target.value)} className={field} /></label>
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-rose-700">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" disabled={busy} onClick={() => setModal(null)} className={secondary}>Cancelar</button>
              <button type="submit" disabled={busy || !activeAccounts.length || !activeCategories.length} className={primary}>{busy ? "Guardando…" : "Guardar gasto"}</button>
            </div>
            {!activeAccounts.length && <p className="text-slate-600">Agrega una cuenta activa en Finanzas → Bancos.</p>}
            {!activeCategories.length && <p className="text-slate-600">Activa una categoría para registrar gastos.</p>}
          </form> : <div className="space-y-3 p-4">
            <p className="text-slate-600">Las categorías inactivas conservan su historial y salen del formulario de nuevos gastos.</p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {categories.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                <span className="font-semibold">{item.name}{!item.active && <span className="ml-2 font-normal text-slate-500">Inactiva</span>}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} className={secondary} onClick={() => { setError(""); setCategoryDraft(item); }}>Renombrar</button>
                  <button type="button" disabled={busy} className={secondary} onClick={() => { void saveCategory({ ...item, active: !item.active }); }}>{item.active ? "Desactivar" : "Activar"}</button>
                </div>
              </li>)}
            </ul>
            {categoryDraft ? <form className="flex items-end gap-2" onSubmit={event => { event.preventDefault(); void saveCategory(categoryDraft); }}>
              <label className="flex-1 font-semibold">Nombre de la categoría
                <input required minLength={2} maxLength={80} value={categoryDraft.name} onChange={event => setCategoryDraft({ ...categoryDraft, name: event.target.value })} className={field} />
              </label>
              <button type="submit" disabled={busy} className={primary}>Guardar</button>
            </form> : <button type="button" disabled={busy} className={primary} onClick={() => { setError(""); setCategoryDraft({ id: "", name: "", active: true }); }}>Nueva categoría</button>}
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-rose-700">{error}</p>}
          </div>}
        </section>
      </div>}
    </div>
  );
}
