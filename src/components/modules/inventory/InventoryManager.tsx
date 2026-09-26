"use client";

import React, { useState, useMemo } from "react";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import {
  InventoryProduct,
  Warehouse,
  ProductCategory,
  ProductBrand,
  KardexEntry,
  WarehouseTransfer,
  InventoryAdjustment,
} from "@/types";
import { ProductModal } from "./ProductModal";
import { WarehouseModal } from "./WarehouseModal";
import { TransferModal } from "./TransferModal";
import { AdjustmentModal } from "./AdjustmentModal";
import { CategoryBrandModal } from "./CategoryBrandModal";
import {
  Boxes,
  Package,
  Wrench,
  Building2,
  BookOpen,
  ArrowRightLeft,
  SlidersHorizontal,
  Tags,
  Plus,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
} from "lucide-react";

type InventoryTab =
  | "productos"
  | "servicios"
  | "bodegas"
  | "kardex"
  | "transferencias"
  | "ajustes"
  | "clasificacion";

export function InventoryManager() {
  const {
    inventoryProducts,
    inventoryWarehouses,
    inventoryCategories,
    inventoryBrands,
    inventoryKardex,
    inventoryTransfers,
    inventoryAdjustments,
    deleteInventoryProduct,
    deleteWarehouse,
    deleteRecord,
  } = useApp();
  const { showConfirm, showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState<InventoryTab>("productos");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<"all" | "low" | "out" | "normal">("all");
  const [kardexProductFilter, setKardexProductFilter] = useState("all");

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<InventoryProduct | null>(null);
  const [productModalDefaultType, setProductModalDefaultType] = useState<"producto" | "servicio">("producto");

  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [warehouseToEdit, setWarehouseToEdit] = useState<Warehouse | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferDefaultProduct, setTransferDefaultProduct] = useState<string | undefined>(undefined);
  const [transferDefaultWarehouse, setTransferDefaultWarehouse] = useState<string | undefined>(undefined);

  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentDefaultProduct, setAdjustmentDefaultProduct] = useState<string | undefined>(undefined);
  const [adjustmentDefaultWarehouse, setAdjustmentDefaultWarehouse] = useState<string | undefined>(undefined);

  const [isCatBrandOpen, setIsCatBrandOpen] = useState(false);
  const [catBrandMode, setCatBrandMode] = useState<"categoria" | "marca">("categoria");

  // ==========================================
  // KPIs Calculations
  // ==========================================
  const kpis = useMemo(() => {
    const physicalProducts = inventoryProducts.filter((p) => p.tracksStock && p.status === "activo");
    const services = inventoryProducts.filter((p) => p.type === "servicio" && p.status === "activo");

    const totalInventoryValue = physicalProducts.reduce(
      (sum, p) => sum + p.stock * p.baseCost,
      0
    );

    const lowStockCount = physicalProducts.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
    const outOfStockCount = physicalProducts.filter((p) => p.stock === 0).length;
    const activeWarehouses = inventoryWarehouses.filter((w) => w.status === "activo").length;

    return {
      totalInventoryValue,
      physicalProductsCount: physicalProducts.length,
      servicesCount: services.length,
      lowStockCount,
      outOfStockCount,
      activeWarehouses,
    };
  }, [inventoryProducts, inventoryWarehouses]);

  // ==========================================
  // Filtered Products
  // ==========================================
  const filteredProducts = useMemo(() => {
    return inventoryProducts.filter((p) => {
      if (p.type !== "producto") return false;

      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchTerm)) ||
        (p.model && p.model.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory =
        selectedCategoryFilter === "all" || p.categoryId === selectedCategoryFilter;

      let matchesStock = true;
      if (stockStatusFilter === "low") matchesStock = p.stock > 0 && p.stock <= p.minStock;
      else if (stockStatusFilter === "out") matchesStock = p.stock === 0;
      else if (stockStatusFilter === "normal") matchesStock = p.stock > p.minStock;

      let matchesWarehouse = true;
      if (selectedWarehouseFilter !== "all") {
        const whStock = p.stockByWarehouse?.[selectedWarehouseFilter] ?? 0;
        matchesWarehouse = whStock > 0;
      }

      return matchesSearch && matchesCategory && matchesStock && matchesWarehouse;
    });
  }, [inventoryProducts, searchTerm, selectedCategoryFilter, stockStatusFilter, selectedWarehouseFilter]);

  // ==========================================
  // Filtered Services
  // ==========================================
  const filteredServices = useMemo(() => {
    return inventoryProducts.filter((p) => {
      if (p.type !== "servicio") return false;

      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory =
        selectedCategoryFilter === "all" || p.categoryId === selectedCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [inventoryProducts, searchTerm, selectedCategoryFilter]);

  // ==========================================
  // Filtered Kardex
  // ==========================================
  const filteredKardex = useMemo(() => {
    return inventoryKardex.filter((k) => {
      const matchesSearch =
        k.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (k.referenceDocNumber && k.referenceDocNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesProduct =
        kardexProductFilter === "all" || k.productId === kardexProductFilter;

      const matchesWarehouse =
        selectedWarehouseFilter === "all" || k.warehouseId === selectedWarehouseFilter;

      return matchesSearch && matchesProduct && matchesWarehouse;
    });
  }, [inventoryKardex, searchTerm, kardexProductFilter, selectedWarehouseFilter]);

  // Quick Action Handlers
  const handleOpenKardexForProduct = (prodId: string) => {
    setKardexProductFilter(prodId);
    setActiveTab("kardex");
  };

  const handleOpenTransferForProduct = (prodId: string) => {
    setTransferDefaultProduct(prodId);
    setIsTransferModalOpen(true);
  };

  const handleOpenAdjustmentForProduct = (prodId: string) => {
    setAdjustmentDefaultProduct(prodId);
    setIsAdjustmentModalOpen(true);
  };

  const handleDeleteProduct = (p: InventoryProduct) => {
    showConfirm(
      "¿Eliminar Ítem del Catálogo?",
      `¿Estás seguro de eliminar "${p.name}"? Los movimientos de Kardex históricos se preservarán para auditoría.`,
      async () => {
        try {
          await deleteInventoryProduct(p.id);
          showSuccess("Eliminado", `El producto "${p.name}" ha sido retirado.`);
        } catch (err: any) {
          showError("Error al Eliminar", err?.message);
        }
      },
      "Eliminar Producto"
    );
  };

  const handleDeleteWarehouse = (w: Warehouse) => {
    if (w.isDefault) {
      showError("Acción Denegada", "No es posible eliminar la bodega principal predeterminada.");
      return;
    }
    showConfirm(
      "¿Eliminar Bodega?",
      `¿Deseas eliminar la bodega "${w.name}" (${w.code})?`,
      async () => {
        try {
          await deleteWarehouse(w.id);
          showSuccess("Bodega Eliminada", `La bodega "${w.name}" ha sido retirada.`);
        } catch (err: any) {
          showError("Error", err?.message);
        }
      },
      "Eliminar Bodega"
    );
  };

  // Export to CSV helper
  const handleExportCsv = () => {
    try {
      const headers = ["SKU", "Nombre", "Tipo", "Categoría", "Stock", "Unidad", "Costo Base", "Precio Sin IVA", "Precio Con IVA"];
      const rows = inventoryProducts.map((p) => [
        `"${p.sku}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.type}"`,
        `"${p.categoryName || ""}"`,
        p.stock,
        `"${p.unit}"`,
        p.baseCost.toFixed(2),
        p.salePrice.toFixed(2),
        p.salePriceConIva.toFixed(2),
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `inventario_inntel_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccess("Reporte Exportado", "Se descargó el catálogo de inventario en formato CSV.");
    } catch (e: any) {
      showError("Error de Exportación", e?.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>ERP INNTEL</span>
            <span>/</span>
            <span className="font-semibold text-slate-800">Control de Inventarios</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#004ac6]" />
            Inventarios, Bodegas & Kardex Valorado
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestión de equipos de fibra óptica, terminales ONT, insumos de red y costeo promedio ponderado
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Exportar CSV
          </button>

          <button
            onClick={() => {
              setTransferDefaultProduct(undefined);
              setIsTransferModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100 text-[#004ac6] text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Trasladar Stock
          </button>

          <button
            onClick={() => {
              setProductToEdit(null);
              setProductModalDefaultType("producto");
              setIsProductModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Valor Inventario</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-slate-900">
            ${kpis.totalInventoryValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 font-bold">Costo Ponderado</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Productos Físicos</span>
            <Package className="w-4 h-4 text-[#004ac6]" />
          </div>
          <div className="text-lg font-black text-slate-900">{kpis.physicalProductsCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">Equipos & Materiales</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Servicios Catálogo</span>
            <Wrench className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-lg font-black text-slate-900">{kpis.servicesCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">Mano de obra & Enlaces</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Stock Crítico</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-black text-amber-600">{kpis.lowStockCount}</div>
          <div className="text-[10px] text-amber-700/80 mt-1 font-semibold">Requiere reabastecer</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Agotados</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg font-black text-rose-600">{kpis.outOfStockCount}</div>
          <div className="text-[10px] text-rose-700/80 mt-1 font-semibold">Sin existencias</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bodegas</span>
            <Building2 className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-lg font-black text-slate-900">{kpis.activeWarehouses}</div>
          <div className="text-[10px] text-slate-500 mt-1">Almacenes activos</div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("productos")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "productos"
              ? "bg-[#eff4ff] text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Package className="w-4 h-4" />
          Productos Físicos
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white border border-slate-200 font-extrabold text-slate-700">
            {inventoryProducts.filter((p) => p.tracksStock).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("servicios")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "servicios"
              ? "bg-[#eff4ff] text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Wrench className="w-4 h-4" />
          Servicios Técnicos
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white border border-slate-200 font-extrabold text-slate-700">
            {inventoryProducts.filter((p) => p.type === "servicio").length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("bodegas")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "bodegas"
              ? "bg-[#eff4ff] text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Bodegas & Nodos
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white border border-slate-200 font-extrabold text-slate-700">
            {inventoryWarehouses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("kardex")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "kardex"
              ? "bg-[#eff4ff] text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Kardex Valorado
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white border border-slate-200 font-extrabold text-slate-700">
            {inventoryKardex.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("transferencias")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "transferencias"
              ? "bg-[#eff4ff] text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          Transferencias
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white border border-slate-200 font-extrabold text-slate-700">
            {inventoryTransfers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("ajustes")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "ajustes"
              ? "bg-[#eff4ff] text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Ajustes de Stock
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white border border-slate-200 font-extrabold text-slate-700">
            {inventoryAdjustments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("clasificacion")}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "clasificacion"
              ? "bg-[#eff4ff] text-[#004ac6] shadow-2xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Tags className="w-4 h-4" />
          Categorías & Marcas
        </button>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por SKU, nombre, código barras o modelo..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto">
          {/* Bodega Filter */}
          {(activeTab === "productos" || activeTab === "kardex") && (
            <select
              value={selectedWarehouseFilter}
              onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20"
            >
              <option value="all">Todas las Bodegas</option>
              {inventoryWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          )}

          {/* Categoría Filter */}
          {(activeTab === "productos" || activeTab === "servicios") && (
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20"
            >
              <option value="all">Todas las Categorías</option>
              {inventoryCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Stock Filter */}
          {activeTab === "productos" && (
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20"
            >
              <option value="all">Todos los Estados</option>
              <option value="normal">Stock Normal</option>
              <option value="low">Stock Bajo (Crítico)</option>
              <option value="out">Sin Existencias (Agotado)</option>
            </select>
          )}

          {/* Kardex Product Filter */}
          {activeTab === "kardex" && (
            <select
              value={kardexProductFilter}
              onChange={(e) => setKardexProductFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 max-w-xs truncate"
            >
              <option value="all">Todos los Productos</option>
              {inventoryProducts
                .filter((p) => p.tracksStock)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name}
                  </option>
                ))}
            </select>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* TAB 1: PRODUCTOS FÍSICOS                    */}
      {/* ========================================== */}
      {activeTab === "productos" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">SKU / Código</th>
                  <th className="py-3 px-4">Descripción del Equipo</th>
                  <th className="py-3 px-4">Categoría / Marca</th>
                  <th className="py-3 px-4 text-center">Stock Global</th>
                  <th className="py-3 px-4 text-right">Costo Promedio</th>
                  <th className="py-3 px-4 text-right">P. Venta (Sin IVA)</th>
                  <th className="py-3 px-4 text-right">P. Venta (Con IVA)</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No se encontraron productos físicos</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Ajusta los filtros o haz clic en "Nuevo Producto" para registrar ítems.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isLowStock = p.stock > 0 && p.stock <= p.minStock;
                    const isOutStock = p.stock === 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">
                          {p.sku}
                          {p.barcode && (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              EAN: {p.barcode}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 line-clamp-1">{p.name}</div>
                          <div className="text-[11px] text-slate-400 line-clamp-1">
                            {p.model ? `Modelo: ${p.model} | ` : ""}
                            {p.fiberLengthMeters ? `Metraje: ${p.fiberLengthMeters}m | ` : ""}
                            {p.description || "Sin descripción adicional"}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold mb-0.5">
                            {p.categoryName || "General"}
                          </span>
                          {p.brandName && (
                            <span className="block text-[10px] text-slate-500 font-medium">
                              {p.brandName}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                              isOutStock
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : isLowStock
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            <span>{p.stock}</span>
                            <span className="text-[10px] font-normal">{p.unit}s</span>
                          </div>
                          {isLowStock && (
                            <span className="block text-[10px] text-amber-600 font-bold mt-0.5">
                              Mín: {p.minStock}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">
                          ${p.baseCost.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">
                          ${p.salePrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          ${p.salePriceConIva.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === "activo"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {p.status === "activo" ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenKardexForProduct(p.id)}
                              title="Consultar Kardex Valorado"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#004ac6] hover:bg-slate-100 transition-colors"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenTransferForProduct(p.id)}
                              title="Transferir a Otra Bodega"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-slate-100 transition-colors"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenAdjustmentForProduct(p.id)}
                              title="Ajuste Rápido de Stock"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 transition-colors"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setProductToEdit(p);
                                setIsProductModalOpen(true);
                              }}
                              title="Editar Producto"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              title="Eliminar Producto"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: SERVICIOS TÉCNICOS                  */}
      {/* ========================================== */}
      {activeTab === "servicios" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-xs">Catálogo de Servicios Técnicos & Mano de Obra</h3>
              <p className="text-[11px] text-slate-500">
                Ítems intangibles para facturación y cotizaciones sin afectación de inventario físico
              </p>
            </div>
            <button
              onClick={() => {
                setProductToEdit(null);
                setProductModalDefaultType("servicio");
                setIsProductModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Servicio
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Código / SKU</th>
                  <th className="py-3 px-4">Servicio Técnico</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Unidad</th>
                  <th className="py-3 px-4 text-right">Costo Base ($)</th>
                  <th className="py-3 px-4 text-right">P. Venta Sin IVA ($)</th>
                  <th className="py-3 px-4 text-right">P. Venta Con IVA ($)</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Wrench className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No se encontraron servicios</p>
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">{s.sku}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{s.name}</div>
                        <div className="text-[11px] text-slate-400">{s.description}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {s.categoryName || "Servicios"}
                        </span>
                      </td>
                      <td className="py-3 px-4 capitalize font-medium text-slate-600">{s.unit}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">${s.baseCost.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800">${s.salePrice.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">${s.salePriceConIva.toFixed(2)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {s.status === "activo" ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setProductToEdit(s);
                              setIsProductModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(s)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: BODEGAS & ALMACENES                 */}
      {/* ========================================== */}
      {activeTab === "bodegas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Almacenes, Bodegas & Unidades Móviles</h3>
              <p className="text-xs text-slate-500">
                Puntos de acopio físico para distribución a técnicos y clientes finales
              </p>
            </div>
            <button
              onClick={() => {
                setWarehouseToEdit(null);
                setIsWarehouseModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              Nueva Bodega
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {inventoryWarehouses.map((w) => {
              // Calcular total de items y valor en esta bodega
              let totalUnitsInWh = 0;
              let totalValueInWh = 0;

              inventoryProducts.forEach((p) => {
                if (p.tracksStock) {
                  const qty = Number(p.stockByWarehouse?.[w.id] || 0);
                  totalUnitsInWh += qty;
                  totalValueInWh += qty * p.baseCost;
                }
              });

              return (
                <div
                  key={w.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4 relative overflow-hidden"
                >
                  {w.isDefault && (
                    <div className="absolute top-0 right-0 bg-[#004ac6] text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-xl shadow-2xs">
                      Predeterminada
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="p-3 rounded-xl bg-[#eff4ff] text-[#004ac6]">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-mono font-bold text-slate-400 uppercase">{w.code}</div>
                      <h4 className="font-bold text-slate-800 text-sm">{w.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{w.city || "Ecuador"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Existencias</span>
                      <span className="text-sm font-black text-slate-800">{totalUnitsInWh.toLocaleString()} u</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Valor Stock</span>
                      <span className="text-sm font-black text-emerald-700">
                        ${totalValueInWh.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    {w.responsibleName && (
                      <div className="text-[11px]">
                        <span className="text-slate-400">Custodio:</span> <strong>{w.responsibleName}</strong>
                      </div>
                    )}
                    {w.address && (
                      <div className="text-[11px] text-slate-500 truncate" title={w.address}>
                        {w.address}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        w.status === "activo"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {w.status === "activo" ? "Operativa" : "Bloqueada"}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedWarehouseFilter(w.id);
                          setActiveTab("productos");
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#004ac6] hover:bg-slate-100 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver Stock
                      </button>
                      <button
                        onClick={() => {
                          setWarehouseToEdit(w);
                          setIsWarehouseModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!w.isDefault && (
                        <button
                          onClick={() => handleDeleteWarehouse(w)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 4: KARDEX VALORADO                     */}
      {/* ========================================== */}
      {activeTab === "kardex" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#004ac6]" />
                Libro Mayor de Kardex Valorado (Costo Promedio Ponderado)
              </h3>
              <p className="text-[11px] text-slate-500">
                Auditoría legal y matemática de cada movimiento de entrada, salida y saldo valorado
              </p>
            </div>
            {kardexProductFilter !== "all" && (
              <button
                onClick={() => setKardexProductFilter("all")}
                className="text-xs font-semibold text-[#004ac6] hover:underline"
              >
                Limpiar filtro de producto
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Fecha & Hora</th>
                  <th className="py-2.5 px-3">Producto / Equipo</th>
                  <th className="py-2.5 px-3">Bodega</th>
                  <th className="py-2.5 px-3">Tipo / Movimiento</th>
                  <th className="py-2.5 px-3">Documento Ref.</th>
                  <th className="py-2.5 px-3 text-right bg-emerald-50/40 text-emerald-800">Entrada (Cant)</th>
                  <th className="py-2.5 px-3 text-right bg-emerald-50/40 text-emerald-800">Costo Unit ($)</th>
                  <th className="py-2.5 px-3 text-right bg-emerald-50/40 text-emerald-800">Total Entrada ($)</th>
                  <th className="py-2.5 px-3 text-right bg-rose-50/40 text-rose-800">Salida (Cant)</th>
                  <th className="py-2.5 px-3 text-right bg-rose-50/40 text-rose-800">Costo Unit ($)</th>
                  <th className="py-2.5 px-3 text-right bg-rose-50/40 text-rose-800">Total Salida ($)</th>
                  <th className="py-2.5 px-3 text-right bg-sky-50/40 text-sky-800">Saldo (Cant)</th>
                  <th className="py-2.5 px-3 text-right bg-sky-50/40 text-sky-800">Costo Prom ($)</th>
                  <th className="py-2.5 px-3 text-right bg-sky-50/40 text-sky-800">Saldo Total ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredKardex.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-slate-400">
                      <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No hay movimientos registrados</p>
                    </td>
                  </tr>
                ) : (
                  filteredKardex.map((k) => (
                    <tr key={k.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(k.date).toLocaleDateString("es-EC", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 max-w-xs truncate" title={k.productName}>
                        {k.productName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium whitespace-nowrap">{k.warehouseName}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            k.type.includes("PURCHASE") || k.type.includes("POSITIVE") || k.type === "TRANSFER_IN"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {k.type}
                        </span>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{k.concept}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {k.referenceDocNumber || k.referenceId}
                      </td>

                      {/* Entradas */}
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700 bg-emerald-50/20">
                        {k.entryQuantity ? `+${k.entryQuantity}` : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 bg-emerald-50/20">
                        {k.entryUnitCost ? `$${k.entryUnitCost.toFixed(2)}` : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-800 bg-emerald-50/20">
                        {k.entryTotalCost ? `$${k.entryTotalCost.toFixed(2)}` : "-"}
                      </td>

                      {/* Salidas */}
                      <td className="py-2.5 px-3 text-right font-bold text-rose-700 bg-rose-50/20">
                        {k.exitQuantity ? `-${k.exitQuantity}` : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-700 bg-rose-50/20">
                        {k.exitUnitCost ? `$${k.exitUnitCost.toFixed(2)}` : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-800 bg-rose-50/20">
                        {k.exitTotalCost ? `$${k.exitTotalCost.toFixed(2)}` : "-"}
                      </td>

                      {/* Saldos */}
                      <td className="py-2.5 px-3 text-right font-black text-slate-800 bg-sky-50/20">
                        {k.balanceQuantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-700 bg-sky-50/20">
                        ${k.balanceAverageCost.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-[#004ac6] bg-sky-50/20">
                        ${k.balanceTotalCost.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 5: TRANSFERENCIAS                      */}
      {/* ========================================== */}
      {activeTab === "transferencias" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-xs">Historial de Transferencias Inter-Bodegas</h3>
              <p className="text-[11px] text-slate-500">
                Registro de traslados físicos de insumos y equipos entre centros de distribución
              </p>
            </div>
            <button
              onClick={() => {
                setTransferDefaultProduct(undefined);
                setIsTransferModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Nueva Transferencia
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Número</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Bodega Origen</th>
                  <th className="py-3 px-4">Bodega Destino</th>
                  <th className="py-3 px-4">Producto Trasladado</th>
                  <th className="py-3 px-4 text-center">Cantidad</th>
                  <th className="py-3 px-4 text-right">Valor Ponderado</th>
                  <th className="py-3 px-4">Motivo / Justificación</th>
                  <th className="py-3 px-4">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <ArrowRightLeft className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No hay transferencias registradas</p>
                    </td>
                  </tr>
                ) : (
                  inventoryTransfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">{t.transferNumber}</td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString("es-EC")}
                      </td>
                      <td className="py-3 px-4 font-medium text-rose-700">{t.originWarehouseName}</td>
                      <td className="py-3 px-4 font-medium text-emerald-700">{t.destWarehouseName}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{t.productName}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full font-black bg-sky-100 text-sky-800 text-xs">
                          {t.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-700">${t.totalCost.toFixed(2)}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={t.reason}>
                        {t.reason}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{t.responsibleUser}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 6: AJUSTES DE STOCK                    */}
      {/* ========================================== */}
      {activeTab === "ajustes" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-xs">Historial de Ajustes de Inventario</h3>
              <p className="text-[11px] text-slate-500">
                Auditoría de correcciones físicas, sobrantes y pérdidas técnicas
              </p>
            </div>
            <button
              onClick={() => {
                setAdjustmentDefaultProduct(undefined);
                setIsAdjustmentModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Nuevo Ajuste
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Número</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Bodega</th>
                  <th className="py-3 px-4">Sentido</th>
                  <th className="py-3 px-4">Concepto / Motivo</th>
                  <th className="py-3 px-4">Ítems Afectados</th>
                  <th className="py-3 px-4">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryAdjustments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <SlidersHorizontal className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No hay ajustes registrados</p>
                    </td>
                  </tr>
                ) : (
                  inventoryAdjustments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">{a.adjustmentNumber}</td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(a.date).toLocaleDateString("es-EC")}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{a.warehouseName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            a.type.includes("ingreso")
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {a.type.includes("ingreso") ? "Ingreso (+)" : "Egreso (-)"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{a.concept}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {a.items.map((it, idx) => (
                            <div key={idx} className="text-[11px] text-slate-600">
                              <strong>{it.productName}:</strong>{" "}
                              <span className={it.type === "ingreso" ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                                {it.type === "ingreso" ? "+" : "-"}
                                {it.quantity}
                              </span>{" "}
                              (Saldo: {it.previousStock} &rarr; {it.newStock})
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{a.responsibleUser}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 7: CATEGORÍAS & MARCAS                 */}
      {/* ========================================== */}
      {activeTab === "clasificacion" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Categorías */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Tags className="w-4 h-4 text-[#004ac6]" />
                  Categorías de Catálogo ({inventoryCategories.length})
                </h3>
                <p className="text-[11px] text-slate-500">Agrupación por líneas de producto o servicios</p>
              </div>
              <button
                onClick={() => {
                  setCatBrandMode("categoria");
                  setIsCatBrandOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Nueva
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {inventoryCategories.map((c) => (
                <div key={c.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div>
                    <h5 className="font-bold text-slate-800 text-xs">{c.name}</h5>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{c.description || "Sin descripción"}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-slate-100 text-slate-600">
                      {c.itemType || "ambos"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {inventoryProducts.filter((p) => p.categoryId === c.id).length} artículos
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Marcas */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Tags className="w-4 h-4 text-indigo-600" />
                  Marcas & Fabricantes ({inventoryBrands.length})
                </h3>
                <p className="text-[11px] text-slate-500">Marcas homologadas en planta externa y NOC</p>
              </div>
              <button
                onClick={() => {
                  setCatBrandMode("marca");
                  setIsCatBrandOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#004ac6] hover:bg-[#003da6] text-white text-xs font-bold shadow-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Nueva
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {inventoryBrands.map((b) => (
                <div key={b.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div>
                    <h5 className="font-bold text-slate-800 text-xs">{b.name}</h5>
                    <span className="text-[11px] text-slate-400">Origen: {b.originCountry || "Internacional"}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {inventoryProducts.filter((p) => p.brandId === b.id).length} artículos
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODALES OPERATIVOS                         */}
      {/* ========================================== */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        productToEdit={productToEdit}
        defaultType={productModalDefaultType}
      />

      <WarehouseModal
        isOpen={isWarehouseModalOpen}
        onClose={() => setIsWarehouseModalOpen(false)}
        warehouseToEdit={warehouseToEdit}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        defaultProductId={transferDefaultProduct}
        defaultOriginWarehouseId={transferDefaultWarehouse}
      />

      <AdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        defaultProductId={adjustmentDefaultProduct}
        defaultWarehouseId={adjustmentDefaultWarehouse}
      />

      <CategoryBrandModal
        isOpen={isCatBrandOpen}
        onClose={() => setIsCatBrandOpen(false)}
        mode={catBrandMode}
      />
    </div>
  );
}
