# Revisión SRI y permisos de Servicios — 16/11/2026

## Factura observada

Se consultó en Firestore la factura 001-010-000000424, ambiente 1, vinculada a una nota comercial. Base 173,91, IVA 26,09, total 200,00. Tenía un intento, ERROR_CONEXION y ningún XML autorizado ni número de autorización.

Se reprodujo la consulta de su clave contra el servicio de certificación: SOAPAction con el nombre de operación devuelve HTTP 500 y «does not match an operation». Con SOAPAction vacío, como declaran los WSDL oficiales, devuelve HTTP 200, cero comprobantes y ninguna autorización. Esta consulta no transmite una nueva factura.

## Correcciones

- SOAPAction vacío tanto en recepción como en autorización.
- Nombre del emisor del certificado: los atributos desconocidos de UANATACA se representan por OID y valor ASN.1 hexadecimal, evitando `undefined=`.
- Referencia firmada a SignedProperties con el atributo Type exigido por XAdES 1.3.2.
- Eliminar factura de prueba: botón de papelera con confirmación y comprobación del permiso de anulación. Solo funciona con configuración en pruebas y comprobante identificado como pruebas tanto en sus metadatos como en su clave. No permite documentos en procesamiento ni con notas de crédito, débito o guías vinculadas.
- La eliminación retira el registro operativo, archiva el documento y registra la auditoría en una misma transacción. Libera el vínculo de prueba con la nota y conserva cualquier vínculo de producción, cobros e inventario. No reinicia ni recicla secuenciales.

## Numeración

La reserva fiscal ya utiliza contador por RUC, ambiente, tipo y serie. Las pruebas verifican que la misma nota puede generar el mismo número visible en pruebas y producción con claves e identificadores diferentes. Dentro de producción sigue prohibida la duplicidad: el contador guardado prevalece sobre un valor de configuración inferior. Debe configurarse el siguiente número libre real, considerando también comprobantes emitidos en otros sistemas.

## Servicios

En Personas → Roles y permisos o en las excepciones del usuario, dentro de Clientes y ficha 360°:

- Servicios · Ver tabla de contratados.
- Servicios · Ver tabla de facturados.
- Servicios · Ver columna de tarifas.

Estos controles dependen de tener habilitado Servicios del cliente. El permiso global de tarifas y el de importes financieros siguen siendo límites adicionales. La denegación local de tarifas oculta la columna y elimina los precios del servicio contratado en la respuesta del servidor; no cambia el permiso separado del catálogo de inventarios. Si se bloquea la tabla de contratados, no se entrega su colección completa. Los directorios mínimos de Ventas siguen sujetos a sus permisos y no incluyen tarifas contratadas.

Las reglas se aplican al popup del directorio y a Servicios en la ficha. Los perfiles anteriores mantienen sus accesos efectivos; una denegación explícita y las excepciones individuales se conservan.

## Validación y límites

279 pruebas automatizadas aprobadas, incluidos firma sintética comprobada criptográficamente por un verificador independiente, reservas por ambiente, recuperación de envío, cinco tipos fiscales, eliminación y permisos. Comprobación de tipos y compilación de producción forman parte de la entrega.

No se eliminó la factura real observada, no se transmitió una factura nueva y no se cambió el ambiente de la empresa. Para incorporar las correcciones de firma al XML existente se debe eliminar esa factura desde pruebas y volver a convertir la nota, usando el nuevo secuencial reservado. El cierre de aceptación exige obtener AUTORIZADO en certificación; esta revisión no lo presenta como logrado.

Fuentes primarias: [WSDL de recepción](https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl), [WSDL de autorización](https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl), [SRI: facturación electrónica y ambientes](https://www.sri.gob.ec/web/intersri/facturacion-electronica), [ETSI XAdES 1.3.2](https://www.etsi.org/deliver/etsi_ts/101900_101999/101903/01.03.02_60/ts_101903v010302p.pdf).
