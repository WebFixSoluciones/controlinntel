# Especificación Técnica: Arquitectura de Roles, Permisos Granulares (RBAC + Overrides) y Gestión Integral de Usuarios en Pantalla Completa

**Fecha:** 22 de Octubre de 2026  
**Sistema:** INNTEL CORP ERP  
**Ruta del Archivo:** `docs/superpowers/specs/2026-10-22-rbac-granular-permissions-design.md`  
**Estado:** Propuesta Aprobada en Brainstorming  

---

## 1. Resumen Ejecutivo y Diagnóstico

Actualmente, la creación de usuarios en el ERP se realizaba a través de un popup modal compacto (`isAddUserModalOpen`), y la gestión de permisos se encontraba segregada en otro popup (`UserPermissionsModal`). Este flujo presentaba tres limitaciones operativas críticas:
1. **Espacio visual restringido:** Un popup flotante no permite visualizar ni configurar con claridad la matriz de seguridad para un empleado.
2. **Falta de granularidad operativa:** Solo se controlaba el acceso a nivel de módulo y submódulo general, existiendo únicamente cuatro banderas globales (`canDeleteClients`, `canDeleteFiles`, `canEditInvoices`, `canDeleteInvoices`).
3. **Riesgo en operaciones sensibles:** Un colaborador del departamento de **Ventas** requiere registrar clientes, emitir cotizaciones y facturar servicios de telecomunicaciones, pero **no** debe tener autorización para:
   - Modificar precios base o costos de inventario.
   - Ver los costos reales de adquisición o márgenes de ganancia.
   - Anular comprobantes electrónicos o notas de crédito sin autorización administrativa.
   - Ajustar stock o mermas de almacén.

### Objetivo del Diseño
Implementar un modelo **RBAC (Role-Based Access Control) con Sobrescritura Granular (Overrides)** en una **vista de pantalla completa integrada** que fusione los datos del colaborador con su matriz de permisos y herramientas internas.

---

## 2. Modelo de Datos: Matriz de Permisos Jerárquica

La interfaz `UserModulePermissions` se expande para soportar tres capas de control:
- **Capa 1 (Módulo):** `enabled: boolean` (control de visibilidad en menú principal).
- **Capa 2 (Submódulos):** `submodules: Record<string, boolean>` (acceso a pestañas internas).
- **Capa 3 (Acciones Internas Sensibles):** `actions: Record<string, boolean>` (permisos para botones, edición de precios, visualización de costos y anulaciones).

### Definición TypeScript Estructurada

