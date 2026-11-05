# Correcciones de sesión, ventas, cobranzas y reportes

Fecha: 4 de noviembre de 2026.
Base revisada: `dacbee3` (validación del desglose de la clave de acceso SRI).

## Sesión al recargar

La lectura de la caché marcaba la autenticación como terminada antes de que Firebase restaurara su identidad y el servidor verificara su perfil. Durante ese intervalo aparecía el login.

- La pantalla espera la resolución de Firebase y del perfil del servidor.
- Mientras espera, muestra «Restaurando sesión…».
- Las respuestas de una sesión anterior se descartan al cerrar sesión o desmontar el observador.
- La caché no concede acceso. Una validación rechazada mantiene el acceso bloqueado.
- Una lectura antigua de datos no puede sobrescribir los saldos de una lectura posterior a un cobro, reverso o devolución.

## Anticipos y notas eliminadas

La consulta de solo lectura del caso comunicado mostró un saldo de $575 ya devuelto, con estado `anulado` y `refundedAmount: 575`. La interfaz etiquetaba cualquier anticipo agotado como «Aplicado», incluso si estaba devuelto. También etiquetaba las deudas anuladas como «Pendiente».

El abono de $100 del otro comprobante tiene su propio movimiento bancario: no proviene de ese anticipo. No se alteró ningún movimiento real para forzar una coincidencia visual.

- El anticipo devuelto muestra «Devuelto» y el importe de la devolución.
- Las ventas eliminadas se ocultan en Ventas, Cobranzas y el detalle/exportación de cobranzas del reporte.
- El registro interno de anulación se conserva para no perder el historial, el movimiento bancario ni la reserva del correlativo.
- Los cobros de una venta eliminada quedan disponibles en **Finanzas → Anticipos**. Pueden aplicarse a otra deuda o devolverse mediante un egreso.
- La confirmación de eliminación informa el importe cobrado que quedará a favor y dónde administrarlo.
- Revertir una aplicación de anticipo recupera su saldo disponible y vuelve a abrir la deuda. Devolver únicamente el remanente conserva las aplicaciones que siguen vigentes.

## Reportes

- «Cobros de ventas vigentes» excluye las ventas anuladas.
- «Entradas de caja» conserva los ingresos reales, incluidos anticipos.
- «Egresos de caja» y «Devoluciones de anticipos» reflejan la devolución efectiva.
- «Flujo neto de caja» resta las salidas a las entradas; no se presenta como margen operativo.
- Los comprobantes anulados no cuentan como cartera pendiente ni como cobros vigentes.
- Las exportaciones de resumen y cobranzas siguen el mismo criterio.

Ejemplo probado: ingresos de $575 y $100; eliminación de la venta de $575; devolución de ese saldo. Resultado: **$100 cobrados en ventas vigentes, $50 pendientes, $675 de entradas históricas, $575 de devoluciones y $100 de flujo neto**. Antes de la devolución, los $575 permanecen como anticipo disponible y siguen formando parte del efectivo recibido.

## Clientes retirados y orden de documentos

- Los clientes retirados se excluyen de los selectores de nueva venta, cotización y conversión a factura.
- Un borrador con un cliente retirado no habilita la emisión.
- El servidor rechaza cotizaciones y facturación para clientes retirados; la venta comercial ya tenía esa guarda y se añadió una regresión transaccional.
- Ventas y Cobranzas ordenan por serie y número de comprobante, de mayor a menor, sin depender de la fecha ni del orden de Firestore.

## Validación

- 137 pruebas automatizadas pasan.
- Las regresiones nuevas cubren restauración de sesión, cierre durante una validación, cliente retirado, orden numérico, reverso atómico con fallo de escritura, reintentos de devolución y actualización del reporte tras eliminar una venta pagada.
- Las pruebas comerciales ejecutan los comandos reales del servidor sobre un adaptador transaccional en memoria. No constituyen una aceptación de producción en navegador.
- La revisión del caso real fue de solo lectura. No se ejecutaron cobros, devoluciones ni emisiones SRI reales.
- La compilación de producción terminó correctamente, incluida la validación de TypeScript y la generación de las 27 páginas. Permanecen advertencias previas sobre dependencias de hooks e imágenes.
