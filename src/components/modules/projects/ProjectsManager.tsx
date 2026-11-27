"use client";
import { ActionIconButton } from "@/components/ui/ActionIconButton";

import React, { useState, useMemo } from "react";
import { canViewFinancialAmounts, canRoleAction } from "@/lib/permissions";
import { useApp } from "@/lib/state";
import { useToast } from "@/lib/toast-context";
import { Project, ProjectStatus } from "@/types";
import { ProjectModal } from "./ProjectModal";
import { ProjectGanttModal } from "./ProjectGanttModal";
import { ProjectTrashModal } from "./ProjectTrashModal";
import { ProjectWorkspace } from "./ProjectWorkspace";
import {
  Briefcase,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

const statusLabels: Record<ProjectStatus, string> = {
  inicio: "Inicio / planeado",
  en_proceso: "En proceso",
  revision: "En revisión",
  terminado: "Terminado",
  en_pausa: "En pausa",
  cancelado: "Cancelado",
};

export function ProjectsManager() {
  const {
    currentUser,
    projects,
    clientProjects,
    deleteProject,
    updateProject,
  } = useApp();
  const showFinancialAmounts = canViewFinancialAmounts(currentUser);
  const { showSuccess, showConfirm, showError } = useToast();

  // Active Selected Project (if non-null, views that Project's Canva Workspace)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [typeFilter, setTypeFilter] = useState<string>("todos");

  // Modals state
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);

  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);

  const [isGanttModalOpen, setIsGanttModalOpen] = useState(false);
  const [selectedGanttProject, setSelectedGanttProject] = useState<Project | null>(null);

  // Active (non-deleted) projects
  const activeProjects = useMemo(() => {
    return projects.filter((p) => !p.isDeleted);
  }, [projects]);

  // Trash count
  const deletedProjectsCount = useMemo(() => {
    return projects.filter((p) => p.isDeleted).length;
  }, [projects]);

  // Currently selected project object for workspace
  const activeWorkspaceProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [selectedProjectId, projects]);

  // Filtered projects for the master table
  const filteredProjects = useMemo(() => {
    return activeProjects.filter((p) => {
      // 1. Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchDesc = (p.description || "").toLowerCase().includes(q);
        const matchClient = (p.clientName || "").toLowerCase().includes(q);
        const matchNode = (p.nodeName || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchClient && !matchNode) return false;
      }

      // 2. Status filter
      if (statusFilter !== "todos" && p.status !== statusFilter) {
        return false;
      }

      // 3. Type filter
      if (typeFilter !== "todos" && p.type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [activeProjects, searchQuery, statusFilter, typeFilter]);

  // KPI Metrics calculations
  const kpis = useMemo(() => {
    const total = activeProjects.length;
    const enProceso = activeProjects.filter((p) => p.status === "en_proceso").length;
    const enRevision = activeProjects.filter((p) => p.status === "revision").length;
    const terminados = activeProjects.filter((p) => p.status === "terminado").length;
    const totalPresupuesto = activeProjects.reduce((acc, p) => acc + (p.estimatedBudget || 0), 0);
    const totalEjecutado = activeProjects.reduce((acc, p) => {
      const taskCosts = clientProjects
        .filter((t) => t.projectId === p.id)
        .reduce((sum, t) => sum + (t.executedCost || 0), 0);
      return acc + (p.executedCost || 0) + taskCosts;
    }, 0);

    return { total, enProceso, enRevision, terminados, totalPresupuesto, totalEjecutado };
  }, [activeProjects, clientProjects]);

  // Handlers
  const handleOpenCreateProject = () => {
    setProjectToEdit(null);
    setIsProjectModalOpen(true);
  };

  const handleOpenEditProject = (project: Project) => {
    setProjectToEdit(project);
    setIsProjectModalOpen(true);
  };

  const handleOpenGantt = (project: Project) => {
    setSelectedGanttProject(project);
    setIsGanttModalOpen(true);
  };

  const handleStatusChange = async (projectId: string, newStatus: ProjectStatus) => {
    try {
      await updateProject(projectId, { status: newStatus });
      showSuccess("Estado actualizado", "El estado del proyecto se ha modificado correctamente.");
    } catch {
      showError("Error", "No se pudo actualizar el estado del proyecto.");
    }
  };

  const handleDeleteProject = (project: Project) => {
    showConfirm(
      "¿Enviar proyecto a la papelera?",
      `El proyecto "${project.title}" se moverá a la papelera de reciclaje. Podrás restaurarlo o purgarlo definitivamente en cualquier momento.`,
      async () => {
        try {
          await deleteProject(project.id);
          showSuccess("Proyecto en papelera", `"${project.title}" ha sido enviado a la papelera.`);
          if (selectedProjectId === project.id) {
            setSelectedProjectId(null);
          }
        } catch {
          showError("Error", "No se pudo mover el proyecto a la papelera.");
        }
      },
      "Mover a papelera"
    );
  };

  // If a project is selected for viewing its Notion-style Canva workspace
  if (activeWorkspaceProject) {
    return (
      <ProjectWorkspace
        project={activeWorkspaceProject}
        onBack={() => setSelectedProjectId(null)}
        onEditProject={(p) => handleOpenEditProject(p)}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="ui-kpi">
          <div className="ui-kpi-label">Total de proyectos</div>
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="ui-kpi-value">{kpis.total}</span>
            <span className="ui-kpi-detail">activos</span>
          </div>
        </div>

        <div className="ui-kpi">
          <div className="ui-kpi-label">En proceso</div>
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="ui-kpi-value">{kpis.enProceso}</span>
            <span className="ui-kpi-detail">en ejecución</span>
          </div>
        </div>

        <div className="ui-kpi">
          <div className="ui-kpi-label">En revisión</div>
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="ui-kpi-value">{kpis.enRevision}</span>
            <span className="ui-kpi-detail">supervisión</span>
          </div>
        </div>

        <div className="ui-kpi">
          <div className="ui-kpi-label">Terminados</div>
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="ui-kpi-value">{kpis.terminados}</span>
            <span className="ui-kpi-detail">finalizados</span>
          </div>
        </div>
      </div>

      {/* Filter, Search Bar & Actions */}
      <div className="ui-toolbar flex flex-wrap items-center justify-between">
        <div className="relative min-w-[13rem] max-w-md grow">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            type="text"
            aria-label="Buscar proyectos"
            placeholder="Buscar por nombre de proyecto, cliente o POP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ui-cell-control w-full !pl-7"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar proyectos por estado"
            className="ui-cell-control"
          >
            <option value="todos">Todos los estados</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filtrar proyectos por tipo"
            className="ui-cell-control"
          >
            <option value="todos">Todos los tipos</option>
            <option value="cliente">Asignado a clientes</option>
            <option value="infraestructura_interna">POP / infraestructura</option>
          </select>

          <button
            type="button"
            onClick={() => setIsTrashModalOpen(true)}
            className="inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap border border-slate-200 bg-white px-2 text-[11px] font-semibold text-[#004ac6] hover:bg-blue-50"
            title="Papelera de proyectos eliminados"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span>Papelera</span>
          </button>

          <button
            type="button"
            disabled={!canRoleAction(currentUser,"proyectos","canCreateProject")}
            onClick={handleOpenCreateProject}
            className="inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap bg-[#004ac6] px-2 text-[11px] font-semibold text-white hover:bg-[#003da6] disabled:opacity-40"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>Nuevo proyecto</span>
          </button>
        </div>
      </div>

      {/* Master Projects Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="ui-table-scroll" role="region" aria-label="Lista de proyectos" tabIndex={0}>
          <table className="table-fixed w-full min-w-[56rem] border-collapse text-left">
            <thead className="bg-[#f8f9ff] text-[#004ac6] border-b border-[#e2e8f0]">
              <tr>
                <th scope="col">Nombre del proyecto</th>
                <th scope="col" className="w-[19%]">Cliente asignado</th>
                <th scope="col" className="w-[5rem]">Fecha de inicio</th>
                <th scope="col" className="w-[5rem]">Fecha de fin</th>
                <th scope="col" className="w-[5rem]">Tareas globales</th>
                <th scope="col" className="w-[6rem] text-right">Presupuesto</th>
                <th scope="col" className="w-[7.5rem]">Estado</th>
                <th scope="col" className="w-[11rem] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="!py-8 text-center">
                    <Briefcase className="mx-auto mb-1 size-5 text-slate-400" aria-hidden="true" />
                    No se encontraron proyectos activos con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  // Calculate tasks for this project
                  const pTasks = clientProjects.filter(
                    (t) => t.projectId === p.id || (!t.projectId && t.clientId === p.clientId)
                  );
                  const totalTasks = pTasks.length;
                  const completedTasks = pTasks.filter(
                    (t) =>
                      t.column === "terminado" ||
                      t.column === "completado" ||
                      t.column === "finalizado" ||
                      (p.columns[p.columns.length - 1] && t.column === p.columns[p.columns.length - 1].id)
                  ).length;
                  const taskPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                  const clientLabel = p.type === "cliente"
                    ? (p.clientName || "Cliente sin asignar")
                    : (p.nodeName || "POP / nodo interno");

                  return (
                    <tr key={p.id} className="hover:bg-[#f8f9ff]">
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedProjectId(p.id)}
                          className="group inline-flex max-w-full items-center gap-1 text-left hover:underline"
                          title={p.title}
                        >
                          <span className="truncate">{p.title}</span>
                          <ExternalLink className="size-3 shrink-0 text-[#004ac6] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                        </button>
                        <span className="ui-cell-meta block">{p.columns.length} fases canva</span>
                      </td>

                      <td>
                        <span className="block truncate" title={clientLabel}>{clientLabel}</span>
                      </td>

                      <td className="whitespace-nowrap tabular-nums">{p.startDate}</td>
                      <td className="whitespace-nowrap tabular-nums">{p.endDate}</td>

                      <td className="tabular-nums">
                        <span className="block">{completedTasks}/{totalTasks} tareas</span>
                        {totalTasks > 0 && <span className="ui-cell-meta block">{taskPercent}%</span>}
                      </td>

                      <td className="text-right tabular-nums [overflow-wrap:anywhere]">
                        {showFinancialAmounts ? `$${(p.estimatedBudget || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                      </td>

                      <td>
                        <select
                          value={p.status}
                          onChange={(e) => handleStatusChange(p.id, e.target.value as ProjectStatus)}
                          aria-label={`Estado del proyecto ${p.title}`}
                          className="ui-cell-control w-full"
                        >
                          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </td>

                      <td className="text-right">
                        <div className="ui-table-actions">
                          <ActionIconButton
                            action="view"
                            onClick={() => setSelectedProjectId(p.id)}
                            title="Ver canva del proyecto"
                            label={`Ver proyecto ${p.title}`}
                          />
                          <ActionIconButton
                            action="edit"
                            disabled={!canRoleAction(currentUser,"proyectos","canEditProject")}
                            onClick={() => handleOpenEditProject(p)}
                            title="Editar datos del proyecto"
                            label={`Editar proyecto ${p.title}`}
                          />

                          <button
                            type="button"
                            onClick={() => {
                              // Quick cycle status
                              const flow: ProjectStatus[] = ["inicio", "en_proceso", "revision", "terminado"];
                              const currentIndex = flow.indexOf(p.status);
                              const nextStatus = flow[(currentIndex + 1) % flow.length];
                              handleStatusChange(p.id, nextStatus);
                            }}
                            title="Avanzar estado"
                            aria-label={`Avanzar estado del proyecto ${p.title}`}
                            className="ui-icon-button"
                          >
                            <RefreshCw aria-hidden="true" strokeWidth={1.8} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenGantt(p)}
                            title="Ver cronograma"
                            aria-label={`Ver cronograma del proyecto ${p.title}`}
                            className="ui-icon-button"
                          >
                            <TrendingUp aria-hidden="true" strokeWidth={1.8} />
                          </button>

                          <ActionIconButton
                            action="delete"
                            disabled={!canRoleAction(currentUser,"proyectos","canDeleteProject")}
                            onClick={() => handleDeleteProject(p)}
                            title="Enviar proyecto a papelera"
                            label={`Enviar proyecto ${p.title} a papelera`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Proyecto */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setProjectToEdit(null);
        }}
        projectToEdit={projectToEdit}
      />

      {/* Modal Papelera de Proyectos */}
      <ProjectTrashModal
        isOpen={isTrashModalOpen}
        onClose={() => setIsTrashModalOpen(false)}
      />

      {/* Modal Diagrama Gantt */}
      <ProjectGanttModal
        isOpen={isGanttModalOpen}
        onClose={() => {
          setIsGanttModalOpen(false);
          setSelectedGanttProject(null);
        }}
        project={selectedGanttProject}
        tasks={clientProjects}
      />
    </div>
  );
}
