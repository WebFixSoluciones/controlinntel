# Revisión de reportería y adaptación de pantallas

Fecha: 9 de noviembre de 2026, Ecuador.

## Alcance

Se revisaron Resultados, Clientes y servicios, Ventas, Compras, Gastos, Caja y bancos y Detalle financiero. Dentro del detalle se comprobaron Resumen y gráficas, Cobranzas, Gastos OPEX, Cuentas por cobrar, Cuentas por pagar y Bancos.

También se ajustó el espacio del contenido en las 13 pantallas principales que comparten la estructura de navegación. La comprobación interactiva se concentró en las 13 vistas de reportes.

## Correcciones aplicadas

| Hallazgo | Corrección |
| --- | --- |
| El cierre bancario excluía movimientos del último día cuando la fecha incluía hora. | El cálculo compara días comerciales e incluye completo el día Hasta. |
| La creación de una cuenta cerca de medianoche podía caer en otro día al usar la hora UTC. | La fecha de creación se interpreta en Ecuador. |
| En el detalle de cuentas por pagar, un abono podía ignorarse si faltaba el saldo almacenado. | Se usa el mismo cálculo de saldo en resumen y detalle; los ceros explícitos se conservan. |
| Ventas sin partidas y compras sin clasificación podían aparentar información completa. | Se identifican como información pendiente y el resultado se presenta como parcial. No se inventa la clasificación de una compra. |
| Los movimientos bancarios sin fecha no permitían un cierre histórico confiable. | Se informa la cantidad de movimientos que requieren conciliación. |
| La gráfica siempre limitaba la vista a seis meses, aunque el filtro incluyera más historia. | Se representa todo el intervalo; los períodos mayores a diez años se agrupan por año, sin descartar movimientos. |
| Los filtros podían mantenerse ocultos al cambiar de sección del detalle. | La búsqueda, estado y categoría se limpian al cambiar de sección. |
| Las exportaciones del detalle usaban un formato distinto al reporte principal. | Se unificaron CSV y Excel, con filtros y fecha de consulta incluidos. |
| El reporte podía perder ceros iniciales en identificaciones o no permitir filtrar directamente en Excel. | Los identificadores se conservan como texto; Excel incluye autofiltro, encabezado fijo y configuración de impresión. |
| La búsqueda de clientes no incluía nombre comercial y era sensible a acentos. | Se buscan nombre, nombre comercial, identificación y servicios, sin distinguir acentos. |
| Al separar permisos de deuda y tarifas, el detalle de servicios podía seguir mostrando la tarifa. | El detalle y la exportación omiten la tarifa cuando está restringida, aunque el usuario pueda consultar deudas. |
| La impresión de tablas largas podía mantener anchos mínimos de pantalla, mostrar controles o intentar conservar toda la tabla en una página. | Los reportes se imprimen en A4 horizontal, sin controles, con columnas ajustadas y encabezados repetidos. |
| Los indicadores y botones competían por espacio al reducir la pantalla. | Se ajustaron las columnas de indicadores, la distribución de acciones y los espacios compartidos. Las tablas mantienen desplazamiento horizontal dentro de su área. |
| El cuadro flotante de la gráfica podía conservar una posición fuera de pantalla al reducir el ancho o hacer zoom. | Se contiene dentro de la gráfica para que no genere desplazamiento horizontal en toda la página. |

## Validación realizada

- 214 pruebas automatizadas aprobadas.
- Comprobación de tipos sin errores y compilación de producción completada.
- 104 combinaciones de vista y ancho en Chrome automatizado: 13 vistas en 320, 360, 390, 640, 768, 1024, 1440 y 1920 píxeles, incluyendo menú y cabecera reales.
- Verificación de que los controles no salgan de su contenedor y que no aparezca desplazamiento horizontal en toda la página. El desplazamiento dentro de tablas y pestañas es intencional.
- Búsqueda por nombre con acentos y nombre comercial; filtros de fechas; exportación de los resultados filtrados y conservación de ceros iniciales en RUC.
- Excel abierto nuevamente para comprobar registros, criterios, autofiltro y orientación de impresión.
- PDF de prueba de 160 filas en 11 páginas A4 horizontales: todas las filas presentes, encabezados repetidos en las 11 páginas y controles de búsqueda ocultos.
- Verificación de restricciones de exportación y de tarifas en el reporte de clientes.

## Criterios de lectura de los reportes

Las ventas, compras, gastos y movimientos respetan las fechas seleccionadas. Las deudas, saldos a favor y saldos bancarios identificados como actuales muestran la situación vigente; no equivalen a un cierre histórico de cartera. Los bancos incluyen una reconstrucción del período con los movimientos disponibles.

El resultado operativo es una estimación de los registros cargados. Si faltan costos, clasificaciones o información histórica, el reporte lo indica. No reemplaza un estado contable con ajustes que no estén registrados en el sistema.

Las pruebas utilizaron datos simulados. No se crearon ni eliminaron registros comerciales de producción. La adaptación se verificó por anchos de pantalla y reflujo equivalente a una ventana reducida; no se realizaron pruebas físicas en Safari/iOS o Android.
