# Corrección y eliminación de compras

Solicitud: permitir editar compras y retirar la factura de pruebas 001-001-000000161 de CIDTECH, conservando consistencia financiera.

Se amplía el historial con Editar y Eliminar. La eliminación es una anulación administrativa auditada, sin borrar el comprobante del proveedor ni tramitar anulaciones ante el SRI. Solo se confirma tras mostrar proveedor, número, total y efectos.

Las compras manuales sin pagos, inventario ni documentos derivados admiten corrección de proveedor, número, fecha y partidas. En compras con efectos registrados o XML se editan notas y vencimiento; el servidor protege los campos asentados.

La anulación revierte exactamente los pagos bancarios y aplicaciones de crédito identificados, verifica que coincidan con el importe pagado y cancela la deuda. Revierte recepciones de inventario únicamente con trazabilidad suficiente y sin movimientos posteriores del producto. Retenciones y notas relacionadas bloquean la operación con una explicación. Todo sucede en una transacción, con control de versión e idempotencia.

Se consideran dos alternativas: borrado directo (descartado por dejar pagos y stock huérfanos) y anulación auditada (elegida para preservar trazabilidad y saldos). Se usan Next.js, React y transacciones Firestore ya existentes, sin dependencias nuevas.
