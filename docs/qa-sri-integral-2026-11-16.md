# QA integral de Facturación SRI e historial de ventas

Fecha: 16 de noviembre de 2026. Proyecto: Control INNTEL.

## Dictamen

**La comunicación tributaria obtuvo autorización real de cuatro tipos de documentos en el ambiente de pruebas del SRI. El proceso comercial integral aún no se aprueba para producción:** falta conciliar automáticamente las notas de crédito, notas de débito y retenciones autorizadas con la cartera y los saldos correspondientes.

Se corrigieron problemas de integridad del XML autorizado, entrega de documentos por correo, validaciones y presentación/permisos del historial. La suite completa del repositorio terminó con **287 pruebas aprobadas, 0 fallidas**. Este número incluye regresiones comerciales y de permisos; no equivale a 287 emisiones al SRI.

## Alcance y aislamiento

- Configuración del emisor, firma PKCS#12 cifrada y datos de referencia: lectura del proyecto existente. No se modificó la base comercial publicada.
- Clientes, ventas, documentos y usuarios de QA: Firebase Auth y Firestore locales, proyecto `demo-controlinntel-qa`.
- Recepción/autorización externas: servidores reales de **certificación**, ambiente `1`, con el certificado configurado. No se emitieron documentos de producción.
- Correos: pruebas con transporte controlado. No se enviaron mensajes a clientes reales. La entrega real a un buzón no está acreditada.
- Navegación: Chrome independiente con perfil temporal, aplicación local y autenticación del emulador. No se utilizó la sesión personal del navegador.
- Cobertura funcional: factura desde nota de venta, NC, ND, guía de remisión, retención ATS, firma, XML, RIDE, reintentos, eliminación de pruebas, permisos e historial. No incluye liquidaciones de compra, ICE, exportación, ni todos los regímenes especiales.

## 1. Evidencia de comunicación real con el SRI

| Documento | Número de QA | Ambiente | Respuesta real |
|---|---|---|---|
| Factura | 001-010-950709475 | Pruebas | AUTORIZADO |
| Nota de crédito parcial | 001-010-950709475 | Pruebas | AUTORIZADO |
| Nota de débito | 001-010-950709475 | Pruebas | AUTORIZADO |
| Guía de remisión | 001-010-950709475 | Pruebas | AUTORIZADO |
| Retención ATS | Fixture local independiente | Pruebas locales | Pendiente de autorización externa |

Los cuatro números visibles coinciden porque pertenecen a **tipos de comprobante diferentes**, con códigos y claves de acceso distintos. Los contadores de QA estuvieron aislados de los contadores publicados.

La factura partió de una nota comercial de **USD 2,00**, cantidad 2, precio final unitario USD 1,00 e IVA 15%. Se verificó el XML firmado devuelto y se guardó la envoltura de autorización. La NC y ND utilizaron esa factura autorizada como sustento; la guía se vinculó al mismo caso.

La revisión de compras existentes encontró una compra de producción y ninguna compra electrónica de pruebas disponible como sustento. No se inventó una autorización ni se utilizó la clave de producción para aparentar una retención certificada.

**La factura publicada 001-010-000000424 no fue reemplazada por estas pruebas.** Conservaba su error de conexión previo. Los resultados de la tabla corresponden a documentos nuevos de QA: no acreditan que esa factura anterior ya esté autorizada. Su recuperación debe consultar su propia clave y, si corresponde, corregir/reintentar mediante el flujo fiscal; no basta con cambiar su estado localmente.

## 2. XML y firma

Se validaron los cinco XML firmados de las pruebas automatizadas contra esquemas oficiales descargados del SRI, sin alterar los esquemas:

| Tipo | Esquema utilizado | Resultado |
|---|---|---|
| Factura | factura_V1.1.0.xsd | Válido |
| Nota de crédito | NotaCredito_V1.1.0.xsd | Válido |
| Nota de débito | NotaDebito_V1.0.0.xsd | Válido |
| Guía de remisión | GuiaRemision_V1.1.0.xsd | Válido |
| Retención ATS | ComprobanteRetencion_V2.0.0.xsd | Válido |

El esquema acredita estructura/tipos; no sustituye las reglas de negocio ni una respuesta de autorización. La firma de los fixtures se verificó también con un verificador independiente. Las transmisiones reales emplearon el certificado del emisor y fueron aceptadas por el servicio de certificación.

Se mantuvieron las correcciones previas de SOAPAction conforme al WSDL, referencia XAdES SignedProperties y representación del emisor del certificado. La nueva protección comprueba criptográficamente el XML devuelto usando el certificado original, rechaza DTD/entidades y firmas múltiples, y no acepta un monto alterado aunque conserve el mismo texto de SignatureValue. Tampoco concede una autorización nueva automáticamente a documentos antiguos sin la evidencia del flujo firmado actual.

