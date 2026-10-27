# Informe QA — proceso comercial de Control INNTEL

**Fecha:** 26 de octubre de 2026, zona horaria de Ecuador.  
**Versión revisada:** commit `365ce426d8124fe9b4f9395364ce835584881a60`.  
**Resultado:** **NO APROBADO para operar el ciclo comercial recurrente sin correcciones y conciliación.**

## 1. Resumen ejecutivo

La prueba encontró defectos capaces de generar notas duplicadas, duplicar cuentas por cobrar, eliminar cobros de una venta distinta, calcular incorrectamente los ingresos, facturar servicios fuera de su período y dar confirmaciones de operaciones que no se ejecutaron. Son riesgos de pérdida o distorsión de información comercial.

Las pruebas también confirmaron que algunos pasos funcionan en el escenario aislado: alta de cliente, alta de servicio de catálogo, selección de categoría del catálogo, alta de producto, prevención de una sobreventa simple, salida de kardex, registro de compra a crédito, costo promedio, alta de cuenta bancaria y pago parcial a proveedor.

**Alcance y límite importante:** la prueba interactiva se hizo en una copia local de la aplicación con Firestore y autenticación sustituidos por simuladores locales y datos ficticios. Se conservaron las pantallas y la lógica comercial del proyecto. Esto permite verificar el flujo de interfaz y operaciones del estado, pero **no certifica las reglas reales de Firebase, la API del servidor, concurrencia real entre equipos, correo, impresión física, despliegue ni integraciones externas**. Los datos reales no fueron modificados.

La auditoría **excluye deliberadamente la evaluación funcional del módulo Facturación SRI**. La suite automática general del repositorio también contiene pruebas de SRI y se ejecutó completa al inicio; sus resultados no se usan aquí como evaluación de ese módulo.

## 2. Preparación y método

- Navegador: Chromium del entorno de escritorio; ejecución local de la versión compilada.
- Cliente ficticio: **PRUEBA CLIENTE QA**; servicio ficticio de conectividad, producto **ROUTER QA**, proveedor ficticio y **BANCO QA**.
- Modalidades: inspección de prepago y postpago y prueba directa de la función de recurrencia con datos simulados.
- Validaciones: interfaz, funciones reales extraídas de `src/lib/state.tsx` ejecutadas con dependencias simuladas, lectura del código relacionado y pruebas automáticas existentes.
- Cada hallazgo indica si se **reprodujo en interfaz**, en **función aislada** o si procede de **revisión de código**. La función aislada no prueba comunicación ni transacciones reales en Firebase.
- La suite general terminó con **87 pruebas aprobadas y cero fallidas**. No debe interpretarse como 87 pruebas integrales de navegador: varios casos llamados E2E verifican operaciones aritméticas o buscan cadenas en archivos, sin recorrer la aplicación y su base real.
- Los experimentos reproducibles de lógica están en `docs/qa-evidencias/qa-recurrence.cjs` y `docs/qa-evidencias/qa-payment.cjs`. Desde la raíz del proyecto pueden ejecutarse con `node docs/qa-evidencias/qa-recurrence.cjs` y `node docs/qa-evidencias/qa-payment.cjs`. No escriben en Firebase.

### Flujo ejecutado

