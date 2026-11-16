# QA del proceso de venta administrativa

Fecha: 16 de noviembre de 2026.

## Resultado ejecutivo

Se probaron altas de clientes, ventas administrativas, servicios ya asignados, precios con/sin IVA, cantidades enteras y fraccionarias, descuentos por partida y generales, pagos, crédito, inventario, edición, anulación y permisos. Se corrigieron los fallos encontrados y se verificó el recorrido con la interfaz real de Next.js, Firebase Authentication y Firestore locales.

- 275 pruebas automatizadas aprobadas, sin fallos.
- 7.056 combinaciones de cantidades, IVA y descuentos contrastadas con un cálculo decimal independiente basado en enteros grandes.
- Aceptación HTTP con autenticación real del emulador y un rol vinculado que únicamente habilita Ventas.
- Aceptación en Chrome: iniciar sesión, crear un cliente societario desde Ventas, elegir cliente y producto, aplicar descuentos, emitir la nota y comprobar los registros guardados.
- Comprobaciones de presentación a 360, 768 y 1440 píxeles.

No se realizaron operaciones comerciales de prueba sobre los datos reales de la empresa.

## Fallos encontrados y corregidos

| Área | Fallo | Corrección |
| --- | --- | --- |
| Porcentajes | Redondear el descuento antes de calcular la partida podía volver a alterar el total un centavo | Se conserva el cálculo preciso del descuento y la referencia del precio con IVA hasta cerrar la partida. Pantalla y servidor comparten cálculo. |
| Descuento general en dólares | Redondear cada reparto proporcional podía perder o añadir centavos | El reparto asigna centavos completos y distribuye el remanente de forma determinista. |
| IVA combinado | El resumen de venta agrupaba todas las bases gravadas como 15%; editar una venta con 5% podía omitir esa base del total | Bases por tasa y suma de los totales de todas las partidas. |
| Rol limitado a Ventas | Sin habilitar Clientes, Inventarios o Finanzas, faltaban datos para elegir cliente, producto y cuenta | El servidor entrega directorios comerciales mínimos sin habilitar esas pantallas ni entregar costos, claves o saldos bancarios. |
| Alta rápida | El botón de crear cliente no distinguía el permiso necesario | Nuevo permiso «Crear clientes desde Ventas». El botón y el servidor lo comprueban. No concede editar o retirar clientes. |
| Alta con servicio embebido | Autorizar crear cliente podía invocar una asignación de servicio adicional sin comprobar su acción específica | Crear un cliente con servicio exige también autorización para asignarlo. |
| Pagos combinados | Efectivo, transferencia y tarjeta se consolidaban en un solo abono con un único medio y cuenta | Cada medio produce su abono, referencia, aplicación y movimiento; el efectivo usa su caja y los medios bancarios su cuenta. |
| Validación de pago | Valores negativos dentro de una distribución podían compensarse entre sí; la interfaz toleraba un faltante de un centavo | Validación individual de importes y cobertura exacta en centavos. Se validan las formas de pago. |
| Venta con descuento del 100% | Una deuda de cero podía quedar marcada como pendiente | Queda pagada con saldo cero y sin movimientos ficticios de dinero. |
| Cliente del comprobante | Campos de contacto enviados junto con otro identificador de cliente podían resultar inconsistentes | Nombre, identificación, correo, teléfono y dirección se toman del cliente seleccionado en el servidor. |
| Borradores | Incluir un identificador de servicio podía evitar la comprobación de su tarifa en borrador | Se verifica pertenencia del servicio y tarifa cuando el usuario no tiene permiso para cambiar precios. |
| Edición | Era posible referenciar artículos inexistentes o introducir un artículo inactivo | Se validan los artículos antes de confirmar la modificación. Se comprueba también la pertenencia de los servicios al cliente. Los descuentos precisos mantienen su permiso específico y la edición conserva el cálculo compartido. |
| Navegación | Historial, Servicios o Archivos podían enviar a un vendedor a una ficha no autorizada | El historial tiene una alternativa dentro de Ventas filtrada por cliente; los accesos a la ficha requieren sus permisos. |
| Historial comercial | Un vendedor sin Finanzas podía carecer del estado actualizado de cobro de sus notas | Recibe el resumen de cartera de las notas autorizadas, sin detalles internos de pagos ni deudas ajenas al historial permitido. |

