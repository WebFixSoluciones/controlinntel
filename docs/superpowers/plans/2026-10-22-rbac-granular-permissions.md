# RBAC Granular Permissions & Full-Screen User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un sistema de Control de Acceso Basado en Roles con Overrides Granulares (RBAC + Overrides) por módulo, submódulo y acción sensible, con una pantalla completa limpia, minimalista y libre de sobrecarga visual para la creación y edición de usuarios colaboradores.

**Architecture:** 
- Capa de datos en TypeScript con interfaces tipadas para acciones operativas específicas por módulo (`InventoryActions`, `BillingActions`, `ClientActions`, etc.) dentro de `UserModulePermissions`.
- Helpers puros de resolución de permisos y presets en `src/lib/permissions.ts` con fallback seguro para superadmin y roles operativos.
- Vista de pantalla completa `UserFormView.tsx` desacoplada con layout ergonómico de 2 columnas: datos de usuario a la izquierda (35%) y acordeones colapsables de permisos con switches accesibles a la derecha (65%).
- Enlace en `UsersManager.tsx` que reemplaza los modales emergentes por navegación en vista completa con mitigación de errores y validaciones defensivas.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide React, Firebase Firestore.

---

### Task 1: Expansión de Tipos de Permisos y Acciones Granulares

**Files:**
- Modify: `src/types/purchases.ts:176-253`
- Modify: `src/types/index.ts:3-19`

- [ ] **Step 1: Declarar interfaces de acciones operativas en `src/types/purchases.ts`**

Agregar las interfaces `InventoryActions`, `BillingActions`, `ClientActions`, `PurchaseActions`, `FinanceActions`, `NetworkActions`, y `VaultActions` y tipar `UserModulePermissions` con ellas.

```typescript
export interface InventoryActions {
  canCreateProduct: boolean;
  canCreateService: boolean;
  canEditProduct: boolean;
  canChangePrices: boolean;       // 🔒 Modificar precios venta
  canViewCosts: boolean;          // 🔒 Ver costos compra/margen
  canAdjustStock: boolean;        // 🔒 Ajustes manuales
  canTransferWarehouses: boolean;
  canDeleteItems: boolean;        // 🔒 Eliminar ítems
}

export interface BillingActions {
  canCreateInvoice: boolean;
  canEditPrices: boolean;         // 🔒 Modificar precio en venta
  canApplyDiscounts: boolean;     // 🔒 Descuentos manuales
  canAuthorizeSri: boolean;       // Firmar / emitir al SRI
  canCancelInvoices: boolean;     // 🔒 Notas crédito / anular
  canCreateQuotes: boolean;
  canApproveQuotes: boolean;
  canViewSalesReports: boolean;
}

export interface ClientActions {
  canCreateClient: boolean;
  canEditClient: boolean;
  canEditServicePrices: boolean;  // 🔒 Editar tarifa mensual acordada
  canUploadContracts: boolean;
  canDeleteContracts: boolean;    // 🔒 Eliminar contratos
  canDeleteClient: boolean;       // 🔒 Eliminar clientes
}

export interface PurchaseActions {
  canCreateSupplier: boolean;
  canRegisterPurchase: boolean;
  canApprovePayments: boolean;    // 🔒 Autorizar pagos
  canEmitWithholding: boolean;    // Emitir retenciones
  canViewSupplierBank: boolean;   // Ver datos bancarios
}

export interface FinanceActions {
  canViewBankBalances: boolean;   // 🔒 Ver saldos de cuentas
  canRegisterReceipts: boolean;   // Registrar cobros
  canRegisterExpenses: boolean;   // Registrar gastos
  canCancelPayments: boolean;     // 🔒 Anular movimientos
  canExportReports: boolean;      // Exportar balances
}

export interface NetworkActions {
  canManageNodes: boolean;
  canAssignIps: boolean;
  canEditRouterCredentials: boolean; // 🔒 Credenciales de router
}

export interface VaultActions {
  canViewClientVault: boolean;
  canViewInternalVault: boolean;  // 🔒 Accesos NOC internos
  canRevealPasswords: boolean;    // 🔒 Revelar contraseñas
  canDeleteCredentials: boolean;  // 🔒 Eliminar credenciales
}
```

- [ ] **Step 2: Actualizar `UserRole` en `src/types/index.ts`**