| Etapa | Resultado observado |
|---|---|
| Alta cliente | Creado PRUEBA CLIENTE QA; visible en directorio y ficha 360. |
| Catálogo de servicios | Creado servicio de $100 sin IVA y $115 con IVA. Filtro de categoría del catálogo respondió al cambiar de categoría. |
| Asignación de servicio | Se asignó un servicio prepago; se guardaron nombre, categoría, tarifa y frecuencia. Se observó contradicción entre día de cobro y próxima fecha. |
| Venta recurrente | Se generaron dos notas de $115 para el mismo cliente y período. Se crearon cobros duplicados y un servicio adicional. |
| Cobranza | Un abono de $50 redujo un registro de $115 a $65 y aumentó el banco simulado. Existía otro registro pendiente por la misma nota. |
| Inventario y venta | Producto con 10 unidades: se rechazó vender 11; al vender 2 quedaron 8. Kardex registró entrada 10 y salida 2. |
| Eliminar venta | Se eliminó una venta distinta de producto; desapareció además el registro de cobro de otra nota y su abono parcial de $50. El saldo bancario conservó ese ingreso. |
| Bancos | Cuenta ficticia creada por $1.000; el pago ficticio de $100 a proveedor redujo la cuenta a $900. |
| Compra y CxP | Compra de 5 unidades a $40: subtotal $200, IVA $30, total $230; pago parcial de $100 dejó $130. Stock final 15 y costo promedio $46,67. |
| Reportes | Tras los abonos de $50 y $40, los ingresos del reporte fueron $130 en lugar de $90 de ingresos bancarios observados. |
| Impresión | Se visualizó la nota de venta y sus importes; no se ejecutó impresión física ni se certificó el archivo PDF/CSV resultante. |

## 3. Hallazgos críticos y altos

### QA-01 — Un mismo servicio y período admiten notas repetidas

**Prioridad:** crítica. **Evidencia:** interfaz y función aislada.

1. Asignar un servicio activo de $100 + IVA al cliente.
2. En Ventas → Recurrentes seleccionar octubre 2026 y generar nota.
3. Cerrar la vista previa y pulsar **Re-emitir NV**.

**Observado:** se emitieron dos notas distintas por $115 para el mismo período, sin advertencia de duplicidad ni sustitución de la anterior. La función aislada creó 2 notas y mantuvo una única referencia periódica de cobro. El control de lote considera el período, pero el botón individual permite reemitir y el emisor no verifica unicidad antes de crear.

**Impacto:** sobreventa documental, cobro duplicado, balances y reportes erróneos.

**Código:** `src/components/modules/billing/RecurringBillingView.tsx:126`, `:234`, `:263`, `:664`; `src/lib/state.tsx:3296`.

**Acción recomendada:** definir la política de reemisión; prevenir doble emisión con clave única cliente/servicio/período y operación atómica. Si se desea reimprimir, reutilizar la nota existente; si se desea sustituir, exigir motivo y anular o corregir explícitamente la anterior.

### QA-02 — Una emisión recurrente crea dos cuentas por cobrar de la misma nota

**Prioridad:** crítica. **Evidencia:** interfaz y revisión de código.

Tras dos notas de $115, Cobranzas mostró tres filas por $115, dos de ellas para el mismo número. Cuentas por Cobrar mostró $345 emitidos cuando las dos notas sumaban $230.

`createInvoice` crea una cuenta `chg-inv-...` y el emisor recurrente crea otra `chg-cliente-mes-año`; la lista comienza con todas las cuentas ya guardadas y solo evita agregar comprobantes sintéticos adicionales, no elimina duplicados dentro de esas cuentas.

**Código:** `src/lib/state.tsx:3163`, `:3368`; `src/components/modules/finance/FinanceDashboard.tsx:149`.

**Impacto:** cartera duplicada, saldos incorrectos, aplicación de abonos a una copia mientras la otra permanece pendiente.

### QA-03 — Eliminar una venta borra un cobro de otra venta del mismo cliente y mes

**Prioridad:** crítica. **Evidencia:** interfaz.

1. Registrar dos notas recurrentes por $115 y abonar $50 a una de ellas.
2. Registrar otra nota distinta por venta de dos routers y después eliminar solo esta última.
3. Consultar Cobranzas.

**Observado:** el cobro parcialmente pagado de la nota recurrente desapareció, mientras sus notas seguían en Ventas y el banco aún mostraba el ingreso de $50.

**Causa identificada:** la cascada de eliminación incluye una coincidencia por `cliente + mes + año`, independientemente de la nota que originó el cobro. Además, algunos movimientos están vinculados a la otra nota, por lo que pueden quedar sin su registro de cobranza.

**Código:** `src/lib/state.tsx:3926`, `:4132`, especialmente `:4138`.

**Acción recomendada:** asociar cada cobro y movimiento exclusivamente por identificadores de origen, conciliar abonos/anticipos antes de una reversión y probar operaciones con dos ventas del mismo cliente y período.

