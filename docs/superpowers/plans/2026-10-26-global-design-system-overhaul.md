# Plan de Implementación: Sistema de Diseño Global "Clean Enterprise" (Skote & Emilus Standard)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estandarizar y aligerar la experiencia visual UX/UI de TODO el sistema (15 módulos, 42 submódulos, 22 pestañas de fichas y 28 modales) aplicando la arquitectura visual de Skote y Emilus: erradicar tarjetas anidadas, homogeneizar tablas con anchos fijos y cabeceras neutrales, purgar contadores con paréntesis `(1)` y elevar la escala tipográfica a 12-14px legible con contraste profesional, garantizando que el 100% de la lógica de negocio y funcionalidades permanezcan intactas.

**Architecture:** 
- **Header Bar Standard:** Barra superior homogénea que integra título con icono temático, buscador, filtros y botón principal de acción a la derecha.
- **Single Card Canvas:** Cero tarjetas dentro de tarjetas; divisiones con `border-t border-[#f1f3f7]` o divisores tenues.
- **Master Table Standard:** `thead` en `#f8f9ff text-[#475569] 11px uppercase font-bold`, filas `py-3.5 px-4`, anchos porcentuales declarativos y badges suaves.
- **Kanban Card Standard:** Tarjetas blancas planas con borde `1px solid #eef0f3`, sombra `shadow-xs`, fecha en gris legible, badge de prioridad en soft-tint y avatares superpuestos.
- **Master Modal Standard:** Grid de 2 columnas, labels 12px `#475569`, focus ring `#004ac6`, pie estándar con botón cancelar neutro y botón principal azul.

**Tech Stack:** React 18, Next.js 14, Tailwind CSS, Lucide Icons, TypeScript, Node.js Test Runner.

---

### Task 1: FASE 1 — Plantillas & Ficha de Clientes (Solución Inmediata de Capturas)

**Files:**
- Modify: `src/components/modules/templates/TemplateGenerator.tsx`
- Modify: `src/components/modules/clients/ClientDossierTab.tsx`
- Modify: `src/components/modules/clients/ClientContractTab.tsx`
- Modify: `src/lib/end-to-end-flows.test.ts`

- [x] **Step 1: Balancear Anchos y Simetría en Módulo de Plantillas**
  - En `TemplateGenerator.tsx`:
    - Agregar icono temático `<FileText className="w-4 h-4 text-[#004ac6]" />` a `Plantillas del Sistema` para que coincida exactamente con `Plantillas Institucionales`.
    - Asignar anchos porcentuales fijos a las columnas de ambas tablas:
      - Tabla 1: `w-6/12` para Plantilla/Documento, `w-3/12` para Formato, `w-3/12` para Acción (alineado a la derecha).
      - Tabla 2: `w-4/12` para Documento, `w-2/12` para Categoría, `w-3/12` para Archivo, `w-2/12` para Última Actualización, `w-1/12` para Acciones.
    - Eliminar vacíos desproporcionados entre columnas.
    - Moderar border-radius a `rounded-xl` y `rounded-lg`.

- [x] **Step 2: Rediseñar Pestaña Identificación del Cliente (Cero Tarjetas Anidadas & Fuentes Legibles)**
  - En `ClientProfile360.tsx` y `ClientDossierTab.tsx`:
    - Erradicar el efecto de tarjetas anidadas; usar un único contenedor blanco continuo (`rounded-xl border border-[#e2e8f0] shadow-2xs`).
    - Bloque de Datos Fiscales en grid limpio de 3 columnas: cambiar etiquetas minúsculas de 10px a `text-xs font-semibold text-[#64748b]` y valores a `text-sm font-bold text-[#0b1c30]`.
    - Separar el Bloque de Contactos mediante un divisor tenue horizontal (`border-t border-[#f1f5f9]`).
    - Reemplazar la caja punteada tosca de contactos vacía por una fila limpia y ligera (`bg-[#f8f9ff] border border-[#e2e8f0] rounded-lg p-4`).

- [x] **Step 3: Rediseñar Pestaña Servicios del Cliente (Unificación & Flujo Plano)**
  - En `ClientContractTab.tsx`:
    - Homologar la barra de herramientas y tabla de servicios con badges suaves, anchos fijos de columna (`table-fixed`), precios tabulares y esquinas moderadas (`rounded-xl` y `rounded-lg`).
    - Homologar la sub-sección de Documentos al pie con tabla de layout fijo y modal limpio de carga `rounded-xl`.

- [x] **Step 4: Escribir Prueba E2E y Validar**
  - Añadir prueba en `src/lib/end-to-end-flows.test.ts` (Flujo E2E 24) que valide la simetría de Plantillas, ausencia de tarjetas anidadas y eliminación de micro-textos en la Ficha de Cliente.
  - Ejecutar `npm test` (49/49 pasando) y `npx tsc --noEmit`.
  - Commit y push al repositorio.

---

### Task 2: FASE 2 — Tablero Kanban de Proyectos & Cuadrillas (Réplica Exacta de la Captura)

**Files:**
- Modify: `src/components/modules/clients/ClientProjectKanban.tsx`
- Modify: `src/components/modules/projects/ProjectWorkspace.tsx`
- Modify: `src/lib/end-to-end-flows.test.ts`

