# Plan de Implementación: Separación de Ventas Comerciales vs Facturación Electrónica SRI y Baja Integral de Clientes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar el proceso comercial diario (Notas de Venta operativas en `/ventas`) del módulo fiscal de Facturación Electrónica SRI con los 5 documentos reglamentarios en `/facturacion`, agregar el botón "Pasar a Factura Electrónica" en cada nota de venta, y habilitar la opción de eliminación completa de clientes en la tabla y en la ficha 360°.

**Architecture:** Módulo `/ventas` enfocado en gestión comercial ágil (descuenta bodega y cobra en banco sin fricción de webservices SRI). Cada Nota de Venta puede ser promovida a Factura Electrónica SRI bajo demanda sin duplicar stock ni asientos contables. Módulo `/facturacion` dedicado exclusivamente a los 5 comprobantes oficiales del SRI (01 Factura, 04 Nota de Crédito, 05 Nota de Débito, 07 Retención, 06 Guía de Remisión) y firma digital `.p12`. Incorporación de botón destructivo seguro de baja de cliente en `ClientProfile360.tsx` y `ClientsTable.tsx` con cascada en Firestore.

**Tech Stack:** Next.js 14 App Router, TypeScript, TailwindCSS, Lucide Icons, Firestore SDK, SRI WebService / Módulo 11, Node.js Native Test Runner.

---

### Task 1: Opción de Eliminación Completa de Clientes en Ficha 360° y Tabla

- [ ] **Paso 1.1:** En `src/components/modules/clients/ClientProfile360.tsx`, agregar el botón `"Eliminar Cliente"` en el encabezado principal (Hub Header) junto al botón `"Editar"`, con icono `Trash2` y estilo de alerta destructiva.
- [ ] **Paso 1.2:** En `ClientProfile360.tsx`, implementar el modal de confirmación segura para la baja del cliente que invoque `deleteClient(client.id)`, emita notificación toast de éxito y cierre la ficha volviendo al listado.
- [ ] **Paso 1.3:** En `src/components/modules/clients/ClientsTable.tsx`, asegurar que el modal de confirmación permita al administrador forzar la eliminación de clientes de prueba o registros duplicados incluso si existen saldos pendientes o servicios demo registrados.
- [ ] **Paso 1.4:** En `src/lib/state.tsx`, verificar que `deleteClient` limpie en cascada `clients`, `clientServices`, `clientProjects`, `clientQuotes`, `clientVaultItems`, `clientContracts` y `clientDocuments`, y registre auditoría con `"DELETE_CLIENT"`.

---

### Task 2: Definición de Tipos, Permisos y Navegación en Sidebar

- [ ] **Paso 2.1:** En `src/types/purchases.ts`, actualizar `UserModulePermissions` para incluir el módulo `ventas` con submódulos `notas_venta`, `nueva_venta`, `cotizaciones`, `recurrentes`.
- [ ] **Paso 2.2:** En `src/types/purchases.ts`, actualizar los submódulos de `facturacion` para los 5 comprobantes: `facturas`, `notas_credito`, `notas_debito`, `retenciones`, `guias_remision`.
- [ ] **Paso 2.3:** En `src/lib/permissions.ts`, añadir mapeo de ruta `"/ventas": "ventas"` y habilitar permisos por defecto para roles operativos y administrativos.
- [ ] **Paso 2.4:** En `src/components/layout/Sidebar.tsx`, reestructurar `NAV_ITEMS`:
  - **Ventas** (`/ventas`): Notas de Venta, Nueva Venta, Cotizaciones, Recurrentes.
  - **Compras** (`/compras`): Facturas Proveedor, Nueva Compra, Notas de Crédito, Notas de Débito, Retenciones.
  - **Facturación Electrónica** (`/facturacion`): Facturas, Notas de Crédito, Notas de Débito, Retenciones, Guías de Remisión.

---

### Task 3: Creación del Módulo Comercial de Ventas (`/ventas`)

