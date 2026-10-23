# Recurring Billing & Client Service Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el sistema integral de Facturación Recurrente (Mensual y Anual), filtro de clientes recurrentes vs. ocasionales, seguimiento granular de estado y facturabilidad por servicio individual, y centro de alertas de renovación con notificación en 1 clic por WhatsApp y Correo Electrónico.

**Architecture:**
- Extensión de `ClientService` y `Client` en `src/types/index.ts` para soportar periodicidad (`mensual`/`anual`), fecha de próxima renovación (`nextRenewalDate`), estado `por_renovar`/`inactivo`, bandera de inclusión en el ciclo actual (`isBillableInCurrentCycle`), motivo de no facturación y registro de notificaciones.
- Métodos de estado en `src/lib/state.tsx` (`addClientService`, `updateClientService`, `deleteClientService`, `renewClientService`, `emitRecurringInvoiceForClient`) sincronizados con Firestore y `localStorage`.
- Filtro de recurrencia en `ClientsTable.tsx` (`Todos`, `Recurrentes Mensuales`, `Recurrentes Anuales`, `Ocasionales`) e indicador de servicios activos/totales.
- Tabla interactiva de servicios contratados en `ClientContractTab.tsx` con switches directos (Activo/Inactivo, Facturable/No Facturado), creación de nuevos servicios para un cliente y botones de renovación/notificación.
- Nuevo módulo `RecurringBillingView.tsx` integrado en `BillingManager.tsx` (`/facturacion`) con pestaña **"Recurrentes & Renovaciones"** libre de ruido visual.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Lucide React, Firebase Firestore.

---

### Task 1: Extensión de Tipos (`ClientService` y `Client`) y Datos Iniciales

**Files:**
- Modify: `src/types/index.ts:41-110`
- Modify: `src/lib/mock-data.ts`

- [ ] **Step 1: Ampliar `ServiceStatus`, `ClientService` y `Client` en `src/types/index.ts`**

Agregar `ServiceBillingFrequency = "mensual" | "anual"`, estados `"inactivo"` y `"por_renovar"`, y campos de control de ciclo y renovación en `ClientService` y `Client`.

- [ ] **Step 2: Verificar compilación de tipos**

Run: `npx tsc --noEmit`  
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/lib/mock-data.ts
git commit -m "feat(types): extender ClientService y Client para facturacion recurrente y seguimiento de renovaciones"
```

---

### Task 2: Funciones de Gestión de Servicios y Facturación Recurrente en `src/lib/state.tsx`

**Files:**
- Modify: `src/lib/state.tsx`

- [ ] **Step 1: Implementar `addClientService`, `updateClientService`, `deleteClientService` y `renewClientService`**

En `src/lib/state.tsx`:
- `addClientService`: crea un nuevo servicio para un cliente con `isBillableInCurrentCycle: true`, `billingFrequency: "mensual"`, `nextRenewalDate` calculada y sincroniza con Firestore.
- `updateClientService`: actualiza cualquier campo del servicio (`status`, `isBillableInCurrentCycle`, `nonBillableReason`, `billingFrequency`, `nextRenewalDate`, `customPrice`, `lastNotificationSentAt`) y recalcula `totalActiveServices` del cliente.
- `deleteClientService`: elimina el servicio y actualiza el contador del cliente.
- `renewClientService`: avanza `nextRenewalDate` +1 mes (si es mensual) o +1 año (si es anual), establece `status: "activo"` y `isBillableInCurrentCycle: true`.

- [ ] **Step 2: Actualizar `generateMonthlyBillingBatch` y crear `emitRecurringInvoiceForClient`**

Filtrar estrictamente servicios donde `s.status === "activo" && s.isBillableInCurrentCycle !== false`. Si un cliente tiene 5 servicios y 1 está marcado como no facturado o inactivo, solo se facturan los 4 activos.

- [ ] **Step 3: Verificar con `npx tsc --noEmit`**

Run: `npx tsc --noEmit`  
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/state.tsx
git commit -m "feat(state): agregar metodos de control de servicios, renovacion y emision recurrente filtrada"
```

---

### Task 3: Filtro de Clientes Recurrentes vs. No Recurrentes en `ClientsTable.tsx`

**Files:**
- Modify: `src/components/modules/clients/ClientsTable.tsx`