## 3. Matriz de pruebas ejecutadas

| Área / escenario | Resultado y tipo de evidencia |
|---|---|
| Nota → factura | Construcción desde datos guardados; no acepta sustituir los importes con valores enviados por el navegador. Local automatizado y emisión real de QA. |
| Cliente de origen | Rechaza cliente ajeno a la nota o retirado. Automatizado. |
| PKCS#12 | Contraseña correcta/incorrecta y certificado todavía no vigente. Automatizado; certificado real utilizado en certificación. El bloqueo de certificado vencido fue revisado en el código, sin afirmar una nueva emisión real con certificado vencido. |
| Cantidades, IVA y descuentos | Líneas recalculadas, cantidades hasta seis decimales, descuento parcial, IVA de fixtures 5% e IVA real de QA 15%. Regresiones del repositorio cubren cálculos comerciales adicionales. |
| Precisión del precio | Precio con más de seis decimales rechazado antes de reservar un número. Automatizado. |
| Medios de pago | Concordancia del desglose con el total; código de pago y plazo presentes en XML. Automatizado y revisión del documento de QA. |
| Secuenciales concurrentes | Reserva transaccional/idempotente del mismo documento; separación entre ambientes. Automatizado. |
| Repetir una petición autorizada | Misma factura, sin consumir otro secuencial ni volver a transmitir. HTTP real contra emuladores. |
| Fallo de escritura después del SOAP | Recuperación consultando la misma clave; no crea una segunda emisión. Fallo inyectado en prueba automatizada. |
| Clave/ambiente equivocados en respuesta | No se aceptan como autorización del documento solicitado. Automatizado. |
| XML alterado conservando SignatureValue | No pasa a AUTORIZADO y no marca la nota como facturada. Automatizado. |
| Documento rechazado | Corrección conserva clave/número y vuelve a firmar; no modifica arbitrariamente un autorizado. Automatizado. |
| NC parcial / exceso | Deriva importes de partidas originales y limita cantidades ya acreditadas. Automatizado; NC parcial autorizada realmente en pruebas. |
| ND y guía | Campos y XML generados desde sus formularios/datos; autorización real de QA para ambos tipos. |
| Retención | Sustento, ambiente, bases, IVA/código y duplicidad controlados; compra anulada rechazada. Automatizado + XSD. Autorización externa pendiente. |
| Eliminar factura de pruebas | Archivo de auditoría, conservación de nota/producción y secuencial; bloqueos por dependencias y proceso en curso. Automatizado. Dependencias comprobadas también por HTTP. |
| Eliminar producción / usuario sin permiso | Operación bloqueada. Automatizado. |
| XML autorizado | Descarga protegida; el listado no incluye XML completo ni material PKCS#12. HTTP contra emuladores. |
| RIDE | Vista autenticada del documento autorizado en navegador; PDF adjunto generado, abierto y revisado visualmente. Un documento de una página comprobado. No se acredita aquí una impresión física ni todos los formatos de impresora. |
| Correo recuperable | Fallo controlado, reintento, resultado persistente y no repetición de envío confirmado. Automatizado con transporte controlado. |
| Correo incierto | Un intento sin confirmación exige decisión explícita antes de reenviar. Automatizado. Un acuse SMTP no prueba llegada a bandeja de entrada. |
| Correo de pruebas | Envío bloqueado. Automatizado y HTTP. |
| Sesión y permisos fiscales | Sin sesión: 401; perfil sin permiso fiscal: 403. HTTP. |
| Historial independiente | Perfil con Clientes + Historial + importes consulta el resumen sin habilitar Ventas ni Facturación SRI. HTTP. |
| Revocación de historial | Con el mismo token activo, una nueva consulta devuelve 403 al retirar el permiso. HTTP. |
| Historial y saldos | Nota + factura de prueba + cuenta por cobrar vinculada: una operación de USD 2,00 y saldo USD 2,00. HTTP y navegador. |
| Historial responsivo | Ventana dentro de 360×640, 768×900, 1440×900 y 844×390; desplazamiento horizontal local de la tabla; cierre visible. Navegador. |
| Teclado | Foco inicial dentro del historial, recorrido acotado de botones y cierre con Escape. Implementado; Escape comprobado en navegador. |

## 4. Correcciones aplicadas durante este QA

### Integridad fiscal y validación

Se reemplazó la comparación aislada de SignatureValue por verificación criptográfica. Se rechazan precios unitarios no representables en el XML y compras anuladas como sustento de retención. Una solicitud SRI vacía, nula o con formato incorrecto devuelve validación de entrada, sin iniciar una emisión.

### Entrega por correo y PDF

