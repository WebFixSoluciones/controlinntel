# Support Ticket Clean Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la vista de detalle de ticket en Soporte (`TicketDetail.tsx`) para transformar una interfaz pesada y saturada de bordes en un espacio de trabajo ágil, limpio ("Clean Workspace"), con flujo de conversación natural (caja de respuesta al pie) y panel lateral unificado.

**Architecture:** Mover el área de respuesta al pie del historial de asistencia cronológico, unificar las 4 tarjetas de la barra lateral derecha en un único panel contextual continuo con enlaces directos, y retirar banners y textos redundantes.

**Tech Stack:** React 18, Next.js 14, Tailwind CSS, Lucide Icons, TypeScript.

---

### Task 1: Reestructurar `TicketDetail.tsx` (Clean Workspace)

**Files:**
- Modify: `src/components/modules/tickets/TicketDetail.tsx`

- [ ] **Step 1: Limpiar la Cabecera Toolbar**
  - Simplificar la barra superior: mostrar botón de volver, badge del ticket `[TKT-0901]`, SLA pill, y título limpio.
  - Mantener a la derecha las acciones rápidas: WhatsApp, Escalar a Cuadrilla y botón primario Resolver/Reabrir.

- [ ] **Step 2: Reorganizar el Hilo de Conversación y Mover la Caja de Respuesta al Pie**
  - Colocar el historial cronológico arriba (solicitud inicial del cliente seguida de las respuestas).
  - Mover la caja de respuesta al pie del hilo (después de los mensajes).
  - Agregar soporte para enviar con `Ctrl+Enter`.
  - Quitar el banner de advertencia extenso de notas privadas y usar estilos sutiles.

- [ ] **Step 3: Unificar el Panel Contextual Derecho en una Sola Tarjeta**
  - Eliminar las 4 tarjetas individuales y reemplazarlas por un panel único con divisores suaves:
    1. Sección Cliente: nombre fiscal, RUC/cédula, enlaces rápidos a teléfono y correo.
    2. Sección Servicio Afectado: plan contratado, IP asignada en mono pill, nodo/POP.
    3. Sección Propiedades: departamento, prioridad, técnico asignado y estado.
    4. Sección Tickets Anteriores: lista compacta de tickets previos del cliente.

---

### Task 2: Añadir Pruebas Automatizadas en `end-to-end-flows.test.ts`

**Files:**
- Modify: `src/lib/end-to-end-flows.test.ts`

- [ ] **Step 1: Escribir prueba E2E para Clean Workspace en Soporte**
  - Validar que `TicketDetail.tsx` ubique el cuadro de respuesta después del historial.
  - Validar que no existan textos explicativos redundantes de notas privadas.
  - Validar que el panel lateral esté unificado.

---

### Task 3: Verificación Local y Despliegue

- [ ] **Step 1: Ejecutar verificación de tipos y tests**
  - `npx tsc --noEmit`
  - `npm test`
  - `npm run lint`

- [ ] **Step 2: Commit y Push a origin main**
  - Confirmar ejecución en GitHub Actions CI.
