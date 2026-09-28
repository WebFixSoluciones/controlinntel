# Plan de Implementación: Módulo de Compras, Finanzas Integradas y Personas/Usuarios

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el Módulo de Compras con gestión de comprobantes SRI y Kardex, reestructurar Finanzas con 5 submódulos (Movimientos, Bancos, CxC, CxP, Reportes), y ampliar Personas con Proveedores y Control Avanzado de Usuarios con matriz granular de permisos por módulo y submódulo.

**Architecture:** Módulo `/compras` con 5 submódulos según especificación del usuario (Historial de Compras, Registrar Compra con importación XML SRI y manual con Kardex `PURCHASE_RECEIPT`, Notas de Crédito Recibidas con `SUPPLIER_RETURN`, Notas de Débito y Retenciones SRI de 49 dígitos). Módulo `/finanzas` con Movimientos, Bancos, CxC, CxP y Reportes. Módulo `/clientes` (Personas) con Clientes, Proveedores y Usuarios con matriz RBAC granular.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide React, LocalStorage + Firestore híbrido, Vitest / Node assertion tests.

---

### Task 1: Modelos de Datos TypeScript para Compras, Proveedores, Finanzas y Permisos Granulares

**Files:**
- Create: `src/types/purchases.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Crear `src/types/purchases.ts` con todas las interfaces de compras, proveedores, finanzas bancarias y permisos granulares**

```typescript
// ==========================================
// INNTEL CORP - PURCHASES, SUPPLIERS & FINANCE EXTENSIONS
// ==========================================

export type SupplierCategory =
  | "transito_ip"
  | "fibra_optica"
  | "equipos_networking"
  | "ferreteria_infraestructura"
  | "servicios_profesionales"
  | "arriendo_espacio_nodo"
  | "general";

export interface Supplier {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  category: SupplierCategory;
  email: string;
  phone: string;
  address: string;
  city?: string;
  creditDaysDefault: number; // 0 = contado, 15, 30, etc.
  bankName?: string;
  bankAccountType?: "ahorros" | "corriente";
  bankAccountNumber?: string;
  bankAccountOwner?: string;
  notes?: string;
  status: "activo" | "inactivo";
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  id: string;
  productId?: string;
  sku?: string;
  name: string;
  description?: string;
  quantity: number;
  unitCost: number;
  discount: number;
  ivaRate: number; // 15, 0, 5
  subtotal: number;
  ivaAmount: number;
  total: number;
  warehouseId: string;
}

export type PurchasePaymentCondition = "contado" | "credito";
export type PurchasePaymentStatus = "pagado" | "pendiente" | "abono_parcial";

export interface PurchaseInvoice {
  id: string;
  documentNumber: string; // ej. "001-002-000012345"
  claveAcceso?: string;   // 49 dígitos oficiales si es XML SRI
  date: string;           // YYYY-MM-DD
  supplierId: string;
  supplierName: string;
  supplierRuc: string;
  items: PurchaseItem[];
  subtotal15: number;
  subtotal0: number;
  subtotal: number;
  ivaAmount: number;
  total: number;
  paymentCondition: PurchasePaymentCondition;
  paymentMethod?: string;
  bankAccountId?: string;
  paymentStatus: PurchasePaymentStatus;
  paidAmount: number;
  balanceRemaining: number;
  dueDate?: string;
  inventoryStatus: "ingresado" | "no_aplica";
  xmlContent?: string;
  notes?: string;
  createdAt: string;
}

export interface SupplierCreditNote {
  id: string;
  purchaseInvoiceId: string;
  documentNumber: string;
  claveAcceso?: string;
  supplierId: string;
  supplierName: string;
  date: string;
  total: number;
  reason: "devolucion_mercaderia" | "descuento_bonificacion" | "correccion_precio";
  items?: {
    productId: string;
    productName: string;
    warehouseId: string;
    quantity: number;
    unitCost: number;
  }[];
  notes?: string;
  createdAt: string;
}

