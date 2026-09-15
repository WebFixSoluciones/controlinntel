# Plan Maestro de Mejoras — Control INNTEL

**Fecha:** 14 de septiembre de 2026  
**Estado:** Propuesto para validación funcional y técnica  
**Objetivo:** Convertir la interfaz actual en un sistema operativo ISP listo para uso productivo, sin cambiar el flujo de entrega `commit → GitHub → Vercel`.

---

## 1. Punto de partida comprobado

El proyecto es una aplicación Next.js 14 con una interfaz funcional y módulos de negocio ya visibles. El repositorio `main` está sincronizado con GitHub y Vercel puede continuar desplegando desde esa rama.

La limitación transversal es que los datos, la autenticación y los permisos viven hoy en el navegador (`localStorage` y estado React). No hay rutas de servidor, base de datos conectada, control de acceso ejecutado en backend, pruebas automatizadas ni integración real con MikroTik, ARCOTEL, SRI o un proveedor de mensajería.

Por tanto, el objetivo no es rehacer la interfaz: es conservarla y reemplazar progresivamente sus fuentes locales por servicios productivos, verificables y seguros.

### Principios no negociables

1. GitHub sigue siendo la fuente de verdad y Vercel continúa desplegando cada cambio aprobado en `main`.
2. Ninguna contraseña, token, clave de IA o dato sensible se almacena, valida o descifra en el navegador.
3. Cada acción relevante debe quedar asociada a un usuario autenticado y a una auditoría persistente.
4. Los documentos regulatorios son borradores controlados hasta contar con validación jurídica y regulatoria de INNTEL.
5. Se implementa como **monolito modular de Next.js**; no se introducen microservicios salvo que una integración lo justifique.

---

## 2. Matriz: promesa del README vs. estado actual

| Área del README | Estado actual comprobado | Brecha para producción | Prioridad |
|---|---|---|---|
| Next.js, TypeScript y Tailwind | Implementados | Falta separación clara cliente/servidor, pruebas y control de calidad | Alta |
| Firestore / Firebase | Hay configuración y dependencias, pero no está consumida por la aplicación | Conectar Auth, Firestore, Storage, reglas y migración desde estado local | Crítica |
| RBAC y sesiones | Formularios y roles existen en la UI | Contraseñas en texto plano, sesión local y permisos no protegidos en servidor | Crítica |
| Bóveda AES-256 | Pantalla, ocultamiento y auditoría visual existen | La "cifra" actual es Base64 invertido; debe sustituirse por cifrado real y gestión de claves | Crítica |
| Cabeceras de seguridad | HSTS, X-Frame-Options, nosniff y otras cabeceras están configuradas | Falta CSP real, políticas de cookies/sesión y evaluación de seguridad | Alta |
| Dashboard | Métricas, gráficos, alertas y actividad se calculan sobre estado local | Consultas persistentes, filtros, métricas confiables y permisos | Alta |
| M1 Clientes y ficha 360° | CRUD visual, validación local de RUC/Cédula, servicios, contratos, cotizaciones y Kanban | Persistencia transaccional, historial, archivos, búsqueda indexada y autorización por operación | Alta |
| M2 ARCOTEL y pólizas | Registro, semáforo y descarga de oficio Word | Alertas programadas, adjuntos, historial, responsables y revisión jurídica de plantillas | Alta |
| M3 Red y MikroTik | Registro visual de POPs, IPs y capacidad | Inventario completo, pools IPv4/IPv6 editables, telemetría y conexión segura a RouterOS | Alta |
| M4 Tickets NOC | Crear ticket y cambiar estado | SLA medible, asignación, comentarios, adjuntos, notificaciones y trazabilidad | Alta |
| M5 Finanzas y cobranzas | Generación local de pre-facturas, gastos, pagos y Excel | Numeración transaccional, conciliación, reglas fiscales aprobadas y prevención de duplicados | Alta |
| M6 Word / Excel | Se generan descargas locales `.docx` y `.xlsx` | Versionado de plantillas, datos persistentes, autorización, trazabilidad y validación legal | Media-alta |
| M7 Gemini | Widget e integración de SDK con respuesta simulada | Endpoint de servidor, secretos protegidos, límites, auditoría y respuestas basadas solo en datos autorizados | Alta |
| Despliegue Vercel | `main` despliega desde GitHub | Instalar con un único gestor, CI, previews y validaciones antes de promover a producción | Alta |
| Documentación | Un README descriptivo | Corregir afirmaciones, variables de entorno, operación, respaldo, seguridad y runbooks | Alta |

