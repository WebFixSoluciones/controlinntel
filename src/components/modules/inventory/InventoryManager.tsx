"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { canAccessSubmodule } from "@/lib/permissions";
import {
  InventoryProduct,
  Warehouse,
  ProductCategory,
  ProductBrand,
} from "@/types";
import { ProductModal } from "./ProductModal";
import { WarehouseModal } from "./WarehouseModal";
import { TransferModal } from "./TransferModal";
import { AdjustmentModal } from "./AdjustmentModal";
import { CategoryBrandModal } from "./CategoryBrandModal";
import {
  Package,
  Wrench,
  Building2,
  BookOpen,
  ArrowRightLeft,
  SlidersHorizontal,
  Tags,
  Plus,
  Search,
  Download,
  Edit2,
  Trash2,
  Eye,
  ShieldAlert,
  Award,
} from "lucide-react";

export type InventoryTab =
  | "productos"
  | "servicios"
  | "categorias"
  | "kardex"
  | "transferencias"
  | "bodegas"
  | "ajustes";

export function InventoryManager() {
  const {
    currentUser,
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
  const router = useRouter();

  const searchParams = useSearchParams();
  const subParam = searchParams.get("sub");

  const normalizeTab = (param: string | null): InventoryTab => {
    if (!param) return "productos";
    if (param === "bodega") return "bodegas";
    if (param === "clasificacion") return "categorias";
    if (
      param === "productos" ||
      param === "servicios" ||
      param === "categorias" ||
      param === "kardex" ||
      param === "transferencias" ||
      param === "bodegas" ||
      param === "ajustes"
    ) {
      return param as InventoryTab;
    }
    return "productos";
  };

  const [activeTab, setActiveTab] = useState<InventoryTab>(() => normalizeTab(subParam));

  useEffect(() => {
    if (subParam) {
      setActiveTab(normalizeTab(subParam));
    }
  }, [subParam]);

  // Global search input for current view
  const [searchTerm, setSearchTerm] = useState("");

  // Productos Filters
  const [productWarehouseFilter, setProductWarehouseFilter] = useState("all");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productStockFilter, setProductStockFilter] = useState<"all" | "low" | "out" | "normal">("all");

  // Servicios Filters
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState("all");
  const [serviceStatusFilter, setServiceStatusFilter] = useState<"todos" | "activo" | "inactivo">("todos");

  // Categorías & Marcas sub-view
  const [categorySubView, setCategorySubView] = useState<"categorias" | "marcas">("categorias");
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<"all" | "producto" | "servicio" | "ambos">("all");

  // Kardex Filters
  const [kardexProductFilter, setKardexProductFilter] = useState("all");
  const [kardexWarehouseFilter, setKardexWarehouseFilter] = useState("all");

  // Transferencias Filters
  const [transferWarehouseFilter, setTransferWarehouseFilter] = useState("all");

  // Bodegas Filters
  const [warehouseStatusFilter, setWarehouseStatusFilter] = useState<"todos" | "activo" | "inactivo">("todos");

  // Ajustes Filters
  const [adjustmentWarehouseFilter, setAdjustmentWarehouseFilter] = useState("all");
  const [adjustmentTypeFilter, setAdjustmentTypeFilter] = useState<"todos" | "ingreso" | "egreso">("todos");

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

  // Check sub-module permission
  const hasAccess = canAccessSubmodule(currentUser, "inventarios", activeTab);

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
        productCategoryFilter === "all" || p.categoryId === productCategoryFilter;

      let matchesStock = true;
      if (productStockFilter === "low") matchesStock = p.stock > 0 && p.stock <= p.minStock;
      else if (productStockFilter === "out") matchesStock = p.stock === 0;
      else if (productStockFilter === "normal") matchesStock = p.stock > p.minStock;

      let matchesWarehouse = true;
      if (productWarehouseFilter !== "all") {
        const whStock = p.stockByWarehouse?.[productWarehouseFilter] ?? 0;
        matchesWarehouse = whStock > 0;
      }

      return matchesSearch && matchesCategory && matchesStock && matchesWarehouse;
    });
  }, [inventoryProducts, searchTerm, productCategoryFilter, productStockFilter, productWarehouseFilter]);

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
        serviceCategoryFilter === "all" || p.categoryId === serviceCategoryFilter;

      const matchesStatus =
        serviceStatusFilter === "todos" || p.status === serviceStatusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [inventoryProducts, searchTerm, serviceCategoryFilter, serviceStatusFilter]);

  // ==========================================
  // Filtered Categories & Brands
  // ==========================================
  const filteredCategories = useMemo(() => {
    return inventoryCategories.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType =
        categoryTypeFilter === "all" || c.itemType === categoryTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [inventoryCategories, searchTerm, categoryTypeFilter]);

  const filteredBrands = useMemo(() => {
    return inventoryBrands.filter((b) => {
      return (
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.originCountry && b.originCountry.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    });
  }, [inventoryBrands, searchTerm]);

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
        kardexWarehouseFilter === "all" || k.warehouseId === kardexWarehouseFilter;

      return matchesSearch && matchesProduct && matchesWarehouse;
    });
  }, [inventoryKardex, searchTerm, kardexProductFilter, kardexWarehouseFilter]);

  // ==========================================
  // Filtered Transfers
  // ==========================================
  const filteredTransfers = useMemo(() => {
    return inventoryTransfers.filter((t) => {
      const matchesSearch =
        t.transferNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.responsibleUser.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesWarehouse =
        transferWarehouseFilter === "all" ||
        t.originWarehouseId === transferWarehouseFilter ||
        t.destWarehouseId === transferWarehouseFilter;

      return matchesSearch && matchesWarehouse;
    });
  }, [inventoryTransfers, searchTerm, transferWarehouseFilter]);

  // ==========================================
  // Filtered Warehouses
  // ==========================================
  const filteredWarehouses = useMemo(() => {
    return inventoryWarehouses.filter((w) => {
      const matchesSearch =
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (w.responsibleName && w.responsibleName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (w.city && w.city.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        warehouseStatusFilter === "todos" || w.status === warehouseStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [inventoryWarehouses, searchTerm, warehouseStatusFilter]);

  // ==========================================
  // Filtered Adjustments
  // ==========================================
  const filteredAdjustments = useMemo(() => {
    return inventoryAdjustments.filter((a) => {
      const matchesSearch =
        a.adjustmentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.responsibleUser.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.items.some((it) => it.productName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesWarehouse =
        adjustmentWarehouseFilter === "all" || a.warehouseId === adjustmentWarehouseFilter;

      const matchesType =
        adjustmentTypeFilter === "todos" ||
        (adjustmentTypeFilter === "ingreso" && a.type.includes("ingreso")) ||
        (adjustmentTypeFilter === "egreso" && !a.type.includes("ingreso"));

      return matchesSearch && matchesWarehouse && matchesType;
    });
  }, [inventoryAdjustments, searchTerm, adjustmentWarehouseFilter, adjustmentTypeFilter]);

  // Quick Action Handlers
  const handleOpenKardexForProduct = (prodId: string) => {
    setKardexProductFilter(prodId);
    router.push("/inventarios?sub=kardex");
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

  const handleDeleteCategory = (cat: ProductCategory) => {
    const productsCount = inventoryProducts.filter((p) => p.categoryId === cat.id).length;
    if (productsCount > 0) {
      showError("Acción Denegada", `No es posible eliminar "${cat.name}" porque tiene ${productsCount} artículos asociados.`);
      return;
    }
    showConfirm(
      "¿Eliminar Categoría?",
      `¿Deseas eliminar la categoría "${cat.name}"?`,
      async () => {
        try {
          await deleteRecord("inventoryCategories", cat.id);
          showSuccess("Categoría Eliminada", `La categoría "${cat.name}" ha sido retirada.`);
        } catch (err: any) {
          showError("Error al Eliminar", err?.message);
        }
      },
      "Eliminar Categoría"
    );
  };

  const handleDeleteBrand = (brand: ProductBrand) => {
    const productsCount = inventoryProducts.filter((p) => p.brandId === brand.id).length;
    if (productsCount > 0) {
      showError("Acción Denegada", `No es posible eliminar "${brand.name}" porque tiene ${productsCount} artículos asociados.`);
      return;
    }
    showConfirm(
      "¿Eliminar Marca?",
      `¿Deseas eliminar la marca "${brand.name}"?`,
      async () => {
        try {
          await deleteRecord("inventoryBrands", brand.id);
          showSuccess("Marca Eliminada", `La marca "${brand.name}" ha sido retirada.`);
        } catch (err: any) {
          showError("Error al Eliminar", err?.message);
        }
      },
      "Eliminar Marca"
    );
  };

  // Export to CSV helper for Products
  const handleExportProductsCsv = () => {
    try {
      const headers = ["SKU", "Nombre", "Tipo", "Categoría", "Stock", "Unidad", "Costo Base", "Precio Sin IVA", "Precio Con IVA"];
      const rows = filteredProducts.map((p) => [
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

  // Export to CSV helper for Kardex
  const handleExportKardexCsv = () => {
    try {
      const headers = [
        "Fecha",
        "Producto",
        "Bodega",
        "Tipo",
        "Concepto",
        "Documento",
        "Entrada Cant",
        "Entrada Costo",
        "Entrada Total",
        "Salida Cant",
        "Salida Costo",
        "Salida Total",
        "Saldo Cant",
        "Costo Promedio",
        "Saldo Total",
      ];
      const rows = filteredKardex.map((k) => [
        `"${k.date}"`,
        `"${k.productName.replace(/"/g, '""')}"`,
        `"${k.warehouseName.replace(/"/g, '""')}"`,
        `"${k.type}"`,
        `"${k.concept.replace(/"/g, '""')}"`,
        `"${k.referenceDocNumber || k.referenceId || ""}"`,
        k.entryQuantity || 0,
        (k.entryUnitCost || 0).toFixed(2),
        (k.entryTotalCost || 0).toFixed(2),
        k.exitQuantity || 0,
        (k.exitUnitCost || 0).toFixed(2),
        (k.exitTotalCost || 0).toFixed(2),
        k.balanceQuantity || 0,
        (k.balanceAverageCost || 0).toFixed(2),
        (k.balanceTotalCost || 0).toFixed(2),
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `kardex_inntel_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccess("Kardex Exportado", "Se descargó el libro mayor de kardex en CSV.");
    } catch (e: any) {
      showError("Error de Exportación", e?.message);
    }
  };

  if (!hasAccess) {
    return (
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-12 text-center shadow-2xs">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#0b1c30]">Acceso Restringido</h3>
        <p className="text-xs text-[#737686] mt-1 max-w-md mx-auto">
          No tienes permisos para visualizar este submódulo de Inventarios. Contacta con el administrador si necesitas acceso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* 1. PRODUCTOS                                              */}
      {/* ========================================================= */}
      {activeTab === "productos" && (
        <div className="space-y-4">
          {/* Top Filter and Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por SKU, nombre, modelo o código..."
                className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={productWarehouseFilter}
                onChange={(e) => setProductWarehouseFilter(e.target.value)}
                className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="all">Todas las Bodegas</option>
                {inventoryWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} - {w.name}
                  </option>
                ))}
              </select>

              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="all">Todas las Categorías</option>
                {inventoryCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={productStockFilter}
                onChange={(e) => setProductStockFilter(e.target.value as any)}
                className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="all">Todos los Estados</option>
                <option value="normal">Stock Normal</option>
                <option value="low">Stock Bajo (Crítico)</option>
                <option value="out">Sin Existencias (Agotado)</option>
              </select>

              <button
                onClick={handleExportProductsCsv}
                className="px-3.5 py-2 rounded-xl border border-[#e2e8f0] bg-white hover:bg-slate-50 text-[#434655] text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Descargar catálogo en CSV"
              >
                <Download className="w-3.5 h-3.5 text-[#737686]" />
                <span>Exportar CSV</span>
              </button>

              <button
                onClick={() => {
                  setProductToEdit(null);
                  setProductModalDefaultType("producto");
                  setIsProductModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Producto</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3 px-4 font-bold">SKU / Código</th>
                    <th className="py-3 px-4 font-bold">Producto / Equipo</th>
                    <th className="py-3 px-4 font-bold">Categoría / Marca</th>
                    <th className="py-3 px-4 font-bold text-center">Stock Global</th>
                    <th className="py-3 px-4 font-bold text-right">Costo Promedio</th>
                    <th className="py-3 px-4 font-bold text-right">P. Venta (Sin IVA)</th>
                    <th className="py-3 px-4 font-bold text-right">P. Venta (Con IVA)</th>
                    <th className="py-3 px-4 font-bold text-center">Estado</th>
                    <th className="py-3 px-4 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs text-[#737686]">
                        <Package className="w-10 h-10 mx-auto mb-2 text-[#cbd5e1]" />
                        <p className="font-semibold text-[#434655]">No se encontraron productos físicos</p>
                        <p className="text-[11px] text-[#737686] mt-0.5">
                          Ajusta los filtros de búsqueda o registra un nuevo producto en el catálogo.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLowStock = p.stock > 0 && p.stock <= p.minStock;
                      const isOutStock = p.stock === 0;

                      return (
                        <tr key={p.id} className="hover:bg-[#f8f9ff] transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">
                            {p.sku}
                            {p.barcode && (
                              <span className="block text-[10px] text-[#737686] font-normal">
                                EAN: {p.barcode}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#0b1c30] line-clamp-1">{p.name}</div>
                            <div className="text-[11px] text-[#737686] line-clamp-1">
                              {p.model ? `Modelo: ${p.model} | ` : ""}
                              {p.fiberLengthMeters ? `Metraje: ${p.fiberLengthMeters}m | ` : ""}
                              {p.description || "Sin especificaciones adicionales"}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-[#f1f5f9] text-[#434655] text-[10px] font-semibold mb-0.5">
                              {p.categoryName || "General"}
                            </span>
                            {p.brandName && (
                              <span className="block text-[10px] text-[#737686] font-medium">
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
                          <td className="py-3 px-4 text-right font-medium text-[#434655]">
                            ${p.baseCost.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-[#0b1c30]">
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
                                title="Consultar Kardex"
                                className="p-1.5 rounded-lg text-[#737686] hover:text-[#004ac6] hover:bg-[#eff4ff] transition-colors cursor-pointer"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenTransferForProduct(p.id)}
                                title="Transferir Stock"
                                className="p-1.5 rounded-lg text-[#737686] hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenAdjustmentForProduct(p.id)}
                                title="Ajuste de Stock"
                                className="p-1.5 rounded-lg text-[#737686] hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setProductToEdit(p);
                                  setProductModalDefaultType("producto");
                                  setIsProductModalOpen(true);
                                }}
                                title="Editar Producto"
                                className="p-1.5 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p)}
                                title="Eliminar Producto"
                                className="p-1.5 rounded-lg text-[#737686] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. SERVICIOS                                              */}
      {/* ========================================================= */}
      {activeTab === "servicios" && (
        <div className="space-y-4">
          {/* Top Filter and Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar servicio por código o nombre..."
                className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={serviceCategoryFilter}
                onChange={(e) => setServiceCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="all">Todas las Categorías</option>
                {inventoryCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={serviceStatusFilter}
                onChange={(e) => setServiceStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="todos">Todos los Estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>

              <button
                onClick={() => {
                  setProductToEdit(null);
                  setProductModalDefaultType("servicio");
                  setIsProductModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Servicio</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3 px-4 font-bold">Código / SKU</th>
                    <th className="py-3 px-4 font-bold">Servicio Técnico / Mano de Obra</th>
                    <th className="py-3 px-4 font-bold">Categoría</th>
                    <th className="py-3 px-4 font-bold text-center">Unidad</th>
                    <th className="py-3 px-4 font-bold text-right">Costo Base ($)</th>
                    <th className="py-3 px-4 font-bold text-right">P. Venta Sin IVA ($)</th>
                    <th className="py-3 px-4 font-bold text-right">P. Venta Con IVA ($)</th>
                    <th className="py-3 px-4 font-bold text-center">Estado</th>
                    <th className="py-3 px-4 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {filteredServices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs text-[#737686]">
                        <Wrench className="w-10 h-10 mx-auto mb-2 text-[#cbd5e1]" />
                        <p className="font-semibold text-[#434655]">No se encontraron servicios técnicos</p>
                        <p className="text-[11px] text-[#737686] mt-0.5">
                          Haz clic en "Nuevo Servicio" para dar de alta conceptos de mano de obra o suscripciones.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredServices.map((s) => (
                      <tr key={s.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">{s.sku}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#0b1c30]">{s.name}</div>
                          <div className="text-[11px] text-[#737686]">{s.description || "Sin descripción"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-[#f1f5f9] text-[#434655] text-[10px] font-semibold">
                            {s.categoryName || "Servicios"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center capitalize font-medium text-[#434655]">{s.unit}</td>
                        <td className="py-3 px-4 text-right font-medium text-[#434655]">${s.baseCost.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold text-[#0b1c30]">${s.salePrice.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">${s.salePriceConIva.toFixed(2)}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === "activo"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {s.status === "activo" ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setProductToEdit(s);
                                setProductModalDefaultType("servicio");
                                setIsProductModalOpen(true);
                              }}
                              title="Editar Servicio"
                              className="p-1.5 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(s)}
                              title="Eliminar Servicio"
                              className="p-1.5 rounded-lg text-[#737686] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. CATEGORÍAS & MARCAS                                    */}
      {/* ========================================================= */}
      {activeTab === "categorias" && (
        <div className="space-y-4">
          {/* Top Filter and Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
            {/* View Sub-tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0] w-full sm:w-auto">
              <button
                onClick={() => setCategorySubView("categorias")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  categorySubView === "categorias"
                    ? "bg-[#004ac6] text-white shadow-xs"
                    : "text-[#434655] hover:text-[#0b1c30]"
                }`}
              >
                <Tags className="w-3.5 h-3.5" />
                <span>Categorías ({inventoryCategories.length})</span>
              </button>
              <button
                onClick={() => setCategorySubView("marcas")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  categorySubView === "marcas"
                    ? "bg-[#004ac6] text-white shadow-xs"
                    : "text-[#434655] hover:text-[#0b1c30]"
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Marcas & Fabricantes ({inventoryBrands.length})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    categorySubView === "categorias"
                      ? "Buscar por categoría o descripción..."
                      : "Buscar marca o fabricante..."
                  }
                  className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
                />
              </div>

              {categorySubView === "categorias" && (
                <select
                  value={categoryTypeFilter}
                  onChange={(e) => setCategoryTypeFilter(e.target.value as any)}
                  className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
                >
                  <option value="all">Todos los Tipos</option>
                  <option value="ambos">Productos y Servicios</option>
                  <option value="producto">Solo Productos Físicos</option>
                  <option value="servicio">Solo Servicios Técnicos</option>
                </select>
              )}

              {categorySubView === "categorias" ? (
                <button
                  onClick={() => {
                    setCatBrandMode("categoria");
                    setIsCatBrandOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nueva Categoría</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setCatBrandMode("marca");
                    setIsCatBrandOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nueva Marca</span>
                </button>
              )}
            </div>
          </div>

          {/* Sub-view: Categorías Table */}
          {categorySubView === "categorias" ? (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
                    <tr>
                      <th className="py-3 px-4 font-bold">Nombre de la Categoría</th>
                      <th className="py-3 px-4 font-bold">Descripción / Alcance</th>
                      <th className="py-3 px-4 font-bold text-center">Aplica a</th>
                      <th className="py-3 px-4 font-bold text-center">Artículos Asociados</th>
                      <th className="py-3 px-4 font-bold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-xs text-[#737686]">
                          <Tags className="w-10 h-10 mx-auto mb-2 text-[#cbd5e1]" />
                          <p className="font-semibold text-[#434655]">No se encontraron categorías</p>
                          <p className="text-[11px] text-[#737686] mt-0.5">
                            Crea una nueva categoría para organizar equipos y servicios.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((c) => {
                        const count = inventoryProducts.filter((p) => p.categoryId === c.id).length;
                        return (
                          <tr key={c.id} className="hover:bg-[#f8f9ff] transition-colors">
                            <td className="py-3 px-4 font-bold text-[#0b1c30]">{c.name}</td>
                            <td className="py-3 px-4 text-[#737686] max-w-md truncate">
                              {c.description || "Sin descripción registrada"}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#eff4ff] text-[#004ac6] border border-[#bfdbfe]">
                                {c.itemType || "ambos"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-[#434655]">
                              {count} artículo{count !== 1 ? "s" : ""}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDeleteCategory(c)}
                                title="Eliminar Categoría"
                                className="p-1.5 rounded-lg text-[#737686] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
          ) : (
            /* Sub-view: Marcas Table */
            <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
                    <tr>
                      <th className="py-3 px-4 font-bold">Marca / Fabricante</th>
                      <th className="py-3 px-4 font-bold">País de Origen</th>
                      <th className="py-3 px-4 font-bold text-center">Artículos Homologados</th>
                      <th className="py-3 px-4 font-bold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {filteredBrands.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-xs text-[#737686]">
                          <Award className="w-10 h-10 mx-auto mb-2 text-[#cbd5e1]" />
                          <p className="font-semibold text-[#434655]">No se encontraron marcas registradas</p>
                          <p className="text-[11px] text-[#737686] mt-0.5">
                            Registra fabricantes homologados como MikroTik, Ubiquiti, Huawei, etc.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredBrands.map((b) => {
                        const count = inventoryProducts.filter((p) => p.brandId === b.id).length;
                        return (
                          <tr key={b.id} className="hover:bg-[#f8f9ff] transition-colors">
                            <td className="py-3 px-4 font-bold text-[#0b1c30]">{b.name}</td>
                            <td className="py-3 px-4 text-[#737686]">{b.originCountry || "Internacional"}</td>
                            <td className="py-3 px-4 text-center font-bold text-[#434655]">
                              {count} artículo{count !== 1 ? "s" : ""}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDeleteBrand(b)}
                                title="Eliminar Marca"
                                className="p-1.5 rounded-lg text-[#737686] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. KARDEX                                                 */}
      {/* ========================================================= */}
      {activeTab === "kardex" && (
        <div className="space-y-4">
          {/* Top Filter and Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por concepto, producto o documento..."
                className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={kardexWarehouseFilter}
                onChange={(e) => setKardexWarehouseFilter(e.target.value)}
                className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="all">Todas las Bodegas</option>
                {inventoryWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} - {w.name}
                  </option>
                ))}
              </select>

              <select
                value={kardexProductFilter}
                onChange={(e) => setKardexProductFilter(e.target.value)}
                className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6] max-w-xs truncate"
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

              {kardexProductFilter !== "all" && (
                <button
                  onClick={() => setKardexProductFilter("all")}
                  className="text-xs font-semibold text-[#004ac6] hover:underline px-1 cursor-pointer"
                >
                  Limpiar Producto
                </button>
              )}

              <button
                onClick={handleExportKardexCsv}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">Fecha & Hora</th>
                    <th className="py-2.5 px-3 font-bold">Producto / Equipo</th>
                    <th className="py-2.5 px-3 font-bold">Bodega</th>
                    <th className="py-2.5 px-3 font-bold">Tipo / Concepto</th>
                    <th className="py-2.5 px-3 font-bold">Documento Ref.</th>
                    <th className="py-2.5 px-3 font-bold text-right bg-emerald-50/40 text-emerald-800">Entrada (Cant)</th>
                    <th className="py-2.5 px-3 font-bold text-right bg-emerald-50/40 text-emerald-800">Costo Unit ($)</th>
                    <th className="py-2.5 px-3 font-bold text-right bg-emerald-50/40 text-emerald-800">Total Entrada ($)</th>
                    <th className="py-2.5 px-3 font-bold text-right bg-rose-50/40 text-rose-800">Salida (Cant)</th>
                    <th className="py-2.5 px-3 font-bold text-right bg-rose-50/40 text-rose-800">Costo Unit ($)</th>
                    <th className="py-2.5 px-3 font-bold text-right bg-rose-50/40 text-rose-800">Total Salida ($)</th>
                    <th className="py-2.5 px-3 font-bold text-right bg-sky-50/40 text-sky-800">Saldo (Cant)</th>
                    <th className="py-2.5 px-3 font-bold text-right bg-sky-50/40 text-sky-800">Costo Prom ($)</th>
                    <th className="py-2.5 px-3 font-bold text-right bg-sky-50/40 text-sky-800">Saldo Total ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {filteredKardex.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-xs text-[#737686]">
                        <BookOpen className="w-10 h-10 mx-auto mb-2 text-[#cbd5e1]" />
                        <p className="font-semibold text-[#434655]">No hay movimientos registrados en el Kardex</p>
                        <p className="text-[11px] text-[#737686] mt-0.5">
                          Las compras, ventas, transferencias y ajustes reflejarán sus asientos contables aquí.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredKardex.map((k) => (
                      <tr key={k.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-2.5 px-3 text-[#737686] whitespace-nowrap">
                          {new Date(k.date).toLocaleDateString("es-EC", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#0b1c30] max-w-xs truncate" title={k.productName}>
                          {k.productName}
                        </td>
                        <td className="py-2.5 px-3 text-[#434655] font-medium whitespace-nowrap">{k.warehouseName}</td>
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
                          <div className="text-[10px] text-[#737686] line-clamp-1">{k.concept}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#434655]">
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
                        <td className="py-2.5 px-3 text-right font-black text-[#0b1c30] bg-sky-50/20">
                          {k.balanceQuantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#434655] bg-sky-50/20">
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
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. TRANSFERENCIAS                                         */}
      {/* ========================================================= */}
      {activeTab === "transferencias" && (
        <div className="space-y-4">
          {/* Top Filter and Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número, producto o motivo..."
                className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={transferWarehouseFilter}
                onChange={(e) => setTransferWarehouseFilter(e.target.value)}
                className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="all">Todas las Bodegas</option>
                {inventoryWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} - {w.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  setTransferDefaultProduct(undefined);
                  setIsTransferModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Trasladar Stock</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3 px-4 font-bold">Número</th>
                    <th className="py-3 px-4 font-bold">Fecha</th>
                    <th className="py-3 px-4 font-bold">Bodega Origen</th>
                    <th className="py-3 px-4 font-bold">Bodega Destino</th>
                    <th className="py-3 px-4 font-bold">Producto Trasladado</th>
                    <th className="py-3 px-4 font-bold text-center">Cantidad</th>
                    <th className="py-3 px-4 font-bold text-right">Valor Ponderado</th>
                    <th className="py-3 px-4 font-bold">Motivo / Justificación</th>
                    <th className="py-3 px-4 font-bold">Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {filteredTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs text-[#737686]">
                        <ArrowRightLeft className="w-10 h-10 mx-auto mb-2 text-[#cbd5e1]" />
                        <p className="font-semibold text-[#434655]">No hay transferencias registradas</p>
                        <p className="text-[11px] text-[#737686] mt-0.5">
                          Haz clic en "Trasladar Stock" para movilizar insumos entre almacenes.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransfers.map((t) => (
                      <tr key={t.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">{t.transferNumber}</td>
                        <td className="py-3 px-4 text-[#737686] whitespace-nowrap">
                          {new Date(t.date).toLocaleDateString("es-EC")}
                        </td>
                        <td className="py-3 px-4 font-medium text-rose-700">{t.originWarehouseName}</td>
                        <td className="py-3 px-4 font-medium text-emerald-700">{t.destWarehouseName}</td>
                        <td className="py-3 px-4 font-bold text-[#0b1c30]">{t.productName}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full font-black bg-[#eff4ff] text-[#004ac6] text-xs">
                            {t.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#434655]">${t.totalCost.toFixed(2)}</td>
                        <td className="py-3 px-4 text-[#737686] max-w-xs truncate" title={t.reason}>
                          {t.reason}
                        </td>
                        <td className="py-3 px-4 text-[#737686]">{t.responsibleUser}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. BODEGA                                                 */}
      {/* ========================================================= */}
      {activeTab === "bodegas" && (
        <div className="space-y-4">
          {/* Top Filter and Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar bodega por código, nombre o custodio..."
                className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={warehouseStatusFilter}
                onChange={(e) => setWarehouseStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="todos">Todos los Estados</option>
                <option value="activo">Operativas</option>
                <option value="inactivo">Bloqueadas / Inactivas</option>
              </select>

              <button
                onClick={() => {
                  setWarehouseToEdit(null);
                  setIsWarehouseModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Bodega</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3 px-4 font-bold">Código</th>
                    <th className="py-3 px-4 font-bold">Nombre de Bodega</th>
                    <th className="py-3 px-4 font-bold">Ubicación / Ciudad</th>
                    <th className="py-3 px-4 font-bold">Custodio / Responsable</th>
                    <th className="py-3 px-4 font-bold text-center">Existencias</th>
                    <th className="py-3 px-4 font-bold text-right">Valorización ($)</th>
                    <th className="py-3 px-4 font-bold text-center">Estado</th>
                    <th className="py-3 px-4 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {filteredWarehouses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-[#737686]">
                        <Building2 className="w-10 h-10 mx-auto mb-2 text-[#cbd5e1]" />
                        <p className="font-semibold text-[#434655]">No se encontraron bodegas registradas</p>
                        <p className="text-[11px] text-[#737686] mt-0.5">
                          Haz clic en "Nueva Bodega" para registrar un centro de distribución o móvil técnico.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredWarehouses.map((w) => {
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
                        <tr key={w.id} className="hover:bg-[#f8f9ff] transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">{w.code}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#0b1c30]">{w.name}</span>
                              {w.isDefault && (
                                <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-[#eff4ff] text-[#004ac6] border border-[#bfdbfe]">
                                  Predeterminada
                                </span>
                              )}
                            </div>
                            {w.address && (
                              <div className="text-[11px] text-[#737686] line-clamp-1">{w.address}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#434655] font-medium">{w.city || "Ecuador"}</td>
                          <td className="py-3 px-4 text-[#434655]">{w.responsibleName || "Sin asignar"}</td>
                          <td className="py-3 px-4 text-center font-bold text-[#0b1c30]">
                            {totalUnitsInWh.toLocaleString()} u
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">
                            ${totalValueInWh.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                w.status === "activo"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {w.status === "activo" ? "Operativa" : "Bloqueada"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setProductWarehouseFilter(w.id);
                                  router.push("/inventarios?sub=productos");
                                  setActiveTab("productos");
                                }}
                                title="Ver Stock de esta Bodega"
                                className="p-1.5 rounded-lg text-[#737686] hover:text-[#004ac6] hover:bg-[#eff4ff] transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setWarehouseToEdit(w);
                                  setIsWarehouseModalOpen(true);
                                }}
                                title="Editar Bodega"
                                className="p-1.5 rounded-lg text-[#737686] hover:text-[#0b1c30] hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {!w.isDefault && (
                                <button
                                  onClick={() => handleDeleteWarehouse(w)}
                                  title="Eliminar Bodega"
                                  className="p-1.5 rounded-lg text-[#737686] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
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
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. AJUSTES                                                */}
      {/* ========================================================= */}
      {activeTab === "ajustes" && (
        <div className="space-y-4">
          {/* Top Filter and Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#737686] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número, concepto o producto..."
                className="w-full pl-9 pr-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs text-[#0b1c30] placeholder-[#737686] focus:outline-hidden focus:border-[#004ac6] transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={adjustmentWarehouseFilter}
                onChange={(e) => setAdjustmentWarehouseFilter(e.target.value)}
                className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="all">Todas las Bodegas</option>
                {inventoryWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} - {w.name}
                  </option>
                ))}
              </select>

              <select
                value={adjustmentTypeFilter}
                onChange={(e) => setAdjustmentTypeFilter(e.target.value as any)}
                className="px-3 py-2 bg-[#f8f9ff] border border-[#e2e8f0] rounded-xl text-xs font-medium text-[#434655] focus:outline-hidden focus:border-[#004ac6]"
              >
                <option value="todos">Todos los Sentidos</option>
                <option value="ingreso">Ingreso (+)</option>
                <option value="egreso">Egreso (-)</option>
              </select>

              <button
                onClick={() => {
                  setAdjustmentDefaultProduct(undefined);
                  setIsAdjustmentModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#004ac6] hover:bg-[#003da6] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Ajuste</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f8f9ff] text-[#434655] border-b border-[#e2e8f0]">
                  <tr>
                    <th className="py-3 px-4 font-bold">Número</th>
                    <th className="py-3 px-4 font-bold">Fecha</th>
                    <th className="py-3 px-4 font-bold">Bodega</th>
                    <th className="py-3 px-4 font-bold text-center">Sentido</th>
                    <th className="py-3 px-4 font-bold">Concepto / Motivo</th>
                    <th className="py-3 px-4 font-bold">Ítems Afectados</th>
                    <th className="py-3 px-4 font-bold">Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {filteredAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-[#737686]">
                        <SlidersHorizontal className="w-10 h-10 mx-auto mb-2 text-[#cbd5e1]" />
                        <p className="font-semibold text-[#434655]">No hay ajustes registrados</p>
                        <p className="text-[11px] text-[#737686] mt-0.5">
                          Haz clic en "Nuevo Ajuste" para corregir saldos físicos o registrar mermas.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredAdjustments.map((a) => (
                      <tr key={a.id} className="hover:bg-[#f8f9ff] transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#004ac6]">{a.adjustmentNumber}</td>
                        <td className="py-3 px-4 text-[#737686] whitespace-nowrap">
                          {new Date(a.date).toLocaleDateString("es-EC")}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#0b1c30]">{a.warehouseName}</td>
                        <td className="py-3 px-4 text-center">
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
                        <td className="py-3 px-4 text-[#434655] font-medium">{a.concept}</td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {a.items.map((it, idx) => (
                              <div key={idx} className="text-[11px] text-[#434655]">
                                <strong className="text-[#0b1c30]">{it.productName}:</strong>{" "}
                                <span className={it.type === "ingreso" ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                                  {it.type === "ingreso" ? "+" : "-"}
                                  {it.quantity}
                                </span>{" "}
                                <span className="text-[#737686]">(Saldo: {it.previousStock} &rarr; {it.newStock})</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[#737686]">{a.responsibleUser}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALES OPERATIVOS                                        */}
      {/* ========================================================= */}
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
