"use client";

import React, { useState, useMemo, useRef } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { InvoiceItem, SriInvoice, Client, InventoryProduct } from "@/types";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  UserPlus,
  CheckCircle2,
  Zap,
  Building2,
  CreditCard,
  Banknote,
  Landmark,
  Clock,
  FileCode2,
  Terminal,
  ShieldCheck,
  Package,
  AlertCircle,
  X,
  UserCheck,
  Sparkles,
  Loader2,
  Receipt,
  Printer,
  Download,
  Copy,
  Check,
  Share2,
  Mail,
  Send,
  ChevronDown,
  ChevronUp,
  Save,
  Ban,
  Percent,
  DollarSign,
  Calendar,
  Tag,
} from "lucide-react";
import {
  generarFacturaXml,
  generarXmlFirmado,
  enviarComprobanteAlSri,
  descargarXmlArchivo,
  validarIdentificacionEcuador,
  formatearSecuencialSRI,
} from "@/lib/sri-service";
import { RidePreviewModal } from "./RidePreviewModal";

interface NewSaleViewProps {
  onBack: () => void;
  onSuccess: (invoice: SriInvoice) => void;
  initialClientId?: string;
  initialDocType?: string;
  initialItems?: InvoiceItem[];
  initialOrderNumber?: string;
  initialNotes?: string;
}

type DiscountMode = "none" | "percentage" | "amount" | "no_iva";

interface CartLineItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number; // Precio base sin IVA
  ivaRate: number;   // 15, 5, 0
  discountType: "percentage" | "amount" | "no_iva";
  discountInput: number;
  serialNumbers: string[];
}