### QA-04 — Eliminar “cobro” también elimina la nota de venta

**Prioridad:** crítica. **Evidencia:** interfaz.

En Cobranzas → Eliminar Cobro, la advertencia indica que se removerá el cobro asociado; al confirmar, el resultado informa **Comprobante Eliminado**. El método llama a `deleteInvoice` para cobros vinculados.

**Impacto:** un operador que pretende eliminar o corregir un cobro puede eliminar la venta y provocar sus cascadas de inventario, servicios y finanzas.

**Código:** `src/lib/state.tsx:2351`; confirmación en `src/components/modules/finance/FinanceDashboard.tsx`.

**Acción recomendada:** diferenciar eliminar abono, anular cobro y anular venta; mostrar consecuencias exactas y conservar trazabilidad.

### QA-05 — Prepago y postpago no determinan el período facturado

**Prioridad:** alta. **Evidencia:** función aislada y revisión de código.

Se simuló un servicio prepago y otro postpago para noviembre 2026. Ambos se emitieron como **Mensual 11/2026** con el mismo tratamiento y la misma fecha de avance. El selector se guarda, pero el emisor no consulta `billingType`, `billingDay` ni `advanceNoticeDay`.

**Impacto:** no se garantiza cobrar por anticipado el período siguiente ni por vencido el período consumido; el día y el aviso configurados no gobiernan la emisión.

**Código:** `src/components/modules/clients/ClientContractTab.tsx:502`; `src/lib/state.tsx:3296`–`:3405`.

**Acción recomendada:** acordar reglas de negocio de período devengado/cobrado, fecha de emisión, vencimiento y avisos para cada modalidad; cubrir altas a mitad de mes, meses cortos, cambios de modalidad y zonas horarias.

### QA-06 — No se comprueba si el servicio corresponde al período o ya fue facturado

**Prioridad:** crítica. **Evidencia:** función aislada.

Un servicio anual con próxima renovación en octubre de 2027 fue incluido al solicitar noviembre de 2026. La función solo filtra cliente, estado y bandera facturable; no compara fecha de inicio, próxima renovación, vigencia, período previamente facturado o renovación automática.

**Impacto:** se puede cobrar por adelantado o de nuevo un servicio anual/semestral/trimestral no exigible, y avanzar su fecha de renovación indebidamente.

**Código:** `src/lib/state.tsx:3305`–`:3312`, `:3389`.

### QA-07 — Filtro de frecuencia no limita lo que se factura

**Prioridad:** alta. **Evidencia:** revisión de código.

La tabla filtra los servicios visibles según frecuencia; al emitir, envía únicamente el identificador del cliente, mes y año. La función de emisión vuelve a seleccionar **todos** los servicios activos facturables del cliente. Así, un filtro “Mensual” puede mostrar un importe y generar una nota que incluya un servicio anual.

**Código:** `src/components/modules/billing/RecurringBillingView.tsx:103`, `:234`; `src/lib/state.tsx:3305`.

### QA-08 — IVA recurrente fijo y tarifa cero sustituida

**Prioridad:** alta. **Evidencia:** función aislada.

Con un servicio cuya tarifa personalizada era $0, tarifa base $100 e IVA configurado 0 %, el cálculo arrojó $100 + 15 % = $115. El operador puede configurar tasas distintas, pero el emisor usa `customPrice || basePrice` y fija 15 %. La vista previa de recurrencia también suma 15 % al subtotal.

**Impacto:** importe y clasificación tributaria del documento comercial pueden diferir de lo contratado. El caso de tarifa cero es una prueba de robustez de la función; el formulario actual exige una tarifa positiva para nuevas asignaciones.

**Código:** `src/lib/state.tsx:3314`–`:3327`; `src/components/modules/billing/RecurringBillingView.tsx:123`.

### QA-09 — La venta recurrente crea un servicio adicional

**Prioridad:** alta. **Evidencia:** interfaz y revisión de código.