- [ ] **Step 1: Aplicar Estilo Attex / Skote al Tablero Kanban**
  - Reemplazar fondos oscuros o bordes gruesos de las columnas por un fondo gris neutro muy suave (`#f4f5f7`), esquinas redondeadas y encabezado en semibold con badge suave de conteo sin paréntesis: `PENDIENTE` `[3]`.
  - Tarjetas de tareas en blanco puro (`#ffffff`), borde sutil de 1px (`border-[#eef0f3]`), sombra suave `shadow-xs`.
  - Fecha superior izquierda en gris legible (`#878a99`), badge de prioridad superior derecho en soft-tint (`Alto` en rosa suave, `Medio` en ámbar suave, `Bajo` en verde suave).
  - Título de tarea en navy oscuro nítido (13-14px).
  - Pie de tarjeta con avatares circulares superpuestos de los técnicos asignados y menú de tres puntos.

- [ ] **Step 2: Escribir Prueba E2E y Validar**
  - Validar estructura visual del Kanban sin paréntesis ruidosos y con badges suaves.
  - Ejecutar `npm test` y `npx tsc --noEmit`.
  - Commit: `git commit -m "refactor(projects): redesign Kanban board to modern light enterprise layout"`

---

### Task 3: FASE 3 — Homologación de Tablas Maestras y Barras de Filtros en Módulos Comerciales y Operativos

**Files:**
- Modify: `src/components/modules/clients/ClientsTable.tsx`
- Modify: `src/components/modules/sales/SalesManager.tsx`
- Modify: `src/components/modules/billing/BillingManager.tsx`
- Modify: `src/components/modules/purchases/PurchaseHistoryTab.tsx`
- Modify: `src/components/modules/purchases/PurchasesManager.tsx`
- Modify: `src/components/modules/inventory/InventoryManager.tsx`
- Modify: `src/lib/end-to-end-flows.test.ts`

- [ ] **Step 1: Directorio General de Clientes (`ClientsTable.tsx`)**
  - Mover el botón `+ Nuevo Cliente` dentro de la barra de filtros a la derecha.
  - Aplicar cabecera `#f8f9ff`, anchos proporcionales fijos y eliminar guiones `—` solitarios.

- [ ] **Step 2: Módulo Ventas (`SalesManager.tsx`)**
  - Estandarizar la tabla de Notas de Venta Comercial y Cotizaciones con el *Master Table Standard*.
  - Purgar cualquier texto con paréntesis `(X)`.

- [ ] **Step 3: Facturación SRI (`BillingManager.tsx`)**
  - Homologar tablas de los 5 comprobantes oficiales (Facturas 01, NC 04, ND 05, Retenciones 07, Guías 06).
  - Clave de Acceso en font-mono 11px con botón de copiado rápido y estado de autorización SRI en pastilla suave.

- [ ] **Step 4: Compras & Inventarios (`PurchasesManager.tsx` e `InventoryManager.tsx`)**
  - Aplicar cabecera estándar y anchos fijos a la tabla de facturas de compras y retenciones de proveedores.
  - Homologar el catálogo de productos y servicios con semáforo de stock suave en pastilla.

- [ ] **Step 5: Escribir Prueba E2E y Validar**
  - Ejecutar `npm test` y `npx tsc --noEmit`.
  - Commit: `git commit -m "refactor(tables): standardize master tables and filter bars across commercial modules"`

---

### Task 4: FASE 4 — Finanzas, ARCOTEL, Configuración, Personas, Trámites y Modales Globales

**Files:**
- Modify: `src/components/modules/finance/FinanceDashboard.tsx`
- Modify: `src/components/modules/finance/BankAccountsTab.tsx`
- Modify: `src/components/modules/arcotel/ArcotelManager.tsx`
- Modify: `src/components/modules/arcotel/PoliciesList.tsx`
- Modify: `src/components/modules/settings/GeneralSettingsView.tsx`
- Modify: `src/components/modules/settings/SriConfigView.tsx`
- Modify: `src/components/modules/clients/SuppliersManager.tsx`
- Modify: `src/components/modules/clients/UsersManager.tsx`
- Modify: `src/components/modules/tramites/TramitesManager.tsx`
- Modify: `src/lib/end-to-end-flows.test.ts`

- [ ] **Step 1: Finanzas & Bancos**
  - Tarjetas KPI en `FinanceDashboard.tsx` estilo Skote.
  - Tarjetas bancarias limpias en `BankAccountsTab.tsx` con montos tabulares legibles.

- [ ] **Step 2: ARCOTEL & Pólizas**
  - Pestañas planas superiores y tabla de pólizas con semáforo de días restantes en pastilla suave.

- [ ] **Step 3: Personas, Trámites y Configuración**
  - Homologar tablas de proveedores, usuarios y trámites Quipux.
  - Formularios de configuración general y SRI en 2 columnas limpias sin marcos dobles.

- [ ] **Step 4: Homologación de los 28 Modales del Sistema**
  - Revisar y garantizar que todos los modales utilicen el *Master Modal Standard* (labels 12px `#475569`, focus ring `#004ac6`, pie estándar).

- [ ] **Step 5: Verificación Integral Final**
  - Ejecutar suite completa de tests: `npm test` (50+ tests pasando).
  - Typecheck completo: `npx tsc --noEmit`.
  - Linting: `npm run lint`.
  - Compilación de producción: `npm run build`.
  - Commit y Push a GitHub origin main.
  - Verificar en vivo que GitHub Actions CI Pipeline complete en **verde (Success)**.