La autorización queda guardada aunque falle el correo. El envío dispone de estado, contador de intentos, exclusión de procesos simultáneos y registro de auditoría. El botón de correo permite recuperar un envío pendiente de una factura autorizada de producción; uno ya confirmado se omite para no duplicarlo. Si el servidor no pudo confirmar el resultado SMTP, el operador debe comprobar el proveedor antes de confirmar otro intento.

Se adjuntan **XML autorizado y PDF RIDE**. El PDF usa la identidad guardada al firmar, código de barras de la clave, autorización, comprador, partidas, bases por tarifa, IVA, total y pagos. El cuerpo del correo muestra las tarifas utilizadas, en lugar de limitarse a subtotales fijos 15%/0%. Las facturas nuevas guardan también el régimen del emisor para conservarlo en documentos históricos.

La entrega automática por correo en este alcance corresponde a facturas. No se ha acreditado entrega automática por correo para todos los documentos complementarios.

### Historial de ventas del cliente

La ventana se amplió, limita su altura al espacio disponible y desplaza su contenido sin cortar las columnas o esconder el cierre en pantallas bajas. La tabla conserva desplazamiento horizontal en móvil. Se incorporaron carga, error, estado vacío y cierre por teclado.

Se corrigieron tres errores de información: las notas ya no se presentan como facturas SRI, no se suman de nuevo los cobros vinculados y los registros anulados/pruebas no inflan el total. Una factura de producción autorizada puede representar la operación, conservando la referencia a su nota de origen. Los cargos huérfanos se señalan para conciliación. Si falta la cuenta por cobrar o hay varias cuentas ambiguas para una misma venta, el saldo de esa fila dice «Por conciliar»: no se presume deuda cero ni se suman cargos duplicados. El resumen informa el saldo registrado y cuántas operaciones requieren conciliación. Esto detecta la ausencia de datos; no reemplaza su recuperación desde evidencia histórica.

Permiso nuevo: **Personas → Roles y permisos → Clientes y ficha 360° → Historial de ventas del cliente**. También exige acceso al módulo Clientes y visibilidad de importes comerciales/financieros. Puede personalizarse por usuario mediante las excepciones de su rol. Al desactivarlo, desaparece el icono y el servidor rechaza la consulta; no depende únicamente de ocultar la pantalla. El superadministrador conserva acceso.

Los perfiles anteriores sin este campo conservan compatibilidad a partir de su acceso previo a Facturación del cliente y visibilidad financiera. Una desactivación explícita del nuevo permiso prevalece. No se habilita de forma indiscriminada a todos los técnicos.

## 5. Hallazgos abiertos y criterios de cierre

### SRI-QA-01 — P1: autorización de documentos complementarios sin aplicación completa a la cartera

**Evidencia de código:** `src/lib/server/sri-workflow.ts`, bloque final de `processFiscalDocument`, actualiza documento fiscal y vínculo de la factura; no crea una aplicación comercial de NC/ND/retención sobre `monthlyCharges`, créditos del cliente o deuda del proveedor. `src/lib/company-reporting.ts` sí descuenta/suma NC/ND autorizadas al resultado de ventas. Por tanto, resultado de ventas y cartera pueden divergir.

Ejemplos para la aceptación pendiente:

1. Factura USD 200 sin pagos + NC USD 50: el saldo debe quedar USD 150.
2. Factura USD 200 pagada íntegra + NC USD 50: debe reconocerse crédito a favor de USD 50 o una devolución expresamente registrada; no inventar un gasto ni una salida bancaria.
3. Factura parcialmente cobrada: la NC debe reducir primero la deuda aplicable y reconocer correctamente cualquier excedente a favor, sin exceder el importe acreditable.
4. ND USD 20: debe aumentar la deuda correspondiente y aparecer en cartera e informe del cliente.
5. Retención de proveedor: debe cruzar la obligación y el impuesto retenido sin simular un pago bancario. Debe distinguirse el comprobante fiscal de una retención comercial ingresada previamente para no duplicarla.

**Mitigación aplicada:** los nuevos complementarios de producción autorizados quedan con `commercialReconciliationStatus: pendiente` y la pantalla indica que requieren conciliación de cartera. No se presenta esto como una implementación del cruce automático.

**Corrección necesaria:** aplicación transaccional e idempotente por documento fiscal, referencias al origen y `operationLog`, estado de conciliación completado solo tras confirmar los efectos; reversión controlada y conciliación de documentos anteriores. Una NC no debe devolver existencias automáticamente si no existe devolución física. Aprobar el flujo requiere probar saldos antes/después, fallos entre autorización y contabilización y repetición sin duplicación.

### SRI-QA-02 — P2: catálogo tributario de renta insuficiente

