# Plan de Implementación: Módulo de Proyectos y Tareas estilo Notion / Jira

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar el módulo `/proyectos` en una arquitectura jerárquica de Proyectos $\rightarrow$ Tareas con Tabla Maestra, Canvas personalizable por proyecto (estados por default: Inicio, En Proceso, Revisión, Terminado), Diagrama Gantt, Papelera de reciclaje y conexión bidireccional con la pestaña Tareas de la Ficha del Cliente.

**Architecture:** 
1. Separación de entidades: `Project` (contenedor con fechas, cliente, presupuesto y columnas personalizables) y `ClientProjectTask` (tareas hijas vinculadas por `projectId` y `clientId`).
2. Estado reactivo en `src/lib/state.tsx` con persistencia en Firestore y LocalStorage para `projects` y `clientProjects`.
3. Navegación en `/proyectos`: Vista principal tabular con KPIs y acciones $\leftrightarrow$ Vista de Canvas / Tablero de trabajo del proyecto seleccionado.
4. Sincronización transparente con `ClientTasksTab.tsx` en `/clientes`.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Firestore SDK.

---

## Tareas de Implementación

### Tarea 1: Extensión de Tipos y Mock Data
- [ ] **Paso 1.1:** En `src/types/index.ts`, definir las interfaces `ProjectCustomColumn`, `ProjectStatus` y `Project`.
- [ ] **Paso 1.2:** En `src/types/index.ts`, extender `ClientProjectTask` con campos opcionales `projectId?: string`, `projectName?: string`, `isDeleted?: boolean`.
- [ ] **Paso 1.3:** En `src/lib/mock-data.ts`, crear `DEMO_PROJECTS: Project[]` con al menos 2 proyectos iniciales (uno vinculado a cliente y otro a nodo de red) con sus 4 columnas por defecto (`inicio`, `en_proceso`, `revision`, `terminado`).
- [ ] **Paso 1.4:** En `src/lib/mock-data.ts`, vincular las tareas de `DEMO_PROJECT_TASKS` con los IDs de los proyectos correspondientes.
- [ ] **Paso 1.5:** Verificar que `npx tsc --noEmit` compile sin errores de tipos.

### Tarea 2: Gestión de Estado y Persistencia en `src/lib/state.tsx`
- [ ] **Paso 2.1:** Añadir el estado `projects` en `AppContext` y `AppProvider`.
- [ ] **Paso 2.2:** Implementar funciones CRUD para proyectos:
  - `addProject(data)`
  - `updateProject(id, updates)`
  - `deleteProject(id)` (soft delete: `isDeleted = true`)
  - `restoreProject(id)` (`isDeleted = false`)
  - `permanentDeleteProject(id)` (hard delete)
  - `updateProjectColumns(projectId, columns)`
- [ ] **Paso 2.3:** Integrar sincronización con Firestore (`syncToFirestore` / `deleteFromFirestore`) y registro en `addAuditLog`.
- [ ] **Paso 2.4:** Verificar compilación de tipos con `npx tsc --noEmit`.

### Tarea 3: Modal Limpio de Creación / Edición de Proyectos (`ProjectModal.tsx`)
- [ ] **Paso 3.1:** Crear `src/components/modules/projects/ProjectModal.tsx`.
- [ ] **Paso 3.2:** Incluir campos: Título del proyecto, Vinculación (Cliente / Nodo), Fecha de Inicio, Fecha de Fin, Presupuesto estimado y Descripción.
- [ ] **Paso 3.3:** Eliminar por completo el selector de "Flujo ISP (6 Fases) / Flujo General (4 Fases)".
- [ ] **Paso 3.4:** Inicializar automáticamente las 4 columnas por defecto:
  1. `inicio`: "Inicio" (`slate`)
  2. `en_proceso`: "En Proceso" (`blue`)
  3. `revision`: "Revisión" (`amber`)
  4. `terminado`: "Terminado" (`emerald`)
- [ ] **Paso 3.5:** Conectar con `addProject` y `updateProject`.