- [ ] **Paso 3.1:** Crear la ruta de página `src/app/ventas/page.tsx` con soporte de parámetros de búsqueda (`?sub=notas_venta | nueva_venta | cotizaciones | recurrentes`).
- [ ] **Paso 3.2:** Crear el componente gestor `src/components/modules/sales/SalesManager.tsx` que centralice:
  - Listado de Notas de Venta comerciales con buscador, filtros de fecha y estado (`Todas`, `Pendientes SRI`, `Facturadas SRI`).
  - Botón "Nueva Nota de Venta" que abra `NewSaleModal` preconfigurado en modo Nota de Venta comercial.
  - Pestañas para Cotizaciones comerciales (`cotizaciones`) y Ventas Recurrentes (`recurrentes`).
- [ ] **Paso 3.3:** En la tabla de Notas de Venta de `SalesManager.tsx`, incluir las acciones:
  - Imprimir Nota de Venta / Ticket RIDE.
  - Editar Nota de Venta (`EditSaleModal`).
  - Eliminar Nota de Venta (`deleteInvoice` con reversión de inventario y caja).
  - **"Pasar a Factura Electrónica SRI"** (botón con icono `FileCheck2` o `Send`).

---

### Task 4: Acción "Pasar a Factura Electrónica SRI" desde Nota de Venta

- [ ] **Paso 4.1:** Crear el componente modal `src/components/modules/sales/ConvertToSriInvoiceModal.tsx`:
  - Recibe la Nota de Venta comercial seleccionada.
  - Carga automáticamente los ítems, precios, subtotales e impuestos (15% o 0%).
  - Valida que el cliente tenga RUC o Cédula válida (no Consumidor Final si el valor supera $50 segun normativa SRI) y correo electrónico.
  - Permite seleccionar establecimiento, punto de emisión y forma de pago SRI.
- [ ] **Paso 4.2:** En `src/lib/state.tsx`, implementar `convertSaleToSriInvoice(saleInvoiceId: string, customData?: Partial<SriInvoice>)`:
  - Genera el comprobante electrónico Tipo 01 oficial con clave de acceso SRI de 49 dígitos.
  - Marca `kardexRegistered: false` en la nueva factura electrónica para evitar duplicar la salida de bodega que ya ejecutó la nota de venta.
  - Vincula la Nota de Venta original: `sale.sriInvoiceId = newInvoice.id` y `sale.sriStatus = "facturada"`.
  - Sincroniza en Firestore y actualiza el estado global.

---

### Task 5: Módulo de Facturación Electrónica SRI con los 5 Documentos

- [ ] **Paso 5.1:** En `src/lib/sri-service.ts`, crear la función `generarNotaDebitoXml` (Comprobante Tipo 05 del SRI) para liquidar intereses o penalidades contractuales.
- [ ] **Paso 5.2:** En `src/types/billing.ts`, definir la interfaz `DebitNote` para Notas de Débito electrónicas oficiales del SRI.
- [ ] **Paso 5.3:** En `src/components/modules/billing/DebitNoteModal.tsx`, crear el modal de emisión de Nota de Débito electrónica.
- [ ] **Paso 5.4:** En `src/components/modules/billing/BillingManager.tsx`, estructurar las 5 pestañas oficiales del SRI:
  1. Facturas Electrónicas (01)
  2. Notas de Crédito (04)
  3. Notas de Débito (05)
  4. Comprobantes de Retención (07)
  5. Guías de Remisión (06)
  + Acceso a Configuración de Firma Electrónica `.p12` y Ambiente SRI.

---

### Task 6: Pruebas Automatizadas y Verificación de Compilación

- [ ] **Paso 6.1:** En `src/lib/end-to-end-flows.test.ts`, escribir:
  - `Flujo E2E 7: Emisión de Nota de Venta Comercial y Promoción a Factura Electrónica SRI (Cero Duplicidad)`.
  - `Flujo E2E 8: Generación y Validación de los 5 Comprobantes Oficiales del SRI (Factura, NC, ND, Retención, Guía)`.
  - `Flujo E2E 9: Baja Completa de Cliente y Purga en Cascada de Servicios y Bóveda`.
- [ ] **Paso 6.2:** Ejecutar `npm test` y verificar que los 32+ tests pasen al 100%.
- [ ] **Paso 6.3:** Ejecutar `npx tsc --noEmit` y `npm run build` para certificar 0 errores de compilación estática.
- [ ] **Paso 6.4:** Realizar commit y push a `origin/main` en GitHub.