export interface SupplierDebitNote {
  id: string;
  purchaseInvoiceId: string;
  documentNumber: string;
  claveAcceso?: string;
  supplierId: string;
  supplierName: string;
  date: string;
  total: number;
  reason: string;
  createdAt: string;
}

export interface PurchaseWithholding {
  id: string;
  purchaseInvoiceId: string;
  documentNumber: string;
  claveAcceso: string;
  supplierId: string;
  supplierName: string;
  supplierRuc: string;
  date: string;
  rentaBase: number;
  rentaPercentage: number;
  rentaAmount: number;
  ivaBase: number;
  ivaPercentage: number;
  ivaAmount: number;
  totalWithheld: number;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountType: "corriente" | "ahorros" | "caja_efectivo";
  accountNumber: string;
  currency: "USD";
  initialBalance: number;
  currentBalance: number;
  status: "activa" | "inactiva";
}

export interface FinancialMovement {
  id: string;
  type: "ingreso" | "egreso";
  date: string;
  amount: number;
  category: string;
  description: string;
  bankAccountId: string;
  bankAccountName: string;
  paymentMethod: "transferencia" | "cheque" | "efectivo" | "tarjeta";
  referenceNumber?: string;
  relatedEntityId?: string;
  createdAt: string;
}

export interface SupplierPaymentRecord {
  id: string;
  purchaseInvoiceId: string;
  supplierId: string;
  supplierName: string;
  date: string;
  amount: number;
  bankAccountId: string;
  bankAccountName: string;
  paymentMethod: "transferencia" | "cheque" | "efectivo";
  referenceNumber: string;
  notes?: string;
  registeredBy: string;
  createdAt: string;
}

