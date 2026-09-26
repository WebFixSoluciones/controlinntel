# Especificación de Diseño: Submódulo de Nodos del Cliente & Localización Geográfica Ecuador

- **Fecha**: 2026-09-26
- **Estado**: Aprobado por el usuario (Enfoque 1)
- **Ámbito**: Ficha 360° del Cliente (`ClientProfile360.tsx`), Menú Principal (`Sidebar.tsx`) y Modelo de Nodos (`types/index.ts`).

---

## 1. Contexto & Objetivos

En la arquitectura previa, el módulo de Nodos existía como un módulo global en la barra lateral (`/red`), concebido originalmente como nodos propios de distribución de INNTEL CORP. 

Sin embargo, en el modelo de negocio real:
1. **Los nodos pertenecen a cada cliente**: El cliente cuenta con diferentes sedes, sucursales o nodos de red propios y nos entrega su información técnica para su monitoreo, conectividad y soporte.
2. **Submódulo exclusivo por cliente**: La administración (creación, edición, visualización y eliminación) de nodos debe gestionarse directamente dentro del expediente 360° de cada abonado.
3. **Estructura geográfica para Ecuador**: La dirección del nodo debe contar con un selector para las 24 provincias de Ecuador, un campo de texto para Cantón, un campo para Parroquia y un campo para Dirección detallada / referencia.
4. **Navegación limpia**: Se remueve el ítem "Nodos" de la barra lateral general (`Sidebar.tsx`), canalizando la gestión a través del módulo de Clientes.

---

## 2. Modelo de Datos (`src/types/index.ts`)

Se actualiza la interfaz `NodeLocation` para incorporar la vinculación directa con el cliente y la división geográfica:

```typescript
export interface NodeLocation {
  id: string;
  clientId: string;            // ID del cliente dueño del nodo
  clientName?: string;         // Nombre comercial del cliente
  name: string;                // Nombre de la sede / nodo (ej: Sede Principal, Sucursal Norte)
  
  // Localización geográfica en Ecuador
  province: string;            // Selector de provincias de Ecuador
  canton: string;              // Campo de texto para cantón
  parish: string;              // Campo de texto para parroquia
  detailedAddress: string;     // Dirección detallada (calle, número, referencia)
  address: string;             // Campo consolidado para compatibilidad

  coordinates?: { lat: number; lng: number };
  upstreamProvider?: string;
  totalCapacityMbps?: number;
  usedCapacityMbps?: number;
  mikrotikIp?: string;
  status: "online" | "warning" | "offline";
  activeClientsCount?: number;
  notes?: string;
  providers?: NodeCarrierProvider[];
  services?: NodeSystemService[];
}
```

Lista oficial de provincias ecuatorianas para el selector:
- Azuay, Bolívar, Cañar, Carchi, Chimborazo, Cotopaxi, El Oro, Esmeraldas, Galápagos, Guayas, Imbabura, Loja, Los Ríos, Manabí, Morona Santiago, Napo, Orellana, Pastaza, Pichincha, Santa Elena, Santo Domingo de los Tsáchilas, Sucumbíos, Tungurahua, Zamora Chinchipe.

---

## 3. Experiencia de Usuario & Componentes

### 3.1 Pestaña "Nodos & Red" en la Ficha 360° (`ClientProfile360.tsx`)
- La pestaña muestra el listado de nodos pertenecientes al cliente actual (`nodes.filter(n => n.clientId === client.id)`).
- Cada tarjeta de nodo incluye:
  - Nombre del nodo y badge de estado (*Online, Warning, Offline*).
  - Ubicación geográfica estructurada: *Provincia, Cantón, Parroquia y Dirección detallada*.
  - IP de gestión MikroTik / router del cliente con enlace o botón de copia rápida.
  - Enlaces portadores / Multi-Carrier configurados para ese nodo.
  - Credenciales de acceso al equipo de la sede con visualización protegida / revelable.
  - Botones de acción: Editar nodo y Eliminar nodo (con modal de confirmación).
- Botón principal: `+ Registrar Nodo / Sede` que abre el modal pre-vinculado a dicho cliente.

### 3.2 Modal de Creación / Edición de Nodo del Cliente (`ClientNodeModal.tsx`)
- Formulario modal con validaciones:
  - **Identificación**: Nombre del nodo/sede (ej: *Oficina Matriz Guayaquil, Sucursal Centro Histórico*).
  - **Ubicación en Ecuador**:
    - Selector desplegable con las 24 Provincias.
    - Campo de texto para Cantón.
    - Campo de texto para Parroquia.
    - Campo de texto para Dirección detallada y referencias.
  - **Parámetros de Conectividad**:
    - IP MikroTik / Router de la sede.
    - Estado inicial (*Online, Advertencia, Fuera de línea*).
    - Capacidad estimada (Mbps).
    - Proveedores de enlace (Multi-Carrier) y servicios/credenciales de acceso.

### 3.3 Barra Lateral & Rutas
- En `Sidebar.tsx`, se retira el ítem `{ href: "/red", label: "Nodos", icon: Radio }`.
- La ruta `/red` (`src/app/red/page.tsx`) se redirige a `/clientes` o presenta un selector asistido hacia la ficha del cliente correspondiente.

---

## 4. Persistencia y Estado Central (`src/lib/state.tsx`)

- `nodes`: Se almacena y sincroniza con Firestore y localStorage incluyendo los nuevos campos geográficos y `clientId`.
- `addNode`: Recibe `clientId` automáticamente del cliente activo.
- `updateNode` y `deleteNode`: Operan sobre la colección asegurando integridad referencial.
- `mock-data.ts`: Los datos iniciales de demostración se asocian a clientes existentes con datos geográficos reales de Ecuador (ej: Pichincha - Quito - Iñaquito).

---

## 5. Criterios de Aceptación & Verificación

1. **Gestión desde el cliente**: Al ingresar a la Ficha 360° de cualquier cliente, se pueden registrar, ver, editar y eliminar sus nodos.
2. **Dirección ecuatoriana completa**: El modal valida provincia (mediante selector), cantón, parroquia y dirección.
3. **Navegación general**: La barra lateral ya no muestra el acceso general de "Nodos", manteniendo el menú limpio y enfocado.
4. **Compilación Next.js**: `npm run build` compila con 0 errores de TypeScript y empaquetado.