## Matriz de aceptación

### Clientes y asignación

- Alta con cédula, RUC de persona natural, RUC societario, RUC público y pasaporte.
- Prevención de duplicados y conservación de los parámetros de validación actuales.
- Crear un cliente no crea una nota ni factura automática.
- El cliente retirado se excluye del selector y el servidor rechaza venderle.
- Elegir el cliente A genera la nota, deuda y saldo del cliente A, incluso si una petición incluye datos descriptivos del cliente B.
- El cliente B conserva su saldo.
- Un servicio ya asignado admite una venta administrativa independiente.
- Una venta emitida conserva cliente y fecha al editar; corregir una asignación errónea requiere anulación y registro correcto, sin trasladar deudas silenciosamente.

### Importes y descuentos

Se usaron precios finales de 0.01, 0.03, 1, 2, 5, 14.99, 80, 121.97, 140, 150, 199.99, 350, 575 y 9999.99; IVA de 0%, 5%, 12% y 15%; cantidades de 0.125, 0.5, 1, 2, 3, 7, 12.345, 100 y 1000; descuentos de línea de 0%, 2%, 10%, 12.5%, 25%, 50% y 100%, combinados con descuento general de 0% o 10%.

Cada combinación comprueba total esperado, igualdad entre base más IVA y total, coherencia del descuento publicado con la base redondeada, y coincidencia al recalcular las partidas en el servidor. El valor esperado se calcula con fracciones de enteros, independientemente de la función monetaria usada por la aplicación.

Se comprueban adicionalmente descuentos generales de 0.01, 0.02, 1, 7.77, 15 y 30 distribuidos entre varias partidas e impuestos; límite del descuento, ausencia de negativos y rechazo de cantidades inválidas.

Ejemplos comprobados:

| Caso | Resultado |
| --- | ---: |
| Precio final 150 × 2, descuento por línea 10% y general 10% | 243.00 |
| Precio final 5 × 0.5, descuento 10% | 2.25 |
| Tres partidas de base 10 con IVA 0%, 5% y 15% | 32.00 |
| Mismas partidas, editadas a cantidad 2 | 64.00 |
| Descuento autorizado del 100% | 0.00; saldo pagado |
| Venta 150 cubierta con 149.99 y sin crédito por el centavo faltante | Rechazada |

Los precios unitarios conservan hasta seis decimales; los importes monetarios presentados permanecen en centavos. La precisión adicional del descuento es una referencia de cálculo interna. El descuento monetario publicado se concilia con las bases redondeadas; editar una partida utiliza el mismo motor y conserva el descuento monetario preciso ya concedido, salvo que se modifique expresamente. La ficha técnica del SRI diferencia la precisión del precio unitario y la cantidad: [especificaciones del SRI](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/fbb05cf5-32f2-4cc3-bc8a-b539c9e0ed74/FICHA%2BTECNICA%2BCOMPROBANTES%2BELECTRO%EF%BF%BDNICOS%2Boffline.pdf).

### Pagos, cartera e inventario

- Venta a crédito, cobro parcial y cobro final: saldo, abonos y banco coinciden.
- Mezcla de efectivo, transferencia, tarjeta y crédito: conserva cada medio y referencia.
- Para combinar efectivo con medios bancarios debe existir una caja activa única o especificarse su cuenta; una ambigüedad devuelve un error y no guarda parte de la venta.
- Stock y kardex disminuyen por la cantidad vendida; los servicios no generan salidas físicas.
- Stock insuficiente revierte nota, secuencial, cobros y demás efectos de la transacción.
- Repetir la misma confirmación con su identificador de operación no duplica nota, stock ni cobro, incluso con peticiones concurrentes.
- Anular quita la deuda de la cartera operativa; las pruebas anteriores de devolución a anticipos y reversión financiera continúan aprobadas.
- Una edición pagada no puede reducir el total por debajo de lo aplicado sin resolver el excedente.

