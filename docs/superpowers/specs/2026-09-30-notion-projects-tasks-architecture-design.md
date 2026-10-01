# Arquitectura del Módulo de Proyectos y Tareas estilo Notion / Jira

**Fecha:** 2026-09-30  
**Sistema:** INNTEL CORP S.A. - Plataforma de Gestión Integral  
**Autor:** Antigravity AI & Equipo Web Fix Soluciones  
**Estado:** Aprobado para Implementación  

---

## 1. Visión General y Objetivos
Evolucionar el módulo `/proyectos` de una vista plana monoflujo a una **arquitectura profesional jerárquica de Proyectos $\rightarrow$ Tareas** (inspirada en Notion, Jira y ClickUp). 

### Objetivos Clave:
1. **Eliminar el selector de "Flujo ISP (6 Fases) / Flujo General (4 Fases)"** del modal de proyectos.
2. **Tabla Maestra de Proyectos como vista principal en `/proyectos`:**
   - Nombre de proyecto
   - Cliente asignado
   - Fechas de inicio y fin (plazo global)
   - Conteo y progreso de tareas globales (ej. 4/6 completadas - 67%)
   - Presupuesto vs Costo ejecutado
   - Estado global del proyecto
   - Acciones: Ver Proyecto (Canvas), Editar Proyecto, Cambiar Estado, Ver Diagrama (Gantt), Eliminar Proyecto (Papelera).
3. **Canvas / Tablero Kanban individual por Proyecto:**
   - Cada proyecto posee su propio Canvas personalizable.
   - **4 Estados por defecto:**
     1. `Inicio` (Por iniciar / Backlog)
     2. `En Proceso` (En ejecución técnica)
     3. `Revisión` (Control de calidad / Pruebas SLA)
     4. `Terminado` (Completado y certificado)
   - Capacidad de añadir y personalizar columnas/estados en cada proyecto.
4. **Diagrama de Fechas / Cronograma (Gantt):**
   - Visualización gráfica de las fechas globales del proyecto y el calendario de cada una de sus tareas.
5. **Papelera de Reciclaje:**
   - Soft-delete para proyectos eliminados, con opción de restaurar o purga definitiva.
6. **Conexión Directa con la Ficha del Cliente (`/clientes` $\rightarrow$ pestaña Tareas):**
   - Las tareas creadas en cualquier proyecto asignado al Cliente A se sincronizan de inmediato con la pestaña **Tareas** del expediente del cliente, permitiendo control y seguimiento integral bidireccional.

---

## 2. Modelo de Datos

### 2.1 Entidad `Project`
```typescript
export interface ProjectCustomColumn {
  id: string;
  label: string;
  color: "slate" | "blue" | "amber" | "emerald" | "purple" | "rose" | "indigo";
}

export type ProjectStatus =
  | "inicio"
  | "en_proceso"
  | "revision"
  | "terminado"
  | "en_pausa"
  | "cancelado";

export interface Project {
  id: string;
  title: string;
  description: string;
  type: "cliente" | "infraestructura_interna";
  clientId?: string;
  clientName?: string;
  nodeId?: string;
  nodeName?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  estimatedBudget: number;
  executedCost: number;
  status: ProjectStatus;
  columns: ProjectCustomColumn[];
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2.2 Entidad `ClientProjectTask` (Extendida con `projectId`)
```typescript
export interface ClientProjectTask {
  id: string;
  projectId?: string; // Vínculo directo al Proyecto padre
  projectName?: string;
  type?: "cliente" | "infraestructura_interna";
  clientId?: string;
  clientName?: string;
  nodeId?: string;
  nodeName?: string;
  title: string;
  description: string;
  column: string; // ID de columna dentro del canvas del proyecto ("inicio", "en_proceso", etc.)
  priority: "baja" | "media" | "alta" | "urgente";
  assignedTo: string;
  assignedToId?: string;
  startDate?: string;
  dueDate: string;
  estimatedBudget?: number;
  executedCost?: number;
  checklist: ProjectChecklistItem[];
  notesThread?: ProjectNoteItem[];
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Componentes de Interfaz

1. **`ProjectsManager.tsx` (Módulo Principal `/proyectos`):**
   - Estado de visualización: `'list'` (Tabla Maestra) vs `'workspace'` (Canvas del Proyecto) vs `'trash'` (Papelera).
   - KPIs del portafolio de proyectos.
   - Tabla interactiva con ordenamiento, filtros por cliente y estado.
   - Acciones por fila de proyecto.

2. **`ProjectModal.tsx` (Creación & Edición de Proyecto):**
   - Título del proyecto.
   - Selector de Cliente / Nodo.
   - Selector de Fechas (Inicio y Fin).
   - Presupuesto estimado.
   - Descripción detallada.
   - *Sin selector de flujo ISP/General.*

3. **`ProjectWorkspace.tsx` (Espacio de Trabajo del Proyecto):**
   - Breadcrumb de retorno al listado de proyectos.
   - Resumen del proyecto (fechas, progreso, presupuesto).
   - Vistas:
     - **Canvas Kanban**: Columnas interactivas con drag & drop de tareas.
     - **Lista de Tareas**: Vista detallada con checklist, comentarios y plazos.
     - **Diagrama Gantt / Cronograma**: Gráfico de barras temporales por tarea.
   - Gestión de columnas del canvas (añadir columna, personalizar).

4. **`ProjectGanttModal.tsx` (Diagrama de Fechas):**
   - Visualización de la duración del proyecto y barras de tiempo de sus tareas.

5. **`ProjectTrashModal.tsx` (Papelera de Reciclaje):**
   - Listado de proyectos en papelera.
   - Acciones de Restaurar o Eliminar definitivamente.

6. **`ClientTasksTab.tsx` (Ficha del Cliente en `/clientes`):**
   - Muestra las tareas asociadas al cliente y a sus respectivos proyectos.
   - Filtro por proyecto del cliente.
   - Al crear una tarea desde la ficha del cliente, permite asociarla a un proyecto existente del cliente o al proyecto por defecto.

---

## 4. Plan de Verificación
1. Validar tipos de datos con `npx tsc --noEmit`.
2. Validar compilación de producción con `npm run build` (21/21 páginas estáticas).
3. Probar ciclo de vida:
   - Crear un Proyecto nuevo vinculado a un Cliente.
   - Abrir su Canvas y verificar las 4 columnas por defecto (Inicio, En Proceso, Revisión, Terminado).
   - Crear tareas en el proyecto y moverlas entre estados.
   - Ir a la Ficha del Cliente (`/clientes`) y verificar que las tareas aparezcan en la pestaña **Tareas**.
   - Probar el Diagrama de Gantt y la Papelera de reciclaje.
