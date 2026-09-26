# Plan de Implementación: Fase 1 - Control de Inventarios & Bodegas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo completo de Control de Inventarios y Bodegas para INNTEL CORP, con catálogo de productos de telecomunicaciones y servicios, gestión de bodegas múltiples, kardex valorado con costo promedio ponderado, transferencias inter-bodegas y ajustes de stock.

**Architecture:** Módulo desacoplado en TypeScript con tipos específicos (`src/types/inventory.ts`), servicio matemático de cálculo de Kardex promedio ponderado (`src/lib/inventory-service.ts`), integración reactiva en el estado global (`src/lib/state.tsx`), componentes modulares y UI empresarial (`src/components/modules/inventory/`) y ruta `/inventarios` protegida en el Sidebar.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide React, Firebase Firestore, LocalStorage fallback.

---

### Task 1: Definición de Tipos TypeScript para Inventarios

**Files:**
- Create: `src/types/inventory.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1.1**: Crear `src/types/inventory.ts` con las interfaces completas: `InventoryItemType`, `UnitOfMeasure`, `TaxMode`, `KardexMovementType`, `InventoryProduct`, `Warehouse`, `ProductCategory`, `ProductBrand`, `KardexEntry`, `WarehouseTransfer`, e `InventoryAdjustment`.
- [ ] **Step 1.2**: Re-exportar todos los tipos de `inventory.ts` en `src/types/index.ts`.
- [ ] **Step 1.3**: Verificar la sintaxis con `npx tsc --noEmit`.
- [ ] **Step 1.4**: Commit de los tipos a git.

---

### Task 2: Semillas y Datos Iniciales de Telecomunicaciones e ISP

**Files:**
- Modify: `src/lib/mock-data.ts`

- [ ] **Step 2.1**: Crear categorías iniciales (`INITIAL_CATEGORIES`): Equipos de Red & ONTs, Fibra Óptica & Pasivos, Cables & Conectividad, Herramientas de Fibra, Servicios de Red.
- [ ] **Step 2.2**: Crear marcas iniciales (`INITIAL_BRANDS`): Huawei, MikroTik, Ubiquiti, FiberHome, ZTE, Furukawa, INNTEL.
- [ ] **Step 2.3**: Crear bodegas iniciales (`INITIAL_WAREHOUSES`): Bodega Central (Quito), Bodega Guayaquil, Bodega Móvil Técnico 1 (Cuadrilla).
- [ ] **Step 2.4**: Crear productos iniciales de telecomunicaciones (`INITIAL_PRODUCTS`): ONT Huawei EG8145V5 Dual Band, Router MikroTik hEX RB750Gr3, Bobina Fibra Óptica Drop 1 Hilo (1000m), Conectores Rápidos SC/APC (Caja 100u), Splitter Óptico PLC 1x8 SC/APC, Fusionadora de Fibra Óptica.
- [ ] **Step 2.5**: Crear servicios técnicos (`INITIAL_SERVICES`): Instalación de Acometida FTTH, Fusión y Certificación de Fibra Óptica, Reconfiguración de OLT y Enlace Dedicado.
- [ ] **Step 2.6**: Generar entradas de Kardex iniciales (`INITIAL_KARDEX`) correspondientes a las aperturas de stock de dichos productos.
- [ ] **Step 2.7**: Verificar la sintaxis con `npx tsc --noEmit`.
- [ ] **Step 2.8**: Commit de las semillas de datos a git.

---

### Task 3: Motor de Kardex y Servicio de Cálculos de Inventario

**Files:**
- Create: `src/lib/inventory-service.ts`

- [ ] **Step 3.1**: Implementar función pura `calculateAverageCost(currentQty, currentAvgCost, entryQty, entryUnitCost): number` para calcular el costo promedio ponderado exacto en entradas.
- [ ] **Step 3.2**: Implementar generador de secuenciales legibles (ej. `TRF-2026-0001`, `ADJ-2026-0001`).
- [ ] **Step 3.3**: Implementar función de validación de disponibilidad de stock por bodega: `validateStockAvailability(product, warehouseId, requestedQty): boolean`.
- [ ] **Step 3.4**: Implementar lógica para registrar movimientos de Kardex automáticos (`createKardexEntry`).
- [ ] **Step 3.5**: Verificar con `npx tsc --noEmit`.
- [ ] **Step 3.6**: Commit del servicio de inventario a git.

---

### Task 4: Integración del Estado Global en `src/lib/state.tsx`

**Files:**
- Modify: `src/lib/state.tsx`
- Modify: `src/lib/permissions.ts`

- [ ] **Step 4.1**: Agregar las colecciones de inventario a `collectionPermissions` en `src/lib/permissions.ts` (`inventoryProducts`, `inventoryWarehouses`, `inventoryCategories`, `inventoryBrands`, `inventoryKardex`, `inventoryTransfers`, `inventoryAdjustments`).
- [ ] **Step 4.2**: Agregar la ruta `/inventarios` a `routePermissions` asignada a `manage_finance` o `manage_network`.
- [ ] **Step 4.3**: En `src/lib/state.tsx`, incorporar los estados de inventario (`products`, `warehouses`, `categories`, `brands`, `kardex`, `transfers`, `adjustments`) con sincronización en Firestore y LocalStorage.
- [ ] **Step 4.4**: Implementar métodos en el contexto:
  - `addInventoryProduct(product)`
  - `updateInventoryProduct(id, updates)`
  - `deleteInventoryProduct(id)`
  - `addWarehouse(warehouse)`
  - `updateWarehouse(id, updates)`
  - `addCategory(category)`
  - `addBrand(brand)`
  - `executeTransfer(originBodegaId, destBodegaId, productId, quantity, reason)`
  - `executeAdjustment(type, warehouseId, concept, items)`
- [ ] **Step 4.5**: Probar compilación con `npx tsc --noEmit`.
- [ ] **Step 4.6**: Commit del estado global a git.

---

### Task 5: Componentes Modales de Gestión de Inventario

**Files:**
- Create: `src/components/modules/inventory/ProductModal.tsx`
- Create: `src/components/modules/inventory/WarehouseModal.tsx`
- Create: `src/components/modules/inventory/TransferModal.tsx`
- Create: `src/components/modules/inventory/AdjustmentModal.tsx`
- Create: `src/components/modules/inventory/CategoryBrandModal.tsx`

- [ ] **Step 5.1**: Crear `ProductModal.tsx`: Formulario reactivo para crear/editar productos o servicios. Cálculo automático de precios (sin IVA / con IVA 15%), selección de bodega, categoría, marca, unidad de medida y alerta de stock mínimo.
- [ ] **Step 5.2**: Crear `WarehouseModal.tsx`: Creación y edición de almacenes, código, nombre, ubicación y custodio responsable.
- [ ] **Step 5.3**: Crear `TransferModal.tsx`: Selector de bodega de origen y destino, selector de producto, visualizador de stock disponible en origen y validación en tiempo real.
- [ ] **Step 5.4**: Crear `AdjustmentModal.tsx`: Selector de bodega, tipo de ajuste (ingreso por sobrante / egreso por faltante o daño), justificación y desglose de cantidades.
- [ ] **Step 5.5**: Crear `CategoryBrandModal.tsx`: Modal ágil para crear nuevas categorías o marcas sin salir del flujo de trabajo.
- [ ] **Step 5.6**: Verificar con `npx tsc --noEmit`.
- [ ] **Step 5.7**: Commit de los modales a git.

---

### Task 6: Módulo Principal `InventoryManager.tsx`

**Files:**
- Create: `src/components/modules/inventory/InventoryManager.tsx`

- [ ] **Step 6.1**: Implementar cabecera con KPIs ejecutivos:
  - Valor Total del Inventario ($ USD)
  - Total de Artículos en Catálogo
  - Productos con Stock Bajo / Crítico
  - Bodegas Activas
- [ ] **Step 6.2**: Implementar selector de sub-pestañas:
  - `Productos` (Físicos)
  - `Servicios` (Intangibles/Técnicos)
  - `Bodegas` (Almacenes y deslose de stock)
  - `Kardex` (Libro mayor de entradas, salidas y saldos ponderados)
  - `Transferencias` (Historial de traslados inter-bodegas)
  - `Ajustes` (Historial de ajustes de stock)
  - `Categorías & Marcas`
- [ ] **Step 6.3**: Implementar filtros avanzados en cada pestaña (búsqueda por texto, filtro por bodega, filtro por categoría, filtro por estado de stock).
- [ ] **Step 6.4**: Implementar exportación de tabla a formato imprimible/CSV.
- [ ] **Step 6.5**: Verificar con `npx tsc --noEmit`.
- [ ] **Step 6.6**: Commit del gestor de inventarios a git.

---

### Task 7: Integración de Navegación y Rutas

**Files:**
- Create: `src/app/inventarios/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 7.1**: Crear página `src/app/inventarios/page.tsx` con título corporativo y renderizado de `InventoryManager`.
- [ ] **Step 7.2**: Agregar `/inventarios` al array `NAV_ITEMS` en `Sidebar.tsx` con icono `Boxes` (o `Package`) y badge de productos con stock bajo si existen.
- [ ] **Step 7.3**: Verificar con `npx tsc --noEmit`.
- [ ] **Step 7.4**: Commit de la navegación a git.

---

### Task 8: Verificación Completa y Build de Producción

**Files:**
- Complete project verification

- [ ] **Step 8.1**: Ejecutar `npx tsc --noEmit` para garantizar cero errores de TypeScript.
- [ ] **Step 8.2**: Ejecutar `$env:NODE_OPTIONS="--max_old_space_size=4096"; npm run build` para asegurar la compilación limpia de Next.js en producción.
- [ ] **Step 8.3**: Validar que la navegación `/inventarios` cargue fluidamente y que las acciones (alta de producto, traslado entre bodegas, ajuste y cálculo de kardex) funcionen sin excepciones.
- [ ] **Step 8.4**: Commit y push a la rama principal `main`.
