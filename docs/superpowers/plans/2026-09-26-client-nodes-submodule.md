# Plan de Implementación: Submódulo de Nodos del Cliente & Geografía de Ecuador

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar el módulo de Nodos en un submódulo exclusivo de cada Cliente dentro de la Ficha 360°, incorporando la división geográfica de Ecuador (selector de 24 provincias, cantón, parroquia y dirección detallada) y removiendo la ruta general de la barra lateral.

**Architecture:** Modificación de `NodeLocation` en `src/types/index.ts` para pertenencia estricta por `clientId` y campos territoriales ecuatorianos; creación de `ClientNodeModal.tsx` y `ClientNodesTab.tsx` para la Ficha 360°; actualización del estado central en `src/lib/state.tsx`; y limpieza de navegación en `Sidebar.tsx` y `/red`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide React, Context API / Firestore.

---

## Estructura de Archivos

- **Modificar:** `src/types/index.ts` — Agregar campos `clientId`, `clientName`, `province`, `canton`, `parish`, `detailedAddress` a `NodeLocation` y exportar `ECUADOR_PROVINCES`.
- **Modificar:** `src/lib/mock-data.ts` — Enriquecer `INITIAL_NODES` con vinculación a clientes de prueba y localización ecuatoriana.
- **Modificar:** `src/lib/state.tsx` — Asegurar manejo de `clientId` y nuevos campos en `addNode`, `updateNode`, `deleteNode`.
- **Crear:** `src/components/modules/clients/ClientNodeModal.tsx` — Modal especializado para registrar y editar sedes/nodos del cliente con selector de provincias, cantón, parroquia, dirección, MikroTik y proveedores.
- **Crear:** `src/components/modules/clients/ClientNodesTab.tsx` — Componente de pestaña dentro de la Ficha 360° con tarjetas de sedes, estado en tiempo real, credenciales protegidas y acciones de CRUD.
- **Modificar:** `src/components/modules/clients/ClientProfile360.tsx` — Integrar `ClientNodesTab` en la pestaña de red/nodos con contador en vivo.
- **Modificar:** `src/components/layout/Sidebar.tsx` — Retirar ítem `/red` del menú general.
- **Modificar:** `src/app/red/page.tsx` — Redirigir a `/clientes` o mostrar asistencia de redirección.

---

### Tarea 1: Extensión de Tipos & Lista de Provincias del Ecuador

**Archivos:**
- Modificar: `src/types/index.ts`

- [ ] **Paso 1: Agregar lista de 24 provincias y actualizar `NodeLocation`**
  - Exportar constante `ECUADOR_PROVINCES` con las 24 provincias:
    `["Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi", "El Oro", "Esmeraldas", "Galápagos", "Guayas", "Imbabura", "Loja", "Los Ríos", "Manabí", "Morona Santiago", "Napo", "Orellana", "Pastaza", "Pichincha", "Santa Elena", "Santo Domingo de los Tsáchilas", "Sucumbíos", "Tungurahua", "Zamora Chinchipe"]`.
  - Agregar a `NodeLocation`:
    - `clientId: string`
    - `clientName?: string`
    - `province: string`
    - `canton: string`
    - `parish: string`
    - `detailedAddress: string`
- [ ] **Paso 2: Verificar que no haya errores de compilación en tipos**
- [ ] **Paso 3: Commit de la tarea 1**

---

### Tarea 2: Actualización de Datos Mock y Estado Central

**Archivos:**
- Modificar: `src/lib/mock-data.ts`
- Modificar: `src/lib/state.tsx`

- [ ] **Paso 1: Actualizar `DEMO_NODE` en `src/lib/mock-data.ts`**
  - Asignar `clientId: "cli-demo-corp-01"`, `clientName: "CORPORACIÓN INDUSTRIAL Y LOGÍSTICA ECUATORIANA C.A."`.
  - Asignar `province: "Pichincha"`, `canton: "Quito"`, `parish: "Iñaquito"`, `detailedAddress: "Av. Amazonas N45-12 y Gaspar de Villarroel, Edificio Platinum Plaza Piso 8"`.