Tras asignar un servicio y emitir notas recurrentes, la tabla pasó de 1 a 2 servicios activos y mostró $230 pendientes, aunque solo se había contratado uno. El proceso general de venta busca servicios pendientes por producto o nombre; si no coincide, agrega un nuevo servicio. La línea recurrente incorpora el período en el nombre y una segunda emisión ya no encuentra el servicio pendiente.

**Código:** `src/lib/state.tsx:3211`–`:3270`, `:3319`.

**Impacto:** crecimiento artificial de servicios, cargos futuros y recuentos del abonado.

### QA-10 — Se permiten abonos superiores al saldo

**Prioridad:** alta. **Evidencia:** función aislada y validación de interfaz revisada.

Caso reproducido: cuenta de $100 con $70 ya pagados y saldo $30; registrar pago de $100 dejó pagado acumulado limitado a $100 y saldo 0, pero guardó un abono y movimiento bancario de $100 y descontó $100 del saldo global del cliente.

**Esperado:** rechazar el exceso o registrarlo explícitamente como anticipo/saldo a favor con trazabilidad.

**Código:** `src/lib/state.tsx:2236`–`:2316`; `src/components/modules/finance/AccountsReceivableTab.tsx:40`.

### QA-11 — Reportes duplican ingresos e incluyen pagos de proveedores como OPEX

**Prioridad:** alta. **Evidencia:** interfaz y revisión de código.

Tras dos ingresos bancarios ficticios de $50 y $40, el reporte mostró **$130**: cuenta los $90 de movimientos de ingreso y vuelve a sumar el abono de $40 que aún estaba en cartera. Los $50 cuyo cobro había sido eliminado solo permanecían como movimiento. Además, un abono de $100 de una compra de inventario apareció como “Gastos OPEX”.

**Código:** `src/components/modules/finance/FinancialReportsTab.tsx:92`–`:125`.

**Impacto:** ingresos, flujo neto, margen y clasificación de gastos no son confiables. Un pago de deuda, una compra de activo y un gasto operativo no deben mezclarse automáticamente.

### QA-12 — La aplicación afirma que envió un correo sin enviarlo

**Prioridad:** alta. **Evidencia:** interfaz y código.

Al registrar la nota de venta, la pantalla mostró “✓ Enviado” para el correo ficticio. El estado inicial es `sent` y el botón de reenvío solo espera 700 ms y muestra éxito; no se llama a un proveedor de correo en ese manejador.

**Impacto:** el personal puede creer que el cliente recibió la nota y dejar de notificarlo.

**Código:** `src/components/modules/billing/NewSaleView.tsx:203`, `:1600`–`:1617`.

### QA-13 — Guardados y eliminaciones comerciales pueden fallar sin informar

**Prioridad:** crítica. **Evidencia:** revisión de código; pendiente reproducción con Firebase real.

En `syncToFirestore` y `deleteFromFirestore`, si falla la API y luego Firestore, los errores se propagan solo para algunas colecciones; las de ventas, servicios, inventario, bancos y cobranzas no figuran en la lista. Varias operaciones además no esperan la persistencia. La interfaz puede continuar y mostrar éxito aunque la nube rechace una parte.

El archivo local de reglas declara nombres como `charges`, `inventoryItems` y `warehouses`, mientras el estado usa `monthlyCharges`, `inventoryProducts`, `inventoryWarehouses` y `billingInvoices`. Bajo esas reglas locales, el acceso directo de respaldo a colecciones no declaradas está denegado. **No se verificó qué reglas están desplegadas**.

**Código:** `src/lib/state.tsx:501`–`:543`; `firestore.rules:59`, `:98`, `:104`.

**Acción recomendada:** propagar fallos, unificar nombres y permisos, hacer escrituras relacionadas de forma transaccional e informar estado de sincronización. Validar contra un proyecto de pruebas real, con desconexión y rechazo de permisos.

### QA-14 — Permisos de base operativa y acceso maestro requieren revisión urgente

**Prioridad:** crítica. **Evidencia:** revisión de código; sin pruebas invasivas en producción.