Asegurar que `UserRole` incluya los roles solicitados por la operación: `"superadmin" | "admin" | "ventas" | "finanzas" | "tecnico" | "soporte" | "bodega" | "consulta"`.

- [ ] **Step 3: Verificar tipos con TypeScript**

Run: `npx tsc --noEmit`  
Expected: 0 errores de compilación de tipos.

- [ ] **Step 4: Commit**

```bash
git add src/types/purchases.ts src/types/index.ts
git commit -m "feat(types): expandir tipos de acciones granulares rbac y roles del sistema"
```

---

### Task 2: Actualización de Presets por Rol y Helper `canUser`

**Files:**
- Modify: `src/lib/permissions.ts:1-120`

- [ ] **Step 1: Definir presets completos por rol en `src/lib/permissions.ts`**

Actualizar `DEFAULT_MODULE_PERMISSIONS_BY_ROLE` para que cada rol (`superadmin`, `admin`, `ventas`, `finanzas`, `tecnico`, `soporte`, `bodega`, `consulta`) tenga definida de forma limpia y por defecto su matriz de submódulos y acciones.
Por ejemplo para `ventas`:
- `inventarios.actions.canChangePrices = false`
- `inventarios.actions.canViewCosts = false`
- `facturacion.actions.canCreateInvoice = true`
- `facturacion.actions.canEditPrices = false`
- `facturacion.actions.canCancelInvoices = false`

- [ ] **Step 2: Crear función helper pura `canUser`**

```typescript
export function canUser(
  user: UserProfile | null | undefined,
  moduleKey: keyof UserModulePermissions,
  actionKey?: string
): boolean {
  if (!user) return false;
  if (user.role === "superadmin") return true;

  const permissions = user.modulePermissions || DEFAULT_MODULE_PERMISSIONS_BY_ROLE[user.role] || DEFAULT_MODULE_PERMISSIONS_BY_ROLE.consulta;
  const mod = permissions?.[moduleKey] as any;
  if (!mod || !mod.enabled) return false;

  if (!actionKey) return true;
  if (mod.actions && typeof mod.actions[actionKey] === "boolean") {
    return mod.actions[actionKey];
  }

  return true;
}
```

- [ ] **Step 3: Verificar con `npx tsc --noEmit`**

Run: `npx tsc --noEmit`  
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat(permissions): agregar presets de roles operativos y helper canUser"
```

---

### Task 3: Componente de Pantalla Completa `UserFormView.tsx`

**Files:**
- Create: `src/components/modules/clients/UserFormView.tsx`

- [ ] **Step 1: Crear componente de pantalla completa con diseño limpio y no sobrecargado**

El componente debe recibir:
- `user: SystemUser | null` (null para crear, usuario para editar).
- `onSave: (userData: Partial<SystemUser>, permissions: UserModulePermissions) => Promise<void>`.
- `onCancel: () => void`.

Estructura visual limpia y directa:
1. **Barra Superior Institucional:**
   - Botón `← Volver a Colaboradores`
   - Título simple: "Nuevo Colaborador" o "Editar Colaborador: [Nombre]"
   - Botón Cancelar y Botón `Guardar Colaborador` con estado de carga.
2. **Columna Izquierda (35%): Datos del Colaborador**
   - Nombre Completo, Correo Corporativo, Contraseña (con botón ver/ocultar), Teléfono, Departamento.
   - Selector de Rol Predeterminado: Al cambiar de rol, muestra un diálogo o aviso amigable: "¿Deseas cargar la plantilla de permisos recomendada para [Rol]?".
   - Estado: Activo / Inactivo.
3. **Columna Derecha (65%): Matriz de Permisos en Acordeones Limpios**
   - Barra rápida con botón "Reestablecer a permisos del rol" y contador de módulos activos.
   - Acordeones estilizados para cada módulo principal (Inventarios, Facturación, Clientes, Compras, Finanzas, Red, Bóveda):
     - Cabecera del acordeón: Switch maestro On/Off, Nombre e ícono del módulo, badge de permisos activos (ej. `6/8 activos`).
     - Al desplegar:
       - Submódulos (en pills/chips de selección rápida).
       - Acciones Operativas Granulares con checkbox claros y badge `🔒 Crítico` en ámbar suave para acciones delicadas (cambiar precios, ver costos, anular).

- [ ] **Step 2: Mitigación de errores y validaciones en cliente**
   - Validación de email corporativo no vacío y con formato `@`.
   - Validación de nombre no vacío.
   - Contraseña mínima de 6 caracteres si es nuevo o si se especifica cambio.
   - Prevención de doble clic con estado `isSaving`.

- [ ] **Step 3: Verificar con `npx tsc --noEmit`**

Run: `npx tsc --noEmit`  
Expected: Sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/clients/UserFormView.tsx
git commit -m "feat(users): crear vista de pantalla completa UserFormView con rbac granular"
```