- [ ] **Paso 2: Actualizar `addNode` en `src/lib/state.tsx`**
  - Permitir que `addNode` reciba `clientId` y los campos geográficos completos.
- [ ] **Paso 3: Commit de la tarea 2**

---

### Tarea 3: Crear `ClientNodeModal.tsx` con Selector de Ecuador

**Archivos:**
- Crear: `src/components/modules/clients/ClientNodeModal.tsx`

- [ ] **Paso 1: Implementar formulario modal con tabs o secciones**
  - Encabezado con icono de sede/nodo y cliente al que pertenece.
  - Sección Geográfica:
    - Selector desplegable `<select>` con `ECUADOR_PROVINCES`.
    - Input de texto para `canton` (ej: Quito, Guayaquil, Cuenca).
    - Input de texto para `parish` (ej: Iñaquito, Tarqui, Cumbayá).
    - Input de texto para `detailedAddress` (calle, número y referencia).
  - Sección de Conectividad & Equipos:
    - Nombre del nodo (ej: Sede Principal, Sucursal Norte).
    - IP MikroTik / Router de acceso del cliente.
    - Estado operativo: Online, Warning, Offline.
    - Proveedores Multi-Carrier y Credenciales del equipo.
- [ ] **Paso 2: Validar campos requeridos y guardar vía `addNode` / `updateNode`**
- [ ] **Paso 3: Commit de la tarea 3**

---

### Tarea 4: Crear `ClientNodesTab.tsx` e Integrar en `ClientProfile360.tsx`

**Archivos:**
- Crear: `src/components/modules/clients/ClientNodesTab.tsx`
- Modificar: `src/components/modules/clients/ClientProfile360.tsx`

- [ ] **Paso 1: Implementar `ClientNodesTab.tsx`**
  - Filtrar nodos por `n.clientId === client.id`.
  - Botón principal `+ Registrar Nodo / Sede`.
  - Listado de tarjetas con:
    - Nombre del nodo y badge de estado (*Online, Advertencia, Fuera de línea*).
    - Ubicación completa: *Provincia, Cantón, Parroquia y Dirección*.
    - IP de gestión MikroTik con botón de copia rápida.
    - Enlaces Multi-Carrier y credenciales protegidas con botón revelar/ocultar.
    - Botones de acción: Editar y Eliminar (con diálogo de confirmación).
- [ ] **Paso 2: Conectar pestaña en `ClientProfile360.tsx`**
  - Actualizar label de la pestaña a `"Nodos & Red"` con contador `nodes.filter(n => n.clientId === client.id).length`.
  - Renderizar `ClientNodesTab` dentro de la pestaña.
- [ ] **Paso 3: Commit de la tarea 4**

---

### Tarea 5: Limpieza de Navegación en `Sidebar.tsx` y Redirección en `/red`

**Archivos:**
- Modificar: `src/components/layout/Sidebar.tsx`
- Modificar: `src/app/red/page.tsx`

- [ ] **Paso 1: Quitar `/red` de `NAV_ITEMS` en `Sidebar.tsx`**
  - Remover la opción "Nodos" del menú lateral.
- [ ] **Paso 2: Actualizar `src/app/red/page.tsx`**
  - Redirigir automáticamente a `/clientes` con un mensaje orientativo explicando que los nodos ahora se gestionan dentro de cada cliente.
- [ ] **Paso 3: Commit de la tarea 5**

---

### Tarea 6: Verificación y Pruebas de Compilación

**Archivos:**
- Todos los modificados

- [ ] **Paso 1: Ejecutar `npm run build`**
  - Asegurar 0 errores de TypeScript y 0 advertencias de empaquetado.
- [ ] **Paso 2: Verificar flujo funcional en navegador**
- [ ] **Paso 3: Commit y push final a `origin/main`**
