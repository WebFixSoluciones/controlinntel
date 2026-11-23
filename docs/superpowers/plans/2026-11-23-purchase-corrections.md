# Purchase corrections implementation plan

**Goal:** editar y eliminar compras desde el historial con consistencia de pagos e inventario.
**Architecture:** comandos comerciales atómicos editPurchase/deletePurchase, formulario de edición y confirmación contextual.
**Tech Stack:** TypeScript, React, Next.js, Firestore.
**Spec:** ../specs/2026-11-23-purchase-corrections-design.md

## Constraints and review focus
- Preservar los cambios ajenos en fecha-real-cobro; trabajar sobre main aislado.
- Servidor: autorización, versión, idempotencia, validación y auditoría.
- Bloquear efectos históricos sin trazabilidad y documentos derivados.
- No duplicar pagos; no permitir pagos o notas sobre compras anuladas.
- Excluir anuladas de deuda, selectores e informes; conservar consulta del historial.

## Tasks
- [x] Agregar pruebas de edición, anulación con pagos/stock, rollback, concurrencia, permisos y referencias inconsistentes; observarlas fallar.
- [x] Implementar comandos, campos de auditoría y acciones de permisos.
- [x] Conectar estado, edición, confirmación y filtros de compras activas.
- [x] Ejecutar pruebas completas, tipos, lint y build; revisar diferencias.
- [ ] Publicar y verificar interfaz y factura de pruebas en producción.

## Ledger
Se utiliza un worktree nativo basado en origin/main para no incluir el trabajo de otra rama. La autorización del usuario cubre la implementación y retirada de la factura de pruebas. Las validaciones que bloqueen datos inconsistentes se informarán sin alterarlos.

Verificación: 312 pruebas aprobadas (16 nuevas), TypeScript y build sin errores; lint sin errores con advertencias previas. Revisión independiente: se corrigieron reserva de numeración al editar y conciliación de movimientos anulados, con regresiones observadas fallar y luego pasar. Segunda revisión sin hallazgos importantes.