---

### Task 4: Integración en `UsersManager.tsx`

**Files:**
- Modify: `src/components/modules/clients/UsersManager.tsx`

- [ ] **Step 1: Reemplazar el estado de modal pequeño por vista completa**

En `UsersManager.tsx`:
- Crear estado `viewMode: "list" | "form"` y `editingUser: SystemUser | null`.
- Cuando `viewMode === "form"`: renderizar `<UserFormView user={editingUser} onSave={handleSaveUser} onCancel={() => setViewMode("list")} />`.
- Al pulsar `+ Añadir Colaborador`, ejecutar `setEditingUser(null); setViewMode("form");`.
- En la tabla de usuarios, al pulsar el botón `Editar` o `Permisos & Módulos`, ejecutar `setEditingUser(u); setViewMode("form");`.

- [ ] **Step 2: Unificar la lógica de guardado en `handleSaveUser`**
   - Si `editingUser` existe: actualizar datos de usuario y permisos en una única operación `updateSystemUser` en Firestore / estado local.
   - Si es nuevo: llamar a `addSystemUser` registrando simultáneamente sus datos de cuenta y su matriz de permisos.
   - Mostrar notificaciones Toast claras de éxito o error.

- [ ] **Step 3: Limpiar código redundante**
   - Retirar los antiguos modales flotantes pequeños obsoletos (`isAddUserModalOpen` y `selectedUserForPermissions`).

- [ ] **Step 4: Verificar con `npx tsc --noEmit` y `npm run build`**

Run: `npx tsc --noEmit`  
Run: `npm run build`  
Expected: Salida exitosa código 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/clients/UsersManager.tsx
git commit -m "feat(users): integrar pantalla completa de creacion y permisos en UsersManager"
```

---

### Task 5: Aplicación de Guards Operativos Clave (Inventarios y Facturación)

**Files:**
- Modify: `src/components/modules/inventory/InventoryManager.tsx`
- Modify: `src/components/modules/billing/NewSaleView.tsx`

- [ ] **Step 1: Ocultar costos o restringir cambio de precios en Inventarios según permisos**
   - En `InventoryManager.tsx`: utilizar `canUser(currentUser, "inventarios", "canViewCosts")` para mostrar u ocultar la columna de costo y margen de ganancia.
   - Utilizar `canUser(currentUser, "inventarios", "canChangePrices")` para permitir o deshabilitar la edición de precio base de productos y servicios.

- [ ] **Step 2: Restringir cambio de precios en Facturación según permisos**
   - En `NewSaleView.tsx`: si `!canUser(currentUser, "facturacion", "canEditPrices")`, el campo de precio unitario en el formulario de ítem de venta queda bloqueado como `readOnly`.
   - Si `!canUser(currentUser, "facturacion", "canApplyDiscounts")`, el input de descuento se deshabilita.

- [ ] **Step 3: Verificar con `npx tsc --noEmit`**

Run: `npx tsc --noEmit`  
Expected: 0 errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/inventory/InventoryManager.tsx src/components/modules/billing/NewSaleView.tsx
git commit -m "feat(guards): aplicar restricciones operativas de costos y precios en inventarios y ventas"
```

---

### Task 6: Verificación de Producción y Despliegue

**Files:** Todos los modificados.

- [ ] **Step 1: Ejecutar verificación exhaustiva de tipos**
   Run: `npx tsc --noEmit`
   Expected: 0 errores.

- [ ] **Step 2: Ejecutar compilación de producción Next.js**
   Run: `npm run build`
   Expected: `✓ Compiled successfully`, páginas estáticas generadas sin excepciones.

- [ ] **Step 3: Push a repositorio principal**
   Run: `git push origin main`
   Expected: Cambios sincronizados con `origin/main`.