---

## 3. Arquitectura objetivo propuesta

### Decisión propuesta: Firebase administrado + Next.js en Vercel

Se propone conservar Next.js en Vercel y activar el stack que el proyecto ya declara: **Firebase Authentication, Firestore y Storage**. Las rutas `app/api/**` de Next.js concentrarán las operaciones sensibles: IA, emisión de documentos, auditoría privilegiada, administración de roles y acceso a integraciones externas.

| Opción | Ventajas | Costos / riesgos | Decisión propuesta |
|---|---|---|---|
| Firebase Auth + Firestore + Storage | Ya está alineado con README y dependencias; permite reglas de acceso, tiempo real y menor migración de UI | Requiere configurar reglas, índices, proyecto productivo, respaldo y control de costos | **Elegida, condicionada a que INNTEL sea dueño del proyecto Firebase** |
| PostgreSQL + ORM | Consultas relacionales y reportes financieros complejos | Migración mayor, nueva infraestructura y más tiempo inicial | Alternativa si el volumen de reportes/conciliación exige SQL avanzado |
| Mantener `localStorage` | Sin migración inmediata | Sin control multiusuario, seguridad, respaldo ni auditoría confiable | No apta para producción |

### Límites de responsabilidad

```text
Usuario autenticado
        │
        ▼
Next.js UI ── Firebase Auth ── Firestore Rules
        │
        ├── API Next.js en Vercel ── Gemini / documentos / auditoría / tareas programadas
        │
        ├── Firestore ── datos operativos, perfiles, tickets, pólizas y cobranzas
        │
        ├── Firebase Storage ── adjuntos, contratos y documentos generados
        │
        └── KMS o gestor de secretos ── cifrado real de bóveda e integraciones
```

### Decisiones que deben quedar aprobadas antes de construir la Fase 2

1. El proyecto Firebase productivo, la cuenta de facturación y la cuenta propietaria pertenecen a INNTEL.
2. Se define si M5 es únicamente control interno de cobranzas o si incluirá facturación electrónica SRI. El código y README deben tener una sola versión del alcance.
3. Jurídico/ARCOTEL valida cada modelo de contrato, oficio y el uso de la palabra “homologado” u “oficial”.
4. Se define quiénes administran usuarios, bóveda, finanzas y documentos regulatorios.
5. Se define cómo se alcanzarán los RouterOS: agente dentro de la red, VPN o API pública protegida. Las IP privadas mostradas en la UI no son accesibles directamente desde Vercel.

---

## 4. Plan de ejecución por releases

Las fases se convierten en commits pequeños y reversibles. No se inicia una fase hasta cumplir sus criterios de salida.

### Release 0 — Contrato funcional, documentación y base de entrega

**Meta:** alinear producto, código, documentación y despliegue antes de mover datos reales.

- Corregir el README: logo, alcance real, módulos, servicios activos, límites actuales y flujo GitHub → Vercel.
- Crear `.env.example` sin secretos y documentar cada variable de Vercel/Firebase/Gemini.
- Elegir un único gestor de paquetes. Recomendación: conservar `pnpm`, versionar `pnpm-lock.yaml` y hacer que Vercel use `pnpm install --frozen-lockfile`.
- Agregar CI en GitHub para typecheck, lint, pruebas y build; un despliegue a producción no se considera aprobado si la verificación falla.
- Registrar ADRs en `docs/architecture/`: persistencia, autenticación/RBAC, bóveda, IA e integración MikroTik.
- Eliminar textos, nombres y tipos SRI si la decisión funcional confirma que M5 es solo interno.

