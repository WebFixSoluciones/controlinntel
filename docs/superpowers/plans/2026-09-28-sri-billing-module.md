# Plan de Implementación: Fase 2 - Facturación & Emisión Electrónica SRI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo de Facturación y Emisión Electrónica SRI para INNTEL CORP, con generación de clave de acceso de 49 dígitos (módulo 11), facturas de venta con consumo automático de stock en bodegas, RIDE PDF oficial, cotizaciones convertibles a factura, notas de crédito con devolución a inventario, retenciones y guías de remisión.

**Architecture:** Módulo fuertemente tipado en TypeScript (`src/types/billing.ts`), motor tributario SRI Ecuador (`src/lib/sri-service.ts`), integración con el estado global reactivo (`src/lib/state.tsx`) vinculando Kardex y bodegas, visor e impresor oficial RIDE (`RidePreviewModal.tsx`), componentes modulares en `src/components/modules/billing/` y ruta `/facturacion` protegida en el Sidebar.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide React, Firebase Firestore, LocalStorage fallback.

---

### Task 1: Definición de Tipos TypeScript para Facturación SRI

**Files:**
- Create: `src/types/billing.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1.1**: Crear `src/types/billing.ts` con interfaces completas:
  - `SriDocumentType`: `"factura" | "nota_credito" | "nota_debito" | "retencion" | "guia_remision" | "cotizacion"`
  - `SriEnvironment`: `"1" | "2"` (1: Pruebas, 2: Producción)
  - `SriCompanyConfig`: RUC, razón social, establecimiento, punto emisión, dirección matriz, obligado a contabilidad, tipo contribuyente.
  - `InvoiceItem`: productId, sku, name, unit, quantity, unitPrice, discount, ivaRate, subtotal, ivaAmount, total, warehouseId.
  - `SriInvoice`: id, documentNumber, claveAcceso, date, clientId, clientName, clientRuc, clientEmail, clientAddress, items, subtotal15, subtotal0, subtotalNoObjeto, discountTotal, ivaTotal, total, paymentMethod, status (`"borrador" | "emitida" | "autorizada" | "anulada"`), warehouseId, kardexRegistered.
  - `ClientQuote`: cotización con items, validez, estado (`"borrador" | "enviada" | "aprobada" | "facturada" | "rechazada"`).
  - `CreditNote`: nota de crédito vinculada a factura, motivo, items devueltos, clave de acceso SRI.
  - `WithholdingReceipt`: retención con base imponible, código impuesto, porcentaje, valor retenido.
  - `RemissionGuide`: guía de remisión con transportista, placa, ruta y motivo de traslado.
- [ ] **Step 1.2**: Re-exportar todos los tipos en `src/types/index.ts`.
- [ ] **Step 1.3**: Validar con `npx tsc --noEmit`.
- [ ] **Step 1.4**: Commit a git.

---

### Task 2: Motor Tributario SRI Ecuador & Clave de Acceso 49 Dígitos

**Files:**
- Create: `src/lib/sri-service.ts`

- [ ] **Step 2.1**: Implementar validador estricto de RUC y Cédula de Ecuador (`validarIdentificacionEcuador`).
- [ ] **Step 2.2**: Implementar algoritmo de dígito verificador Módulo 11 (`calcularModulo11`).
- [ ] **Step 2.3**: Implementar generador de Clave de Acceso de 49 dígitos reglamentaria (`generarClaveAccesoSRI`).
- [ ] **Step 2.4**: Implementar conversor de números a letras para el RIDE (`numeroALetrasDolares`).
- [ ] **Step 2.5**: Implementar generador de estructura XML para Facturas y Notas de Crédito SRI (esquema XSD v1.1.0).
- [ ] **Step 2.6**: Definir configuración de emisor predeterminado para INNTEL CORP S.A. (`DEFAULT_INNTEL_SRI_CONFIG`).
- [ ] **Step 2.7**: Validar con `npx tsc --noEmit`.
- [ ] **Step 2.8**: Commit a git.

---

### Task 3: Semillas Iniciales de Facturación y Emisor

**Files:**
- Modify: `src/lib/mock-data.ts`

- [ ] **Step 3.1**: Agregar `INITIAL_SRI_CONFIG` con datos de INNTEL CORP S.A. (RUC 1792458921001, Establecimiento 001, Punto 001).
- [ ] **Step 3.2**: Crear `INITIAL_INVOICES` con facturas de prueba emitidas con clave de 49 dígitos válida.
- [ ] **Step 3.3**: Crear `INITIAL_BILLING_QUOTES` con cotizaciones de prueba para clientes de telecomunicaciones.
- [ ] **Step 3.4**: Crear `INITIAL_CREDIT_NOTES`, `INITIAL_WITHHOLDINGS`, y `INITIAL_REMISSION_GUIDES`.
- [ ] **Step 3.5**: Validar con `npx tsc --noEmit`.
- [ ] **Step 3.6**: Commit a git.

---

### Task 4: Integración del Estado Global en `src/lib/state.tsx` & Permisos

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `src/lib/state.tsx`

- [ ] **Step 4.1**: Agregar colecciones de facturación en `collectionPermissions` (`billingInvoices`, `billingQuotes`, `billingCreditNotes`, `billingWithholdings`, `billingRemissionGuides`, `sriCompanyConfig`) y ruta `/facturacion`.
- [ ] **Step 4.2**: Incorporar estados en `src/lib/state.tsx` con persistencia en Firestore y LocalStorage.
- [ ] **Step 4.3**: Implementar método `createInvoice(data)`:
  - Genera clave de acceso de 49 dígitos.
  - Afecta automáticamente el inventario: registra salida `SALE` en el Kardex de la bodega seleccionada y descuenta el stock de los productos físicos.
  - Genera registro contable en `monthlyCharges` si aplica para seguimiento de cobro.
- [ ] **Step 4.4**: Implementar método `convertQuoteToInvoice(quoteId, warehouseId)` para transformar proforma en factura con consumo de stock.
- [ ] **Step 4.5**: Implementar método `createCreditNote(data)`:
  - Genera clave de acceso SRI para la nota de crédito.
  - Reingresa los productos seleccionados al inventario de la bodega vía Kardex tipo `CUSTOMER_RETURN`.
- [ ] **Step 4.6**: Implementar métodos para cotizaciones, retenciones, guías de remisión y actualización de config SRI.
- [ ] **Step 4.7**: Validar con `npx tsc --noEmit`.
- [ ] **Step 4.8**: Commit a git.

---

### Task 5: Componente RIDE PDF & Modal de Impresión

**Files:**
- Create: `src/components/modules/billing/RidePreviewModal.tsx`

- [ ] **Step 5.1**: Crear diseño oficial de RIDE tipo SRI con maquetación A4 para impresión limpia (`window.print()`).
- [ ] **Step 5.2**: Renderizado de código de barras simulado con clave de 49 dígitos, RUC del emisor, matriz, establecimiento y régimen tributario.
- [ ] **Step 5.3**: Tabla de ítems con desglose de código, cantidad, precio unitario, descuento, IVA y total.
- [ ] **Step 5.4**: Cuadro resumen de subtotales 15%, 0%, no objeto, IVA 15%, total y leyenda en letras ("SON: X DÓLARES").
- [ ] **Step 5.5**: Tabla de formas de pago oficiales SRI (01 Sin utilización sistema financiero, 19 Tarjeta, 20 Otros con utilización sistema financiero).
- [ ] **Step 5.6**: Soporte de descarga en formato XML y botón directo de impresión.
- [ ] **Step 5.7**: Validar con `npx tsc --noEmit`.
- [ ] **Step 5.8**: Commit a git.

---

### Task 6: Modales Operativos de Facturación

**Files:**
- Create: `src/components/modules/billing/NewSaleModal.tsx`
- Create: `src/components/modules/billing/BillingQuoteModal.tsx`
- Create: `src/components/modules/billing/CreditNoteModal.tsx`
- Create: `src/components/modules/billing/RemissionGuideModal.tsx`
- Create: `src/components/modules/billing/SriConfigModal.tsx`

- [ ] **Step 6.1**: Crear `NewSaleModal.tsx`:
  - Selector de cliente con búsqueda rápida (o Consumidor Final).
  - Selector de bodega de donde se despachan los productos.
  - Buscador y selector de productos físicos (con indicador de stock en bodega) y servicios.
  - Tabla de líneas de venta con cantidades, precios, descuentos y tarifa IVA 15%.
  - Selección de método de pago (Efectivo, Transferencia, Tarjeta).
  - Cálculo en tiempo real de subtotales e impuestos.
- [ ] **Step 6.2**: Crear `BillingQuoteModal.tsx`: Generación y edición de cotizaciones formales.
- [ ] **Step 6.3**: Crear `CreditNoteModal.tsx`: Generación de nota de crédito vinculada a factura, selección de ítems y motivo de anulación/devolución.
- [ ] **Step 6.4**: Crear `RemissionGuideModal.tsx`: Guía de remisión para transporte de fibra y routers.
- [ ] **Step 6.5**: Crear `SriConfigModal.tsx`: Formulario para editar datos del emisor SRI.
- [ ] **Step 6.6**: Validar con `npx tsc --noEmit`.
- [ ] **Step 6.7**: Commit a git.

---

### Task 7: Módulo Principal `BillingManager.tsx`

**Files:**
- Create: `src/components/modules/billing/BillingManager.tsx`

- [ ] **Step 7.1**: Cabecera ejecutiva con KPIs: Total Facturado en el Mes ($), Facturas Emitidas, Cotizaciones Pendientes, Notas de Crédito, IVA 15% Recaudado.
- [ ] **Step 7.2**: Navegación por sub-pestañas:
  - `Facturas`: Historial con filtros por fecha, cliente, estado SRI y botones para RIDE, XML y Nota de Crédito.
  - `Cotizaciones`: Listado con acción de "Convertir a Factura".
  - `Notas de Crédito`: Listado de notas de crédito emitidas con trazabilidad de factura origen.
  - `Retenciones`: Historial de comprobantes de retención.
  - `Guías de Remisión`: Historial de traslados de mercadería.
  - `Configuración SRI`: Visualizador del emisor actual.
- [ ] **Step 7.3**: Filtros y búsqueda en tiempo real.
- [ ] **Step 7.4**: Validar con `npx tsc --noEmit`.
- [ ] **Step 7.5**: Commit a git.

---

### Task 8: Ruta de la Aplicación y Navegación en `Sidebar.tsx`

**Files:**
- Create: `src/app/facturacion/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 8.1**: Crear página `src/app/facturacion/page.tsx` integrando `BillingManager`.
- [ ] **Step 8.2**: Agregar `/facturacion` a `NAV_ITEMS` en `Sidebar.tsx` con icono `Receipt`.
- [ ] **Step 8.3**: Validar con `npx tsc --noEmit`.
- [ ] **Step 8.4**: Commit a git.

---

### Task 9: Verificación Completa y Build de Producción

**Files:**
- Complete project verification

- [ ] **Step 9.1**: Ejecutar `npx tsc --noEmit` asegurando 0 errores.
- [ ] **Step 9.2**: Ejecutar `npm run build` asegurando compilación estática limpia de la ruta `/facturacion`.
- [ ] **Step 9.3**: Probar la emisión de una factura y comprobar que descuente stock en bodega y genere la clave de 49 dígitos.
- [ ] **Step 9.4**: Push a la rama `main`.
