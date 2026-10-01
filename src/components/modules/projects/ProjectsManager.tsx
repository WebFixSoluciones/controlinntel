"use client";

import React, { useState, useMemo } from "react";
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
  Filter,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  Building2,
  Radio,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

export function ProjectsManager() {
  const {
    projects,
    clientProjects,
    deleteProject,
    updateProject,
  } = useApp();
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

  // Status Badge styling helper
  const statusStyles: Record<ProjectStatus, { bg: string; text: string; border: string; label: string }> = {
    inicio: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300", label: "Inicio / Planeado" },
    en_proceso: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300", label: "En Proceso" },
    revision: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", label: "En Revisión" },
    terminado: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", label: "Terminado" },
    en_pausa: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300", label: "En Pausa" },
    cancelado: { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300", label: "Cancelado" },
  };

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
      showSuccess("Estado Actualizado", "El estado del proyecto se ha modificado correctamente.");
    } catch {
      showError("Error", "No se pudo actualizar el estado del proyecto.");
    }
  };

  const handleDeleteProject = (project: Project) => {
    showConfirm(
      "¿Enviar Proyecto a la Papelera?",
      `El proyecto "${project.title}" se moverá a la papelera de reciclaje. Podrás restaurarlo o purgarlo definitivamente en cualquier momento.`,
      async () => {
        try {
          await deleteProject(project.id);
          showSuccess("Proyecto en Papelera", `"${project.title}" ha sido enviado a la papelera.`);
          if (selectedProjectId === project.id) {
            setSelectedProjectId(null);
          }
        } catch {
          showError("Error", "No se pudo mover el proyecto a la papelera.");
        }
      },
      "Mover a Papelera"
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
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Proyectos</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{kpis.total}</span>
            <span className="text-xs text-slate-400 font-medium">activos</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">En Proceso</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600">{kpis.enProceso}</span>
            <span className="text-xs text-blue-500 font-medium">en ejecución</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">En Revisión</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{kpis.enRevision}</span>
            <span className="text-xs text-amber-500 font-medium">supervisión</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Terminados</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">{kpis.terminados}</span>
            <span className="text-xs text-emerald-600 font-medium">finalizados</span>
          </div>
        </div>
      </div>

      {/* Filter, Search Bar & Actions */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre de proyecto, cliente o POP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-[#004ac6] transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-hidden focus:border-[#004ac6] transition-all cursor-pointer"
          >
            <option value="todos">Estado: Todos</option>
            <option value="inicio">Inicio / Planeado</option>
            <option value="en_proceso">En Proceso</option>
            <option value="revision">En Revisión</option>
            <option value="terminado">Terminado</option>
            <option value="en_pausa">En Pausa</option>
            <option value="cancelado">Cancelado</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-hidden focus:border-[#004ac6] transition-all cursor-pointer"
          >
            <option value="todos">Tipo: Todos</option>
            <option value="cliente">Asignado a Clientes</option>
            <option value="infraestructura_interna">POP / Infraestructura</option>
          </select>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Botones de Acción: Papelera y Nuevo Proyecto */}
          <button
            onClick={() => setIsTrashModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50 transition-all cursor-pointer shadow-2xs"
            title="Papelera de reciclaje de proyectos eliminados"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Papelera</span>
            {deletedProjectsCount > 0 && (
              <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded-full font-bold">
                {deletedProjectsCount}
              </span>
            )}
          </button>

          <button
            onClick={handleOpenCreateProject}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#004ac6] text-white text-xs font-bold hover:bg-[#003da6] transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Proyecto</span>
          </button>
        </div>
      </div>

      {/* Master Projects Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Nombre del Proyecto</th>
                <th className="py-3.5 px-4">Cliente Asignado</th>
                <th className="py-3.5 px-4">Fecha Inicio</th>
                <th className="py-3.5 px-4">Fecha Fin</th>
                <th className="py-3.5 px-4">Tareas Globales</th>
                <th className="py-3.5 px-4">Presupuesto</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-xs text-slate-400">
                    <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
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

                  const curStatus = statusStyles[p.status] || statusStyles.inicio;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* 1. Nombre de Proyecto (sin icono, solo título y fases) */}
                      <td className="py-4 px-4">
                        <div>
                          <button
                            onClick={() => setSelectedProjectId(p.id)}
                            className="font-bold text-slate-900 hover:text-[#004ac6] text-left transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                          >
                            <span>{p.title}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#004ac6]" />
                          </button>
                          <div className="mt-1">
                            <span className="inline-block text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {p.columns.length} fases canva
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Cliente Asignado (sin icono) */}
                      <td className="py-4 px-4">
                        <span className="text-slate-800 font-bold block truncate max-w-[200px]">
                          {p.type === "cliente" ? (p.clientName || "Cliente No Asignado") : (p.nodeName || "POP / Nodo Interno")}
                        </span>
                      </td>

                      {/* 3. Fecha Inicio */}
                      <td className="py-4 px-4 font-mono text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.startDate}</span>
                        </div>
                      </td>

                      {/* 4. Fecha Fin */}
                      <td className="py-4 px-4 font-mono text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.endDate}</span>
                        </div>
                      </td>

                      {/* 5. Tareas Globales (Píldora minimalista) */}
                      <td className="py-4 px-4">
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            totalTasks === 0
                              ? "bg-slate-100 text-slate-500 border-slate-200"
                              : completedTasks === totalTasks
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-blue-50 text-[#004ac6] border-blue-200"
                          }`}
                        >
                          <span className="font-bold">{completedTasks}/{totalTasks}</span>
                          <span className="text-[10px] opacity-75">tareas</span>
                          {totalTasks > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white/80 shadow-2xs">
                              {taskPercent}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Presupuesto (sin costo) */}
                      <td className="py-4 px-4 font-mono text-xs text-slate-800 font-bold">
                        ${p.estimatedBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>

                      {/* 7. Estado del Proyecto */}
                      <td className="py-4 px-4">
                        <div className="relative inline-block">
                          <select
                            value={p.status}
                            onChange={(e) => handleStatusChange(p.id, e.target.value as ProjectStatus)}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-hidden transition-all ${curStatus.bg} ${curStatus.text} ${curStatus.border}`}
                          >
                            <option value="inicio">Inicio / Planeado</option>
                            <option value="en_proceso">En Proceso</option>
                            <option value="revision">En Revisión</option>
                            <option value="terminado">Terminado</option>
                            <option value="en_pausa">En Pausa</option>
                            <option value="cancelado">Cancelado</option>
                          </select>
                        </div>
                      </td>

                      {/* 8. Iconos de Acciones Solicitados */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* 👁️ Ver Proyecto */}
                          <button
                            onClick={() => setSelectedProjectId(p.id)}
                            title="Ver Canva del Proyecto"
                            className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* ✏️ Editar Proyecto */}
                          <button
                            onClick={() => handleOpenEditProject(p)}
                            title="Editar Datos del Proyecto"
                            className="p-1.5 text-slate-500 hover:text-[#004ac6] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* 🔄 Cambiar Estado */}
                          <button
                            onClick={() => {
                              // Quick cycle status
                              const flow: ProjectStatus[] = ["inicio", "en_proceso", "revision", "terminado"];
                              const currentIndex = flow.indexOf(p.status);
                              const nextStatus = flow[(currentIndex + 1) % flow.length];
                              handleStatusChange(p.id, nextStatus);
                            }}
                            title="Avanzar Estado Rápido"
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>

                          {/* 📊 Ver Diagrama de Proyecto (Gantt) */}
                          <button
                            onClick={() => handleOpenGantt(p)}
                            title="Ver Diagrama de Fechas y Cronograma"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>

                          {/* 🗑️ Eliminar Proyecto (Envía a Papelera) */}
                          <button
                            onClick={() => handleDeleteProject(p)}
                            title="Enviar Proyecto a Papelera"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