- [ ] **Step 1: Añadir selector de recurrencia en la barra de herramientas de Clientes**

Opciones de filtro limpias:
- `all`: Todos los Clientes
- `recurrente_todos`: Todos los Recurrentes
- `mensual`: Recurrentes Mensuales
- `anual`: Recurrentes Anuales
- `ocasional`: Clientes Ocasionales (Sin Recurrencia)

- [ ] **Step 2: Mostrar badge de recurrencia y conteo de servicios activos vs. totales en la tabla**

Ejemplo visual limpio en la columna de estado/servicios: `4/5 facturables • Mensual`.

- [ ] **Step 3: Verificar con `npx tsc --noEmit`**

Run: `npx tsc --noEmit`  
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/clients/ClientsTable.tsx
git commit -m "feat(clients): agregar filtro de clientes recurrentes mensuales, anuales y ocasionales"
```

---

### Task 4: Seguimiento Individual de Servicios y Notificaciones en Ficha de Cliente (`ClientContractTab.tsx`)

**Files:**
- Modify: `src/components/modules/clients/ClientContractTab.tsx`

- [ ] **Step 1: Rediseñar la tabla de Servicios Contratados con controles en línea de 1 clic**

Para cada servicio del cliente:
- Selector de Frecuencia (`Mensual` / `Anual`).
- Fecha de Próxima Renovación con semáforo automático (`Al día`, `Por renovar`, `Vencido`).
- Selector de Estado (`Activo`, `Por Renovar`, `Inactivo`, `Suspendido`).
- Switch `Facturable` vs. `No Facturado` (si pasa a No Facturado, excluye el servicio del cobro del ciclo actual).
- Botones directos de **WhatsApp**, **Email** y **Renovar (+1 periodo)**.
- Botón `+ Añadir Servicio al Cliente` para registrar múltiples servicios por cliente de forma rápida y limpia.

- [ ] **Step 2: Verificar con `npx tsc --noEmit`**

Run: `npx tsc --noEmit`  
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/clients/ClientContractTab.tsx
git commit -m "feat(client-services): implementar control en linea de estado, facturabilidad y alertas whatsapp/email por servicio"
```

---

### Task 5: Centro de Facturación Recurrente y Renovaciones (`RecurringBillingView.tsx` + `BillingManager.tsx`)

**Files:**
- Create: `src/components/modules/billing/RecurringBillingView.tsx`
- Modify: `src/components/modules/billing/BillingManager.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Crear `RecurringBillingView.tsx` con diseño limpio y directo**

Incluye dos vistas conmutables sin sobrecarga:
1. **Lote de Facturación Recurrente (Mensual / Anual):**
   - Selector de Periodo (Mes y Año) y filtro de frecuencia (`Todos`, `Mensual`, `Anual`).
   - Tabla de clientes recurrentes mostrando: Servicios Activos Facturables, Servicios No Facturados/Pausados, Monto Subtotal + IVA = Total a Facturar, Estado en el periodo (`Pendiente` / `Facturado`), detalle expandible para encender/apagar cualquiera de los servicios del cliente antes de facturar, y botón `Emitir Factura` individual o en lote.
2. **Seguimiento de Renovaciones y Alertas (WhatsApp / Email):**
   - Filtros rápidos: `Todos`, `Por Renovar (≤ 15 días / Vencidos)`, `No Facturados Este Ciclo`, `Inactivos`.
   - Controles rápidos en línea para cambiar estado, marcar como No Facturado, enviar recordatorio por WhatsApp (`wa.me`) o Email (`mailto:`), y botón `Renovar Periodo`.

- [ ] **Step 2: Integrar pestaña `"recurrentes"` en `BillingManager.tsx` y `Sidebar.tsx`**

- [ ] **Step 3: Verificar con `npx tsc --noEmit` y `npm run build`**

Run: `npx tsc --noEmit`  
Run: `npm run build`  
Expected: Compilación limpia código 0.

- [ ] **Step 4: Commit & Push**

```bash
git add src/components/modules/billing/RecurringBillingView.tsx src/components/modules/billing/BillingManager.tsx src/components/layout/Sidebar.tsx
git commit -m "feat(billing): implementar centro de facturacion recurrente y seguimiento de renovaciones"
git push origin main
```