La retención valida formato de código, porcentaje/rango, bases, IVA y límites. Para RENTA no existe en este flujo una relación completa de código, porcentaje y vigencia por fecha: se acepta un código con formato válido sin confirmar su correspondencia tributaria. `supportCode` también se valida por formato, no mediante todo el catálogo de sustentos.

Corrección propuesta: catálogo oficial versionado, búsqueda por concepto y porcentaje vinculado, conservando la versión en el comprobante. Probar códigos inexistentes, incompatibles y cambios de vigencia. No reemplazar esta comprobación por porcentajes inventados.

### SRI-QA-03 — Validación externa pendiente: retención ATS

Para cerrar se necesita una compra electrónica válida y autorizada del ambiente de pruebas, del proveedor correspondiente. Después: emisión real, respuesta AUTORIZADO, XML/RIDE y cruce comercial una vez resuelto SRI-QA-01. La prueba estructural local ya pasó; no equivale a esta aceptación externa.

### SRI-QA-04 — Validación operativa pendiente: recepción de correo

Para cerrar: configuración SMTP activa, buzón controlado, factura de aceptación autorizada y verificación de XML/PDF recibidos, destinatarios/copias y carpeta de no deseados. La opción estaba desactivada en la configuración revisada; no se cambió ni se enviaron correos reales. Los fallos/recuperación del envío sí se probaron localmente.

## 6. Evidencia reproducible

Comprobaciones de entrega: `npm test` (287/287), TypeScript sin errores y compilación de producción completada. La compilación mantiene advertencias previas sobre imágenes y dependencias de hooks; no se confundieron con fallos tributarios ni se amplió esta intervención a esos componentes ajenos al flujo revisado.

El resumen sin secretos está en `docs/qa-sri-integral-evidencia-2026-11-16.json`. Incluye resultados, dimensiones y huellas de archivos. Los XML completos, certificado y contraseñas no se incluyen en el repositorio.

Herramientas incorporadas:

- `scripts/qa-sri-certification.mjs`: emisión de certificación con consentimiento explícito mediante `SRI_QA_REAL_RECEPTION=1`; verifica ambiente 1, lee el origen y escribe documentos solo en el emulador. **Sí transmite al servicio externo de pruebas.** No es una tarea automática de CI.
- `scripts/qa-sri-http.mjs`: rutas reales de la aplicación con Firebase local; requiere el servidor y los emuladores configurados.
- `scripts/qa-sri-browser.cjs`: navegación autenticada y capturas con Chrome en perfil temporal, exclusivamente localhost.
- `scripts/qa-sri-xsd.php`: validación DOM/libxml contra los cinco esquemas locales oficiales y su dependencia XMLDSig.
- `npm test`: regresión completa. `SRI_QA_XML_OUTPUT` permite exportar XML de fixtures sintéticos para el validador XSD.

Archivos locales de esta ejecución, bajo `%TEMP%`:

- `inntel-sri-certification-1794851843716/results.json`: respuestas reales resumidas; XML firmados y autorizados en ese mismo directorio.
- `sri-qa-all.log`, `sri-qa-types.log`, `sri-qa-build.log`: regresión, tipos y compilación.
- `sri-qa-http.log`, `sri-qa-browser.log`, `sri-qa-xsd.json`: HTTP, navegador y esquemas.
- `inntel-sri-ui-BYABK9/`: capturas del historial en cuatro tamaños.
- `sri-qa-ride-authorized.pdf` y `.png`: PDF de QA generado y representación revisada.

Estos archivos temporales pueden ser eliminados por Windows; el resumen versionado conserva las verificaciones y huellas, no el contenido confidencial.

## 7. Fuentes y límites

Fuentes primarias consultadas: [portal técnico del SRI](https://www.sri.gob.ec/web/intersri/facturacion-electronica), con sus paquetes XSD/XML; [ficha técnica Off-line versión 2.34, julio de 2026](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/f8d9bb36-5632-4f96-b463-b9265b55338c/FICHA%20TE%CC%81CNICA%20COMPROBANTES%20ELECTRO%CC%81NICOS%20ESQUEMA%20OFFLINE%20Versio%CC%81n%202.34.pdf). Se comprobó además la interoperabilidad real con el servicio de certificación.

No se certificó cada tarifa/regla tributaria especial ni toda posible combinación de fechas, descuentos y medios de pago mediante emisiones externas. La validación XSD y los casos automatizados no sustituyen esa aceptación. El historial extenso no se trunca silenciosamente: al alcanzar el límite de consulta de 1.000 registros por búsqueda devuelve una indicación para consultar reportes por período; la paginación completa del historial no forma parte de esta entrega.

**Prioridad de continuación:** cerrar primero SRI-QA-01, después catálogo tributario y aceptación externa de retención/correo. La autorización real de cuatro documentos es una evidencia positiva de integración SRI, no un cierre del pendiente comercial.