```typescript
export interface InventoryActions {
  canCreateProduct: boolean;
  canCreateService: boolean;
  canEditProduct: boolean;
  canChangePrices: boolean;       // 🔒 Modificar precios de venta
  canViewCosts: boolean;          // 🔒 Visualizar costos de compra / margen
  canAdjustStock: boolean;        // 🔒 Realizar ajustes manuales o mermas
  canTransferWarehouses: boolean; // Transferir entre bodegas
  canDeleteItems: boolean;        // 🔒 Eliminar productos o servicios
}

export interface BillingActions {
  canCreateInvoice: boolean;
  canEditPrices: boolean;         // 🔒 Modificar precio unitario en venta
  canApplyDiscounts: boolean;     // 🔒 Aplicar descuentos libres
  canAuthorizeSri: boolean;       // Firmar y enviar al SRI
  canCancelInvoices: boolean;     // 🔒 Emitir notas de crédito / anular
  canCreateQuotes: boolean;
  canApproveQuotes: boolean;
  canViewSalesReports: boolean;
}

export interface ClientActions {
  canCreateClient: boolean;
  canEditClient: boolean;
  canEditServicePrices: boolean;  // 🔒 Cambiar precio acordado de servicio recurrente
  canUploadContracts: boolean;
  canDeleteContracts: boolean;    // 🔒 Eliminar archivos de contrato
  canDeleteClient: boolean;       // 🔒 Eliminar cliente
}

export interface PurchaseActions {
  canCreateSupplier: boolean;
  canRegisterPurchase: boolean;
  canApprovePayments: boolean;    // 🔒 Autorizar órdenes de pago a proveedores
  canEmitWithholding: boolean;    // Emitir retención SRI
  canViewSupplierBank: boolean;   // Ver datos bancarios
}

export interface FinanceActions {
  canViewBankBalances: boolean;   // 🔒 Ver saldos y extractos de cuentas bancarias
  canRegisterReceipts: boolean;   // Registrar cobranzas y abonos de clientes
  canRegisterExpenses: boolean;   // Registrar gastos operativos
  canCancelPayments: boolean;     // 🔒 Anular movimientos financieros
  canExportReports: boolean;      // Exportar balances y libros contables
}

export interface NetworkActions {
  canManageNodes: boolean;
  canAssignIps: boolean;
  canEditRouterCredentials: boolean; // 🔒 Modificar accesos RouterOS Mikrotik
}

export interface VaultActions {
  canViewClientVault: boolean;
  canViewInternalVault: boolean;  // 🔒 Ver credenciales del NOC/Sistemas
  canRevealPasswords: boolean;    // 🔒 Revelar y descifrar contraseñas AES
  canDeleteCredentials: boolean;  // 🔒 Eliminar credenciales
}

export interface UserModulePermissions {
  abonados?: { enabled: boolean };
  personas?: {
    enabled: boolean;
    submodules: { proveedores: boolean; usuarios_equipo: boolean };
  };
  inventarios?: {
    enabled: boolean;
    submodules: {
      productos: boolean;
      servicios: boolean;
      categorias: boolean;
      kardex: boolean;
      transferencias: boolean;
      bodegas: boolean;
      ajustes: boolean;
    };
    actions: InventoryActions;
  };
  facturacion?: {
    enabled: boolean;
    submodules: {
      facturas: boolean;
      cotizaciones: boolean;
      notas_credito: boolean;
      retenciones: boolean;
      guias_remision: boolean;
    };
    actions: BillingActions;
  };
  compras?: {
    enabled: boolean;
    submodules: {
      historial_compras: boolean;
      registrar_compra: boolean;
      notas_credito: boolean;
      notas_debito: boolean;
      retenciones: boolean;
    };
    actions: PurchaseActions;
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
    actions: FinanceActions;
  };
  red?: {
    enabled: boolean;
    submodules: { nodos: boolean; pools_ip: boolean };
    actions: NetworkActions;
  };
  boveda?: {
    enabled: boolean;
    actions: VaultActions;
  };
  proyectos?: { enabled: boolean };
  tickets?: { enabled: boolean };
  arcotel?: { enabled: boolean };
  plantillas?: { enabled: boolean };
  configuracion?: {
    enabled: boolean;
    submodules?: { general: boolean; sri: boolean };
  };
}
```

---

## 3. Roles como Plantillas Base (Presets)

Para agilizar la operación y evitar errores humanos, la selección de un rol carga un preset específico:

1. **`superadmin`:** Acceso total irrestricto a todos los módulos, submódulos y acciones sensibles.
2. **`admin`:** Acceso administrativo completo, con auditoría activa.
3. **`ventas`:**
   - **Facturación:** Habilitada (facturas, cotizaciones, guías). `canEditPrices: false`, `canCancelInvoices: false`, `canApplyDiscounts: false`.
   - **Inventarios:** Solo lectura de catálogo y stock disponible. `canChangePrices: false`, `canViewCosts: false`, `canAdjustStock: false`.
   - **Clientes:** Creación y seguimiento habilitado. `canEditServicePrices: false`, `canDeleteClient: false`.
   - **Finanzas:** Solo visualización de cuentas por cobrar para cobranza; cuentas bancarias y reportes contables restringidos.
4. **`tecnico` / `soporte`:**
   - **Redes / NOC & Proyectos:** Acceso a nodos, pools y tickets.
   - **Bóveda:** Solo credenciales de clientes asignados; credenciales internas del NOC bloqueadas.
   - **Facturación / Finanzas:** Desactivados.
5. **`finanzas` / `contador`:**
   - Acceso total a Finanzas, Cuentas por Cobrar/Pagar, Bancos, Facturación y Compras.
   - Bloqueo en configuraciones de Redes y NOC.
6. **`bodega` / `inventarios`:**
   - Acceso a recepción de compras en almacén, transferencias y kardex físico.
   - Visualización de precios y cobros restringida.
7. **`consulta`:** Acceso estrictamente de solo lectura.

---

## 4. Arquitectura de Interfaz: Nueva Vista Pantalla Completa