El cliente contiene una ruta de acceso maestro con combinaciones fijas y una comparación de contraseñas de cuentas en el cliente. Las reglas locales permiten lectura/escritura de varias colecciones financieras a cualquier usuario autenticado, sin comprobar rol dentro de las reglas.

**Impacto:** la seguridad depende de controles de interfaz que pueden eludirse; se pone en riesgo la integridad de saldos y datos. No se verificaron reglas desplegadas ni se intentó acceso a datos reales.

**Código:** `src/lib/state.tsx:938`–`:956`, `:1012`; `firestore.rules:37`–`:104`.

## 4. Hallazgos funcionales y UX/UI

### QA-15 — Categoría técnica y frecuencia pueden contradecirse

**Prioridad:** media. **Evidencia:** interfaz.

En la ficha del cliente elegí **Hosting Web (Anual)** y la frecuencia continuó **Mensual**; se pudo asignar con ambas opciones contradictorias. El selector sí se guarda como categoría técnica y aparece como etiqueta: no está completamente inactivo. Sin embargo, al modificarlo no cambia automáticamente la frecuencia ni impide una combinación contradictoria.

El **filtro de categoría del catálogo de servicios** es otro control distinto: durante la prueba sí filtró el servicio según su categoría. No se debe confundir con el selector técnico de asignación.

**Código:** `src/components/modules/clients/ClientContractTab.tsx:1232`; `src/components/modules/inventory/InventoryManager.tsx:294`, `:968`.

### QA-16 — Próximo cobro contradice el día de facturación predeterminado

**Prioridad:** alta. **Evidencia:** interfaz.

Con inicio 26/10/2026 y día de facturación 1, el formulario propuso próximo cobro 26/11/2026. La fecha inicial se calcula sumando un mes al inicio y solo se ajusta al día si el usuario cambia manualmente el selector.

Al elegir día 30 se construye una cadena con ese día sin limitar el último día del mes; febrero puede generar una fecha inválida.

**Código:** `src/components/modules/clients/ClientContractTab.tsx:88`, `:448`–`:458`.

### QA-17 — Se promete facturación automática sin mecanismo programado comprobado

**Prioridad:** alta. **Evidencia:** interfaz y revisión del repositorio.

El formulario ofrece “Auto-Facturación Recurrente” y afirma que factura automáticamente. Se guarda `autoRenew`, pero la emisión localizada se invoca desde botones de la vista y no se identificó un planificador en el proyecto que procese fechas de facturación. La búsqueda de código no prueba ausencia de un servicio externo fuera del repositorio.

**Código:** `src/components/modules/clients/ClientContractTab.tsx:509`, `:1350`; `src/components/modules/billing/RecurringBillingView.tsx:230`.

### QA-18 — Trimestral y semestral se presentan como mensual en notas y filtros

**Prioridad:** media. **Evidencia:** función aislada y código.

Un servicio trimestral generó el texto “Mensual 10/2026”, aunque la fecha de renovación avanzó tres meses. El selector de frecuencia de la vista principal solo ofrece mensual y anual; la etiqueta resumida trata los demás casos como mensual.

**Código:** `src/lib/state.tsx:3321`, `:3392`; `src/components/modules/billing/RecurringBillingView.tsx:60`, `:131`, `:455`.

### QA-19 — Se usa fecha UTC para documentos y pagos en lugar de fecha local

**Prioridad:** alta. **Evidencia:** interfaz y código.

Durante la prueba del 26 de octubre en Ecuador, formularios de venta, compra y cobro se inicializaron con 27 de octubre. Varios controles usan `new Date().toISOString().slice(0, 10)`, que toma el día UTC. Otras partes utilizan una función específica de Ecuador; esto produce fechas incoherentes dentro del mismo flujo.

**Código:** `src/components/modules/billing/NewSaleView.tsx:216`; `src/components/modules/purchases/NewPurchaseView.tsx:54`; `src/components/modules/finance/FinanceDashboard.tsx:111`; `src/components/modules/finance/AccountsPayableTab.tsx:34`.

