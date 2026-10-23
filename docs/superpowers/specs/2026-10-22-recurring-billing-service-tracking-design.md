# Especificación Técnica: Facturación Recurrente (Mensual/Anual), Seguimiento de Servicios Contratados y Alertas de Renovación

**Fecha:** 22 de Octubre de 2026  
**Sistema:** INNTEL CORP ERP  
**Ruta del Archivo:** `docs/superpowers/specs/2026-10-22-recurring-billing-service-tracking-design.md`  
**Estado:** Diseño Aprobado (Opción A — Flujo Semi-automático)  

---

## 1. Resumen Ejecutivo y Objetivos

En INNTEL CORP conviven clientes con facturación ocasional (venta única de equipos o instalaciones) y clientes con **facturación recurrente (mensual o anual)** que poseen uno o múltiples servicios contratados simultáneamente.

### Problemática que resuelve este diseño:
1. **Diferenciación clara de clientes:** Filtrar al instante qué clientes son recurrentes (mensuales o anuales) frente a los clientes ocasionales sin recurrencia.
2. **Independencia por servicio contratado:** Si un cliente tiene 5 servicios contratados y este mes decide no continuar o pausar 1 de ellos, ese servicio específico pasa a estado **"No Facturado / Inactivo"** con un solo clic, facturándose únicamente los 4 servicios activos restantes.
3. **Control Semi-automático de Renovaciones (Opción A):** El sistema detecta automáticamente qué servicios están próximos a vencer o han llegado a su fecha de renovación, marcándolos visualmente como **"Por Renovar"**. El operador puede con 1 clic:
   - Enviar aviso de renovación por **WhatsApp** o **Correo Electrónico** con plantilla pre-llenada.
   - **Renovar Servicio** (extiende automáticamente la fecha de vencimiento +1 mes o +1 año y lo mantiene activo/facturable).
   - **Pasar a No Facturado / Inactivo** (lo excluye del ciclo de facturación actual sin borrar su historial).
4. **UX/UI Limpia y Directa:** Cero popups innecesarios, tablas institucionales despejadas, switches en línea de 1 clic y filtros rápidos sin ruido visual.

---

## 2. Modelo de Datos

### 2.1 Extensión de `ClientService` (`src/types/index.ts`)

Cada servicio contratado por un cliente incorpora propiedades de seguimiento de ciclo de facturación y renovación:

```typescript
export type ServiceBillingFrequency = "mensual" | "anual";
export type ServiceStatus = "activo" | "inactivo" | "por_renovar" | "suspendido" | "retirado" | "en_instalacion";

export interface ClientService {
  id: string;
  clientId: string;
  planId: string;
  planName: string;
  downloadMbps: number;
  uploadMbps: number;
  basePrice: number;
  customPrice: number;
  billingType: ServiceBillingType;
  billingFrequency?: ServiceBillingFrequency; // "mensual" (default) | "anual"
  cutoffDay: number;
  nodeId: string;
  nodeName: string;
  ipv4Address: string;
  ipv6Prefix?: string;
  pppoeUser: string;
  pppoePassword?: string;
  status: ServiceStatus;
  installationDate: string;
  nextRenewalDate?: string;       // YYYY-MM-DD: Fecha de próxima renovación
  lastBilledPeriod?: string;      // Ej: "2026-10" o "2026" para control anti-duplicados
  isBillableInCurrentCycle?: boolean; // true = se factura, false = "No Facturado" este ciclo
  nonBillableReason?: string;     // Ej: "No renovó este mes", "Pausa temporal"
  lastNotificationSentAt?: string; // Registro de último aviso WhatsApp/Email enviado
  installationAddress?: string;
  coordinates?: { lat: number; lng: number };
  ontSerialNumber?: string;
  notes?: string;
}
```

### 2.2 Clasificación de Clientes Recurrentes vs. No Recurrentes (`Client`)

Un cliente se identifica como recurrente mediante:
- Propiedad opcional en `Client`: `billingRecurrence?: "mensual" | "anual" | "ocasional"`.
- **Inferencia inteligente automática:** Si el cliente tiene servicios asociados en `clientServices` con estado `activo` o `por_renovar`, el sistema lo categoriza automáticamente según la frecuencia de sus servicios (`Mensual`, `Anual` o `Mixto`), y si no posee servicios periódicos se clasifica como `Ocasional`.

---

## 3. Diseño de Interfaz y Flujo de Usuario (UX Limpia y Sin Ruido)

### 3.1 Filtro en Directorio de Clientes (`ClientsTable.tsx`)

En la barra de búsqueda del listado general de clientes se añade un selector limpio de modalidad:
- `Todos los Clientes`
- `Recurrentes ( Todos )`
- `Recurrentes Mensuales`
- `Recurrentes Anuales`
- `Clientes Ocasionales (Sin Recurrencia)`

Cada fila de cliente muestra de forma discreta cuántos servicios activos facturables tiene vs. su total de servicios (ej. `4/5 activos • Mensual`).

### 3.2 Seguimiento de Servicios dentro de la Ficha del Cliente (`ClientContractTab.tsx`)

En la pestaña de Servicios y Contratos del cliente se presenta una tabla directa con controles en línea:

| Columna | Contenido y Acción Directa |
| :--- | :--- |
| **Servicio / Detalle Técnico** | Nombre del servicio/plan, velocidad o descripción e IP/Nodo. |
| **Frecuencia & Tarifa** | Selector rápido `Mensual` / `Anual` y valor acordado (`$XX.XX`). |
| **Próxima Renovación** | Fecha editable (`YYYY-MM-DD`) + badge semántico automático:<br>• 🟢 **Al día** (> 15 días)<br>• 🟡 **Por renovar** (≤ 15 días)<br>• 🔴 **Vencido** (fecha superada) |
| **Estado del Servicio** | Selector directo en línea: `Activo` \| `Por Renovar` \| `Inactivo` \| `Suspendido`. |
| **Estado de Facturación** | Switch directo: **`Facturable`** (Verde) vs. **`No Facturado`** (Gris/Ámbar).<br>Al apagarlo, excluye este servicio de la factura del mes actual. |
| **Notificar / Renovar** | • Botón **WhatsApp**: Abre WhatsApp con mensaje personalizado de renovación.<br>• Botón **Email**: Envía/abre correo formal de aviso.<br>• Botón **Renovar (+1 periodo)**: Avanza la fecha de vencimiento 1 mes o 1 año y marca como `Activo` y `Facturable`. |

### 3.3 Centro de Facturación Recurrente y Renovaciones (`RecurringBillingView.tsx` en `/facturacion`)

Dentro del módulo de **Facturación (`/facturacion`)**, se incorpora la pestaña **"Recurrentes & Renovaciones"**, organizada en dos vistas conmutables mediante un selector limpio:

#### Vista 1: Emisión de Facturación Recurrente (Por Cliente)
Muestra los clientes con servicios recurrentes para el periodo seleccionado (ej. `Octubre 2026`):
- **Resumen del Cliente:** Razón social, RUC, Frecuencia (`Mensual` / `Anual`).
- **Servicios Incluidos vs. Excluidos:**
  - Muestra claramente: *"4 servicios a facturar ($180.00) • 1 servicio No Facturado"*.
  - Permite desplegar la fila del cliente para activar/desactivar con un clic cualquiera de sus 5 servicios antes de generar la factura.
- **Estado en el Periodo:** Badge `Pendiente de Emitir` o `Facturado (001-001-000000123)`.
- **Acción Directa:** Botón **`Facturar Periodo`** que precarga o emite la factura electrónica SRI únicamente con los servicios marcados como `Facturable` y registra el cargo en Cuentas por Cobrar (`monthlyCharges`).

#### Vista 2: Seguimiento Global de Servicios y Renovaciones
Una tabla consolidada de todos los servicios de todos los clientes con filtros rápidos en píldoras:
- `[ Todos ]`
- `[ Por Renovar / Vencen en ≤ 15 días ]`
- `[ No Facturados Este Ciclo ]`
- `[ Inactivos / Pausados ]`
- `[ Mensuales ]` / `[ Anuales ]`

Desde cada fila el operador puede:
1. Cambiar estado (`Activo` ⇄ `Inactivo`).
2. Pasar a `No Facturado` o reactivar a `Facturable`.
3. Enviar recordatorio de renovación por **WhatsApp** o **Correo** (registrando fecha de último aviso).
4. Confirmar **Renovación** con 1 clic.

---

## 4. Plantillas Automáticas de Notificación (WhatsApp y Email)

Cuando el usuario pulsa el botón de **WhatsApp** o **Email** en un servicio próximo a vencer o vencido:

### Mensaje WhatsApp Pre-formateado:
> *"Estimado(a) *{client.businessName}*, le saludamos de *INNTEL CORP S.A.* Le informamos que su servicio contratado *{service.planName}* ({service.billingFrequency}) tiene fecha de renovación el *{service.nextRenewalDate}* por un valor de *${service.customPrice.toFixed(2)} + IVA*. Por favor confírmenos la continuidad del servicio para proceder con la facturación correspondiente. Quedamos atentos a sus comentarios."*

- Limpia el número telefónico del cliente (convirtiendo `09...` a formato internacional `5939...`).
- Registra en el servicio `lastNotificationSentAt` para mostrar un indicador sutil *"Notificado hoy"* y evitar que dos operadores envíen el mismo mensaje por duplicado.

---

## 5. Mitigación de Errores y Reglas de Integridad

1. **Cálculo Exacto de Factura:** Si un cliente tiene 5 servicios y 1 está en `status !== "activo"` o `isBillableInCurrentCycle === false`, el generador de factura recurrente filtra estrictamente `s.status === "activo" && s.isBillableInCurrentCycle !== false`. Si un cliente tiene 0 servicios facturables en el mes, el botón de facturar se deshabilita indicando *"Sin servicios facturables activos"*.
2. **Prevención de Doble Facturación:** Una vez emitida la factura del periodo para un cliente, sus servicios facturados actualizan `lastBilledPeriod` (ej. `"2026-10"`) y la fila muestra el número de factura emitida, impidiendo duplicar el cobro accidentalmente.
3. **Persistencia Inmediata:** Todo cambio de switch (`Activo/Inactivo` o `Facturable/No Facturado`) actualiza inmediatamente el estado global y sincroniza con Firestore mediante `updateClientService`.