export function NewSaleView({
  onBack,
  onSuccess,
  initialClientId,
  initialDocType,
  initialItems,
  initialOrderNumber,
  initialNotes,
}: NewSaleViewProps) {
  const {
    clients,
    suppliers,
    addClient,
    inventoryProducts,
    addInventoryProduct,
    inventoryCategories,
    inventoryWarehouses,
    sriCompanyConfig,
    billingInvoices,
    bankAccounts,
    createInvoice,
    updateInvoiceStatus,
  } = useApp();
  const { showSuccess, showError, showWarning } = useToast();

  const clientSearchInputRef = useRef<HTMLInputElement>(null);
  const productSearchInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // PASO DEL FLUJO (1 = Registro, 2 = Comprobante Emitido)
  // ==========================================
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [emittedInvoice, setEmittedInvoice] = useState<SriInvoice | null>(null);

  // Visor RIDE / Ticket en Paso 2
  const [isRideModalOpen, setIsRideModalOpen] = useState(false);
  const [rideModalFormat, setRideModalFormat] = useState<"ride" | "ticket">("ride");
  const [copiedAccessKey, setCopiedAccessKey] = useState(false);

  // Panel de correo en Paso 2
  const [emailStatus, setEmailStatus] = useState<"sent" | "sending" | "idle">("sent");
  const [customCopyEmail, setCustomCopyEmail] = useState("");
  const [isSendingCustomEmail, setIsSendingCustomEmail] = useState(false);

  // ==========================================
  // ESTADO PASO 1: CLIENTE Y DOCUMENTO
  // ==========================================
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || "");
  const [isConsumidorFinal, setIsConsumidorFinal] = useState<boolean>(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [documentType, setDocumentType] = useState<"factura" | "nota_venta">(
    initialDocType === "nota_venta" ? "nota_venta" : "factura"
  );
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedEstablecimiento, setSelectedEstablecimiento] = useState(
    sriCompanyConfig?.establecimiento || "010"
  );
  const [warehouseId, setWarehouseId] = useState(
    inventoryWarehouses[0]?.id || "wh-central"
  );

  // Datos adicionales opcionales
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(
    Boolean(initialOrderNumber || initialNotes)
  );
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber || "");
  const [notes, setNotes] = useState(initialNotes || "");

  // ==========================================
  // ESTADO PASO 1: PRODUCTOS Y DESCUENTOS
  // ==========================================
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [cartItems, setCartItems] = useState<CartLineItem[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((it) => ({
        id: it.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: it.productId || "",
        sku: it.sku || "SRV-001",
        name: it.name,
        description: it.description || "",
        unit: it.unit || "unidad",
        quantity: it.quantity || 1,
        unitPrice: it.unitPrice || 0,
        ivaRate: it.ivaRate ?? 15,
        discountType: it.discountType || (it.discount > 0 ? "amount" : "percentage"),
        discountInput: it.discountInput ?? (it.discount || 0),
        serialNumbers: it.serialNumbers || [],
      }));
    }
    return [];
  });

  // Descuento General
  const [globalDiscountType, setGlobalDiscountType] = useState<DiscountMode>("none");
  const [globalDiscountValue, setGlobalDiscountValue] = useState<number>(0);

  // Modal de descuento por ítem
  const [editingDiscountIndex, setEditingDiscountIndex] = useState<number | null>(null);
  const [itemModalDiscType, setItemModalDiscType] = useState<"percentage" | "amount" | "no_iva">("percentage");
  const [itemModalDiscValue, setItemModalDiscValue] = useState<string>("");

  // ==========================================
  // ESTADO PASO 1: MULTIPAGO Y CRÉDITO
  // ==========================================
  const [activeMethods, setActiveMethods] = useState<{
    efectivo: boolean;
    transferencia: boolean;
    tarjeta: boolean;
    credito: boolean;
  }>({
    efectivo: true,
    transferencia: false,
    tarjeta: false,
    credito: false,
  });

  const [paymentValues, setPaymentValues] = useState<{
    efectivo: string;
    transferencia: string;
    tarjeta: string;
    credito: string;
  }>({
    efectivo: "",
    transferencia: "",
    tarjeta: "",
    credito: "",
  });

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(
    bankAccounts[0]?.id || ""
  );
  const [transferenciaRef, setTransferenciaRef] = useState("");
  const [tarjetaRef, setTarjetaRef] = useState("");
  const [paymentTermDays, setPaymentTermDays] = useState(30);
  const [creditDueDate, setCreditDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [creditNotes, setCreditNotes] = useState("");
  const [showCreditModal, setShowCreditModal] = useState(false);

  // ==========================================
  // MODALES DE APOYO (CLIENTE, PRODUCTO, VALIDACIÓN, CONFIRMACIÓN)
  // ==========================================
  // Nuevo Cliente Rápido
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientType, setNewClientType] = useState<"RUC" | "CEDULA" | "PASAPORTE">("RUC");
  const [newClientRuc, setNewClientRuc] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("Quito, Ecuador");
  const [isLookingUpSri, setIsLookingUpSri] = useState(false);

  // Búsqueda Avanzada de Productos
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");

  // Crear Producto Rápido
  const [showQuickProductModal, setShowQuickProductModal] = useState(false);
  const [quickProdName, setQuickProdName] = useState("");
  const [quickProdSku, setQuickProdSku] = useState("");
  const [quickProdPrice, setQuickProdPrice] = useState("");
  const [quickProdCost, setQuickProdCost] = useState("");
  const [quickProdStock, setQuickProdStock] = useState("10");
  const [quickProdIva, setQuickProdIva] = useState<0 | 5 | 15>(15);
  const [quickProdTracksStock, setQuickProdTracksStock] = useState(true);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // Diálogo de Validación
  const [validationDialog, setValidationDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    targetSection: "client" | "products" | "payment" | "switch_nota_venta";
  } | null>(null);

  // Diálogo de Confirmación
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    mode: "emit" | "draft" | "void";
    title: string;
    message: string;
  } | null>(null);

  // Consola SRI en vivo
  const [isProcessing, setIsProcessing] = useState(false);
  const [sriLogs, setSriLogs] = useState<string[]>([]);

  // ==========================================
  // DATOS DERIVADOS: CLIENTE Y SECUENCIAL
  // ==========================================
  const selectedClient: Client | null = useMemo(() => {
    if (isConsumidorFinal) {
      return {
        id: "cf-9999999999999",
        identificationType: "CEDULA",
        identificationNumber: "9999999999999",
        businessName: "CONSUMIDOR FINAL",
        email: "consumidor@final.ec",
        phone: "9999999999",
        address: "ECUADOR",
        requiresSriBilling: false,
        status: "activo",
        totalActiveServices: 0,
        currentBalance: 0,
        createdAt: "",
        updatedAt: "",
      };
    }
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId, isConsumidorFinal]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients
      .filter(
        (c) =>
          c.businessName.toLowerCase().includes(q) ||
          c.identificationNumber.includes(q)
      )
      .slice(0, 8);
  }, [clients, clientSearch]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return inventoryProducts.slice(0, 8);
    return inventoryProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [inventoryProducts, productSearch]);

  const catalogFilteredProducts = useMemo(() => {
    return inventoryProducts.filter((p) => {
      const q = catalogSearch.trim().toLowerCase();
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      const matchCat = catalogCategory === "all" || p.categoryId === catalogCategory;
      return matchQ && matchCat;
    });
  }, [inventoryProducts, catalogSearch, catalogCategory]);

  // Vista previa del próximo secuencial según Tipo de Documento
  const nextSequentialPreview = useMemo(() => {
    const estab = selectedEstablecimiento || sriCompanyConfig.establecimiento || "010";
    const pto = sriCompanyConfig.puntoEmision || "001";
    if (documentType === "nota_venta") {
      const startFromNota = (sriCompanyConfig.secuencialNotaVenta || 1) - 1;
      const maxNota = billingInvoices
        .filter((inv) => inv.documentType === "nota_venta" && inv.status !== "borrador")
        .reduce((max, inv) => {
          const parts = (inv.documentNumber || "").split("-");
          const num = parseInt(parts[2] || "0", 10);
          return !isNaN(num) && num > max ? num : max;
        }, 0);
      return formatearSecuencialSRI(Math.max(maxNota, startFromNota) + 1, estab, pto);
    } else {
      const startFromFac = (sriCompanyConfig.secuencialFactura || 1) - 1;
      const maxFac = billingInvoices
        .filter((inv) => (inv.documentType || "factura") === "factura" && inv.status !== "borrador")
        .reduce((max, inv) => {
          const parts = (inv.documentNumber || "").split("-");
          const num = parseInt(parts[2] || "0", 10);
          return !isNaN(num) && num > max ? num : max;
        }, 0);
      return formatearSecuencialSRI(Math.max(maxFac, startFromFac) + 1, estab, pto);
    }
  }, [documentType, selectedEstablecimiento, sriCompanyConfig, billingInvoices]);

  // ==========================================
  // MOTOR DE CÁLCULO DE ÍTEMS Y DESCUENTOS (CON "QUITAR IVA")
  // ==========================================
  const calculatedTotals = useMemo(() => {
    // 1. Calcular descuento por línea
    const lineCalcs = cartItems.map((item) => {
      const qty = Math.max(0.01, Number(item.quantity) || 0);
      const price = Math.max(0, Number(item.unitPrice) || 0);
      const grossLine = qty * price;
      const rate = Number(item.ivaRate) || 0;

      let lineDiscount = 0;
      if (item.discountType === "percentage") {
        const pct = Math.min(100, Math.max(0, Number(item.discountInput) || 0));
        lineDiscount = grossLine * (pct / 100);
      } else if (item.discountType === "amount") {
        lineDiscount = Math.min(grossLine, Math.max(0, Number(item.discountInput) || 0));
      } else if (item.discountType === "no_iva") {
        // Descuenta proporcionalmente el IVA para que el total con IVA sea igual al bruto sin IVA
        lineDiscount = rate > 0 ? grossLine - grossLine / (1 + rate / 100) : 0;
      }

      const netAfterLineDisc = Math.max(0, grossLine - lineDiscount);
      return {
        ...item,
        grossLine,
        lineDiscount,
        netAfterLineDisc,
        rate,
      };
    });

    const sumNetAfterLine = lineCalcs.reduce((acc, l) => acc + l.netAfterLineDisc, 0);

    // 2. Calcular descuento general distribuido proporcionalmente
    let globalDiscountAmount = 0;
    if (sumNetAfterLine > 0) {
      if (globalDiscountType === "percentage") {
        const pct = Math.min(100, Math.max(0, Number(globalDiscountValue) || 0));
        globalDiscountAmount = sumNetAfterLine * (pct / 100);
      } else if (globalDiscountType === "amount") {
        globalDiscountAmount = Math.min(sumNetAfterLine, Math.max(0, Number(globalDiscountValue) || 0));
      } else if (globalDiscountType === "no_iva") {
        // Quitar IVA en todos los ítems gravados
        globalDiscountAmount = lineCalcs.reduce((acc, l) => {
          if (l.rate > 0) {
            return acc + (l.netAfterLineDisc - l.netAfterLineDisc / (1 + l.rate / 100));
          }
          return acc;
        }, 0);
      }
    }

    let subtotal15 = 0;
    let subtotal0 = 0;
    let discountTotal = 0;
    let ivaTotal = 0;

    const finalInvoiceItems: InvoiceItem[] = lineCalcs.map((l) => {
      let extraGlobalDisc = 0;
      if (sumNetAfterLine > 0 && globalDiscountAmount > 0) {
        if (globalDiscountType === "no_iva") {
          extraGlobalDisc =
            l.rate > 0 ? l.netAfterLineDisc - l.netAfterLineDisc / (1 + l.rate / 100) : 0;
        } else {
          extraGlobalDisc = globalDiscountAmount * (l.netAfterLineDisc / sumNetAfterLine);
        }
      }

      const totalItemDiscount = Math.round((l.lineDiscount + extraGlobalDisc) * 100) / 100;
      const finalSubtotal = Math.max(0, Math.round((l.grossLine - totalItemDiscount) * 100) / 100);
      const finalIva = Math.round(finalSubtotal * (l.rate / 100) * 100) / 100;
      const finalTotal = Math.round((finalSubtotal + finalIva) * 100) / 100;

      if (l.rate > 0) {
        subtotal15 += finalSubtotal;
        ivaTotal += finalIva;
      } else {
        subtotal0 += finalSubtotal;
      }
      discountTotal += totalItemDiscount;

      return {
        id: l.id,
        productId: l.productId,
        sku: l.sku,
        name: l.name,
        description: l.description,
        unit: l.unit,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: totalItemDiscount,
        discountType: l.discountType,
        discountInput: l.discountInput,
        ivaRate: l.rate,
        subtotal: finalSubtotal,
        ivaAmount: finalIva,
        total: finalTotal,
        warehouseId,
        serialNumbers: l.serialNumbers,
      };
    });

    subtotal15 = Math.round(subtotal15 * 100) / 100;
    subtotal0 = Math.round(subtotal0 * 100) / 100;
    discountTotal = Math.round(discountTotal * 100) / 100;
    ivaTotal = Math.round(ivaTotal * 100) / 100;
    const total = Math.round((subtotal15 + subtotal0 + ivaTotal) * 100) / 100;

    return {
      items: finalInvoiceItems,
      subtotal15,
      subtotal0,
      discountTotal,
      ivaTotal,
      total,
    };
  }, [cartItems, globalDiscountType, globalDiscountValue, warehouseId]);

  // ==========================================
  // CÁLCULO DE MULTIPAGO Y VUELTO
  // ==========================================
  const paymentSummary = useMemo(() => {
    const ef = activeMethods.efectivo ? Math.max(0, parseFloat(paymentValues.efectivo) || 0) : 0;
    const tr = activeMethods.transferencia ? Math.max(0, parseFloat(paymentValues.transferencia) || 0) : 0;
    const tj = activeMethods.tarjeta ? Math.max(0, parseFloat(paymentValues.tarjeta) || 0) : 0;
    const cr = activeMethods.credito ? Math.max(0, parseFloat(paymentValues.credito) || 0) : 0;

    // Si solo efectivo está activo y aún no han digitado monto, asumimos cubierto exacto cuando pulsan o muestran placeholder
    const totalEntered = Math.round((ef + tr + tj + cr) * 100) / 100;
    const totalSale = calculatedTotals.total;
    const diff = Math.round((totalEntered - totalSale) * 100) / 100;

    const change = diff > 0 ? diff : 0;
    const missing = diff < 0 ? Math.abs(diff) : 0;

    return {
      efectivo: ef,
      transferencia: tr,
      tarjeta: tj,
      credito: cr,
      totalEntered,
      change,
      missing,
      isCovered: totalSale > 0 && totalEntered >= totalSale - 0.01,
    };
  }, [activeMethods, paymentValues, calculatedTotals.total]);

  // Sincronizar monto por defecto cuando cambia el total y solo hay 1 método activo
  const syncSingleActivePayment = (newTotal: number) => {
    const activeKeys = (Object.keys(activeMethods) as Array<keyof typeof activeMethods>).filter(
      (k) => activeMethods[k]
    );
    if (activeKeys.length === 1) {
      const key = activeKeys[0];
      setPaymentValues((prev) => ({
        ...prev,
        [key]: newTotal > 0 ? newTotal.toFixed(2) : "",
      }));
    }
  };

  // ==========================================
  // MANEJADORES DEL CARRITO
  // ==========================================
  const handleAddProductToCart = (prod: InventoryProduct) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === prod.id);
      let updated: CartLineItem[];
      if (existingIndex >= 0) {
        updated = prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        const newItem: CartLineItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          description: "",
          unit: prod.unit || "unidad",
          quantity: 1,
          unitPrice: prod.salePrice,
          ivaRate: prod.ivaRate ?? 15,
          discountType: "percentage",
          discountInput: 0,
          serialNumbers: [],
        };
        updated = [...prev, newItem];
      }
      return updated;
    });
    setProductSearch("");
    setShowProductDropdown(false);
  };

  const handleUpdateCartItem = (index: number, updates: Partial<CartLineItem>) => {
    setCartItems((prev) => prev.map((it, idx) => (idx === index ? { ...it, ...updates } : it)));
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const openItemDiscountModal = (index: number) => {
    const item = cartItems[index];
    if (!item) return;
    setEditingDiscountIndex(index);
    setItemModalDiscType(item.discountType || "percentage");
    setItemModalDiscValue(item.discountInput ? String(item.discountInput) : "");
  };

  const applyItemDiscountModal = () => {
    if (editingDiscountIndex === null) return;
    const numVal = Math.max(0, parseFloat(itemModalDiscValue) || 0);
    handleUpdateCartItem(editingDiscountIndex, {
      discountType: itemModalDiscType,
      discountInput: itemModalDiscType === "no_iva" ? 100 : numVal,
    });
    setEditingDiscountIndex(null);
  };

  // ==========================================
  // MANEJADORES DE MULTIPAGO
  // ==========================================
  const togglePaymentMethod = (method: keyof typeof activeMethods) => {
    if (method === "credito" && isConsumidorFinal) {
      showWarning(
        "Crédito Requiere Cliente Identificado",
        "No se puede otorgar crédito directo a Consumidor Final. Selecciona un cliente con RUC o Cédula."
      );
      return;
    }

    const willBeActive = !activeMethods[method];
    const nextActive = { ...activeMethods, [method]: willBeActive };

    // Garantizar al menos 1 método activo
    if (!Object.values(nextActive).some(Boolean)) {
      return;
    }

    setActiveMethods(nextActive);

    if (willBeActive) {
      // Calcular cuánto falta por cubrir con los otros métodos activos
      const otherSum = (Object.keys(nextActive) as Array<keyof typeof activeMethods>)
        .filter((k) => k !== method && nextActive[k])
        .reduce((acc, k) => acc + (parseFloat(paymentValues[k]) || 0), 0);
      const remaining = Math.max(0, calculatedTotals.total - otherSum);
      setPaymentValues((prev) => ({
        ...prev,
        [method]: remaining > 0 ? remaining.toFixed(2) : "",
      }));

      if (method === "credito") {
        setShowCreditModal(true);
      }
    } else {
      setPaymentValues((prev) => ({
        ...prev,
        [method]: "",
      }));
    }
  };

  // Actualizar automáticamente el monto si solo hay 1 método activo y su valor está vacío o desincronizado
  React.useEffect(() => {
    syncSingleActivePayment(calculatedTotals.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatedTotals.total]);

  // ==========================================
  // CREACIÓN RÁPIDA DE CLIENTE Y PRODUCTO
  // ==========================================
  const handleLookupClientSri = async () => {
    const clean = newClientRuc.trim();
    if (clean.length < 10) {
      showWarning("Identificación incompleta", "Ingresa al menos 10 dígitos para consultar en el SRI.");
      return;
    }
    setIsLookingUpSri(true);
    try {
      const isValid = validarIdentificacionEcuador(clean);
      if (!isValid) {
        showError("Identificación Inválida", "El número de RUC o Cédula no supera la validación algorítmica del SRI.");
        return;
      }

      const existingClient = clients.find((c) => c.identificationNumber === clean);
      const existingSupplier = suppliers.find((s) => s.ruc === clean);

      if (existingClient) {
        setNewClientName(existingClient.businessName);
        setNewClientAddress(existingClient.address);
        setNewClientEmail(existingClient.email);
        setNewClientPhone(existingClient.phone);
        setNewClientType(clean.length === 13 ? "RUC" : "CEDULA");
        showSuccess("Datos SRI Recuperados", `Contribuyente localizado: ${existingClient.businessName}`);
      } else if (existingSupplier) {
        setNewClientName(existingSupplier.razonSocial);
        setNewClientAddress(existingSupplier.address || "Quito, Ecuador");
        setNewClientEmail(existingSupplier.email || "");
        setNewClientPhone(existingSupplier.phone || "");
        setNewClientType(clean.length === 13 ? "RUC" : "CEDULA");
        showSuccess("Datos SRI Recuperados", `Contribuyente localizado: ${existingSupplier.razonSocial}`);
      } else {
        setNewClientType(clean.length === 13 ? "RUC" : "CEDULA");
        if (!newClientName.trim()) {
          setNewClientName(
            clean.length === 13
              ? `CONTRIBUYENTE SRI RUC ${clean}`
              : `CIUDADANO C.I. ${clean}`
          );
        }
        showSuccess("Identificación Válida en SRI", "RUC/Cédula verificado algorítmicamente con éxito.");
      }
    } catch (err: any) {
      showError("Error de Consulta", err?.message || "No se pudo consultar el catastro SRI.");
    } finally {
      setIsLookingUpSri(false);
    }
  };

  const handleSaveQuickClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientRuc.trim()) {
      showError("Campos Requeridos", "Ingresa nombre/razón social y RUC/Cédula.");
      return;
    }
    const created = await addClient({
      identificationType: newClientType,
      identificationNumber: newClientRuc.trim(),
      businessName: newClientName.trim().toUpperCase(),
      email: newClientEmail.trim() || "facturacion@cliente.ec",
      phone: newClientPhone.trim() || "0999999999",
      address: newClientAddress.trim() || "Quito, Ecuador",
      requiresSriBilling: true,
      status: "activo",
      totalActiveServices: 0,
      currentBalance: 0,
    });
    setIsConsumidorFinal(false);
    setSelectedClientId(created.id);
    setShowNewClientModal(false);
    setNewClientName("");
    setNewClientRuc("");
    setNewClientEmail("");
    setNewClientPhone("");
    showSuccess("Cliente Registrado", `${created.businessName} seleccionado para la venta.`);
  };

  const handleSaveQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProdName.trim() || !quickProdPrice) {
      showError("Datos incompletos", "Ingresa el nombre y el precio unitario del producto.");
      return;
    }
    setIsCreatingProduct(true);
    try {
      const priceNum = Math.max(0, parseFloat(quickProdPrice) || 0);
      const costNum = Math.max(0, parseFloat(quickProdCost) || priceNum * 0.7);
      const stockNum = Math.max(0, parseInt(quickProdStock, 10) || 0);
      const skuCode =
        quickProdSku.trim().toUpperCase() ||
        `PRD-${Math.floor(1000 + Math.random() * 9000)}`;

      const createdProd = await addInventoryProduct({
        sku: skuCode,
        name: quickProdName.trim(),
        description: "Creado desde Punto de Venta",
        categoryId: inventoryCategories[0]?.id || "cat-equipos",
        categoryName: inventoryCategories[0]?.name || "Equipos",
        brandId: "brd-generic",
        brandName: "Genérico",
        type: quickProdTracksStock ? "producto" : "servicio",
        unit: "unidad",
        baseCost: costNum,
        salePrice: priceNum,
        salePriceConIva: priceNum * (1 + quickProdIva / 100),
        taxMode: "EXCLUIDO",
        ivaRate: quickProdIva,
        minStock: 2,
        tracksStock: quickProdTracksStock,
        stock: quickProdTracksStock ? stockNum : 0,
        stockByWarehouse: quickProdTracksStock ? { [warehouseId]: stockNum } : {},
        defaultWarehouseId: warehouseId,
        status: "activo",
      });

      handleAddProductToCart(createdProd);
      setShowQuickProductModal(false);
      setQuickProdName("");
      setQuickProdSku("");
      setQuickProdPrice("");
      setQuickProdCost("");
      setQuickProdStock("10");
      showSuccess("Producto Creado y Añadido", `${createdProd.name} se agregó al carrito.`);
    } catch (err: any) {
      showError("Error al Crear Producto", err?.message || "No se pudo crear el producto.");
    } finally {
      setIsCreatingProduct(false);
    }
  };

  // ==========================================
  // VALIDACIÓN ADMINISTRATIVA Y TRIBUTARIA (saleValidation)
  // ==========================================
  const validateBeforeSubmit = (mode: "emit" | "draft"): boolean => {
    if (!selectedClient) {
      setValidationDialog({
        isOpen: true,
        title: "Falta Seleccionar el Cliente",
        message:
          "Debes asignar un cliente registrado o seleccionar 'Consumidor Final' antes de procesar la venta.",
        actionLabel: "Ingresar Cliente",
        targetSection: "client",
      });
      return false;
    }

    if (calculatedTotals.items.length === 0) {
      setValidationDialog({
        isOpen: true,
        title: "Carrito de Venta Vacío",
        message:
          "Agrega al menos un producto o servicio a la tabla de detalle para continuar.",
        actionLabel: "Agregar Producto",
        targetSection: "products",
      });
      return false;
    }

    if (mode === "draft") {
      return true;
    }

    // Regla SRI Ecuador: Consumidor Final > $50 SOLO bloquea en Factura Electrónica
    if (
      documentType === "factura" &&
      (isConsumidorFinal || selectedClient.identificationNumber === "9999999999999") &&
      calculatedTotals.total > 50
    ) {
      setValidationDialog({
        isOpen: true,
        title: "Restricción Tributaria SRI ($50.00)",
        message:
          "Por normativa del SRI Ecuador, las Facturas Electrónicas mayores a $50.00 USD no pueden emitirse a CONSUMIDOR FINAL. Identifica al cliente con RUC/Cédula o registra el comprobante como Nota de Venta (Recibo).",
        actionLabel: "Cambiar a Nota de Venta",
        targetSection: "switch_nota_venta",
      });
      return false;
    }

    // Validar que el pago cubra el total
    if (!paymentSummary.isCovered) {
      setValidationDialog({
        isOpen: true,
        title: "Monto de Pago Incompleto",
        message: `El monto cubierto ($${paymentSummary.totalEntered.toFixed(
          2
        )}) es menor al total de la venta ($${calculatedTotals.total.toFixed(
          2
        )}). Falta cubrir $${paymentSummary.missing.toFixed(2)}.`,
        actionLabel: "Completar Pago",
        targetSection: "payment",
      });
      return false;
    }

    // Validar que el vuelto no supere al efectivo recibido
    if (paymentSummary.change > 0 && paymentSummary.change > paymentSummary.efectivo) {
      setValidationDialog({
        isOpen: true,
        title: "Monto en Transferencia / Tarjeta Excede el Total",
        message:
          "Los pagos por Transferencia, Tarjeta o Crédito no pueden superar el valor total de la venta para generar vuelto en efectivo.",
        actionLabel: "Corregir Forma de Pago",
        targetSection: "payment",
      });
      return false;
    }

    return true;
  };

  const handleRequestAction = (mode: "emit" | "draft") => {
    if (!validateBeforeSubmit(mode)) return;

    if (mode === "draft") {
      setConfirmDialog({
        isOpen: true,
        mode: "draft",
        title: "Guardar Borrador",
        message:
          "¿Deseas guardar este comprobante como BORRADOR? No consumirá secuencial ni descontará stock de bodega hasta su emisión definitiva.",
      });
    } else if (documentType === "nota_venta") {
      setConfirmDialog({
        isOpen: true,
        mode: "emit",
        title: "Confirmar Registro de Nota de Venta",
        message:
          "Se guardará el RECIBO de venta local para control interno, descontando el inventario de bodega y registrando el ingreso en caja/bancos. Esta acción no tiene validez tributaria ante el SRI.",
      });
    } else {
      setConfirmDialog({
        isOpen: true,
        mode: "emit",
        title: "Confirmar Emisión Electrónica SRI",
        message:
          "Se firmará digitalmente con tu certificado XAdES-BES y se enviará la FACTURA ELECTRÓNICA al SRI de forma oficial. Esta acción no se puede deshacer y tiene validez tributaria.",
      });
    }
  };

  // ==========================================
  // EJECUCIÓN DE EMISIÓN (FACTURA SRI / NOTA DE VENTA / BORRADOR)
  // ==========================================
  const executeConfirmedAction = async () => {
    if (!confirmDialog || !selectedClient) return;
    const mode = confirmDialog.mode;
    setConfirmDialog(null);

    if (mode === "void" && emittedInvoice) {
      await updateInvoiceStatus(emittedInvoice.id, "anulada");
      setEmittedInvoice({ ...emittedInvoice, status: "anulada" });
      showSuccess(
        "Comprobante Anulado",
        `El documento ${emittedInvoice.documentNumber} fue anulado y el stock se reintegró al Kardex.`
      );
      return;
    }

    setIsProcessing(true);
    setSriLogs([]);

    const pushLog = (msg: string) => {
      const ts = new Date().toLocaleTimeString("es-EC", { hour12: false });
      setSriLogs((prev) => [...prev, `[${ts}] ${msg}`]);
    };

    try {
      const wh =
        inventoryWarehouses.find((w) => w.id === warehouseId) || inventoryWarehouses[0];

      // Determinar método principal de pago para compatibilidad con SriInvoice
      let primaryMethod: SriInvoice["paymentMethod"] = "efectivo";
      if (activeMethods.transferencia && paymentSummary.transferencia >= paymentSummary.efectivo) {
        primaryMethod = "transferencia";
      } else if (activeMethods.tarjeta && paymentSummary.tarjeta >= paymentSummary.efectivo) {
        primaryMethod = "tarjeta";
      } else if (activeMethods.credito && paymentSummary.credito > 0) {
        primaryMethod = "credito";
      }

      const sriPaymentCode =
        primaryMethod === "efectivo" ? "01" : primaryMethod === "tarjeta" ? "19" : "20";

      const tipoIdentificacion = isConsumidorFinal
        ? "07"
        : selectedClient.identificationNumber.length === 13
        ? "04"
        : selectedClient.identificationNumber.length === 10
        ? "05"
        : "06";

      if (mode === "draft") {
        const draftInvoice = await createInvoice({
          documentType,
          date: issueDate,
          time: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
          clientId: selectedClient.id,
          clientName: selectedClient.businessName,
          clientRuc: selectedClient.identificationNumber,
          clientEmail: selectedClient.email,
          clientPhone: selectedClient.phone,
          clientAddress: selectedClient.address || "Ecuador",
          tipoIdentificacion,
          items: calculatedTotals.items,
          subtotal15: calculatedTotals.subtotal15,
          subtotal0: calculatedTotals.subtotal0,
          subtotalNoObjeto: 0,
          subtotalExento: 0,
          discountTotal: calculatedTotals.discountTotal,
          ivaTotal: calculatedTotals.ivaTotal,
          total: calculatedTotals.total,
          paymentMethod: primaryMethod,
          paymentsBreakdown: {
            efectivo: Math.min(calculatedTotals.total, paymentSummary.efectivo),
            transferencia: paymentSummary.transferencia,
            tarjeta: paymentSummary.tarjeta,
            credito: paymentSummary.credito,
          },
          transferenciaRef: transferenciaRef.trim() || undefined,
          tarjetaRef: tarjetaRef.trim() || undefined,
          bankAccountId: selectedBankAccountId || undefined,
          creditDueDate: activeMethods.credito ? creditDueDate : undefined,
          orderNumber: orderNumber.trim() || undefined,
          sriPaymentCode,
          paymentTermDays: activeMethods.credito ? paymentTermDays : 0,
          status: "borrador",
          warehouseId: wh ? wh.id : warehouseId,
          warehouseName: wh ? wh.name : "Bodega Central",
          notes: notes.trim() || undefined,
        });

        setIsProcessing(false);
        showSuccess("Borrador Guardado", `Comprobante guardado como ${draftInvoice.documentNumber}.`);
        onBack();
        return;
      }

      if (documentType === "nota_venta") {
        // FLUJO RÁPIDO: NOTA DE VENTA (RECIBO INTERNO)
        const nota = await createInvoice({
          documentType: "nota_venta",
          date: issueDate,
          time: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
          clientId: selectedClient.id,
          clientName: selectedClient.businessName,
          clientRuc: selectedClient.identificationNumber,
          clientEmail: selectedClient.email,
          clientPhone: selectedClient.phone,
          clientAddress: selectedClient.address || "Ecuador",
          tipoIdentificacion,
          items: calculatedTotals.items,
          subtotal15: calculatedTotals.subtotal15,
          subtotal0: calculatedTotals.subtotal0,
          subtotalNoObjeto: 0,
          subtotalExento: 0,
          discountTotal: calculatedTotals.discountTotal,
          ivaTotal: calculatedTotals.ivaTotal,
          total: calculatedTotals.total,
          paymentMethod: primaryMethod,
          paymentsBreakdown: {
            efectivo: Math.max(0, paymentSummary.efectivo - paymentSummary.change),
            transferencia: paymentSummary.transferencia,
            tarjeta: paymentSummary.tarjeta,
            credito: paymentSummary.credito,
          },
          transferenciaRef: transferenciaRef.trim() || undefined,
          tarjetaRef: tarjetaRef.trim() || undefined,
          bankAccountId: selectedBankAccountId || undefined,
          creditDueDate: activeMethods.credito ? creditDueDate : undefined,
          orderNumber: orderNumber.trim() || undefined,
          sriPaymentCode,
          paymentTermDays: activeMethods.credito ? paymentTermDays : 0,
          status: "autorizada",
          authorizationDate: new Date().toISOString(),
          warehouseId: wh ? wh.id : warehouseId,
          warehouseName: wh ? wh.name : "Bodega Central",
          notes: notes.trim() || undefined,
        });

        setIsProcessing(false);
        setEmittedInvoice(nota);
        setCurrentStep(2);
        showSuccess(
          "Nota de Venta Registrada",
          `Recibo No. ${nota.documentNumber} registrado con éxito.`
        );
        return;
      }

      // FLUJO OFICIAL: FACTURA ELECTRÓNICA SRI
      pushLog("Iniciando motor de facturación electrónica SRI v2.1.0...");
      pushLog("Validando RUC Emisor y estructura tributaria...");

      const newInvoice = await createInvoice({
        documentType: "factura",
        date: issueDate,
        time: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
        clientId: selectedClient.id,
        clientName: selectedClient.businessName,
        clientRuc: selectedClient.identificationNumber,
        clientEmail: selectedClient.email,
        clientPhone: selectedClient.phone,
        clientAddress: selectedClient.address || "Ecuador",
        tipoIdentificacion,
        items: calculatedTotals.items,
        subtotal15: calculatedTotals.subtotal15,
        subtotal0: calculatedTotals.subtotal0,
        subtotalNoObjeto: 0,
        subtotalExento: 0,
        discountTotal: calculatedTotals.discountTotal,
        ivaTotal: calculatedTotals.ivaTotal,
        total: calculatedTotals.total,
        paymentMethod: primaryMethod,
        paymentsBreakdown: {
          efectivo: Math.max(0, paymentSummary.efectivo - paymentSummary.change),
          transferencia: paymentSummary.transferencia,
          tarjeta: paymentSummary.tarjeta,
          credito: paymentSummary.credito,
        },
        transferenciaRef: transferenciaRef.trim() || undefined,
        tarjetaRef: tarjetaRef.trim() || undefined,
        bankAccountId: selectedBankAccountId || undefined,
        creditDueDate: activeMethods.credito ? creditDueDate : undefined,
        orderNumber: orderNumber.trim() || undefined,
        sriPaymentCode,
        paymentTermDays: activeMethods.credito ? paymentTermDays : 0,
        status: "emitida",
        warehouseId: wh ? wh.id : warehouseId,
        warehouseName: wh ? wh.name : "Bodega Central",
        notes: notes.trim() || undefined,
      });

      pushLog(`Secuencial asignado: ${newInvoice.documentNumber}`);
      pushLog(`Clave de Acceso Módulo 11 (49 dígitos): ${newInvoice.claveAcceso}`);

      const rawXml = generarFacturaXml(newInvoice, sriCompanyConfig);
      pushLog("Aplicando firma electrónica XAdES-BES con certificado PKCS#12 (.p12)...");
      const signedXml = generarXmlFirmado(rawXml, sriCompanyConfig);

      pushLog(
        `Transmitiendo comprobante a WS SRI (${
          sriCompanyConfig.ambiente === "2" ? "PRODUCCIÓN" : "PRUEBAS"
        })...`
      );
      const wsResult = await enviarComprobanteAlSri(
        signedXml,
        newInvoice.claveAcceso,
        sriCompanyConfig.ambiente
      );

      let finalInvoice: SriInvoice = newInvoice;
      if (wsResult.estado === "AUTORIZADO") {
        const authDate = wsResult.fechaAutorizacion || new Date().toISOString();
        pushLog(`Respuesta SRI: [AUTORIZADO] Fecha: ${authDate}`);
        await updateInvoiceStatus(newInvoice.id, "autorizada", authDate);
        finalInvoice = {
          ...newInvoice,
          status: "autorizada",
          authorizationDate: authDate,
        };
        showSuccess(
          "Factura Autorizada por el SRI",
          `Comprobante ${newInvoice.documentNumber} autorizado y Kardex actualizado.`
        );
      } else {
        const msg = wsResult.mensajes?.[0]?.mensaje || "Comprobante en procesamiento";
        pushLog(`Estado SRI: [${wsResult.estado}] - ${msg}`);
        showWarning("Comprobante Emitido", `Estado SRI: ${wsResult.estado}. ${msg}`);
      }

      setIsProcessing(false);
      setEmittedInvoice(finalInvoice);
      setCurrentStep(2);
    } catch (err: any) {
      pushLog(`ERROR: ${err?.message || "Fallo en proceso de emisión"}`);
      showError("Error al Procesar Venta", err?.message || "Revisa los datos del comprobante.");
      setIsProcessing(false);
    }
  };

  // ==========================================
  // REINICIAR PARA NUEVA VENTA (DESDE PASO 2)
  // ==========================================
  const handleStartNewSale = () => {
    setCurrentStep(1);
    setEmittedInvoice(null);
    setCartItems([]);
    setSelectedClientId("");
    setIsConsumidorFinal(false);
    setGlobalDiscountType("none");
    setGlobalDiscountValue(0);
    setOrderNumber("");
    setNotes("");
    setTransferenciaRef("");
    setTarjetaRef("");
    setSriLogs([]);
    setActiveMethods({
      efectivo: true,
      transferencia: false,
      tarjeta: false,
      credito: false,
    });
    setPaymentValues({
      efectivo: "",
      transferencia: "",
      tarjeta: "",
      credito: "",
    });
  };

  // ==========================================
  // ACCIONES PASO 2 (XML, WHATSAPP, CORREO, IMPRESIÓN)
  // ==========================================
  const handleDownloadEmittedXml = () => {
    if (!emittedInvoice || emittedInvoice.documentType === "nota_venta") return;
    try {
      const rawXml = generarFacturaXml(emittedInvoice, sriCompanyConfig);
      const signedXml = generarXmlFirmado(rawXml, sriCompanyConfig);
      descargarXmlArchivo(signedXml, `SRI-FACTURA-${emittedInvoice.documentNumber}.xml`);
      showSuccess("XML Descargado", `Archivo SRI-FACTURA-${emittedInvoice.documentNumber}.xml guardado.`);
    } catch (e: any) {
      showError("Error XML", e?.message || "No se pudo descargar el XML.");
    }
  };

  const handleShareWhatsApp = () => {
    if (!emittedInvoice) return;
    const isNota = emittedInvoice.documentType === "nota_venta";
    const docTitle = isNota ? "Nota de Venta" : "Factura Electrónica";
    const phoneClean = (emittedInvoice.clientPhone || "").replace(/\D/g, "");
    const ecPhone =
      phoneClean.startsWith("0") && phoneClean.length === 10
        ? `593${phoneClean.slice(1)}`
        : phoneClean;

    const text = [
      `Hola *${emittedInvoice.clientName}*,`,
      `Te enviamos el detalle de tu *${docTitle} No. ${emittedInvoice.documentNumber}* emitida por *${sriCompanyConfig.razonSocial}*:`,
      ``,
      `• *Fecha:* ${emittedInvoice.date}`,
      `• *Total:* $${emittedInvoice.total.toFixed(2)} USD`,
      !isNota && emittedInvoice.claveAcceso
        ? `• *Clave de Acceso SRI:* ${emittedInvoice.claveAcceso}`
        : `• *Estado:* Registrado`,
      ``,
      `¡Gracias por tu preferencia!`,
    ].join("\n");

    const url = ecPhone
      ? `https://wa.me/${ecPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleResendEmail = (targetEmail?: string) => {
    if (!emittedInvoice) return;
    if (targetEmail) {
      setIsSendingCustomEmail(true);
      setTimeout(() => {
        setIsSendingCustomEmail(false);
        setCustomCopyEmail("");
        showSuccess("Copia Enviada", `El comprobante fue enviado a ${targetEmail}.`);
      }, 700);
    } else {
      setEmailStatus("sending");
      setTimeout(() => {
        setEmailStatus("sent");
        showSuccess(
          "Correo Reenviado",
          `Notificación enviada a ${emittedInvoice.clientEmail || "cliente"}.`
        );
      }, 700);
    }
  };

  // ==========================================
  // RENDERIZADO PASO 2: DETALLE DE VENTA E IMPRESIÓN
  // ==========================================
  if (currentStep === 2 && emittedInvoice) {
    const isNota = emittedInvoice.documentType === "nota_venta";
    const isVoided = emittedInvoice.status === "anulada";

    return (
      <div className="space-y-5 animate-in fade-in duration-200">
        {/* Barra Superior de Comprobante Emitido */}
        <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-slate-900 text-white text-xs font-bold">
                {isNota ? <Receipt className="w-3.5 h-3.5 text-emerald-400" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                <span>Tipo de Documento: {isNota ? "Nota de Venta" : "Factura Electrónica"}</span>
              </span>

              <span className="text-sm font-mono font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-[4px] border border-slate-200">
                CÓDIGO: {emittedInvoice.documentNumber}
              </span>

              {!isNota && emittedInvoice.claveAcceso && (
                <div className="flex items-center gap-1.5 bg-blue-50/70 border border-blue-200 px-2.5 py-1 rounded-[4px]">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Clave SRI:</span>
                  <span className="text-[11px] font-mono font-semibold text-slate-800 max-w-[200px] truncate">
                    {emittedInvoice.claveAcceso}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(emittedInvoice.claveAcceso);
                      setCopiedAccessKey(true);
                      setTimeout(() => setCopiedAccessKey(false), 2000);
                    }}
                    className="p-0.5 text-blue-600 hover:text-blue-800 cursor-pointer"
                    title="Copiar Clave de Acceso"
                  >
                    {copiedAccessKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Botones de Acción Rápida Paso 2 */}
            <div className="flex flex-wrap items-center gap-2">
              {!isNota && (
                <button
                  type="button"
                  onClick={handleDownloadEmittedXml}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-[#004ac6]" />
                  <span>XML</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setRideModalFormat("ride");
                  setIsRideModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-rose-600" />
                <span>{isNota ? "PDF (A4)" : "PDF / RIDE"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRideModalFormat("ticket");
                  setIsRideModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-700" />
                <span>Imprimir / Ticket 80mm</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleStartNewSale}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#004ac6] hover:bg-[#003ca3] text-white text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Venta</span>
              </button>

              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Historial</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tarjeta Principal del Documento Registrado */}
        <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs p-6 space-y-6">
          {/* Cabecera Cliente y Estado */}
          <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Datos del Cliente
              </span>
              <h2 className="text-lg font-black text-slate-900">
                {emittedInvoice.clientName}
              </h2>
              <p className="text-xs font-mono text-slate-600">
                <strong>RUC / C.I.:</strong> {emittedInvoice.clientRuc}
              </p>
              <p className="text-xs text-slate-600">
                <strong>Dirección:</strong> {emittedInvoice.clientAddress || "Ecuador"}
              </p>
              {emittedInvoice.clientEmail && (
                <p className="text-xs text-slate-600">
                  <strong>Email:</strong> {emittedInvoice.clientEmail}
                </p>
              )}
            </div>

            <div className="flex flex-col md:items-end justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  Fecha: <strong className="text-slate-900">{emittedInvoice.date}</strong>
                </span>
                <span
                  className={`px-2.5 py-1 rounded-[4px] text-xs font-black uppercase border ${
                    isVoided
                      ? "bg-rose-50 text-rose-700 border-rose-300"
                      : "bg-emerald-50 text-emerald-700 border-emerald-300"
                  }`}
                >
                  {isVoided ? "ANULADO" : isNota ? "REGISTRADO" : "AUTORIZADO SRI"}
                </span>
              </div>

              {!isVoided && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      isOpen: true,
                      mode: "void",
                      title: isNota ? "Anular Nota de Venta" : "Anular Comprobante",
                      message: `¿Estás seguro de anular el documento ${emittedInvoice.documentNumber}? Se revertirá la salida de mercadería en el Kardex.`,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{isNota ? "Anular Nota de Venta" : "Anular Documento"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Productos Facturados */}
          <div className="rounded-[6px] border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase">
                  <th className="py-2.5 px-3 text-center w-20">Cantidad</th>
                  <th className="py-2.5 px-3">Producto / Descripción</th>
                  <th className="py-2.5 px-3 text-right">Precio U.</th>
                  <th className="py-2.5 px-3 text-right">Descuento</th>
                  <th className="py-2.5 px-3 text-center">IVA</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {emittedInvoice.items.map((it, idx) => (
                  <tr key={it.id || idx} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                      {it.quantity}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{it.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">SKU: {it.sku}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      ${it.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                      {it.discount > 0 ? `-$${it.discount.toFixed(2)}` : "$0.00"}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      {it.ivaRate}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      ${it.subtotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sección Inferior: Pagos, Correo y Totales */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              {/* Formas de Pago */}
              <div className="p-4 rounded-[6px] bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Formas de Pago Aplicadas
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {emittedInvoice.paymentsBreakdown ? (
                    <>
                      {emittedInvoice.paymentsBreakdown.efectivo > 0 && (
                        <div className="p-2.5 rounded-[6px] bg-white border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Efectivo</span>
                          <span className="text-sm font-mono font-black text-slate-900">
                            ${emittedInvoice.paymentsBreakdown.efectivo.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {emittedInvoice.paymentsBreakdown.transferencia > 0 && (
                        <div className="p-2.5 rounded-[6px] bg-white border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Transferencia</span>
                          <span className="text-sm font-mono font-black text-slate-900">
                            ${emittedInvoice.paymentsBreakdown.transferencia.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {emittedInvoice.paymentsBreakdown.tarjeta > 0 && (
                        <div className="p-2.5 rounded-[6px] bg-white border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Tarjeta</span>
                          <span className="text-sm font-mono font-black text-slate-900">
                            ${emittedInvoice.paymentsBreakdown.tarjeta.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {emittedInvoice.paymentsBreakdown.credito > 0 && (
                        <div className="p-2.5 rounded-[6px] bg-amber-50 border border-amber-200">
                          <span className="text-[10px] font-bold text-amber-700 uppercase block">
                            Crédito ({emittedInvoice.paymentTermDays || 30}d)
                          </span>
                          <span className="text-sm font-mono font-black text-amber-900">
                            ${emittedInvoice.paymentsBreakdown.credito.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-2.5 rounded-[6px] bg-white border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        {emittedInvoice.paymentMethod}
                      </span>
                      <span className="text-sm font-mono font-black text-slate-900">
                        ${emittedInvoice.total.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Panel de Notificación por Correo Electrónico */}
              <div className="p-4 rounded-[6px] bg-white border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#004ac6]" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Notificación por Correo Electrónico
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResendEmail()}
                    disabled={emailStatus === "sending"}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-blue-50 hover:bg-blue-100 text-[#004ac6] text-[11px] font-bold transition cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>{emailStatus === "sending" ? "Enviando..." : "Reenviar al Cliente"}</span>
                  </button>
                </div>

                <div className="text-xs text-slate-600 flex items-center justify-between bg-slate-50 px-3 py-2 rounded-[4px] border border-slate-200/70">
                  <span>
                    Destinatario:{" "}
                    <strong className="text-slate-900">
                      {emittedInvoice.clientEmail || "consumidor@final.ec"}
                    </strong>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[4px] border border-emerald-200">
                    ✓ Enviado
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="Enviar copia a otro correo (ej. contabilidad@empresa.com)..."
                    value={customCopyEmail}
                    onChange={(e) => setCustomCopyEmail(e.target.value)}
                    className="flex-1 text-xs py-1.5 px-3 rounded-[6px] border border-slate-300 bg-white outline-hidden focus:border-[#004ac6]"
                  />
                  <button
                    type="button"
                    disabled={!customCopyEmail.trim() || isSendingCustomEmail}
                    onClick={() => handleResendEmail(customCopyEmail.trim())}
                    className="px-3 py-1.5 rounded-[6px] bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold transition cursor-pointer"
                  >
                    {isSendingCustomEmail ? "Enviando..." : "Enviar Copia"}
                  </button>
                </div>
              </div>
            </div>

            {/* Cuadro de Totales Paso 2 */}
            <div className="lg:col-span-5">
              <div className="rounded-[6px] border-2 border-slate-900 overflow-hidden divide-y divide-slate-200 text-xs">
                <div className="flex justify-between px-4 py-2 bg-slate-50">
                  <span className="font-bold text-slate-600">Sub-total 15%:</span>
                  <span className="font-mono font-bold text-slate-900">
                    ${emittedInvoice.subtotal15.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2">
                  <span className="font-bold text-slate-600">Sub-total 0%:</span>
                  <span className="font-mono font-bold text-slate-900">
                    ${emittedInvoice.subtotal0.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2 bg-slate-50">
                  <span className="font-bold text-slate-600">Descuento Total:</span>
                  <span className="font-mono font-bold text-rose-600">
                    -${emittedInvoice.discountTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2">
                  <span className="font-bold text-[#004ac6]">IVA 15%:</span>
                  <span className="font-mono font-bold text-[#004ac6]">
                    ${emittedInvoice.ivaTotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-3 bg-slate-900 text-white text-sm font-black">
                  <span>TOTAL:</span>
                  <span className="font-mono text-base">${emittedInvoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal RIDE / Ticket POS 80mm */}
        <RidePreviewModal
          isOpen={isRideModalOpen}
          onClose={() => setIsRideModalOpen(false)}
          invoice={emittedInvoice}
          companyConfig={sriCompanyConfig}
          initialFormat={rideModalFormat}
        />

        {/* Modal de Confirmación para Anular en Paso 2 */}
        {confirmDialog && confirmDialog.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden">
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[6px] bg-rose-100 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900">{confirmDialog.title}</h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.message}</p>
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 rounded-[6px] text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={executeConfirmedAction}
                    className="px-4 py-2 rounded-[6px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Sí, Anular
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDERIZADO PASO 1: FORMULARIO DE VENTA (FACTURA SRI / NOTA DE VENTA)
  // ==========================================
  return (
    <div className="space-y-4">
      {/* Barra Superior Compacta */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-[6px] border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-[6px] border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            title="Volver al historial de ventas"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight">
              Registrar Venta
            </h1>
            <p className="text-[11px] text-slate-500">
              Emisión electrónica SRI y notas de venta con control de stock en tiempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-[4px] bg-slate-100 border border-slate-200 text-[11px] font-mono font-bold text-slate-700">
            Serie Activa: {selectedEstablecimiento || sriCompanyConfig.establecimiento || "010"}-
            {sriCompanyConfig.puntoEmision || "001"}
          </span>
          <span
            className={`px-2.5 py-1 rounded-[4px] text-[10px] font-bold uppercase border ${
              sriCompanyConfig.ambiente === "2"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            SRI: {sriCompanyConfig.ambiente === "2" ? "PRODUCCIÓN" : "PRUEBAS"}
          </span>
        </div>
      </div>

      {/* Layout Principal: 12 Columnas (8 Izquierda Operativa + 4 Derecha Resumen y Pago) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* =======================================================
            COLUMNA IZQUIERDA (8 COLUMNAS): CLIENTE, DOCUMENTO Y CARRITO
           ======================================================= */}
        <div className="lg:col-span-8 space-y-4">
          {/* Bloque 1: Selección de Cliente + Parámetros del Comprobante */}
          <div className="bg-white p-4 rounded-[6px] border border-slate-200/80 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Selector de Cliente (5 cols) */}
              <div className="md:col-span-5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Cliente <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsConsumidorFinal(true);
                        setSelectedClientId("");
                        setShowClientDropdown(false);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-bold border transition cursor-pointer ${
                        isConsumidorFinal
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Consumidor Final</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewClientModal(true)}
                      className="p-1 rounded-[4px] bg-blue-50 hover:bg-blue-100 text-[#004ac6] border border-blue-200 transition cursor-pointer"
                      title="Crear Nuevo Cliente Rápido"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {selectedClient ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-[6px] bg-blue-50/50 border border-blue-200">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {selectedClient.businessName}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {selectedClient.identificationType}: {selectedClient.identificationNumber}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClientId("");
                        setIsConsumidorFinal(false);
                      }}
                      className="p-1 rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-white transition cursor-pointer shrink-0"
                      title="Cambiar cliente"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={clientSearchInputRef}
                      type="text"
                      placeholder="Buscar por nombre, RUC o cédula..."
                      value={clientSearch}
                      onFocus={() => setShowClientDropdown(true)}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setShowClientDropdown(true);
                      }}
                      className="w-full text-xs pl-8 pr-3 py-2 rounded-[6px] border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                    />
                    {showClientDropdown && (
                      <div className="absolute z-30 mt-1 w-full bg-white rounded-[6px] shadow-xl border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100">
                        {filteredClients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedClientId(c.id);
                              setIsConsumidorFinal(false);
                              setShowClientDropdown(false);
                              setClientSearch("");
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50/60 transition flex items-center justify-between cursor-pointer"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-bold text-xs text-slate-900 truncate">
                                {c.businessName}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500">
                                {c.identificationNumber}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold text-[#004ac6] shrink-0">
                              Seleccionar
                            </span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setShowClientDropdown(false);
                            setShowNewClientModal(true);
                          }}
                          className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 text-[#004ac6] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+ Crear nuevo cliente</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Configuración del Documento (7 cols -> 4 campos compactos) */}
              <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Tipo Documento */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Tipo Documento *
                  </label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as "factura" | "nota_venta")}
                    className={`w-full text-[11px] font-bold py-2 px-2 rounded-[6px] border outline-hidden cursor-pointer ${
                      documentType === "nota_venta"
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-900 border-slate-300 focus:border-[#004ac6]"
                    }`}
                  >
                    <option value="factura" className="bg-white text-slate-900">
                      FACTURA ELECTRÓNICA
                    </option>
                    <option value="nota_venta" className="bg-white text-slate-900">
                      NOTA DE VENTA
                    </option>
                  </select>
                </div>

                {/* Fecha Emisión */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Fecha Emisión *
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full text-[11px] font-semibold py-2 px-2 rounded-[6px] border border-slate-300 bg-white text-slate-800 outline-hidden focus:border-[#004ac6]"
                  />
                </div>

                {/* Establecimiento */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Establecimiento
                  </label>
                  <select
                    value={selectedEstablecimiento}
                    onChange={(e) => setSelectedEstablecimiento(e.target.value)}
                    className="w-full text-[11px] font-semibold py-2 px-2 rounded-[6px] border border-slate-300 bg-white text-slate-800 outline-hidden focus:border-[#004ac6]"
                  >
                    <option value={sriCompanyConfig.establecimiento || "010"}>
                      {sriCompanyConfig.establecimiento || "010"} - Sucursal Principal
                    </option>
                    {sriCompanyConfig.establecimiento !== "010" && (
                      <option value="010">010 - Sucursal ISP</option>
                    )}
                    {sriCompanyConfig.establecimiento !== "011" && (
                      <option value="011">011 - Sucursal 011</option>
                    )}
                    {sriCompanyConfig.establecimiento !== "001" && (
                      <option value="001">001 - Sucursal Matriz</option>
                    )}
                  </select>
                </div>

                {/* Bodega Despacho */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Bodega Despacho
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full text-[11px] font-semibold py-2 px-2 rounded-[6px] border border-slate-300 bg-white text-slate-800 outline-hidden focus:border-[#004ac6]"
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
          </div>

          {/* Bloque 2: Buscador de Productos + Descuento General + Tabla de Ítems */}
          <div className="bg-white p-4 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {/* Buscador de Productos y Botones Añadir / Crear (8 cols) */}
              <div className="md:col-span-8 space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Buscar Producto / Servicio
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={productSearchInputRef}
                      type="text"
                      placeholder="Escribe nombre, SKU o escanea código de barras..."
                      value={productSearch}
                      onFocus={() => setShowProductDropdown(true)}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        setShowProductDropdown(true);
                      }}
                      className="w-full text-xs pl-8 pr-3 py-2 rounded-[6px] border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#004ac6] outline-hidden"
                    />
                    {showProductDropdown && productSearch.trim().length > 0 && (
                      <div className="absolute z-30 mt-1 w-full bg-white rounded-[6px] shadow-xl border border-slate-200 max-h-64 overflow-y-auto divide-y divide-slate-100">
                        {filteredProducts.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-500">
                            No se encontraron coincidencias. Usa el botón{" "}
                            <button
                              type="button"
                              onClick={() => {
                                setShowProductDropdown(false);
                                setQuickProdName(productSearch);
                                setShowQuickProductModal(true);
                              }}
                              className="text-[#004ac6] font-bold underline cursor-pointer"
                            >
                              + Crear
                            </button>
                          </div>
                        ) : (
                          filteredProducts.map((prod) => {
                            const whStock = prod.tracksStock
                              ? Number(prod.stockByWarehouse?.[warehouseId] ?? prod.stock ?? 0)
                              : null;
                            return (
                              <button
                                key={prod.id}
                                type="button"
                                onClick={() => handleAddProductToCart(prod)}
                                className="w-full text-left px-3 py-2 hover:bg-blue-50/60 transition flex items-center justify-between cursor-pointer"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="font-bold text-xs text-slate-900 truncate">
                                    {prod.name}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                                    <span>SKU: {prod.sku}</span>
                                    {whStock !== null && (
                                      <span
                                        className={
                                          whStock > 0
                                            ? "text-emerald-600 font-bold"
                                            : "text-rose-600 font-bold"
                                        }
                                      >
                                        • Stock: {whStock}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-mono font-bold text-xs text-slate-900">
                                    ${prod.salePrice.toFixed(2)}
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    + IVA {prod.ivaRate}%
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCatalogModal(true)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-[6px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQuickProductModal(true)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-[6px] border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shrink-0"
                  >
                    <Package className="w-3.5 h-3.5 text-[#004ac6]" />
                    <span>Crear</span>
                  </button>
                </div>
              </div>

              {/* Descuento General (4 cols) */}
              <div className="md:col-span-4 space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Descuento General
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={globalDiscountType}
                    onChange={(e) => {
                      const mode = e.target.value as DiscountMode;
                      setGlobalDiscountType(mode);
                      if (mode === "none" || mode === "no_iva") {
                        setGlobalDiscountValue(0);
                      }
                    }}
                    className="flex-1 text-xs font-semibold py-2 px-2.5 rounded-[6px] border border-slate-300 bg-white text-slate-800 outline-hidden focus:border-[#004ac6]"
                  >
                    <option value="none">-- Sin Descuento --</option>
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="amount">Monto Fijo ($)</option>
                    <option value="no_iva">Quitar IVA (Sin IVA)</option>
                  </select>

                  {(globalDiscountType === "percentage" || globalDiscountType === "amount") && (
                    <div className="relative w-24">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={globalDiscountValue || ""}
                        onChange={(e) =>
                          setGlobalDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))
                        }
                        placeholder="0"
                        className="w-full text-xs font-mono font-bold py-2 pl-2 pr-5 rounded-[6px] border border-slate-300 bg-white text-right outline-hidden focus:border-[#004ac6]"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        {globalDiscountType === "percentage" ? "%" : "$"}
                      </span>
                    </div>
                  )}

                  {globalDiscountType === "no_iva" && (
                    <span className="px-2 py-2 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 font-mono font-bold text-[10px] shrink-0">
                      -100% IVA
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tabla de Ítems del Carrito */}
            <div className="rounded-[6px] border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase border-b border-slate-200">
                      <th className="py-2.5 px-3 w-20 text-center">Cant.</th>
                      <th className="py-2.5 px-3">Producto / Descripción</th>
                      <th className="py-2.5 px-3 w-28 text-right">Precio U.</th>
                      <th className="py-2.5 px-2 w-24 text-center">Dto.</th>
                      <th className="py-2.5 px-2 w-20 text-center">IVA</th>
                      <th className="py-2.5 px-3 w-28 text-right">Total</th>
                      <th className="py-2.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cartItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400">
                            <Package className="w-7 h-7 stroke-[1.5]" />
                            <p className="text-xs font-medium">
                              Empieza buscando o escaneando un producto arriba
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      cartItems.map((item, idx) => {
                        const calcItem = calculatedTotals.items[idx];
                        const hasLineDisc =
                          (item.discountType === "no_iva" || item.discountInput > 0) &&
                          calcItem &&
                          calcItem.discount > 0;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/60">
                            {/* Cantidad */}
                            <td className="py-2 px-2 text-center align-top">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateCartItem(idx, {
                                    quantity: Math.max(0.01, parseFloat(e.target.value) || 1),
                                  })
                                }
                                className="w-16 text-center font-mono font-bold text-xs py-1 px-1.5 rounded-[4px] border border-slate-300 bg-white"
                              />
                            </td>

                            {/* Producto / Descripción */}
                            <td className="py-2 px-3 align-top">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  handleUpdateCartItem(idx, { name: e.target.value })
                                }
                                className="w-full font-bold text-slate-900 text-xs bg-transparent border-b border-transparent focus:border-slate-300 outline-hidden"
                              />
                              <input
                                type="text"
                                placeholder="Nota adicional o Serie/MAC opcional..."
                                value={item.description}
                                onChange={(e) =>
                                  handleUpdateCartItem(idx, { description: e.target.value })
                                }
                                className="w-full text-[10px] text-slate-500 bg-transparent border-b border-transparent focus:border-slate-200 outline-hidden mt-0.5"
                              />
                            </td>

                            {/* Precio Unitario */}
                            <td className="py-2 px-3 text-right align-top">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  handleUpdateCartItem(idx, {
                                    unitPrice: Math.max(0, parseFloat(e.target.value) || 0),
                                  })
                                }
                                className="w-24 text-right font-mono font-semibold text-xs py-1 px-1.5 rounded-[4px] border border-slate-300 bg-white"
                              />
                            </td>

                            {/* Botón de Descuento de Línea */}
                            <td className="py-2 px-2 text-center align-top">
                              <button
                                type="button"
                                onClick={() => openItemDiscountModal(idx)}
                                className={`px-2 py-1 rounded-[4px] font-mono text-[10px] font-bold border transition cursor-pointer ${
                                  hasLineDisc
                                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                }`}
                                title="Configurar descuento de esta línea"
                              >
                                {item.discountType === "no_iva"
                                  ? "-IVA"
                                  : item.discountInput > 0
                                  ? item.discountType === "percentage"
                                    ? `-${item.discountInput}%`
                                    : `-$${item.discountInput}`
                                  : "0%"}
                              </button>
                            </td>

                            {/* Selector IVA */}
                            <td className="py-2 px-2 text-center align-top">
                              <select
                                value={item.ivaRate}
                                onChange={(e) =>
                                  handleUpdateCartItem(idx, {
                                    ivaRate: Number(e.target.value),
                                  })
                                }
                                className="text-[11px] font-mono font-bold py-1 px-1.5 rounded-[4px] border border-slate-300 bg-white text-slate-700"
                              >
                                <option value={15}>15%</option>
                                <option value={5}>5%</option>
                                <option value={0}>0%</option>
                              </select>
                            </td>

                            {/* Subtotal Línea */}
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 align-top pt-3">
                              ${(calcItem ? calcItem.subtotal : 0).toFixed(2)}
                            </td>

                            {/* Eliminar */}
                            <td className="py-2 px-2 text-center align-top pt-2.5">
                              <button
                                type="button"
                                onClick={() => handleRemoveCartItem(idx)}
                                className="p-1 rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Acordeón: Datos Adicionales del Comprobante (Opcional) */}
            <div className="border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
                className="flex items-center justify-between w-full text-left py-1.5 px-2 rounded-[4px] hover:bg-slate-50 text-xs font-bold text-slate-600 transition cursor-pointer"
              >
                <span>Datos Adicionales del Comprobante (Opcional)</span>
                {showAdditionalInfo ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showAdditionalInfo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 pb-1 px-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Nro. Pedido / Ref. Externa
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. OC-2026-0089"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      className="w-full text-xs py-1.5 px-2.5 rounded-[6px] border border-slate-300 bg-white outline-hidden focus:border-[#004ac6]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Notas / Observaciones en RIDE
                    </label>
                    <input
                      type="text"
                      placeholder="Garantía, condiciones de entrega..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full text-xs py-1.5 px-2.5 rounded-[6px] border border-slate-300 bg-white outline-hidden focus:border-[#004ac6]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =======================================================
            COLUMNA DERECHA (4 COLUMNAS): RESUMEN, MULTIPAGO Y EMISIÓN
           ======================================================= */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-4">
            {/* Cabecera RESUMEN con Badge Dinámico */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Resumen
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold text-slate-500">
                  {nextSequentialPreview}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase ${
                    documentType === "nota_venta"
                      ? "bg-slate-900 text-emerald-300"
                      : "bg-blue-50 text-[#004ac6] border border-blue-200"
                  }`}
                >
                  {documentType === "nota_venta" ? "Nota de Venta" : "Factura SRI"}
                </span>
              </div>
            </div>

            {/* Desglose de Subtotales e Impuestos */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal 15%</span>
                <span className="font-mono font-semibold text-slate-900">
                  ${calculatedTotals.subtotal15.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal 0%</span>
                <span className="font-mono font-semibold text-slate-900">
                  ${calculatedTotals.subtotal0.toFixed(2)}
                </span>
              </div>
              {calculatedTotals.discountTotal > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>Descuento Total</span>
                  <span className="font-mono">-${calculatedTotals.discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>IVA (15%)</span>
                <span className="font-mono font-semibold text-slate-900">
                  ${calculatedTotals.ivaTotal.toFixed(2)}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
                <span className="text-xs font-black uppercase text-slate-900">
                  Total a Pagar
                </span>
                <span className="text-2xl font-mono font-black text-[#004ac6]">
                  ${calculatedTotals.total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Alerta en vivo si es Factura > $50 con Consumidor Final */}
            {documentType === "factura" &&
              isConsumidorFinal &&
              calculatedTotals.total > 50 && (
                <div className="p-2.5 rounded-[6px] bg-amber-50 border border-amber-300 text-amber-900 text-[11px] space-y-1.5">
                  <div className="flex items-start gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Factura SRI a Consumidor Final supera $50.00</span>
                  </div>
                  <p className="text-[10px] text-amber-800">
                    Asigna un cliente con RUC/Cédula o cambia el documento a Nota de Venta.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDocumentType("nota_venta")}
                    className="w-full py-1 rounded-[4px] bg-amber-900 text-white font-bold text-[10px] hover:bg-amber-950 transition cursor-pointer"
                  >
                    Cambiar a Nota de Venta (Recibo)
                  </button>
                </div>
              )}

            {/* FORMA DE PAGO (MULTIPAGO COMBINABLE) */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Forma de Pago
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  ${paymentSummary.totalEntered.toFixed(2)} / ${calculatedTotals.total.toFixed(2)}
                </span>
              </div>

              {/* 4 Botones Combinables */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => togglePaymentMethod("efectivo")}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-[6px] border text-[10px] font-bold transition cursor-pointer ${
                    activeMethods.efectivo
                      ? "bg-[#004ac6] text-white border-[#004ac6] shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Banknote className="w-4 h-4 mb-0.5" />
                  <span>Efectivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => togglePaymentMethod("transferencia")}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-[6px] border text-[10px] font-bold transition cursor-pointer ${
                    activeMethods.transferencia
                      ? "bg-[#004ac6] text-white border-[#004ac6] shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Landmark className="w-4 h-4 mb-0.5" />
                  <span>Transf.</span>
                </button>

                <button
                  type="button"
                  onClick={() => togglePaymentMethod("tarjeta")}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-[6px] border text-[10px] font-bold transition cursor-pointer ${
                    activeMethods.tarjeta
                      ? "bg-[#004ac6] text-white border-[#004ac6] shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <CreditCard className="w-4 h-4 mb-0.5" />
                  <span>Tarjeta</span>
                </button>

                <button
                  type="button"
                  onClick={() => togglePaymentMethod("credito")}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-[6px] border text-[10px] font-bold transition cursor-pointer ${
                    activeMethods.credito
                      ? "bg-[#004ac6] text-white border-[#004ac6] shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Clock className="w-4 h-4 mb-0.5" />
                  <span>Crédito</span>
                </button>
              </div>

              {/* Bloques de Entrada por cada Método Activo */}
              <div className="space-y-2">
                {activeMethods.efectivo && (
                  <div className="p-2.5 rounded-[6px] bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">
                        Efectivo Recibido ($)
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentValues((prev) => ({
                            ...prev,
                            efectivo: calculatedTotals.total.toFixed(2),
                          }))
                        }
                        className="text-[10px] font-bold text-[#004ac6] hover:underline cursor-pointer"
                      >
                        Monto Exacto
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={paymentValues.efectivo}
                      onChange={(e) =>
                        setPaymentValues((prev) => ({ ...prev, efectivo: e.target.value }))
                      }
                      className="w-full text-sm font-mono font-bold py-1.5 px-2.5 rounded-[4px] border border-slate-300 bg-white text-slate-900 outline-hidden focus:border-[#004ac6]"
                    />
                  </div>
                )}

                {activeMethods.transferencia && (
                  <div className="p-2.5 rounded-[6px] bg-slate-50 border border-slate-200 space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Monto Transferencia ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={paymentValues.transferencia}
                        onChange={(e) =>
                          setPaymentValues((prev) => ({
                            ...prev,
                            transferencia: e.target.value,
                          }))
                        }
                        className="w-full text-xs font-mono font-bold py-1.5 px-2.5 rounded-[4px] border border-slate-300 bg-white"
                      />
                    </div>
                    {bankAccounts.length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Cuenta Bancaria Destino
                        </label>
                        <select
                          value={selectedBankAccountId}
                          onChange={(e) => setSelectedBankAccountId(e.target.value)}
                          className="w-full text-[11px] font-semibold py-1.5 px-2 rounded-[4px] border border-slate-300 bg-white"
                        >
                          {bankAccounts.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.bankName} - {b.accountNumber}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <input
                        type="text"
                        placeholder="Nro. Comprobante / Ref. transferencia..."
                        value={transferenciaRef}
                        onChange={(e) => setTransferenciaRef(e.target.value)}
                        className="w-full text-[11px] py-1.5 px-2 rounded-[4px] border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                )}

                {activeMethods.tarjeta && (
                  <div className="p-2.5 rounded-[6px] bg-slate-50 border border-slate-200 space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Monto Tarjeta ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={paymentValues.tarjeta}
                        onChange={(e) =>
                          setPaymentValues((prev) => ({ ...prev, tarjeta: e.target.value }))
                        }
                        className="w-full text-xs font-mono font-bold py-1.5 px-2.5 rounded-[4px] border border-slate-300 bg-white"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Nro. Lote / Voucher POS..."
                      value={tarjetaRef}
                      onChange={(e) => setTarjetaRef(e.target.value)}
                      className="w-full text-[11px] py-1.5 px-2 rounded-[4px] border border-slate-300 bg-white"
                    />
                  </div>
                )}

                {activeMethods.credito && (
                  <div className="p-2.5 rounded-[6px] bg-amber-50/70 border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-amber-900 uppercase">
                        Monto a Crédito ($)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowCreditModal(true)}
                        className="text-[10px] font-bold text-[#004ac6] underline cursor-pointer"
                      >
                        Plazo: {paymentTermDays} días ({creditDueDate})
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={paymentValues.credito}
                      onChange={(e) =>
                        setPaymentValues((prev) => ({ ...prev, credito: e.target.value }))
                      }
                      className="w-full text-xs font-mono font-bold py-1.5 px-2.5 rounded-[4px] border border-amber-300 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Recuadro de Cambio / Vuelto y Estado Cubierto */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-[6px] bg-slate-50 border border-slate-200">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase block">
                    Cambio / Vuelto
                  </span>
                  <span className="text-sm font-mono font-black text-slate-900">
                    ${paymentSummary.change.toFixed(2)}
                  </span>
                </div>
                <div
                  className={`p-2.5 rounded-[6px] border ${
                    paymentSummary.isCovered
                      ? "bg-emerald-50/60 border-emerald-200 text-emerald-700"
                      : "bg-rose-50/60 border-rose-200 text-rose-700"
                  }`}
                >
                  <span className="text-[9.5px] font-bold uppercase block opacity-75">
                    Cubierto
                  </span>
                  <span className="text-xs font-bold block">
                    {calculatedTotals.total === 0
                      ? "Sin ítems"
                      : paymentSummary.isCovered
                      ? paymentSummary.change > 0
                        ? "✓ Con vuelto"
                        : "✓ Exacto"
                      : `Falta $${paymentSummary.missing.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Consola SRI en vivo (cuando está procesando o hay logs) */}
            {(isProcessing || sriLogs.length > 0) && documentType === "factura" && (
              <div className="rounded-[6px] bg-slate-950 text-slate-100 p-3 font-mono text-[10px] space-y-1 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1 mb-1">
                  <span className="flex items-center gap-1 font-bold text-sky-400">
                    <Terminal className="w-3 h-3" /> Consola SRI (Ecuador)
                  </span>
                  <span>XAdES-BES</span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {sriLogs.map((log, index) => (
                    <div key={index} className="text-emerald-300 leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BOTONES PRINCIPALES DE ACCIÓN: DIFERENCIACIÓN FACTURA SRI vs NOTA DE VENTA */}
            <div className="space-y-2 pt-1">
              {documentType === "nota_venta" ? (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleRequestAction("emit")}
                  className="w-full py-3 px-4 rounded-[6px] bg-[#1b1b1b] hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#c0ffa5]" />
                  <span>
                    {isProcessing ? "Registrando Nota de Venta..." : "Registrar Nota de Venta"}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleRequestAction("emit")}
                  className="w-full py-3 px-4 rounded-[6px] bg-[#004ac6] hover:bg-[#003ca3] disabled:opacity-50 text-white font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>
                    {isProcessing
                      ? "Firmando y Autorizando en SRI..."
                      : "Emitir Factura Electrónica (SRI)"}
                  </span>
                </button>
              )}

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleRequestAction("draft")}
                className="w-full py-2 px-3 rounded-[6px] border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-slate-500" />
                <span>Guardar Borrador</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =======================================================
          MODAL 1: DIÁLOGO DE VALIDACIÓN (SaleValidationDialog)
         ======================================================= */}
      {validationDialog && validationDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[6px] bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-slate-900">{validationDialog.title}</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{validationDialog.message}</p>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setValidationDialog(null)}
                  className="px-3 py-1.5 rounded-[6px] text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = validationDialog.targetSection;
                    setValidationDialog(null);
                    if (target === "client") {
                      clientSearchInputRef.current?.focus();
                      setShowClientDropdown(true);
                    } else if (target === "products") {
                      productSearchInputRef.current?.focus();
                    } else if (target === "switch_nota_venta") {
                      setDocumentType("nota_venta");
                    }
                  }}
                  className="px-4 py-1.5 rounded-[6px] bg-[#004ac6] hover:bg-[#003ca3] text-white text-xs font-bold cursor-pointer"
                >
                  {validationDialog.actionLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL 2: DIÁLOGO DE CONFIRMACIÓN DE EMISIÓN / BORRADOR
         ======================================================= */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-[6px] flex items-center justify-center shrink-0 ${
                    documentType === "nota_venta"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-blue-100 text-[#004ac6]"
                  }`}
                >
                  {documentType === "nota_venta" ? (
                    <Receipt className="w-5 h-5" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">{confirmDialog.title}</h3>
                  <span className="text-[11px] font-mono font-bold text-slate-500">
                    Total: ${calculatedTotals.total.toFixed(2)} USD
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 rounded-[6px] text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeConfirmedAction}
                  className={`px-4 py-2 rounded-[6px] text-white text-xs font-bold cursor-pointer ${
                    documentType === "nota_venta"
                      ? "bg-slate-900 hover:bg-slate-800"
                      : "bg-[#004ac6] hover:bg-[#003ca3]"
                  }`}
                >
                  {confirmDialog.mode === "draft"
                    ? "Sí, Guardar Borrador"
                    : documentType === "nota_venta"
                    ? "Sí, Registrar Nota de Venta"
                    : "Sí, Emitir Factura SRI"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL 3: DESCUENTO / PROMO POR ÍTEM
         ======================================================= */}
      {editingDiscountIndex !== null && cartItems[editingDiscountIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Descuento de Ítem
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingDiscountIndex(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs font-bold text-slate-800 truncate">
                {cartItems[editingDiscountIndex].name}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setItemModalDiscType("percentage")}
                  className={`py-2 px-2 rounded-[6px] text-xs font-bold border transition cursor-pointer ${
                    itemModalDiscType === "percentage"
                      ? "bg-[#004ac6] text-white border-[#004ac6]"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  % Porc.
                </button>
                <button
                  type="button"
                  onClick={() => setItemModalDiscType("amount")}
                  className={`py-2 px-2 rounded-[6px] text-xs font-bold border transition cursor-pointer ${
                    itemModalDiscType === "amount"
                      ? "bg-[#004ac6] text-white border-[#004ac6]"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  $ Monto
                </button>
                <button
                  type="button"
                  onClick={() => setItemModalDiscType("no_iva")}
                  className={`py-2 px-2 rounded-[6px] text-xs font-bold border transition cursor-pointer ${
                    itemModalDiscType === "no_iva"
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  Quitar IVA
                </button>
              </div>

              {itemModalDiscType !== "no_iva" ? (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {itemModalDiscType === "percentage"
                      ? "Porcentaje de Descuento (%)"
                      : "Monto de Descuento ($)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemModalDiscValue}
                    onChange={(e) => setItemModalDiscValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-sm font-mono font-bold py-2 px-3 rounded-[6px] border border-slate-300"
                  />
                </div>
              ) : (
                <div className="p-2.5 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                  Se descontará proporcionalmente el IVA ({cartItems[editingDiscountIndex].ivaRate}%) para que el cliente pague exactamente el precio base.
                </div>
              )}

              <div className="flex justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateCartItem(editingDiscountIndex, {
                      discountType: "percentage",
                      discountInput: 0,
                    });
                    setEditingDiscountIndex(null);
                  }}
                  className="px-3 py-1.5 rounded-[6px] text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  Quitar Dto.
                </button>
                <button
                  type="button"
                  onClick={applyItemDiscountModal}
                  className="px-4 py-1.5 rounded-[6px] bg-[#004ac6] hover:bg-[#003ca3] text-white text-xs font-bold cursor-pointer"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL 4: SEGUIMIENTO DE CUENTA POR COBRAR (CRÉDITO)
         ======================================================= */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Seguimiento de Cuenta por Cobrar
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreditModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-[6px] bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Deuda Actual Cliente
                  </span>
                  <span className="text-sm font-mono font-bold text-slate-900">
                    ${(selectedClient?.currentBalance || 0).toFixed(2)}
                  </span>
                </div>
                <div className="p-2.5 rounded-[6px] bg-amber-50 border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-700 uppercase block">
                    Crédito Venta Actual
                  </span>
                  <span className="text-sm font-mono font-black text-amber-900">
                    ${paymentSummary.credito.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Plazo de Crédito (Días)
                  </label>
                  <select
                    value={paymentTermDays}
                    onChange={(e) => {
                      const days = Number(e.target.value);
                      setPaymentTermDays(days);
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      setCreditDueDate(d.toISOString().slice(0, 10));
                    }}
                    className="w-full text-xs font-bold py-2 px-2.5 rounded-[6px] border border-slate-300 bg-white"
                  >
                    <option value={15}>15 Días</option>
                    <option value={30}>30 Días</option>
                    <option value={45}>45 Días</option>
                    <option value={60}>60 Días</option>
                    <option value={90}>90 Días</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Fecha de Vencimiento
                  </label>
                  <input
                    type="date"
                    value={creditDueDate}
                    onChange={(e) => setCreditDueDate(e.target.value)}
                    className="w-full text-xs font-semibold py-2 px-2.5 rounded-[6px] border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Observaciones de Cobranza
                </label>
                <input
                  type="text"
                  placeholder="Acuerdo de pago, contacto de tesorería..."
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-[6px] border border-slate-300"
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className="px-4 py-2 rounded-[6px] bg-[#004ac6] hover:bg-[#003ca3] text-white text-xs font-bold cursor-pointer"
                >
                  Confirmar Plazo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL 5: CREACIÓN RÁPIDA DE CLIENTE CON CONSULTA SRI
         ======================================================= */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Nuevo Cliente (Rápido)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewClientModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveQuickClient} className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  RUC / Cédula *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newClientRuc}
                    onChange={(e) => setNewClientRuc(e.target.value)}
                    placeholder="Ej. 1790016919001"
                    className="flex-1 text-xs font-mono py-2 px-3 rounded-[6px] border border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={handleLookupClientSri}
                    disabled={isLookingUpSri}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[6px] bg-[#004ac6] hover:bg-[#003ca3] text-white text-xs font-bold transition cursor-pointer shrink-0"
                  >
                    {isLookingUpSri ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Consultar SRI</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Razón Social / Nombres Completos *
                </label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="NOMBRE O EMPRESA S.A."
                  className="w-full text-xs py-2 px-3 rounded-[6px] border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Correo para RIDE
                  </label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="cliente@correo.com"
                    className="w-full text-xs py-2 px-3 rounded-[6px] border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Teléfono / Celular
                  </label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="0999999999"
                    className="w-full text-xs py-2 px-3 rounded-[6px] border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Dirección Fiscal
                </label>
                <input
                  type="text"
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-[6px] border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(false)}
                  className="px-4 py-2 rounded-[6px] text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[6px] bg-[#004ac6] hover:bg-[#003ca3] text-white text-xs font-bold cursor-pointer"
                >
                  Guardar y Seleccionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL 6: BÚSQUEDA AVANZADA DE PRODUCTOS (CATÁLOGO)
         ======================================================= */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Catálogo de Productos y Servicios
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar por nombre o SKU..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 rounded-[6px] border border-slate-300"
                  />
                </div>
                <select
                  value={catalogCategory}
                  onChange={(e) => setCatalogCategory(e.target.value)}
                  className="text-xs font-semibold py-2 px-3 rounded-[6px] border border-slate-300 bg-white"
                >
                  <option value="all">Todas las Categorías</option>
                  {inventoryCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="max-h-80 overflow-y-auto rounded-[6px] border border-slate-200 divide-y divide-slate-100">
                {catalogFilteredProducts.map((prod) => {
                  const inCartItem = cartItems.find((i) => i.productId === prod.id);
                  const whStock = prod.tracksStock
                    ? Number(prod.stockByWarehouse?.[warehouseId] ?? prod.stock ?? 0)
                    : null;

                  return (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{prod.name}</span>
                          {inCartItem && (
                            <span className="px-2 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              En Carrito ({inCartItem.quantity})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          SKU: {prod.sku} | IVA: {prod.ivaRate}%{" "}
                          {whStock !== null && `| Stock Bodega: ${whStock}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          ${prod.salePrice.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddProductToCart(prod)}
                          className="px-3 py-1.5 rounded-[6px] bg-[#004ac6] hover:bg-[#003ca3] text-white text-xs font-bold cursor-pointer"
                        >
                          + Añadir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  className="px-4 py-2 rounded-[6px] bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL 7: CREAR PRODUCTO / SERVICIO RÁPIDO
         ======================================================= */}
      {showQuickProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-[6px] shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Crear Producto / Servicio Rápido
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickProductModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveQuickProduct} className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nombre del Producto o Servicio *
                </label>
                <input
                  type="text"
                  required
                  value={quickProdName}
                  onChange={(e) => setQuickProdName(e.target.value)}
                  placeholder="Ej. Router Mikrotik hAP ac3 / Instalación Fibra"
                  className="w-full text-xs py-2 px-3 rounded-[6px] border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Código SKU (Opcional)
                  </label>
                  <input
                    type="text"
                    value={quickProdSku}
                    onChange={(e) => setQuickProdSku(e.target.value)}
                    placeholder="Auto-generado"
                    className="w-full text-xs font-mono py-2 px-3 rounded-[6px] border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tarifa IVA
                  </label>
                  <select
                    value={quickProdIva}
                    onChange={(e) => setQuickProdIva(Number(e.target.value) as 0 | 5 | 15)}
                    className="w-full text-xs font-bold py-2 px-3 rounded-[6px] border border-slate-300 bg-white"
                  >
                    <option value={15}>IVA 15%</option>
                    <option value={5}>IVA 5%</option>
                    <option value={0}>IVA 0%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    P. Venta (Sin IVA) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={quickProdPrice}
                    onChange={(e) => setQuickProdPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono font-bold py-2 px-2.5 rounded-[6px] border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Costo Base ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quickProdCost}
                    onChange={(e) => setQuickProdCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs font-mono py-2 px-2.5 rounded-[6px] border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Stock Inicial
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={!quickProdTracksStock}
                    value={quickProdStock}
                    onChange={(e) => setQuickProdStock(e.target.value)}
                    className="w-full text-xs font-mono py-2 px-2.5 rounded-[6px] border border-slate-300 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={quickProdTracksStock}
                  onChange={(e) => setQuickProdTracksStock(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Controlar stock en Kardex (desmarcar si es un servicio)</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickProductModal(false)}
                  className="px-4 py-2 rounded-[6px] text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProduct}
                  className="px-4 py-2 rounded-[6px] bg-[#004ac6] hover:bg-[#003ca3] text-white text-xs font-bold cursor-pointer"
                >
                  {isCreatingProduct ? "Creando..." : "Crear y Añadir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
