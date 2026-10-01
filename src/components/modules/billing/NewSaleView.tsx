"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  User,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Receipt,
  CreditCard,
  Building2,
  FileText,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Tag,
  Zap,
  DollarSign,
  Calendar,
  Layers,
  Percent,
  Check,
  ArrowLeftRight,
  Clock,
} from "lucide-react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { InvoiceItem, SriInvoice, InventoryProduct, Client } from "@/types";

interface NewSaleViewProps {
  onBack: () => void;
  onSuccess?: (invoice: SriInvoice) => void;
}

export function NewSaleView({ onBack, onSuccess }: NewSaleViewProps) {
  const {
    clients,
    inventoryWarehouses,
    inventoryProducts,
    createInvoice,
    addClient,
    addInventoryProduct,
    sriCompanyConfig,
  } = useApp();
  const { showSuccess, showError, showConfirm } = useToast();

  // Document metadata
  const [documentType, setDocumentType] = useState<"factura" | "nota_venta" | "cotizacion">("factura");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [establishment, setEstablishment] = useState(() => sriCompanyConfig?.establecimiento || "001");
  const [warehouseId, setWarehouseId] = useState<string>("");

  // Client selection
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  // Products and cart
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const [generalDiscount, setGeneralDiscount] = useState<number>(0);

  // Additional Data (Accordion)
  const [isExtraDataOpen, setIsExtraDataOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // Payment section
  const [paymentTab, setPaymentTab] = useState<"efectivo" | "transferencia" | "tarjeta" | "credito">("transferencia");
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [bankAccount, setBankAccount] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [cardType, setCardType] = useState("Visa");
  const [cardAuthCode, setCardAuthCode] = useState("");
  const [creditDays, setCreditDays] = useState(30);

  // Modals state
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [isQuickProductOpen, setIsQuickProductOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Client form state
  const [newClientName, setNewClientName] = useState("");
  const [newClientRuc, setNewClientRuc] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");

  // Quick Product form state
  const [newProdName, setNewProdName] = useState("");
  const [newProdSku, setNewProdSku] = useState("");
  const [newProdPrice, setNewProdPrice] = useState<number>(0);
  const [newProdIva, setNewProdIva] = useState<number>(15);
  const [newProdType, setNewProdType] = useState<"producto" | "servicio">("servicio");

  // Initialize warehouse
  useEffect(() => {
    if (inventoryWarehouses.length > 0 && !warehouseId) {
      setWarehouseId(inventoryWarehouses[0].id);
    }
  }, [inventoryWarehouses, warehouseId]);

  // Click outside listener for search dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setIsClientSearchOpen(false);
      }
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node)) {
        setIsProductSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Selected client entity
  const selectedClient = useMemo(() => {
    if (selectedClientId === "final") {
      return {
        id: "final",
        businessName: "CONSUMIDOR FINAL",
        identificationNumber: "9999999999999",
        email: sriCompanyConfig?.emailNotificaciones || "consumidorfinal@inntelcorp.com",
        phone: "0999999999",
        address: "Quito, Ecuador",
      } as Client;
    }
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [selectedClientId, clients, sriCompanyConfig]);

  // Filtered clients for autocomplete
  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase().trim();
    if (!q) return clients.slice(0, 8);
    return clients.filter(
      (c) =>
        c.businessName.toLowerCase().includes(q) ||
        c.identificationNumber.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [clients, clientSearch]);

  // Filtered products for autocomplete
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return inventoryProducts.filter((p) => p.status === "activo").slice(0, 8);
    return inventoryProducts.filter(
      (p) =>
        p.status === "activo" &&
        (p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q)))
    ).slice(0, 10);
  }, [inventoryProducts, productSearch]);

  // Calculations
  const subtotal15 = items
    .filter((it) => it.ivaRate === 15)
    .reduce((sum, it) => sum + (it.quantity * it.unitPrice - (it.discount || 0)), 0);

  const subtotal0 = items
    .filter((it) => it.ivaRate === 0)
    .reduce((sum, it) => sum + (it.quantity * it.unitPrice - (it.discount || 0)), 0);

  const discountTotal = items.reduce((sum, it) => sum + (it.discount || 0), 0);
  const ivaTotal = items.reduce((sum, it) => sum + it.ivaAmount, 0);
  const total = Math.max(0, subtotal15 + subtotal0 + ivaTotal);

  // Sync payment amount when total changes if using electronic/transfer/card
  useEffect(() => {
    if (paymentTab === "transferencia" || paymentTab === "tarjeta" || paymentTab === "credito") {
      setPaymentAmount(total);
    } else if (paymentTab === "efectivo") {
      if (cashReceived === 0 || cashReceived < total) {
        setCashReceived(total);
      }
    }
  }, [total, paymentTab]);

  // Covered amount & Change/Vuelto
  const coveredAmount = useMemo(() => {
    if (paymentTab === "efectivo") {
      return Math.min(cashReceived, total);
    }
    return Math.min(paymentAmount || total, total);
  }, [paymentTab, cashReceived, paymentAmount, total]);

  const changeDue = useMemo(() => {
    if (paymentTab === "efectivo") {
      return Math.max(0, cashReceived - total);
    }
    return 0;
  }, [paymentTab, cashReceived, total]);

  const currentWarehouse = inventoryWarehouses.find((w) => w.id === warehouseId) || inventoryWarehouses[0];

  // Cart operations
  const handleAddItem = (prod: InventoryProduct) => {
    const existingIndex = items.findIndex((it) => it.productId === prod.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      const cur = updated[existingIndex];
      const newQty = cur.quantity + 1;
      const sub = newQty * cur.unitPrice - (cur.discount || 0);
      const iva = cur.ivaRate === 15 ? sub * 0.15 : 0;
      updated[existingIndex] = {
        ...cur,
        quantity: newQty,
        subtotal: sub,
        ivaAmount: iva,
        total: sub + iva,
      };
      setItems(updated);
    } else {
      const unitPrice = prod.salePrice || 0;
      const sub = unitPrice;
      const ivaRate = prod.ivaRate ?? 15;
      const iva = (sub * ivaRate) / 100;
      const newItem: InvoiceItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productId: prod.id,
        sku: prod.sku,
        name: prod.name,
        description: prod.name,
        unit: prod.unit || "UND",
        quantity: 1,
        unitPrice,
        discount: 0,
        subtotal: sub,
        ivaRate,
        ivaAmount: iva,
        total: sub + iva,
        warehouseId,
      };
      setItems([...items, newItem]);
    }
    setProductSearch("");
    setIsProductSearchOpen(false);
  };

  const handleUpdateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      handleRemoveItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const sub = qty * it.unitPrice - (it.discount || 0);
        const iva = it.ivaRate === 15 ? sub * 0.15 : 0;
        return { ...it, quantity: qty, subtotal: sub, ivaAmount: iva, total: sub + iva };
      })
    );
  };

  const handleUpdatePrice = (id: string, price: number) => {
    if (price < 0) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const sub = it.quantity * price - (it.discount || 0);
        const iva = it.ivaRate === 15 ? sub * 0.15 : 0;
        return { ...it, unitPrice: price, subtotal: sub, ivaAmount: iva, total: sub + iva };
      })
    );
  };

  const handleUpdateDiscount = (id: string, disc: number) => {
    if (disc < 0) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const sub = it.quantity * it.unitPrice - disc;
        const iva = it.ivaRate === 15 ? sub * 0.15 : 0;
        return { ...it, discount: disc, subtotal: sub, ivaAmount: iva, total: sub + iva };
      })
    );
  };

  const handleUpdateDetail = (id: string, desc: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, description: desc } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleClearItems = () => {
    if (items.length === 0) return;
    showConfirm(
      "¿Vaciar Comprobante?",
      "Se removerán todos los productos y servicios añadidos a esta venta.",
      () => {
        setItems([]);
        showSuccess("Comprobante Limpio", "Se removieron todos los ítems.");
      },
      "Vaciar"
    );
  };

  const handleApplyGeneralDiscount = (rate: number) => {
    setGeneralDiscount(rate);
    setItems((prev) =>
      prev.map((it) => {
        const itemGross = it.quantity * it.unitPrice;
        const disc = rate > 0 ? (itemGross * rate) / 100 : 0;
        const sub = itemGross - disc;
        const iva = it.ivaRate === 15 ? sub * 0.15 : 0;
        return { ...it, discount: disc, subtotal: sub, ivaAmount: iva, total: sub + iva };
      })
    );
  };

  // Quick Client Creation
  const handleSaveQuickClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientRuc.trim()) {
      showError("Datos Requeridos", "Ingrese el nombre/razón social y RUC o Cédula.");
      return;
    }
    try {
      const created = await addClient({
        businessName: newClientName.trim(),
        legalRepresentative: newClientName.trim(),
        identificationType: newClientRuc.length === 13 ? "RUC" : "CEDULA",
        identificationNumber: newClientRuc.trim(),
        email: newClientEmail.trim() || "cliente@correo.com",
        phone: newClientPhone.trim() || "0999999999",
        address: newClientAddress.trim() || "Ecuador",
        status: "activo",
        requiresSriBilling: true,
        totalActiveServices: 0,
        currentBalance: 0,
      });
      setSelectedClientId(created.id);
      setIsQuickClientOpen(false);
      setNewClientName("");
      setNewClientRuc("");
      setNewClientEmail("");
      setNewClientPhone("");
      setNewClientAddress("");
      showSuccess("Cliente Registrado", `${created.businessName} seleccionado en la venta.`);
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo registrar el cliente.");
    }
  };

  // Quick Product Creation
  const handleSaveQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || newProdPrice <= 0) {
      showError("Datos Requeridos", "Ingrese nombre del producto/servicio y precio mayor a 0.");
      return;
    }
    const sku = newProdSku.trim() || `ITM-${Date.now().toString().slice(-5)}`;
    try {
      await addInventoryProduct({
        name: newProdName.trim(),
        sku,
        salePrice: newProdPrice,
        salePriceConIva: newProdPrice * (1 + newProdIva / 100),
        baseCost: newProdPrice * 0.6,
        ivaRate: newProdIva,
        type: newProdType,
        taxMode: "EXCLUIDO",
        unit: "unidad",
        categoryId: "cat-servicios",
        tracksStock: newProdType === "producto",
        stock: newProdType === "producto" ? 100 : 0,
        minStock: 5,
        stockByWarehouse: { [warehouseId || "wh-central"]: newProdType === "producto" ? 100 : 0 },
        status: "activo",
      });

      // Add immediately to items
      const sub = newProdPrice;
      const iva = (sub * newProdIva) / 100;
      setItems((prev) => [
        ...prev,
        {
          id: `item-${Date.now()}`,
          productId: `prod-${Date.now()}`,
          sku,
          name: newProdName.trim(),
          description: newProdName.trim(),
          unit: "UND",
          quantity: 1,
          unitPrice: newProdPrice,
          discount: 0,
          subtotal: sub,
          ivaRate: newProdIva,
          ivaAmount: iva,
          total: sub + iva,
          warehouseId,
        },
      ]);
      setIsQuickProductOpen(false);
      setNewProdName("");
      setNewProdSku("");
      setNewProdPrice(0);
      showSuccess("Producto Creado", `"${newProdName}" añadido a la venta.`);
    } catch (err: any) {
      showError("Error", err?.message || "No se pudo crear el producto.");
    }
  };

  // Submit Invoice (SRI)
  const handleSubmit = async (isDraft: boolean = false) => {
    if (!selectedClient) {
      showError("Cliente Requerido", "Por favor selecciona o busca un cliente para emitir el comprobante.");
      return;
    }
    if (items.length === 0) {
      showError("Comprobante Vacío", "Debe agregar al menos un producto o servicio.");
      return;
    }

    if (!isDraft && coveredAmount < total) {
      showError("Pago Incompleto", `El monto cubierto ($${coveredAmount.toFixed(2)}) no cubre el total de la venta ($${total.toFixed(2)}).`);
      return;
    }

    // Verify stock availability
    for (const it of items) {
      const prod = inventoryProducts.find((p) => p.id === it.productId);
      if (prod && prod.tracksStock) {
        const currentWhStock = Number(prod.stockByWarehouse?.[warehouseId] || 0);
        if (currentWhStock < it.quantity) {
          showError(
            "Stock Insuficiente",
            `Stock insuficiente de "${prod.name}" en ${currentWarehouse?.name}. Disponible: ${currentWhStock}, Requerido: ${it.quantity}.`
          );
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const sriPaymentCode =
        paymentTab === "efectivo"
          ? "01"
          : paymentTab === "tarjeta"
          ? "19"
          : paymentTab === "credito"
          ? "20"
          : "20";

      let paymentNotes = "";
      if (paymentTab === "transferencia") {
        paymentNotes = `Transferencia Banco: ${bankAccount}. Ref: ${bankReference || "N/A"}`;
      } else if (paymentTab === "tarjeta") {
        paymentNotes = `Tarjeta ${cardType}. Auth/Lote: ${cardAuthCode || "N/A"}`;
      } else if (paymentTab === "credito") {
        paymentNotes = `Crédito a ${creditDays} días plazo`;
      } else {
        paymentNotes = `Efectivo recibido: $${cashReceived.toFixed(2)} - Cambio: $${changeDue.toFixed(2)}`;
      }

      const fullNotes = [
        invoiceNotes,
        orderNumber ? `Orden de Compra / Pedido: ${orderNumber}` : "",
        deliveryAddress ? `Entrega en: ${deliveryAddress}` : "",
        paymentNotes,
      ]
        .filter(Boolean)
        .join(" | ");

      const newInvoice = await createInvoice({
        date: issueDate,
        time: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
        clientId: selectedClient.id,
        clientName: selectedClient.businessName,
        clientRuc: selectedClient.identificationNumber,
        clientEmail: selectedClient.email || "facturacion@inntelcorp.com",
        clientPhone: selectedClient.phone,
        clientAddress: selectedClient.address || "Ecuador",
        tipoIdentificacion: selectedClient.identificationNumber?.length === 13 ? "04" : "05",
        items,
        subtotal15,
        subtotal0,
        subtotalNoObjeto: 0,
        subtotalExento: 0,
        discountTotal,
        ivaTotal,
        total,
        paymentMethod: paymentTab,
        sriPaymentCode,
        paymentTermDays: paymentTab === "credito" ? creditDays : 0,
        status: isDraft ? "borrador" : "autorizada",
        authorizationDate: isDraft ? "" : new Date().toISOString(),
        warehouseId,
        warehouseName: currentWarehouse?.name || "Bodega Central",
        notes: fullNotes,
      });

      showSuccess(
        isDraft ? "Borrador Guardado" : "Factura Electrónica Emitida",
        isDraft
          ? `Comprobante ${newInvoice.documentNumber} guardado en estado borrador.`
          : `Factura ${newInvoice.documentNumber} autorizada con éxito por el SRI.`
      );

      if (onSuccess && !isDraft) {
        onSuccess(newInvoice);
      }
      onBack();
    } catch (err: any) {
      showError("Error de Facturación", err?.message || "No se pudo emitir la factura electrónica.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      {/* Top Minimal Action Row with Close Button (WebFix Style) */}
      <div className="flex justify-end -mb-2">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer shadow-xs"
          title="Cerrar y volver al Historial de Ventas"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main 2-Column Split Layout (WebFix Style) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Client, Products, Additional Data (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* CARD 1: Datos de Cliente */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <span>Datos de Cliente</span>
              </div>

              {/* Quick Consumer Switch */}
              <button
                type="button"
                onClick={() => setSelectedClientId("final")}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                  selectedClientId === "final"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                Consumidor Final
              </button>
            </div>

            {/* Client Search and Add Row */}
            <div className="relative" ref={clientSearchRef}>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Escribe para buscar cliente..."
                    value={clientSearch}
                    onFocus={() => setIsClientSearchOpen(true)}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setIsClientSearchOpen(true);
                    }}
                    className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden font-medium text-slate-800 transition"
                  />
                </div>

                {/* Quick Add Client Button */}
                <button
                  type="button"
                  onClick={() => setIsQuickClientOpen(true)}
                  className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition cursor-pointer shadow-2xs shrink-0"
                  title="Registrar Nuevo Cliente"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Autocomplete Dropdown */}
              {isClientSearchOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 max-h-60 overflow-y-auto">
                  <div
                    onClick={() => {
                      setSelectedClientId("final");
                      setIsClientSearchOpen(false);
                      setClientSearch("");
                    }}
                    className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs border-b border-slate-100"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">CONSUMIDOR FINAL</span>
                      <span className="font-mono text-[10px] text-slate-400">9999999999999</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Rápido</span>
                  </div>

                  {filteredClients.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedClientId(c.id);
                        setIsClientSearchOpen(false);
                        setClientSearch("");
                      }}
                      className="px-4 py-2 hover:bg-[#eff4ff] cursor-pointer flex items-center justify-between text-xs border-b border-slate-50 last:border-0"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-slate-900 block truncate">{c.businessName}</span>
                        <span className="font-mono text-[10px] text-slate-400">RUC/CI: {c.identificationNumber}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{c.email}</span>
                    </div>
                  ))}

                  <div
                    onClick={() => {
                      setIsClientSearchOpen(false);
                      setIsQuickClientOpen(true);
                    }}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-[#004ac6] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Crear nuevo cliente...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Selected Client Info Banner vs Alert when empty (WebFix Design) */}
            {!selectedClient ? (
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-800 text-xs flex items-center justify-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Selecciona un cliente para habilitar la facturación.</span>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-emerald-50/70 via-slate-50 to-emerald-50/30 border border-emerald-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs animate-in fade-in">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Razón Social</span>
                  <span className="font-bold text-slate-900 block">{selectedClient.businessName}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">RUC / CI</span>
                  <span className="font-mono font-bold text-slate-800 block">{selectedClient.identificationNumber}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Teléfono / Correo</span>
                  <span className="text-slate-700 font-medium block">
                    {selectedClient.phone || "S/N"} | {selectedClient.email || "S/C"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientId("");
                    setClientSearch("");
                  }}
                  className="text-[10px] font-bold text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 bg-white px-2 py-1 rounded-lg transition cursor-pointer"
                  title="Cambiar cliente"
                >
                  Cambiar
                </button>
              </div>
            )}

            {/* Document Metadata Row (4 Inputs Side by Side) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {/* Tipo Documento */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Tipo Documento
                </label>
                <div className="relative">
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as any)}
                    className="w-full text-xs font-bold py-2 pl-3 pr-8 rounded-xl bg-[#004ac6] text-white border-0 appearance-none cursor-pointer focus:ring-2 focus:ring-[#003ca3] outline-hidden shadow-2xs"
                  >
                    <option value="factura" className="bg-white text-slate-800">FACTURA ELECTRÓNICA</option>
                    <option value="nota_venta" className="bg-white text-slate-800">NOTA DE VENTA</option>
                    <option value="cotizacion" className="bg-white text-slate-800">COTIZACIÓN</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-white/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Fecha Emisión */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Fecha Emisión
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden"
                />
              </div>

              {/* Establecimiento */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Establecimiento
                </label>
                <select
                  value={establishment}
                  onChange={(e) => setEstablishment(e.target.value)}
                  className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden cursor-pointer"
                >
                  <option value="001">001 - Sucursal Matriz</option>
                  <option value="002">002 - Sucursal Norte</option>
                  <option value="003">003 - Sucursal Sur</option>
                </select>
              </div>

              {/* Bodega */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Bodega Despacho
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden cursor-pointer"
                >
                  {inventoryWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* CARD 2: Productos y Servicios */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#004ac6] flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <span>Productos y Servicios</span>
              </div>
            </div>

            {/* Product Search & Quick Add Row */}
            <div className="relative" ref={productSearchRef}>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar productos o servicios por nombre, SKU..."
                    value={productSearch}
                    onFocus={() => setIsProductSearchOpen(true)}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setIsProductSearchOpen(true);
                    }}
                    className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-[#004ac6] focus:border-transparent outline-hidden font-medium text-slate-800 transition"
                  />
                </div>

                {/* Catalog Button */}
                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(true)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Examinar catálogo de productos"
                >
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  <span>Añadir</span>
                </button>

                {/* Quick Create Product Button */}
                <button
                  type="button"
                  onClick={() => setIsQuickProductOpen(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs shrink-0"
                  title="Crear Nuevo Producto / Servicio"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear</span>
                </button>
              </div>

              {/* Product Autocomplete Dropdown */}
              {isProductSearchOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 max-h-64 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No se encontraron productos coincidentes.
                    </div>
                  ) : (
                    filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddItem(p)}
                        className="px-4 py-2.5 hover:bg-[#eff4ff] cursor-pointer flex items-center justify-between text-xs border-b border-slate-50 last:border-0"
                      >
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{p.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">[{p.sku}]</span>
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                            <span>Tarifa: {p.ivaRate}% IVA</span>
                            {p.tracksStock && (
                              <span>• Stock: {p.stockByWarehouse?.[warehouseId] ?? p.stock} {p.unit}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900 block">${p.salePrice.toFixed(2)}</span>
                          <span className="text-[10px] text-emerald-600 font-semibold">+ Agregar</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* General Discount and Clear Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-600">Descuento General:</span>
                <select
                  value={generalDiscount}
                  onChange={(e) => handleApplyGeneralDiscount(parseFloat(e.target.value) || 0)}
                  className="text-xs font-semibold py-1.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 cursor-pointer focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                >
                  <option value={0}>-- Sin Descuento --</option>
                  <option value={5}>5% Descuento Global</option>
                  <option value={10}>10% Descuento Global</option>
                  <option value={15}>15% Descuento Global</option>
                  <option value={20}>20% Descuento Global</option>
                </select>
              </div>

              {items.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearItems}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              )}
            </div>

            {/* Items Table / Empty State (WebFix Design) */}
            {items.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 font-medium">
                No hay productos en el carrito. Utiliza el buscador para añadir ítems.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden animate-in fade-in">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">CÓDIGO & PRODUCTO / DETALLE</th>
                      <th className="py-2.5 px-2 text-center w-28">CANT.</th>
                      <th className="py-2.5 px-2 text-center w-24">P. UNIT.</th>
                      <th className="py-2.5 px-2 text-center w-20">DTO.</th>
                      <th className="py-2.5 px-3 text-right w-24">SUBTOTAL</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/50 transition">
                        {/* Producto & Detalle */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            <span className="font-mono text-[11px] text-[#004ac6]">{it.sku}</span>
                            <span>{it.name}</span>
                          </div>
                          <input
                            type="text"
                            value={it.description || ""}
                            onChange={(e) => handleUpdateDetail(it.id, e.target.value)}
                            placeholder="Detalle o nota adicional en RIDE..."
                            className="w-full text-[11px] text-slate-500 bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-[#004ac6] outline-hidden py-0.5 mt-0.5"
                          />
                        </td>

                        {/* Cantidad Stepper */}
                        <td className="py-2.5 px-2 text-center">
                          <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(it.id, it.quantity - 1)}
                              className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-xs font-bold transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => handleUpdateQuantity(it.id, parseInt(e.target.value) || 1)}
                              className="w-10 text-center text-xs font-bold border-x border-slate-200 py-1 outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(it.id, it.quantity + 1)}
                              className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-xs font-bold transition"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* Precio Unitario */}
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-slate-400 font-mono text-xs">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={it.unitPrice}
                              onChange={(e) => handleUpdatePrice(it.id, parseFloat(e.target.value) || 0)}
                              className="w-16 text-center text-xs font-mono font-bold py-1 px-1 rounded-lg border border-slate-200 outline-hidden focus:ring-1 focus:ring-[#004ac6]"
                            />
                          </div>
                        </td>

                        {/* Descuento */}
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={it.discount || 0}
                              onChange={(e) => handleUpdateDiscount(it.id, parseFloat(e.target.value) || 0)}
                              className="w-14 text-center text-xs font-mono py-1 px-1 rounded-lg border border-slate-200 outline-hidden focus:ring-1 focus:ring-[#004ac6]"
                            />
                          </div>
                        </td>

                        {/* Subtotal */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ${it.subtotal.toFixed(2)}
                        </td>

                        {/* Delete Action */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                            title="Remover producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CARD 3: Datos Adicionales del Comprobante (Opcional - Accordion) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => setIsExtraDataOpen(!isExtraDataOpen)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50/60 transition cursor-pointer"
            >
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Datos Adicionales del Comprobante (Opcional)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                <span>Nro. Pedido, Notas</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExtraDataOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isExtraDataOpen && (
              <div className="p-5 pt-0 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Nro. Pedido / Orden de Compra
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="Ej. OC-2026-0045"
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Dirección de Entrega / Instalación
                  </label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Ingrese dirección de entrega o instalación..."
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Observaciones y Notas para el RIDE (SRI)
                  </label>
                  <textarea
                    rows={2}
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    placeholder="Detalles de facturación que se imprimirán en el comprobante electrónico..."
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Resumen & Forma de Pago (Unificado en una sola columna/tarjeta) */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
            {/* SECCIÓN RESUMEN */}
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
              <Receipt className="w-4 h-4 text-[#004ac6]" />
              <span>RESUMEN</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold">${(subtotal15 + subtotal0 + discountTotal).toFixed(2)}</span>
              </div>

              {discountTotal > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Descuento:</span>
                  <span className="font-mono font-semibold">-${discountTotal.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Base Imponible (15%):</span>
                <span className="font-mono font-semibold">${subtotal15.toFixed(2)}</span>
              </div>

              {subtotal0 > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Base 0%:</span>
                  <span className="font-mono font-semibold">${subtotal0.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>IVA (15%):</span>
                <span className="font-mono font-semibold">${ivaTotal.toFixed(2)}</span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-black text-slate-900 tracking-tight">TOTAL:</span>
                <span className="text-2xl font-black font-mono text-[#004ac6]">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* SECCIÓN FORMA DE PAGO */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                <CreditCard className="w-4 h-4 text-[#004ac6]" />
                <span>FORMA DE PAGO</span>
              </div>

              {/* 4 Payment Methods Buttons (WebFix style) */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentTab("efectivo")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    paymentTab === "efectivo"
                      ? "bg-[#eff4ff] border-[#004ac6] text-[#004ac6] shadow-xs"
                      : "border-slate-200 hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <DollarSign className="w-4 h-4 mb-1" />
                  <span>Efectivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentTab("transferencia")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    paymentTab === "transferencia"
                      ? "bg-[#eff4ff] border-[#004ac6] text-[#004ac6] shadow-xs"
                      : "border-slate-200 hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <ArrowLeftRight className="w-4 h-4 mb-1" />
                  <span>Transf.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentTab("tarjeta")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    paymentTab === "tarjeta"
                      ? "bg-[#eff4ff] border-[#004ac6] text-[#004ac6] shadow-xs"
                      : "border-slate-200 hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <CreditCard className="w-4 h-4 mb-1" />
                  <span>Tarjeta</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentTab("credito")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    paymentTab === "credito"
                      ? "bg-[#eff4ff] border-[#004ac6] text-[#004ac6] shadow-xs"
                      : "border-slate-200 hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <User className="w-4 h-4 mb-1" />
                  <span>Crédito</span>
                </button>
              </div>

              {/* Dynamic Fields Based on Payment Tab */}
              <div className="space-y-3 pt-1 text-xs">
                {paymentTab === "transferencia" && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Transferencia
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={paymentAmount || ""}
                          placeholder="0.00"
                          onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                          className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-900 outline-hidden focus:ring-2 focus:ring-[#004ac6]"
                        />
                      </div>
                    </div>

                    <div>
                      <select
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium outline-hidden cursor-pointer"
                      >
                        <option value="">-- Cuenta Bancaria Destino --</option>
                        <option value="Pichincha - Cta. Cte. #2100889901">Banco Pichincha - Cta. Cte. #2100889901</option>
                        <option value="Guayaquil - Cta. Cte. #1100345672">Banco Guayaquil - Cta. Cte. #1100345672</option>
                        <option value="Produbanco - Cta. Ahorros #1200984511">Produbanco - Cta. Ahorros #1200984511</option>
                        <option value="Austro - Cta. Cte. #0500123987">Banco del Austro - Cta. Cte. #0500123987</option>
                      </select>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={bankReference}
                        onChange={(e) => setBankReference(e.target.value)}
                        placeholder="Banco / Referencia de depósito"
                        className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white outline-hidden focus:ring-2 focus:ring-[#004ac6]"
                      />
                    </div>
                  </>
                )}

                {paymentTab === "efectivo" && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Monto Recibido
                      </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-900 outline-hidden focus:ring-2 focus:ring-[#004ac6]"
                      />
                    </div>
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setCashReceived(total)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 transition cursor-pointer"
                    >
                      Exacto
                    </button>
                    {[10, 20, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashReceived(amt)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-mono font-bold text-slate-700 transition cursor-pointer"
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {paymentTab === "tarjeta" && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Monto Tarjeta
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-900 outline-hidden focus:ring-2 focus:ring-[#004ac6]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipo Tarjeta</label>
                      <select
                        value={cardType}
                        onChange={(e) => setCardType(e.target.value)}
                        className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium outline-hidden"
                      >
                        <option value="Visa">Visa</option>
                        <option value="Mastercard">Mastercard</option>
                        <option value="Diners">Diners Club</option>
                        <option value="Amex">American Express</option>
                        <option value="Debito">Débito Bancario</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Voucher / Lote</label>
                      <input
                        type="text"
                        value={cardAuthCode}
                        onChange={(e) => setCardAuthCode(e.target.value)}
                        placeholder="Ej. #04928"
                        className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white outline-hidden"
                      />
                    </div>
                  </div>
                </>
              )}

              {paymentTab === "credito" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Plazo (Días)</label>
                      <input
                        type="number"
                        min="1"
                        value={creditDays}
                        onChange={(e) => setCreditDays(parseInt(e.target.value) || 30)}
                        className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-900 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Vencimiento</label>
                      <div className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-600">
                        {new Date(Date.now() + creditDays * 86400000).toISOString().slice(0, 10)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Payment Summary Box: CAMBIO / VUELTO & CUBIERTO (WebFix style) */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  CAMBIO / VUELTO
                </span>
                <span className="text-base font-black font-mono text-emerald-700">
                  ${changeDue.toFixed(2)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/60 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  CUBIERTO
                </span>
                <span className="text-base font-black font-mono text-slate-800">
                  ${coveredAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Validation Alert (Only show when there are items in the cart) */}
            {items.length > 0 && (
              coveredAmount < total ? (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span className="font-semibold text-[11px]">
                    Falta cubrir ${(total - coveredAmount).toFixed(2)} de la venta.
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="font-semibold text-[11px]">Monto completo cubierto.</span>
                </div>
              )
            )}

            {/* Big Action Button (WebFix style) */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting || items.length === 0 || coveredAmount < total}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Emitiendo Comprobante SRI...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>Emitir Factura Electrónica (SRI)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting || items.length === 0}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-semibold transition py-1 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Guardar Borrador</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* QUICK CLIENT MODAL */}
      {isQuickClientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <User className="w-4 h-4 text-[#004ac6]" />
                <span>Registrar Nuevo Cliente</span>
              </div>
              <button
                onClick={() => setIsQuickClientOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickClient} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Razón Social / Nombres Completos *
                </label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ingrese nombres o razón social"
                  className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  RUC o Cédula *
                </label>
                <input
                  type="text"
                  required
                  value={newClientRuc}
                  onChange={(e) => setNewClientRuc(e.target.value)}
                  placeholder="Ingrese número de RUC o Cédula"
                  className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-white font-mono focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="Ingrese correo electrónico"
                    className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="Ingrese número de teléfono"
                    className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Dirección Domiciliaria</label>
                <input
                  type="text"
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  placeholder="Ingrese dirección domiciliaria"
                  className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickClientOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition cursor-pointer"
                >
                  Guardar y Seleccionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK PRODUCT MODAL */}
      {isQuickProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <ShoppingCart className="w-4 h-4 text-[#004ac6]" />
                <span>Crear Producto / Servicio</span>
              </div>
              <button
                onClick={() => setIsQuickProductOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickProduct} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nombre Comercial *
                </label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  placeholder="Ingrese nombre del producto o servicio"
                  className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Tipo</label>
                  <select
                    value={newProdType}
                    onChange={(e) => setNewProdType(e.target.value as any)}
                    className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-white outline-hidden cursor-pointer"
                  >
                    <option value="servicio">Servicio (Sin stock)</option>
                    <option value="producto">Producto Físico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">SKU / Código</label>
                  <input
                    type="text"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    placeholder="Ingrese código o SKU (opcional)"
                    className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-white font-mono outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Precio Unitario ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newProdPrice || ""}
                    onChange={(e) => setNewProdPrice(parseFloat(e.target.value) || 0)}
                    placeholder="20.00"
                    className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-white font-mono font-bold outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Tarifa IVA</label>
                  <select
                    value={newProdIva}
                    onChange={(e) => setNewProdIva(parseInt(e.target.value) || 15)}
                    className="w-full py-2 px-3 rounded-xl border border-slate-300 bg-white outline-hidden cursor-pointer"
                  >
                    <option value={15}>15% (Vigente)</option>
                    <option value={0}>0% (Tarifa Cero)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickProductOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition cursor-pointer"
                >
                  Crear y Agregar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATALOG PICKER MODAL */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Search className="w-4 h-4 text-[#004ac6]" />
                <span>Catálogo de Productos y Servicios</span>
              </div>
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar por nombre, categoría o SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 outline-hidden"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredProducts.map((p) => {
                const inCart = items.some((it) => it.productId === p.id);
                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl border border-slate-200 hover:border-[#004ac6]/40 hover:bg-[#eff4ff]/30 flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{p.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">[{p.sku}]</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        <span>IVA: {p.ivaRate}%</span>
                        {p.tracksStock && (
                          <span className="ml-2 font-medium text-slate-600">
                            • Stock: {p.stockByWarehouse?.[warehouseId] ?? p.stock}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        ${p.salePrice.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddItem(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                          inCart
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-[#004ac6] hover:bg-[#003ca3] text-white"
                        }`}
                      >
                        {inCart ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>En Venta (+)</span>
                          </>
                        ) : (
                          <span>+ Añadir</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar Catálogo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
