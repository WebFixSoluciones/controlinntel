# Especificación de Diseño: Módulo General de Proyectos tipo Trello & Control de Obras

- **Fecha**: 2026-09-24
- **Estado**: Aprobado por el usuario
- **Módulo**: Gestión General de Proyectos & Obras (`/proyectos`)

---

## 1. Contexto & Objetivos

Actualmente, el sistema INNTEL CORP cuenta con un componente `ClientProjectKanban.tsx` embebido dentro de la ficha de cada cliente en la pestaña "Obras". Sin embargo, se requiere un **Módulo General de Control de Proyectos tipo TRELLO** accesible desde el menú principal que permita:
1. Visualizar, organizar y administrar todos los proyectos y tareas del ecosistema INNTEL CORP en un único tablero Trello interactivo con arrastrar y soltar (*drag & drop*).
2. Soportar tanto proyectos asignados a clientes específicos (altas, despliegues de fibra, migraciones) como proyectos de infraestructura interna de red (mantenimiento de POPs, expansión de anillos ópticos, upgrades de Core).
3. Ofrecer dos flujos de trabajo configurables en el tablero:
   - **Flujo Técnico ISP (6 fases)**: Factibilidad $\rightarrow$ Tendido de Fibra $\rightarrow$ Fusión & Splitters $\rightarrow$ Instalación ONT $\rightarrow$ Pruebas & Homologación $\rightarrow$ Entregado & Operativo.
   - **Flujo General de Proyectos (4 fases)**: Por Iniciar $\rightarrow$ En Progreso $\rightarrow$ En Pausa / Revisión $\rightarrow$ Finalizado.
4. Control de **Presupuesto Integral**: Monto asignado (\$ USD), costos/gastos reales ejecutados (\$ USD), balance restante y porcentaje de consumo.
5. Bitácora de **Notas & Comentarios de Cuadrilla** con autor, fecha/hora y registro cronológico.
6. Checklists interactivos de verificación con barra de progreso.
7. Sincronización bidireccional en tiempo real con la pestaña "Obras" de la Ficha 360° del cliente.

---

## 2. Modelo de Datos (`src/types/index.ts`)

Se amplían las definiciones de tipos para soportar proyectos tanto de clientes como internos, presupuestos, notas y los dos flujos de trabajo:

```typescript
export type ProjectBoardFlow = "isp_tecnico" | "general";

export type ProjectKanbanColumn =
  // Flujo Técnico ISP (Despliegue FTTH / Red)
  | "factibilidad"
  | "tendido_fibra"
  | "fusion_splitters"
  | "instalacion_ont"
  | "pruebas_homologacion"
  | "completado"
  // Flujo General de Proyectos
  | "por_iniciar"
  | "en_progreso"
  | "en_pausa"
  | "finalizado";

export interface ProjectChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ProjectNoteItem {
  id: string;
  authorName: string;
  authorRole?: string;
  content: string;
  createdAt: string;
}

export interface ClientProjectTask {
  id: string;
  // Vinculación
  type?: "cliente" | "infraestructura_interna";
  clientId?: string;
  clientName?: string;
  nodeId?: string;
  nodeName?: string;

  title: string;
  description: string;
  boardFlow?: ProjectBoardFlow; // 'isp_tecnico' (default) | 'general'
  column: ProjectKanbanColumn;
  priority: "baja" | "media" | "alta" | "urgente";
  assignedTo: string;
  assignedToId?: string;
  dueDate: string;
  startDate?: string;

  // Control Financiero / Presupuestario
  estimatedBudget?: number; // Presupuesto asignado ($ USD)
  executedCost?: number;    // Costo real ejecutado ($ USD)

  // Subtareas y Bitácora
  checklist: ProjectChecklistItem[];
  notesThread?: ProjectNoteItem[];
  notes?: string;

  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Estado Central y Persistencia (`src/lib/state.tsx`)

El estado de proyectos ya existe parcialmente bajo `clientProjects`, pero se expande para permitir operaciones completas de creación, edición, movimiento entre columnas, adición de notas y eliminación:

- `addClientProjectTask(task)`: Crea una nueva tarea/proyecto con identificador único `prj-timestamp`, fecha de creación y la persiste en `localStorage` (bajo la clave `STORAGE_KEY`) y en Firestore si está conectado.
- `updateClientProjectTask(id, updates)`: Actualiza campos generales, presupuesto, checklist o fechas.
- `moveProjectTaskColumn(id, newColumn)`: Mueve una tarea a una nueva columna (usado por el drag & drop) y actualiza `updatedAt`.
- `addProjectTaskNote(id, noteText)`: Añade una nueva entrada a `notesThread` con el nombre del usuario activo `currentUser.displayName`.
- `deleteClientProjectTask(id)`: Remueve el proyecto con confirmación previa.

---

## 4. Navegación, Rutas y Permisos

1. **Ruta**: `/proyectos` con página en `src/app/proyectos/page.tsx`.
2. **Barra Lateral (`Sidebar.tsx`)**:
   - Se añade el ítem en `NAV_ITEMS`:
     ```typescript
     { href: "/proyectos", label: "Proyectos", icon: Kanban },
     ```
   - Ubicación: Justo entre *Nodos* y *Soporte*, integrando las operaciones de ingeniería y despliegue.
3. **Permisos RBAC (`permissions.ts`)**:
   - `routePermissions["/proyectos"] = "manage_network"`.
   - Si el usuario tiene `all`, `manage_network` o `manage_clients`, tiene acceso de consulta y edición.
   - En `UserManager.tsx` y `UserModal.tsx`, se muestra la mención explícita al módulo Proyectos.

---

## 5. Componentes de Interfaz

### 5.1 `ProjectsManager.tsx` (Módulo Principal en `/proyectos`)
- **Cabecera Institucional**:
  - Título y subtítulo con icono `Kanban`.
  - Botón principal `+ Nuevo Proyecto / Tarea`.
- **KPI Cards de Control de Obras**:
  1. *Total Presupuesto Planificado*: Suma de `estimatedBudget` de todos los proyectos activos (\$ USD).
  2. *Costo Real Ejecutado*: Suma de `executedCost` (\$ USD).
  3. *Balance / Margen Restante*: Diferencia `Presupuesto - Costo Ejecutado` con indicador de color (verde si superávit, rojo si sobrecosto).
  4. *Total Obras / Proyectos*: Cantidad total y número de proyectos entregados/completados.
- **Barra de Herramientas y Filtros**:
  - Selector de Flujo (*Flujo Técnico ISP* de 6 columnas vs. *Flujo General* de 4 columnas).
  - Buscador omnibox (título, descripción, cliente, nodo).
  - Selector de filtro por Cliente.
  - Selector de filtro por Tipo (Todos, Clientes, Infraestructura).
  - Selector de filtro por Prioridad (Baja, Media, Alta, Urgente).
  - Selector de filtro por Responsable / Técnico.
- **Tablero Kanban con Drag & Drop**:
  - Columnas horizontales con badges de conteo y colores distintivos.
  - Eventos de Drag & Drop HTML5 nativos (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) con sombreado al pasar sobre la columna receptora.
  - Tarjetas con:
    - Badge de prioridad (`baja` gris, `media` azul, `alta` ámbar, `urgente` rojo).
    - Etiqueta del Cliente asignado o del Nodo de infraestructura.
    - Barra de progreso de checklist (ej. `3/5 (60%)`).
    - Mini-kpi de presupuesto (`$450 / $600 USD`).
    - Fecha límite con aviso si está vencida o por vencer.
    - Botones de acción rápida: Ver detalle / Ficha Trello, Eliminar.

### 5.2 `ProjectTaskModal.tsx` (Modal Ficha Trello Completa)
- Modal flotante con backdrop blur centrado.
- Pestañas o secciones internas organizadas:
  1. **Información General**: Título, descripción, flujo (`isp_tecnico` o `general`), columna actual, prioridad y técnico/cuadrilla responsable (selector con usuarios reales de `systemUsers`).
  2. **Asignación & Vinculación**:
     - Radio selector: ¿Vinculado a Cliente o a Infraestructura Interna?
     - Si es Cliente: selector de clientes registrados.
     - Si es Infraestructura: selector de POPs/Nodos registrados.
  3. **Control Presupuestario**:
     - Presupuesto Asignado (\$ USD).
     - Costo Ejecutado (\$ USD).
     - Tarjeta de cálculo automático de balance restante y porcentaje consumido con barra visual.
  4. **Checklist de Subtareas**:
     - Lista de ítems con casillas de verificación interactivas.
     - Input rápido para agregar nuevo ítem con Enter o clic en "+ Agregar".
     - Botón de eliminación por ítem.
  5. **Bitácora de Notas / Comentarios**:
     - Historial ordenado cronológicamente con nombre del autor, rol, fecha/hora y contenido.
     - Formulario para registrar nueva nota de cuadrilla.

### 5.3 `ClientProjectKanban.tsx` (Ficha 360° del Cliente)
- Se actualiza para consumir y compartir las funciones enriquecidas de presupuesto, notas, checklist y drag & drop, filtrando automáticamente las tareas pertenecientes al cliente actual.

---

## 6. Manejo de Errores y Casos Límite

- **Tareas sin presupuesto asignado**: Se muestran como `$0.00` sin causar errores aritméticos en divisiones (manejo de división por cero al calcular porcentaje).
- **Proyectos sin cliente (infraestructura interna)**: Se visualizan claramente con icono de `Server` / `Radio` indicando "Infraestructura Interna: [Nombre del Nodo]".
- **Drag & drop entre columnas de flujos incompatibles**: Si una tarea pertenece al flujo general pero está seleccionada la vista técnica, el sistema maneja la transición de columna limpiamente.
- **Persistencia garantizada**: Cada cambio se graba en `localStorage` inmediatamente y emite los eventos correspondientes en el contexto global.

---

## 7. Plan de Verificación

1. **Compilación**: Ejecutar `npm run build` y asegurar 0 errores de TypeScript y empaquetado Next.js.
2. **Pruebas Funcionales**:
   - Navegación al nuevo módulo `/proyectos`.
   - Creación de proyecto para Cliente con presupuesto y checklist.
   - Creación de proyecto interno de Infraestructura de red.
   - Arrastrar y soltar entre columnas y verificar actualización de estado.
   - Agregar notas y validar que se registren con fecha y autor.
   - Verificar sincronización en la Ficha 360° del cliente (pestaña Obras).
   - Verificar cálculo de KPIs financieros en tiempo real.