**Criterio de salida:** README honesto, instalación reproducible, variables documentadas y pipeline de verificación verde.

### Release 1 — Seguridad, identidad y datos persistentes

**Meta:** reemplazar la base local sin cambiar el comportamiento visual de las pantallas.

- Configurar Firebase Auth con inicio de sesión real, restablecimiento de contraseña, cierre de sesión global y sesiones protegidas.
- Definir perfiles y permisos en servidor; reflejarlos en Firestore Rules y en rutas API. La UI no será la autoridad de permisos.
- Crear colecciones, índices y reglas para usuarios, clientes, servicios, nodos, pólizas, tickets, gastos, cobros, contratos, cotizaciones y auditoría.
- Migrar `state.tsx` de fuente de verdad a repositorios/servicios de datos. Mantener estado React solo como caché de interfaz.
- Implementar auditoría inmutable para altas, ediciones, eliminaciones, accesos a la bóveda, generación documental y cambios de pago.
- Crear estrategia de respaldo, restauración y retención de datos.
- Retirar cuentas y contraseñas de demostración del código versionado.

**Criterio de salida:** dos usuarios autorizados, desde navegadores distintos, ven los mismos datos permitidos; no hay contraseñas ni registros operativos en `localStorage`.

### Release 2 — M1: Clientes, servicios y ficha 360°

**Meta:** dejar operativo el ciclo de vida del abonado.

- Persistir clientes, servicios, planes, direcciones, equipos, contratos, tareas, cotizaciones y órdenes.
- Aplicar validación en cliente y servidor para identificación ecuatoriana, correo, teléfono, tarifas e IPs.
- Añadir edición/baja controlada de servicios, historial de cambios, estados de instalación y responsables.
- Incorporar búsqueda, filtros, paginación y exportación autorizada.
- Convertir el dossier en una vista imprimible basada en datos persistentes, sin incluir secretos.
- Definir el flujo: prospecto → factibilidad → instalación → activo → suspendido → retirado.

**Criterio de salida:** un cliente puede recorrer el ciclo completo y todos sus cambios quedan auditados y visibles según el rol.

### Release 3 — M2: ARCOTEL, pólizas y bóveda real

**Meta:** proteger los datos más sensibles y formalizar el seguimiento regulatorio.

- Implementar cifrado autenticado real en servidor; usar un servicio de gestión de claves aprobado. Nunca usar una clave fija en el repositorio.
- Limitar revelado/copiado de credenciales por permiso, motivo, reautenticación y registro de auditoría.
- Guardar pólizas, responsables, fechas, montos, adjuntos y versiones de oficio en datos persistentes.
- Programar alertas de vencimiento a 90, 60, 30, 15 y 7 días, con responsables y evidencia de notificación.
- Revisar legalmente contratos/oficios y etiquetarlos como borrador hasta su aprobación.

**Criterio de salida:** una credencial no puede recuperarse desde el navegador o base de datos sin autorización de servidor; una póliza vencida genera alerta y seguimiento verificable.

### Release 4 — M3 y M4: Red, MikroTik y operación NOC

**Meta:** convertir inventario estático en operación técnica trazable.

- Completar CRUD de POPs, enlaces, equipos, pools IPv4/IPv6, capacidad y estado operativo.
- Modelar equipos, interfaces, credenciales de integración y mediciones históricas por nodo.
- Diseñar un agente con salida HTTPS desde la red de INNTEL o una conexión VPN segura para consultar RouterOS. No exponer RouterOS ni credenciales a Vercel/navegador.
- Implementar inventario y telemetría por etapas: conectividad, capacidad, PPPoE, pools y alertas.
- Completar tickets con SLA por prioridad, comentarios, adjuntos, asignación, bitácora, cierre y notificaciones.
- Vincular ticket, cliente, servicio, nodo y técnico responsable.

