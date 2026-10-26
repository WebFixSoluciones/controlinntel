# Design Spec: Soporte UX/UI — Clean Workspace Redesign

**Fecha:** 2026-10-26  
**Módulo:** Soporte / Incidencias (`src/components/modules/tickets/TicketDetail.tsx`)  
**Objetivo:** Aligerar drásticamente la carga visual de la vista de tickets, eliminando la saturación de bordes, tarjetas anidadas, textos explicativos redundantes y reorganizando el flujo de lectura y respuesta en un espacio de trabajo ágil y profesional ("Clean Workspace").

---

## 1. Problemas Identificados y Solución

| Componente Actual | Problema Detectado | Solución en Clean Workspace |
| :--- | :--- | :--- |
| **Caja de Respuesta** | Ubicada arriba del historial; obliga al usuario a scrollear hacia abajo para leer y luego volver a subir para contestar. | Se traslada al **pie del historial de conversación**, donde concluye la lectura natural del caso. |
| **Bordeadora y Cards** | Columna derecha dividida en 4 tarjetas independientes con bordes toscos (`border-[#e2e8f0]`) y sombras apiladas. | Unificada en **un único panel lateral continuo**, con divisiones suaves (`divide-[#f1f5f9]`) y sin cajas anidadas. |
| **Textos de Relleno** | Banners explicativos extensos (*"Esta nota técnica es PRIVADA..."*) y etiquetas redundantes (*"Razón Social:"*). | Eliminación de banners. Uso de iconos semánticos discretos y datos directos en negrita/mono. |
| **Estados Duplicados** | El estado del ticket se modifica en 3 selectores simultáneos. | Un solo control maestro de estado en el panel lateral y selector sincronizado al enviar respuesta. |
| **Historial de Mensajes** | Tarjetas con doble borde y fondos contrastantes agresivos. | Estilo de hilo cronológico conversacional limpio, con avatares compactos y fechas legibles. |

---

## 2. Arquitectura de Componentes

### 2.1 Header Superior Aligerado
- **Izquierda:** Botón de retroceso `<-`, número de ticket (`[TKT-0901]`), etiqueta SLA (`Crítica`, `Alta`), y título del ticket sin doble contenedor.
- **Derecha:** Botón rápido de WhatsApp (con mensaje prellenado), botón `Escalar a Cuadrilla` (hacia Proyectos), y botón primario de resolución rápida (`Resolver Ticket` / `Reabrir Ticket`).

### 2.2 Columna Izquierda: Conversación + Caja de Respuesta al Pie
1. **Filtros de Hilo:** Barra discreta (`Todos` | `Cliente` | `Notas Internas`).
2. **Mensaje Inicial del Cliente:** Solicitud inicial con fecha, autor y cuerpo claro.
3. **Hilo Cronológico:**
   - Mensajes de soporte del staff: fondo blanco con borde suave.
   - Mensajes de cliente: fondo tenue con borde sutil.
   - Notas internas: fondo cálido sutil (`bg-amber-50/70`, `border-amber-200/60`), badge `Nota Interna`, sin párrafos de advertencia.
4. **Caja de Respuesta al Pie:**
   - Pestañas compactas: `Responder al Cliente` | `Nota Interna`.
   - Selector discreto de `Respuestas Rápidas (Canned)`.
   - Área de texto con foco azul institucional (`focus:border-[#004ac6]`).
   - Barra de acción: Selector de estado resultante y botón `Enviar Respuesta` / `Guardar Nota` (soporta atajo `Ctrl+Enter`).

### 2.3 Columna Derecha: Panel de Contexto Unificado (Single Card)
Un solo contenedor blanco estilizado con 4 bloques continuos:
- **Encabezado:** Título `Información del Caso` y enlace directo `Ficha 360° ->`.
- **Bloque Cliente:** Nombre fiscal directo, RUC/Cédula, enlaces rápidos a teléfono/WhatsApp, email y dirección.
- **Bloque Servicio:** Plan contratado, IP asignada (código mono seleccionable), serial ONT y POP/Nodo.
- **Bloque Propiedades:** Selectores limpios de Departamento, Prioridad SLA, Técnico Asignado y Estado.
- **Bloque Historial Previo:** Mini-lista de otros tickets activos o recientes del cliente con acceso inmediato.

---

## 3. Pruebas y Criterios de Aceptación
1. **Tests automatizados (E2E):** Creación de test en `end-to-end-flows.test.ts` que valide:
   - Que la caja de respuesta esté situada al pie del historial.
   - Que no existan banners redundantes de notas privadas ni títulos repetidos.
   - Que el panel lateral esté unificado en un solo contenedor.
2. **Typecheck & Lint:** 0 errores de TypeScript (`npx tsc --noEmit`) y 0 fallos de linting.
3. **CI Pipeline:** Pipeline de GitHub Actions en verde continuo.
