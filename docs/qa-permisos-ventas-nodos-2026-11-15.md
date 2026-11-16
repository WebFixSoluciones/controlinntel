# QA de permisos, ventas administrativas y credenciales

Fecha: 15 de noviembre de 2026.

## Resultado

Se corrigió la desaparición de Clientes con permisos concedidos, la dependencia incorrecta del acceso a Ventas recurrentes respecto de Facturación SRI, un bypass de la restricción de precios, la emisión administrativa de meses anteriores, la pérdida de un centavo en tarifas con IVA y el rechazo de RUC societarios mediante un algoritmo antiguo. Las credenciales de los nodos se administran ahora en una ventana independiente.

## Permisos: hallazgos y correcciones

| Hallazgo | Causa | Corrección y comprobación |
| --- | --- | --- |
| Clientes estaba habilitado y no aparecía en el menú | El menú exigía `abonados.submodules.listado`, una opción inexistente en el catálogo de permisos | Directorio deriva su acceso de las vistas autorizadas de Clientes. Se probó el menú real con un técnico que solo puede ver Identificación. |
| El enlace a Ventas recurrentes podía desaparecer aunque se permitiera crear ventas | Consultaba la acción de crear factura del módulo SRI | Consulta la acción correspondiente de Ventas. |
| Un vendedor sin permiso de precios podía intentar enviar una partida sin artículo | El servidor omitía esa partida al comprobar la tarifa del catálogo | Se rechazan partidas de precio libre cuando el usuario no puede modificar precios. |
| Comparar precios únicamente en centavos ocultaba cambios en la precisión de la tarifa | La autorización usaba el redondeo monetario para comparar precios unitarios | Se comparan seis decimales; un cambio de 100 a 100.000001 se rechaza sin permiso. |
| El nuevo editor de credenciales podía mostrar Guardar sin poder administrar nodos | Editar credenciales y administrar nodos son autorizaciones separadas | El lápiz exige ambas autorizaciones y el servidor vuelve a comprobarlas. |

### QA automatizado de autorizaciones

El catálogo contiene 15 módulos, 50 opciones de submódulos y 66 opciones de acciones dentro de módulos. Las pruebas recorren los controles publicados y comprueban habilitación, revocación y bloqueo al apagar el módulo padre. Los controles reservados de Usuarios y Roles continúan siendo exclusivos del superadministrador.

También se comprobaron rutas denegadas, cuentas inactivas, visibilidad de importes, acciones comerciales y rechazo de cambios no autorizados en el servidor. Las pruebas de roles cubren actualización de usuarios vinculados, excepciones individuales, restauración de herencia, desactivación y conflictos de edición.

En navegador se verificó:

- Perfil limitado a Clientes: aparece Clientes y su Directorio; no aparece Ventas.
- Perfil limitado a Ventas: aparece Ventas; no aparecen Clientes ni Dashboard.
- Sin módulos: no aparecen entradas de módulos.
- Ficha 360°: solicitar una pestaña no autorizada vuelve a una pestaña permitida; no muestra Editar sin autorización.
- Perfil técnico con Servicios: puede ver los servicios autorizados sin la columna de tarifas ni sus importes.
- Usuarios y Roles: creación, asignación, excepciones, cambios simultáneos y revocación de acceso.
- Bóveda: un permiso de lectura/revelación no muestra crear, editar o eliminar.

### Condiciones que siguen siendo parte del diseño

Conceder una vista no concede automáticamente permisos de escritura, revelación de claves o acceso financiero. Las vistas de la ficha que usan Soporte, Red, Bóveda o Finanzas siguen dependiendo de sus autorizaciones correspondientes. El editor conserva los avisos de dependencias para registrar ventas con Clientes/Inventarios y para visualizar módulos financieros.

Los cambios de un rol se propagan a los usuarios vinculados; una excepción individual sigue prevaleciendo. Los usuarios anteriores sin rol vinculado mantienen sus permisos individuales. No se reasignó a Samir ni se modificaron cuentas reales durante estas pruebas.

## Ventas de meses anteriores