### Tarea 4: Tabla Maestra de Proyectos y KPIs (`ProjectsManager.tsx`)
- [ ] **Paso 4.1:** En `src/components/modules/projects/ProjectsManager.tsx`, reemplazar la vista plana directa por la Tabla Maestra de Proyectos cuando `currentView === 'list'`.
- [ ] **Paso 4.2:** Implementar KPIs superiores: Total Proyectos, En Proceso, En Revisión, Finalizados, Presupuesto Total vs Costo Ejecutado.
- [ ] **Paso 4.3:** Construir la tabla con las columnas solicitadas:
  1. Nombre del Proyecto
  2. Cliente Asignado
  3. Fecha de Inicio
  4. Fecha de Fin (con semáforo de tiempo)
  5. Tareas Globales (progreso % con barra visual)
  6. Presupuesto ($ Presupuesto vs $ Ejecutado)
  7. Estado del Proyecto (con badge)
  8. Acciones:
     - 👁️ Ver Proyecto (`setCurrentView('workspace')` con proyecto seleccionado)
     - ✏️ Editar Proyecto (abre `ProjectModal`)
     - 🔄 Cambiar Estado (selector rápido)
     - 📊 Ver Diagrama (abre `ProjectGanttModal`)
     - 🗑️ Eliminar Proyecto (`deleteProject` a papelera)
- [ ] **Paso 4.4:** Añadir barra de búsqueda, filtro por cliente, filtro por estado, botón "+ Nuevo Proyecto" y acceso a "Papelera".

### Tarea 5: Espacio de Trabajo del Proyecto con Canvas Personalizable (`ProjectWorkspace.tsx`)
- [ ] **Paso 5.1:** Crear `src/components/modules/projects/ProjectWorkspace.tsx`.
- [ ] **Paso 5.2:** Implementar encabezado con breadcrumb: `Proyectos / [Nombre del Proyecto]`, botón *"← Volver al Listado de Proyectos"*, detalles del cliente y avance global.
- [ ] **Paso 5.3:** Implementar pestañas de vista interna:
  - **Canvas (Tablero Kanban):** Columnas del proyecto con drag & drop de tareas, botón "+ Crear Tarea" por columna.
  - **Lista de Tareas:** Vista tabular con estados, prioridades, fechas y comentarios.
  - **Diagrama de Fechas:** Visualizador cronológico interno.
- [ ] **Paso 5.4:** Soporte para personalizar columnas del Canvas: botón "+ Añadir Columna", renombrar y cambiar color de estado.
- [ ] **Paso 5.5:** Conectar con modal de tareas para crear y editar tareas dentro del proyecto.

### Tarea 6: Visualizador de Diagrama Gantt / Cronograma (`ProjectGanttModal.tsx`)
- [ ] **Paso 6.1:** Crear `src/components/modules/projects/ProjectGanttModal.tsx`.
- [ ] **Paso 6.2:** Renderizar línea de tiempo horizontal con la duración global del proyecto y las barras temporales de cada una de sus tareas.
- [ ] **Paso 6.3:** Semáforos visuales por estado y prioridad de cada tarea.

### Tarea 7: Papelera de Reciclaje de Proyectos (`ProjectTrashModal.tsx`)
- [ ] **Paso 7.1:** Crear `src/components/modules/projects/ProjectTrashModal.tsx`.
- [ ] **Paso 7.2:** Listar proyectos con `isDeleted === true`.
- [ ] **Paso 7.3:** Proveer botones para **Restaurar Proyecto** o **Eliminar Definitivamente**.

### Tarea 8: Sincronización con la Pestaña Tareas de la Ficha del Cliente (`ClientTasksTab.tsx`)
- [ ] **Paso 8.1:** En `src/components/modules/clients/ClientTasksTab.tsx`, mostrar el nombre del proyecto al que pertenece cada tarea (`task.projectName`).
- [ ] **Paso 8.2:** Añadir selector/filtro de "Proyecto" para que el usuario pueda ver tareas de todos los proyectos del cliente o de uno específico.
- [ ] **Paso 8.3:** Al crear una tarea desde la ficha del cliente, permitir asignarla a un proyecto existente de ese cliente.

### Tarea 9: Verificación Final y Despliegue
- [ ] **Paso 9.1:** Ejecutar `npx tsc --noEmit` y asegurar 0 errores de tipado.
- [ ] **Paso 9.2:** Ejecutar `npm run build` y confirmar la generación exitosa de las 21/21 páginas estáticas.
- [ ] **Paso 9.3:** Git commit y push a `origin main`.
- [ ] **Paso 9.4:** Informar al usuario con resumen completo de las funcionalidades entregadas.