**Criterio de salida:** una incidencia NOC puede abrirse, asignarse, resolverse y medirse; la información de un nodo procede de una fuente identificable, no de valores simulados.

### Release 5 — M5 y M6: Cobranzas, gastos y documentos

**Meta:** controlar operaciones financieras internas y documentos con trazabilidad.

- Crear lotes de cobro idempotentes: emitir dos veces para el mismo período no duplica registros.
- Definir estados: borrador, emitido, enviado, pendiente, pagado, anulado y conciliado.
- Registrar pago con método, referencia, comprobante, fecha y usuario; incorporar reversos con auditoría.
- Implementar gastos con categorías, proveedor, adjunto y aprobación cuando aplique.
- Generar DOCX/XLSX desde una ruta de servidor, guardar copia/versionado en Storage y registrar quién lo generó.
- Validar formatos, numeración y textos con Finanzas/Jurídico antes de habilitarlos a usuarios finales.

**Criterio de salida:** cobros, pagos, gastos y documentos son persistentes, auditables, no duplicables y exportables con datos coherentes.

### Release 6 — M7: Asistente IA seguro y útil

**Meta:** habilitar Gemini sin exponer claves ni información fuera del rol permitido.

- Mover la llamada a Gemini a una ruta de servidor; la clave queda solo en variables privadas de Vercel.
- Construir contexto mínimo por rol y por consulta; excluir bóveda, datos personales innecesarios y secretos.
- Implementar límites por usuario, registro de consultas, control de errores y mensajes explícitos cuando la IA no tenga datos.
- Sustituir respuestas simuladas por consultas autorizadas a Firestore y plantillas de respuesta verificables.
- Establecer guardrails: la IA informa y redacta borradores, pero no modifica pagos, pólizas, red ni usuarios por sí sola.

**Criterio de salida:** ninguna clave de Gemini llega al navegador; el asistente devuelve información autorizada, auditable y diferenciada de una acción operativa.

### Release 7 — Calidad, operación y salida a producción

**Meta:** demostrar que el sistema está listo para datos reales.

- Pruebas unitarias para validaciones, cálculo de cobros, permisos, cifrado y generación documental.
- Pruebas de integración para reglas Firestore, rutas API, autenticación y auditoría.
- Pruebas end-to-end para login, clientes, pólizas, tickets, cobros y restricciones de rol.
- Revisión de seguridad: CSP, rate limiting, cabeceras, dependencias, secretos, reglas Firebase y acceso a Storage.
- Prueba de restauración de respaldos y simulación de usuario bloqueado/perdida de sesión.
- UAT con Operaciones, NOC, Finanzas y Jurídico; registro de aprobación por módulo.
- Manuales operativos: alta/baja de usuarios, respaldo, incidentes, gestión de secretos, despliegue y reversión.

**Criterio de salida:** todas las pruebas críticas están verdes, se completó UAT, los respaldos se restauraron en una prueba y el propietario del sistema aprueba la salida.

---

## 5. Orden de implementación y dependencias

```text
R0 documentación + CI
        ↓
R1 identidad + Firestore + auditoría
        ↓
R2 clientes ────────────────┐
        ↓                   │
R3 pólizas + bóveda         │
        ↓                   ├── R5 cobros + documentos
R4 red + tickets ───────────┘
        ↓
R6 IA segura
        ↓
R7 pruebas, UAT y salida
```

Los Releases 2, 3 y 4 pueden avanzar parcialmente en paralelo una vez terminado Release 1. Release 5 requiere clientes y servicios persistentes. Release 6 puede iniciarse al final de Release 1, pero no se habilita hasta que los permisos estén validados.