### QA-20 — La fecha de venta cambia visualmente cuando se abona un cobro

**Prioridad:** media. **Evidencia:** interfaz.

La fila recurrente pasó de mostrar 01/10/2026 a 27/10/2026 en la columna **Fecha venta** al abonar. La cuenta recurrente carece de `saleDate` y la pantalla usa `paymentDate` como reemplazo.

**Código:** `src/lib/state.tsx:3368`; `src/components/modules/finance/FinanceDashboard.tsx:722`.

### QA-21 — Gráficos y porcentajes presentan datos ficticios

**Prioridad:** alta. **Evidencia:** revisión de código e interfaz.

El gráfico de reportes incorpora valores fijos para cinco meses y, cuando el valor real es cero, lo sustituye por cifras de demostración. El dashboard también muestra porcentajes fijos y un gráfico con meses históricos predefinidos.

**Impacto:** el usuario puede interpretar cifras de demostración como resultados reales.

**Código:** `src/components/modules/finance/FinancialReportsTab.tsx:210`–`:224`; `src/components/modules/dashboard/FinancialChart.tsx:24`; `src/components/modules/dashboard/MetricsCards.tsx:34`, `:54`.

### QA-22 — La numeración comercial depende de datos locales del navegador

**Prioridad:** alta. **Evidencia:** revisión de código; concurrencia real no probada.

El siguiente número de nota se calcula a partir del máximo de `billingInvoices` cargado en el navegador. Dos operadores que emitan simultáneamente pueden seleccionar el mismo número si no existe una reserva transaccional del correlativo.

**Código:** `src/lib/state.tsx:2960`–`:2973`.

### QA-23 — Al borrar un servicio se pueden borrar cuentas pendientes

**Prioridad:** alta. **Evidencia:** revisión de código.

La eliminación del servicio borra cobros pendientes sin pagos si es el último servicio del cliente o si su descripción contiene el nombre del servicio. Se identifican por texto y no siempre por la nota exacta; por tanto, podrían desaparecer cuentas vinculadas a ventas que siguen existiendo. No se ejecutó el caso en interfaz.

**Código:** `src/lib/state.tsx:1879`–`:1913`.

### QA-24 — Al borrar una venta parcialmente pagada se resta el total al saldo del cliente

**Prioridad:** alta. **Evidencia:** revisión de código.

La reversión utiliza `currentBalance - inv.total` en vez de identificar el saldo pendiente atribuible a la venta y los pagos efectivamente aplicados. Si el cliente tiene otras deudas, una venta de $100 con $70 pagados debería quitar $30 de deuda; restar $100 puede borrar $70 de deuda ajena. No se comprobó con un segundo cliente en Firebase real.

**Código:** `src/lib/state.tsx:4042`–`:4050`.

### QA-25 — Clasificación y selección de categorías: confusión de diseño

**Prioridad:** media. **Evidencia:** interfaz y código.

Al crear un servicio, el formulario seleccionó por defecto una categoría de equipos de red, aun existiendo una categoría de servicios. El filtro del catálogo ofrece todas las categorías de productos y servicios. Al asignar, existe además otra categoría técnica separada. Esto aumenta la probabilidad de clasificar mal un servicio.

**Código:** `src/components/modules/inventory/ProductModal.tsx:100`, `:453`; `src/components/modules/inventory/InventoryManager.tsx:968`.

### QA-26 — Tarifa, nodo, velocidad y dirección técnica predeterminados no son datos reales del contrato

**Prioridad:** media. **Evidencia:** revisión de código.

La asignación manual fija 100/100 Mbps, nodo central, DHCP y un usuario generado, sin solicitar ni validar esos datos en la ficha de asignación. En la nota impresa aparecieron “100 Mbps / 100 Mbps • IP: DHCP”, aunque en la prueba solo se había elegido un servicio comercial.

**Código:** `src/components/modules/clients/ClientContractTab.tsx:519`–`:529`; `src/lib/state.tsx:3322`.

**Impacto:** información técnica y documento comercial pueden afirmar características no confirmadas.