export interface UserModulePermissions {
  compras?: {
    enabled: boolean;
    submodules: {
      historial_compras: boolean;
      registrar_compra: boolean;
      notas_credito: boolean;
      notas_debito: boolean;
      retenciones: boolean;
    };
  };
  finanzas?: {
    enabled: boolean;
    submodules: {
      movimientos: boolean;
      bancos: boolean;
      cuentas_por_cobrar: boolean;
      cuentas_por_pagar: boolean;
      reportes: boolean;
    };
  };
  personas?: {
    enabled: boolean;
    submodules: {
      clientes: boolean;
      proveedores: boolean;
      usuarios_equipo: boolean;
    };
  };
  facturacion?: {
    enabled: boolean;
    submodules: {
      facturas: boolean;
      cotizaciones: boolean;
      notas_credito: boolean;
      retenciones: boolean;
      guias_remision: boolean;
      configuracion_sri: boolean;
    };
  };
  inventarios?: {
    enabled: boolean;
    submodules: {
      productos: boolean;
      bodegas: boolean;
      kardex: boolean;
      transferencias: boolean;
      ajustes: boolean;
    };
  };
  red?: {
    enabled: boolean;
    submodules: {
      nodos: boolean;
      pools_ip: boolean;
    };
  };
  proyectos?: { enabled: boolean };
  tickets?: { enabled: boolean };
  arcotel?: { enabled: boolean };
  boveda?: { enabled: boolean };
  plantillas?: { enabled: boolean };
  configuracion?: { enabled: boolean };
}
```

- [ ] **Step 2: Reexportar tipos en `src/types/index.ts` y extender `UserProfile` / `SystemUser` con `modulePermissions?: UserModulePermissions`**

- [ ] **Step 3: Verificar que `npx tsc --noEmit` pase sin errores**

- [ ] **Step 4: Commit**
```bash
git add src/types/purchases.ts src/types/index.ts
git commit -m "feat(types): add models for purchases, suppliers, bank accounts, and granular user permissions"
```

---

### Task 2: Motor de Compras, Parser XML SRI y Algoritmo de Retenciones

**Files:**
- Create: `src/lib/purchases-service.ts`
- Test: `scripts/test-purchases.mjs`

- [ ] **Step 1: Escribir el test en `scripts/test-purchases.mjs` comprobando:**
  - Parsing de un XML de Factura de Proveedor con SRI
  - Recálculo de costo promedio ponderado tras compra
  - Registro de retención electrónica en la fuente (1.75%) e IVA (30% / 70%)
  - Liquidación parcial de CxP con saldo remanente

- [ ] **Step 2: Ejecutar el test para verificar que falle (esperado por falta de implementación)**
```bash
node scripts/test-purchases.mjs
```

- [ ] **Step 3: Implementar `src/lib/purchases-service.ts` con:**
  - `parseSupplierSriXml(xmlString: string)`: extrae cabecera, RUC emisor, número de factura, clave de acceso, desglose de impuestos e ítems.
  - `calculatePurchaseTotals(items: PurchaseItem[])`: totalizador con bases imponibles 15% y 0%.
  - `calculateWithholdingAmounts(base15, base0, iva, rentaCode, ivaCode)`: cálculos tributarios SRI Ecuador.
  - `generateWithholdingAccessKey(params)`: 49 dígitos módulo 11 para retenciones.

- [ ] **Step 4: Ejecutar `node scripts/test-purchases.mjs` y verificar que pase 100%**

- [ ] **Step 5: Commit**
```bash
git add src/lib/purchases-service.ts scripts/test-purchases.mjs
git commit -m "feat(purchases): add SRI XML parser and tax withholding engine"
```

---

### Task 3: Motor de Permisos RBAC Granular (Módulos & Submódulos)

**Files:**
- Modify: `src/lib/permissions.ts`

- [ ] **Step 1: Extender `src/lib/permissions.ts` con:**
  - `DEFAULT_MODULE_PERMISSIONS_BY_ROLE`: configuración inicial de permisos por rol (`superadmin` todo activo, `admin`, `finanzas`, `tecnico`, `soporte`, `consulta`).
  - `canAccessModule(user: UserProfile, moduleKey: keyof UserModulePermissions): boolean`
  - `canAccessSubmodule(user: UserProfile, moduleKey: keyof UserModulePermissions, submoduleKey: string): boolean`
  - Actualizar `canAccessRoute(user: UserProfile, route: string)` para evaluar tanto roles legacy como `user.modulePermissions`.

- [ ] **Step 2: Probar con tests unitarios en `scripts/test-purchases.mjs` que verifiquen permisos granulares**

- [ ] **Step 3: Commit**
```bash
git add src/lib/permissions.ts scripts/test-purchases.mjs
git commit -m "feat(auth): implement granular module and submodule permissions engine"
```

---

### Task 4: Estado Global, Semillas de Proveedores, Bancos y Compras

**Files:**
- Modify: `src/lib/mock-data.ts`
- Modify: `src/lib/state.tsx`

- [ ] **Step 1: Agregar semillas en `src/lib/mock-data.ts`**:
  - Proveedores iniciales ecuatorianos: Carriers de tránsito IP, importadores de fibra óptica, distribuidores de routers/ONTs.
  - Cuentas bancarias de INNTEL CORP (Banco Pichincha, Banco Guayaquil, Caja Chica).
  - Compras muestra (una pagada de contado, una a crédito con saldo en CxP).
  - Usuarios iniciales con su configuración de `modulePermissions`.

- [ ] **Step 2: Integrar colecciones y métodos en `src/lib/state.tsx`**:
  - Colecciones: `suppliers`, `purchaseInvoices`, `supplierCreditNotes`, `supplierDebitNotes`, `purchaseWithholdings`, `bankAccounts`, `supplierPayments`.
  - Mutaciones:
    - `addSupplier`, `updateSupplier`, `deleteSupplier`
    - `addPurchaseInvoice`: Si tiene productos físicos, genera `PURCHASE_RECEIPT` en `inventoryKardex`, actualiza stock y costo promedio en `inventoryProducts`. Si fue contado, descuenta saldo en `bankAccounts` y crea un `FinancialMovement`. Si fue crédito, queda pendiente en CxP.
    - `addSupplierCreditNote`: Si incluye devolución física, genera `SUPPLIER_RETURN` en `inventoryKardex` y descuenta saldo en `purchaseInvoices`.
    - `addSupplierDebitNote`: Incrementa deuda en `purchaseInvoices`.
    - `addPurchaseWithholding`: Registra retención electrónica.
    - `addSupplierPayment`: Abona a factura de compra, actualiza saldo en CxP, crea movimiento de egreso en `financialMovements` y descuenta de la cuenta bancaria.
    - `addBankAccount`, `updateBankAccount`
    - `updateUserModulePermissions`: Actualiza la matriz granular de permisos para un usuario.

- [ ] **Step 3: Verificar TypeScript con `npx tsc --noEmit`**

- [ ] **Step 4: Commit**
```bash
git add src/lib/mock-data.ts src/lib/state.tsx
git commit -m "feat(state): integrate purchases, suppliers, bank accounts, cxp payments, and permissions"
```

---

### Task 5: Componentes del Módulo Compras (`/compras`)

**Files:**
- Create: `src/components/modules/purchases/PurchaseHistoryTab.tsx`
- Create: `src/components/modules/purchases/RegisterPurchaseModal.tsx`
- Create: `src/components/modules/purchases/SupplierCreditNotesTab.tsx`
- Create: `src/components/modules/purchases/SupplierDebitNotesTab.tsx`
- Create: `src/components/modules/purchases/PurchaseWithholdingsTab.tsx`
- Create: `src/components/modules/purchases/PurchasesManager.tsx`
- Create: `src/app/compras/page.tsx`

- [ ] **Step 1: Crear `RegisterPurchaseModal.tsx` con tabs Carga XML SRI del Proveedor y Formulario Manual, selector de bodega, condición de pago (Contado/Crédito) y autocompletado de productos**

- [ ] **Step 2: Crear `PurchaseHistoryTab.tsx` con buscador, filtros de pago/bodega, desglose de ítems, botones de acción y RIDE**

- [ ] **Step 3: Crear `SupplierCreditNotesTab.tsx` con soporte de devolución física a Kardex y reducción de deuda**

- [ ] **Step 4: Crear `SupplierDebitNotesTab.tsx` y `PurchaseWithholdingsTab.tsx` con emisor de retenciones SRI**

- [ ] **Step 5: Crear `PurchasesManager.tsx` implementando exactamente el menú y pestañas de la captura del usuario**:
  - `Historial de Compras`
  - `Registrar Compra`
  - `Notas de Crédito Recibidas`
  - `Notas de Débito Recibidas`
  - `Retenciones de Compras`

- [ ] **Step 6: Crear la página `src/app/compras/page.tsx` con protección de permisos por usuario**

- [ ] **Step 7: Verificar compilación limpia**

- [ ] **Step 8: Commit**
```bash
git add src/components/modules/purchases/ src/app/compras/page.tsx
git commit -m "feat(ui): implement complete Compras module with 5 submodules matching user design"
```

---

### Task 6: Reestructuración del Módulo Finanzas (`/finanzas`)

**Files:**
- Create: `src/components/modules/finance/MovementsTab.tsx`
- Create: `src/components/modules/finance/BankAccountsTab.tsx`
- Create: `src/components/modules/finance/AccountsReceivableTab.tsx`
- Create: `src/components/modules/finance/AccountsPayableTab.tsx`
- Create: `src/components/modules/finance/FinancialReportsTab.tsx`
- Modify: `src/components/modules/finance/FinanceDashboard.tsx`
- Modify: `src/app/finanzas/page.tsx`

- [ ] **Step 1: Crear `MovementsTab.tsx` para flujo cronológico de ingresos y egresos de caja y bancos**

- [ ] **Step 2: Crear `BankAccountsTab.tsx` para catálogo de cuentas bancarias y saldos disponibles**

- [ ] **Step 3: Crear `AccountsReceivableTab.tsx` para gestión de cobranzas de clientes y morosidad**

- [ ] **Step 4: Crear `AccountsPayableTab.tsx` con semáforo de vencimientos (Al día / Por Vencer / Vencida) y modal de Registrar Abono/Pago a proveedores**

- [ ] **Step 5: Crear `FinancialReportsTab.tsx` con resumen gráfico de ingresos vs egresos y distribución de gastos**

- [ ] **Step 6: Actualizar `src/app/finanzas/page.tsx` para ofrecer los 5 submódulos:**
  - `Movimientos`
  - `Bancos`
  - `Cuentas por Cobrar`
  - `Cuentas por Pagar`
  - `Reportes`

- [ ] **Step 7: Commit**
```bash
git add src/components/modules/finance/ src/app/finanzas/page.tsx
git commit -m "feat(finance): restructure Finanzas module into 5 submodules (Movimientos, Bancos, CxC, CxP, Reportes)"
```

---

### Task 7: Módulo Personas (`/clientes`) y Control de Usuarios Avanzado

**Files:**
- Create: `src/components/modules/clients/SuppliersManager.tsx`
- Create: `src/components/modules/clients/UsersManager.tsx`
- Create: `src/components/modules/clients/UserPermissionsModal.tsx`
- Modify: `src/app/clientes/page.tsx`

- [ ] **Step 1: Crear `SuppliersManager.tsx`**:
  - Directorio maestro de proveedores con RUC, datos de contacto, categoría, días de crédito y cuentas bancarias registradas.
  - Modales para agregar y editar proveedores.

- [ ] **Step 2: Crear `UserPermissionsModal.tsx`**:
  - Matriz interactiva de permisos con switches/checkboxes para cada módulo y cada submódulo (`Compras`, `Finanzas`, `Personas`, `Facturación`, `Inventarios`, `Red`, etc.).
  - Selector de roles rápidos que preconfiguran la matriz.

- [ ] **Step 3: Crear `UsersManager.tsx`**:
  - Listado de colaboradores/usuarios con avatar, rol, estado activo/inactivo, botón de gestión de permisos.
  - Acción rápida para activar o suspender usuarios.

- [ ] **Step 4: Actualizar `src/app/clientes/page.tsx`**:
  - Barra de navegación superior con 3 submódulos:
    - `Clientes` (Abonados de internet/telecomunicaciones y ficha 360°)
    - `Proveedores` (Directorio maestro)
    - `Usuarios / Equipo` (Control avanzado y permisos granulares)

- [ ] **Step 5: Commit**
```bash
git add src/components/modules/clients/ src/app/clientes/page.tsx
git commit -m "feat(persons): add Proveedores and advanced Usuarios control with granular permissions matrix"
```

---

### Task 8: Navegación Global (Sidebar) y Verificación Integral

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Actualizar `Sidebar.tsx`**:
  - Agregar enlace a `/compras` con ícono de compras y badge de cuentas por pagar pendientes.
  - Cambiar etiqueta de `/clientes` a `Personas` o `Clientes & Equipo` respetando permisos granulares.
  - Filtrar dinámicamente los módulos visibles según `user.modulePermissions[module].enabled`.

- [ ] **Step 2: Ejecutar suite de pruebas unitarias**:
```bash
node scripts/test-purchases.mjs
```

- [ ] **Step 3: Ejecutar build de producción**:
```bash
npm run build
```
  - Debe compilar todas las páginas estáticas (`/compras`, `/finanzas`, `/clientes`, `/facturacion`, `/inventarios`, etc.) con 0 errores de TypeScript y 0 warnings.

- [ ] **Step 4: Commit y push a origin/main**:
```bash
git add -A
git commit -m "feat: complete Phase 3 ERP Compras, Finanzas 5-submodules, and Personas with granular permissions"
git push origin main
```