---

## 6. Criterios de aceptación por capacidad transversal

| Capacidad | Aceptación mínima |
|---|---|
| Autenticación | Un usuario no autorizado no puede cargar datos ni operar rutas protegidas, aunque manipule la interfaz |
| RBAC | Cada operación se valida en backend y en reglas de datos; la UI solo oculta acciones por usabilidad |
| Persistencia | Los datos sobreviven cierre de sesión, cambio de navegador y despliegue de Vercel |
| Auditoría | Se conoce quién, cuándo, desde qué acción y sobre qué registro operó |
| Bóveda | Los secretos están cifrados en reposo, no se registran en logs y se revelan bajo autorización reforzada |
| Finanzas | Los cálculos y lotes son repetibles, idempotentes y cuentan con reverso controlado |
| Documentos | Cada archivo tiene plantilla/versionado, autor, fecha, datos de origen y copia guardada |
| Integraciones | Credenciales y llamadas se ejecutan fuera del navegador y fallan de forma segura |
| Despliegue | Un commit en `main` pasa verificaciones, Vercel construye sin instalar versiones distintas y existe reversión por commit |

---

## 7. Flujo GitHub → Vercel conservado

El proceso solicitado se mantiene. Para reducir riesgo operativo, cada mejora debe seguir este ciclo:

1. Crear un cambio pequeño con un objetivo y criterio de aceptación claros.
2. Ejecutar typecheck, lint, pruebas y build local/CI.
3. Registrar el cambio con un commit convencional y descriptivo.
4. Subirlo a GitHub; Vercel despliega automáticamente desde `main`.
5. Verificar el despliegue y anotar el resultado en el commit o issue correspondiente.
6. Si existe incidencia, revertir mediante un nuevo commit o la reversión del commit específico; no modificar producción manualmente.

Para cambios de seguridad, datos o finanzas, se recomienda usar previamente una rama de trabajo con Preview Deployment de Vercel. El despliegue definitivo sigue ocurriendo solo al integrar el commit a `main`.

---

## 8. Backlog inicial para los próximos commits

1. `docs: add production readiness master plan and correct README scope`
2. `chore: standardize pnpm and reproducible Vercel install`
3. `ci: add lint typecheck test and build verification`
4. `feat(auth): replace local authentication with Firebase Auth`
5. `feat(data): persist core operational entities in Firestore`
6. `feat(rbac): enforce server-side authorization and audit logging`
7. `security(vault): replace reversible encoding with managed encryption`
8. `feat(finance): make monthly billing batches idempotent`
9. `feat(noc): add persistent ticket SLA workflow`
10. `feat(ai): proxy Gemini through protected server endpoint`
11. `test: cover critical business and permission flows`
12. `docs: add operation, recovery and deployment runbooks`

---

## 9. Riesgos que el plan evita

- Publicar datos operativos o contraseñas con una interfaz que parece segura pero no lo es.
- Hacer que cada navegador tenga una versión distinta de clientes, tickets o cobranzas.
- Duplicar cobros al presionar varias veces la emisión mensual.
- Tratar documentos generados automáticamente como documentos regulatorios aprobados sin validación jurídica.
- Intentar conectar Vercel directamente a redes privadas de MikroTik.
- Exponer claves de Gemini, Firebase Admin o una clave maestra en el bundle del navegador.
- Romper el despliegue por instalar dependencias con gestores o lockfiles inconsistentes.

---

## 10. Definición de “sistema listo”

Control INNTEL estará listo para uso productivo cuando los módulos de alcance aprobado funcionen con usuarios reales, datos persistentes, autorización en servidor, respaldo probado, auditoría consultable, secretos protegidos, despliegue reproducible y aprobación UAT de las áreas responsables.

El diseño visual actual se conserva; la prioridad es convertir cada flujo visual en una operación confiable, segura y trazable.