### QA-27 — La cabecera “Últimas ventas” dirige a Facturación SRI

**Prioridad:** media. **Evidencia:** interfaz y código.

En Dashboard, “Ver todas” bajo Últimas ventas dirige a `/facturacion?sub=facturas`, aunque las notas comerciales se administran en Ventas. Puede llevar al usuario al módulo excluido cuando solo busca sus ventas internas.

**Código:** `src/components/modules/dashboard/RecentSalesCard.tsx`.

### QA-28 — Exportación rotulada “CSV / Excel” produce CSV

**Prioridad:** baja. **Evidencia:** código.

El botón se llama “Exportar CSV / Excel”; la implementación genera únicamente `.csv`, no un archivo `.xlsx`. Debe especificar el formato o proporcionar ambas opciones. No se verificó la apertura del archivo en Excel.

**Código:** `src/components/modules/finance/FinancialReportsTab.tsx:229`, `:304`–`:314`.

## 5. Verificaciones positivas y observaciones

1. **Cliente:** el alta creó y mostró el abonado ficticio en el directorio.
2. **Categoría del catálogo:** al filtrar por una categoría distinta, el servicio dejó de aparecer como se esperaba. Esto no demuestra que todas las categorías, permisos o datos heredados funcionen.
3. **Stock y kardex:** se rechazó vender 11 unidades cuando había 10; vender 2 registró salida por 2 y saldo 8. Después de eliminar esa venta y comprar 5 unidades, el inventario mostró 15 unidades a costo promedio $46,67, consistente con 10 a $50 más 5 a $40.
4. **Compra a crédito y CxP:** compra de $230, abono de $100, saldo $130; cuenta bancaria de prueba pasó de $1.000 a $900.
5. **Vista previa:** la nota comercial mostró cliente, detalle, impuestos, total y condición de crédito. No se validó el contenido de una impresión física ni el archivo generado.

## 6. Cobertura pendiente

Este informe no equivale a una certificación integral de todas las pantallas. Quedan pendientes, como mínimo:

- Repetir el flujo de extremo a extremo contra un proyecto Firebase de pruebas con autenticación y reglas reales; comprobar reinicio, recarga, dos usuarios y desconexión.
- Crear varios clientes, categorías y productos con IVA distinto; emitir mensual/trimestral/semestral/anual, prepago y postpago en el límite de mes, febrero y cambio de año.
- Probar en conjunto edición, anulación y eliminación de ventas con pagos parciales/múltiples, anticipos, servicios compartidos y varias bodegas; conciliar todos los registros.
- Probar proveedores catalogados, crédito, notas de proveedor y pagos completos, duplicados y concurrentes; verificar las reglas de negocio de inventario y CxP.
- Verificar exportaciones descargadas y sus valores en Excel; generar PDF y probar impresión A4 y POS en un entorno controlado.
- Revisar permisos por rol, accesibilidad de teclado y lector de pantalla, móvil, navegadores y rendimiento con volumen realista.
- Auditar el módulo Facturación SRI en una etapa posterior, tal como solicitó el usuario.

## 7. Orden recomendado de corrección

1. **Contención:** bloquear reemisión duplicada y la cascada de cobros ajenos; revisar accesos maestros y reglas desplegadas; evitar borrar información comercial sin reversión identificada.
2. **Integridad financiera:** un solo origen de cuentas por cobrar, límites de abonos, pagos/anticipos conciliados, cálculo correcto de ingresos/gastos y operaciones atómicas.
3. **Motor recurrente:** reglas explícitas de prepago/postpago, elegibilidad por vigencia/frecuencia/período, IVA individual, prevención de servicios duplicados y numeración concurrente segura.
4. **Interfaz:** corregir fecha Ecuador, coherencia categoría/frecuencia y próximo cobro, notificaciones reales, navegación e indicadores con datos reales.
5. **Aceptación:** pruebas integrales automatizadas contra Firebase de pruebas y prueba manual de usuario con conciliación de stock, cartera y bancos.

**Nota:** no se modificó el código de la aplicación ni se desplegaron cambios como parte de esta auditoría.