En [`src/components/modules/clients/UsersManager.tsx`](file:///e:/CLOUD%20WEBFIX/WEBFIX/SISTEMAS/controlinntel/src/components/modules/clients/UsersManager.tsx), se sustituyen los modales flotantes por una vista de estado completo:

```
viewMode: "list" | "form"
formMode: "create" | "edit"
```

### Layout de la Pantalla Completa

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Volver al Directorio     Nuevo Colaborador / Editar Usuario      [ Cancelar ] [ Guardar ] │
├──────────────────────────────┬─────────────────────────────────────────────────────────┤
│ COLUMNA IZQUIERDA (35%)      │ COLUMNA DERECHA (65%)                                   │
│                              │ MATRIZ DE SEGURIDAD & PERMISOS GRANULARES               │
│ [ Tarjeta de Datos ]         │ Preset Actual: [ Rol: Ventas ▼ ] [ Reestablecer Preset ] │
│ • Nombre Completo            ├─────────────────────────────────────────────────────────┤
│ • Correo Corporativo         │ Acordeones Colapsables por Módulo:                      │
│ • Contraseña de Acceso       │                                                         │
│ • Teléfono                   │ ▼ [x] MÓDULO INVENTARIOS                     [8/8 Activo]│
│ • Departamento               │   Submódulos:                                           │
│ • Rol Plantilla (Preset)     │   [x] Productos  [x] Servicios  [x] Bodegas  [ ] Kardex │
│ • Estado (Activo/Inactivo)   │   Acciones Operativas Internas:                         │
│                              │   [x] Crear Producto        [ ] Modificar Precios 🔒    │
│ [ Resumen de Accesos ]       │   [x] Crear Servicio        [ ] Ver Costos de Compra 🔒 │
│ • Módulos permitidos: 6/12   │   [x] Transferir Bodegas    [ ] Ajustes de Stock 🔒     │
│ • Acciones críticas: 2       │                                                         │
│                              │ ► [x] MÓDULO FACTURACIÓN                    [5/7 Activo]│
│                              │ ► [x] MÓDULO CLIENTES                       [4/6 Activo]│
│                              │ ► [ ] MÓDULO FINANZAS                       [0/5 Inactivo]│
└──────────────────────────────┴─────────────────────────────────────────────────────────┘
```

### Elementos Visuales Clave
1. **Badges de Acciones Críticas:** Aquellas acciones que comprometen dinero, precios o integridad de datos se destacan con un badge visual ámbar/rojo con icono de candado (`🔒`) para que el administrador sea consciente de los privilegios otorgados.
2. **Master Switch por Módulo:** Al apagar el switch principal de un módulo, todos sus submódulos y acciones se desactivan automáticamente.
3. **Preset Dinámico:** Cambiar el selector de rol actualiza la matriz en tiempo real, pero el administrador puede hacer cualquier modificación puntual que se guarda como un override para ese usuario en Firebase Firestore.

---

## 5. Implementación de Guards y Verificación en el Sistema

1. **Helper Global de Validación:**
   `canUser(currentUser, moduleKey, actionKey)` exportado desde [`src/lib/permissions.ts`](file:///e:/CLOUD%20WEBFIX/WEBFIX/SISTEMAS/controlinntel/src/lib/permissions.ts).
   - Si `currentUser.role === "superadmin"`, retorna siempre `true`.
   - Si `currentUser.modulePermissions?.[moduleKey]?.actions?.[actionKey]` está explícitamente definido, respeta su valor booleano.
   - De lo contrario, utiliza el valor por defecto configurado para el rol en `DEFAULT_MODULE_PERMISSIONS_BY_ROLE`.
2. **Protección en Vistas del Sistema:**
   - En **Inventarios**: Los campos de costo y margen se ocultan si `!canUser(user, "inventarios", "canViewCosts")`. El botón de editar precio se desactiva si `!canUser(user, "inventarios", "canChangePrices")`.
   - En **Facturación**: El campo de precio unitario se bloquea en solo lectura si `!canUser(user, "facturacion", "canEditPrices")`. El botón de anular se bloquea si `!canUser(user, "facturacion", "canCancelInvoices")`.
3. **Auditoría Centralizada:** Cada vez que se crea o edita un usuario y sus permisos, se genera un registro estructurado en `AuditLog`.