- Nueva venta permite emitir una nota administrativa de octubre aunque ya exista una nota de noviembre, manteniendo el siguiente número disponible.
- El campo «Período de la nota» identifica el mes del servicio independientemente de la fecha de emisión. Se conserva en el borrador y se utiliza para el mes/año de la cuenta por cobrar. La nota incluye esa referencia en sus observaciones.
- Tener el servicio asignado a un contrato ya no bloquea una venta administrativa independiente.
- El aviso distingue esta venta de la liquidación de un período contractual. Una nota independiente no marca automáticamente el contrato como facturado; para liquidar ese período y evitar que la recurrencia lo vuelva a emitir se utiliza Ventas recurrentes.
- En Ventas recurrentes se puede anticipar manualmente un período prepago o postpago dentro de la vigencia. El control transaccional impide emitir dos veces el mismo período vigente.
- Emitir octubre después de noviembre no retrocede la última facturación ni la renovación del contrato.
- Los servicios excluidos muestran la causa al desplegar Servicios. Se reemplazó la clasificación engañosa «Pausados» por «No incluidos».
- La emisión automática conserva la ejecución del día 1 y sus reglas de exigibilidad. Guardar un cliente o asignar un servicio no genera una nota automáticamente.
- No se modificaron las reglas de numeración ni autorización del flujo tributario SRI.

## Tarifas cerradas e IVA

La base se redondeaba a dos decimales antes de extender la partida y calcular el impuesto. Al desglosar 150 con IVA del 15%, guardar 130.43 perdía la precisión necesaria y terminaba en 149.99.

La tarifa unitaria conserva hasta seis decimales. Los subtotales, impuestos, notas, cuentas por cobrar y cobros permanecen en centavos. El desglose de una tarifa final de 150 queda en base 130.43 e IVA 19.57; el total es 150.00. El cálculo parte de la tarifa precisa antes del redondeo final de la partida.

Se añadió «Con IVA» por partida en Nueva venta para ingresar directamente 150 o 140. Se alinearon creación/edición del catálogo, asignación/edición de servicios, notas nuevas, edición de notas y períodos recurrentes. No se convierten automáticamente tarifas históricas de 149.99 en 150: si 149.99 ya fue guardado como precio pactado, debe corregirse explícitamente.

Se probaron precios de centavos, 100, 140, 149.99, 150 y 575, diferentes cantidades y tasas del 0%, 5%, 12% y 15%. Un cobro real de la operación de servidor, con almacenamiento de prueba, deja la deuda de 150 en cero y aumenta el banco exactamente en 150.

## Nodos y credenciales

- Los encabezados son «Proveedores» y «Credenciales».
- La fila muestra un único botón «Ver credenciales» con la cantidad.
- La ventana permite buscar por sistema, IP, usuario o notas y editar una credencial sin modificar las demás.
- La IP se muestra completa. Las claves permanecen ocultas; mostrar/copiar usa la consulta autorizada del servidor.
- Dejar vacía la contraseña al editar conserva la clave cifrada. Una nueva contraseña se cifra en el servidor.
- La versión del nodo evita sobrescribir cambios simultáneos. Cerrar una edición solicita confirmación dentro del sistema.
- Se probó una lista de 12 credenciales y anchos de 360, 768 y 1440 píxeles sin desbordamiento de la página.

## Registro de empresas y RUC

El registro y la facturación tenían validadores duplicados, y el registro imponía módulo 11 a sociedades. El SRI indica que los RUC de sociedades públicas, privadas y personas extranjeras sin cédula no tienen una validación mediante un algoritmo específico: [comunicación publicada por el SRI](https://www.sri.gob.ec/nl-BE/facturacion-electronica).

Ahora ambos flujos usan el mismo validador. Se conservan las comprobaciones de formato y la validación de cédula cuando corresponde a una persona natural. Una marca enviada por el navegador no permite saltarse la validación. El formato correcto no equivale a verificar que un contribuyente exista o se encuentre activo.

Cambiar el número borra la marca de consulta anterior. Mientras se consulta se bloquea cambiar el número o guardar el formulario, evitando cruces entre respuestas y números diferentes. Se probó el alta societaria en servidor, prevención de duplicados y la secuencia de autocompletar/registrar en navegador con una respuesta de consulta simulada.

## Evidencia y alcance

- Suite completa: 258 pruebas aprobadas, sin fallos.
- Compilación de producción y comprobación de tipos realizadas. Persisten advertencias anteriores de imágenes y dependencias de efectos en otros componentes.
- Navegador: componentes reales con datos y adaptadores de prueba; ventanas, campos, confirmación de venta, menús y permisos a 360/768/1440 píxeles.
- Servidor: operaciones comerciales y de credenciales reales ejecutadas contra adaptadores transaccionales de prueba; incluye rechazos por permiso, versión y duplicados.
- No se crearon ventas, cobros, clientes ni usuarios de prueba en producción. No se envió documentación al SRI ni se utilizó una firma real.
- Estas pruebas no constituyen una auditoría exhaustiva de todas las combinaciones posibles de permisos ni una aceptación autenticada con la cuenta real afectada. El informe identifica qué flujos se comprobaron efectivamente.