### Roles y seguridad

- Superadministrador, administrador general y usuario vinculado a un rol personalizado de Ventas.
- El nombre del rol no sustituye sus permisos: un rol denominado «Ventas» debe habilitar Nueva venta y Emitir notas de venta, además de la visibilidad de importes necesaria.
- Crear clientes desde Ventas, editar documentos y precios, aplicar descuentos y anular son autorizaciones independientes. En la matriz actual, editar una nota y sus precios comparten «Editar documentos y precios»; sin ese permiso se deniegan también cambios de cantidad en notas y borradores.
- Registrar cobros posteriores en Finanzas sigue requiriendo su permiso; registrar un pago inicial forma parte de la emisión autorizada de la venta.
- Apagar el módulo o revocar Emitir notas bloquea el servidor.
- Revocar un permiso en el rol se aplica en la siguiente petición con el mismo token, sin volver a iniciar sesión.
- Una cuenta inactiva pierde acceso y Firestore rechaza escrituras directas que intentan evitar las operaciones del servidor.
- El alta rápida informa los errores del servidor dentro de la aplicación y ambos accesos de creación respetan el permiso. El bloque de parámetros usa el ancho completo disponible para evitar superposición de etiquetas.
- Los directorios adicionales no conceden acceso al menú Clientes, Inventarios, Finanzas o Configuración; no incluyen contraseñas, costos ni saldos de cuentas bancarias.

## Evidencia con interfaz y backend reales locales

Los scripts reproducibles son:

- `scripts/qa-sales-emulator.mjs`: crea cuentas y rol de prueba, autentica contra Firebase Auth Emulator y ejecuta las rutas HTTP reales de Next.js. Comprueba la base Firestore Emulator tras cada operación y prueba revocación de permisos.
- `scripts/qa-sales-browser.cjs`: inicia sesión en la aplicación real con Chrome, crea un cliente societario desde Ventas, selecciona cliente y catálogo, aplica cantidades y descuentos, confirma la nota y compara con lo devuelto por la API.

Ambos exigen localhost. El script HTTP exige además los emuladores en 127.0.0.1:8080 y 127.0.0.1:9099 y utiliza exclusivamente `demo-controlinntel-qa`. Reinicia únicamente ese proyecto de prueba. El servidor local debe arrancarse con ese mismo proyecto y ambos emuladores configurados.

La venta de navegador usa cantidad 2, precio final 150, descuentos del 10% y 10% y período de octubre: confirma y guarda 243.00. Se comprobaron también el historial permitido y la presentación en móvil, tableta y escritorio. Se guardaron capturas y resultados en la carpeta temporal local. Las etiquetas de fecha, establecimiento y bodega se comprobaron por sus límites visibles para detectar superposiciones, además del ancho de la página.

Incidencia del entorno de QA: una ejecución de navegador simultánea con la compilación de producción agotó la espera mientras aparecía «Restaurando sesión». Al repetirla con la compilación terminada, el recorrido completo concluyó correctamente en menos de seis segundos. Para reproducir la aceptación, ejecutar la compilación y el navegador de forma secuencial; no se atribuye esa corrida interrumpida a una validación comercial.

## Alcance y límite de la conclusión

Se comprobó la preparación de una factura electrónica a partir de la nota, conservando cliente, descuento y total, sin repetir el movimiento de inventario. Se conservó la proporcionalidad del descuento preciso al preparar una nota de crédito parcial.

Esta auditoría no emitió documentos tributarios reales ni utilizó una firma electrónica real. La aceptación del XML firmado por el SRI requiere su validación correspondiente en ambiente de pruebas; no se presenta aquí como certificada. Tampoco se afirma que se hayan agotado todas las combinaciones posibles de entradas o permisos: se detallan los casos ejecutados y se dejan pruebas para detectar regresiones.

La compilación de producción y la comprobación de tipos forman parte de la entrega. Se mantienen las advertencias preexistentes de imágenes y dependencias de efectos ajenas a esta corrección.
