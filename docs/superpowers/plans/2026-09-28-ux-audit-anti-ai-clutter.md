# Auditoría de UX, Flujo de Procesos y Eliminación de Saturación IA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auditar el sistema para eliminar elementos repetitivos, textos explicativos innecesarios y widgets flotantes que saturen la pantalla denotando "hecho por IA", reemplazando alertas nativas del navegador por popups/modals y garantizando un flujo de proceso claro donde el usuario nunca se desoriente.

**Architecture:** Limpieza de widgets flotantes redundantes en las 12 rutas principales; reemplazo de diálogos nativos (`alert`, `confirm`, `prompt`) por el sistema de popups (`useToast` con `showConfirm`, `showInfo`, `showSuccess`); consolidación de barras de herramientas (toolbars) en Compras, Finanzas y Personas para eliminar tarjetas de encabezado descriptivas duplicadas.

**Tech Stack:** Next.js 14 App Router, TypeScript estricto, Tailwind CSS, Lucide React, Toast / Modal Context.

---

### Task 1: Erradicar el Widget Flotante de IA (`GeminiAssistantWidget`) de las 12 Rutas
Eliminar el botón flotante permanente con destello y texto de IA que cubre tablas y controles en la esquina inferior derecha.

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/arcotel/page.tsx`
- Modify: `src/app/boveda/page.tsx`
- Modify: `src/app/clientes/page.tsx`
- Modify: `src/app/compras/page.tsx`
- Modify: `src/app/configuracion/page.tsx`
- Modify: `src/app/facturacion/page.tsx`
- Modify: `src/app/finanzas/page.tsx`
- Modify: `src/app/inventarios/page.tsx`
- Modify: `src/app/plantillas/page.tsx`
- Modify: `src/app/proyectos/page.tsx`
- Modify: `src/app/tickets/page.tsx`

- [x] **Step 1: Remover import y etiqueta `<GeminiAssistantWidget />` en las 12 páginas de `src/app/`**
- [x] **Step 2: Verificar compilación preliminar**
- [x] **Step 3: Commit**

---

### Task 2: Erradicar Diálogos Nativos (`alert`, `confirm`, `prompt`) y Centralizar en Popups
Reemplazar todos los llamados a diálogos del navegador con alertas en popup (`useToast`).

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/modules/settings/RecordManager.tsx`
- Modify: `src/components/modules/vault/SecureVault.tsx`
- Modify: `src/components/modules/arcotel/ArcotelManager.tsx`

- [x] **Step 1: Actualizar `Header.tsx`**: Usar `showInfo` para ayuda institucional y `showConfirm` para reiniciar base de datos.
- [x] **Step 2: Actualizar `RecordManager.tsx`**: Usar `showConfirm` para confirmación de eliminación.
- [x] **Step 3: Actualizar `SecureVault.tsx`**: Usar `showConfirm` para confirmación de borrado de credenciales.
- [x] **Step 4: Actualizar `ArcotelManager.tsx`**: Reemplazar `prompt()` por formulario inline/modal limpio para agregar atributos regulatorios.
- [x] **Step 5: Commit**

---

### Task 3: Optimizar Flujo y Eliminar Tarjetas Redundantes en Módulo de Compras
Eliminar el estado de pantalla vacía en "Registrar Compra" y unificar toolbars en notas de crédito, débito y retenciones.

**Files:**
- Modify: `src/components/modules/purchases/PurchasesManager.tsx`
- Modify: `src/components/modules/purchases/SupplierCreditNotesTab.tsx`
- Modify: `src/components/modules/purchases/SupplierDebitNotesTab.tsx`
- Modify: `src/components/modules/purchases/PurchaseWithholdingsTab.tsx`

- [x] **Step 1: Refactorizar `PurchasesManager.tsx`**: Abrir modal directamente al pulsar "Registrar Compra" manteniendo la vista activa en `historial_compras` sin pantallas intermedias ni tarjetas explicativas con rebote.
- [x] **Step 2: Refactorizar `SupplierCreditNotesTab.tsx`**: Fusionar encabezado y buscador en un solo toolbar limpio.
- [x] **Step 3: Refactorizar `SupplierDebitNotesTab.tsx`**: Fusionar encabezado y buscador en un solo toolbar limpio.
- [x] **Step 4: Refactorizar `PurchaseWithholdingsTab.tsx`**: Fusionar encabezado y buscador en un solo toolbar limpio.
- [x] **Step 5: Commit**

---

### Task 4: Optimizar Toolbars en Finanzas y Personas
Eliminar repeticiones de textos descriptivos y unificar barras de búsqueda y acciones.

**Files:**
- Modify: `src/components/modules/finance/BankAccountsTab.tsx`
- Modify: `src/components/modules/clients/SuppliersManager.tsx`
- Modify: `src/components/modules/clients/UsersManager.tsx`

- [x] **Step 1: Refactorizar `BankAccountsTab.tsx`**: Consolidar panel de acciones y balance sin textos redundantes.
- [x] **Step 2: Refactorizar `SuppliersManager.tsx`**: Toolbar cohesivo con buscador, selector de categoría y botón de añadir.
- [x] **Step 3: Refactorizar `UsersManager.tsx`**: Toolbar cohesivo con buscador y botón de nuevo usuario.
- [x] **Step 4: Commit**

---

### Task 5: Verificación Integral
- [x] **Step 1: Ejecutar verificación de tipos TypeScript (`npx tsc --noEmit`)**
- [x] **Step 2: Ejecutar tests unitarios (`npx tsx scripts/test-purchases.ts`)**
- [x] **Step 3: Ejecutar build de producción (`npm run build`)**
- [x] **Step 4: Commit y push a `origin/main`**
