# Archivos, Concesión, avisos y cotizaciones — 4 de noviembre de 2026

## Problemas y correcciones

- **Excel descargado inválido:** ARCOTEL guardaba metadatos, sin subir los bytes. La descarga sin URL fabricaba texto con la extensión del original. Ahora se sube primero el archivo real y después se registra. Las descargas comprueban la respuesta y, para los archivos nuevos, su huella SHA-256 antes de entregar el documento. No se generan sustitutos con extensiones Office.
- **Almacenamiento publicado:** faltaba la configuración del almacenamiento Vercel anterior. Se aprovisionó un depósito privado en Google Cloud, usando las credenciales existentes del servidor, acceso uniforme y prevención de acceso público. Los archivos nuevos usan descarga autenticada; las referencias Vercel anteriores conservan su adaptador. No se añadieron permisos IAM ni accesos públicos.
- **Control de acceso:** carga, lectura y eliminación requieren sesión y permisos del área correspondiente. Se rechazan rutas fuera de los espacios previstos y recorridos de directorios. Un fallo de almacenamiento devuelve error; no informa una carga o eliminación ficticia.
- **ARCOTEL con documentos predeterminados:** los registros antiguos que solo contienen metadatos se conservan para recuperación, pero se excluyen de los documentos disponibles y se muestra un aviso para volver a cargar el original. SIETEL LOPAM muestra el último documento con original, sin borrar los anteriores antes de que termine una carga.
- **Concesión con información automática:** los valores iniciales quedan vacíos. Al cargar caché o servidor se reconoce únicamente la huella exacta de la antigua concesión de ejemplo. Los datos reales diferentes y los campos propios se conservan. Si no hay configuración en el servidor, se limpia la vista en vez de mantener datos antiguos de la caché. Esta normalización no borra el documento original del servidor.
- **Plantillas:** se quitaron los ejemplos iniciales y las descargas de texto disfrazadas de Word/Excel. Las cargas usan autenticación. Un fallo al guardar referencias en el navegador no elimina silenciosamente el contenido ni el archivo anterior. Las plantillas personalizadas siguen teniendo su listado local por navegador; esta entrega no incorpora un catálogo compartido de plantillas.
- **Avisos nativos:** se reemplazaron las confirmaciones de cambios sin guardar y devolución de anticipos. Las restricciones HTML mantienen su validación y usan un aviso formal con el campo que requiere revisión. El diálogo principal se dibuja por encima de los formularios y devuelve el foco al cerrar. “Seguir editando” y Escape conservan los cambios; descartar ejecuta el cierre original. Las acciones asíncronas bloquean clics duplicados y muestran errores.
- **Cotizaciones:** se eliminaron obligación contable, régimen y resolución de retención del formato comercial. La leyenda es “DOCUMENTO SIN VALIDEZ TRIBUTARIA”. El recuadro derecho usa un borde más ligero y conserva número, RUC, emisión y vigencia, omitiendo textos redundantes. No se modificó el formato tributario RIDE.
- **Transferencias:** en **Configuración → General → Datos bancarios para transferencias** se habilita su impresión y se configuran banco, tipo, número de cuenta, titular, identificación y correo opcional. Se puede copiar una cuenta activa de Finanzas → Bancos. El formato ya no contiene banco, cuenta ni titular fijos. Una configuración ausente, deshabilitada o incompleta no se imprime. Las cuentas son texto para conservar ceros iniciales. El servidor valida los mismos campos y persiste por el mecanismo existente de configuración empresarial.
- **Usuarios comerciales:** reciben solo la información del emisor necesaria para cotizar cuando no tienen acceso a configuración. Esta proyección excluye parámetros fiscales, certificados y configuración SMTP.

## Evidencia de verificación

- Suite completa: **162 pruebas aprobadas, cero fallos**. Compilación de producción completada. Continúan advertencias previas de dependencias de algunos efectos de React; no bloquearon la compilación.

- Prueba real de Bóveda en producción: crear, revelar, editar notas conservando contraseña y eliminar una credencial temporal; respuestas sin campos secretos. Registro temporal eliminado.
- Prueba real de Nodos en producción: registro con estado `activo` y coordenadas cero aceptado; verificación de persistencia y eliminación del nodo temporal.
- Archivo Excel válido generado para QA, guardado en el depósito privado y descargado: coincidencia exacta de bytes y SHA-256; lectura posterior con ExcelJS conservando valores y acentos. Nombre original preservado. El acceso público respondió 403. Archivo temporal eliminado.
- Navegador automatizado con componentes reales y formulario aislado: conservar datos al cancelar o usar Escape, descartar y cerrar, validación formal con nombre del campo y devolución del foco. Cero diálogos nativos y cero errores de página.
- Navegador automatizado con Configuración General y cotización reales, usando datos y adaptador de estado de prueba: cuenta copiada, campos guardados, ceros conservados y contenido clonado para impresión correcto; sin textos fiscales ni cuenta predeterminada. No se guardó una cuenta bancaria ficticia en producción.
- Se incorporaron pruebas de normalización de Concesión, permisos y rutas de documentos, nombres de descarga, validación bancaria y proyección comercial del emisor.

## Límites y seguimiento

### Ajuste visual posterior de cotizaciones

Se retiró el borde del logo y la fecha de emisión duplicada en los datos del cliente. Se aplica Inter a todo el documento, incluyendo sus cifras. El nombre del emisor queda en una línea y peso 600; el número de cotización aumenta a 16 px y peso 600. El valor total usa peso 600 y el cuadro de totales un borde de 1 px. Estos tamaños se mantienen en la impresión, que ahora hereda la familia Inter y espera las hojas de estilo y las fuentes antes de imprimir; también se evita iniciar dos impresiones por temporizadores simultáneos.

Verificado en navegador con el nombre completo proporcionado: una sola línea sin desbordamiento, logo sin borde, una sola fecha de emisión, tamaños y pesos correctos en vista previa e impresión A4. Se simuló una hoja de estilo con carga demorada para comprobar que la impresión espera su llegada. La suite de 162 pruebas y la compilación de producción completaron correctamente.

- Los originales que nunca se almacenaron no pueden reconstruirse desde su nombre: requieren nueva carga. No se fabricaron ni eliminaron documentos reales para ocultar el problema.
- La advertencia al cerrar o recargar la pestaña la administra el navegador; la interfaz no puede personalizarla. Las confirmaciones dentro de la aplicación usan el diálogo corporativo.
- Compartir expedientes mediante enlace público es un flujo diferente y no forma parte de estas pruebas de descarga autenticada.
- Se mantiene la propuesta **Configuración → Soporte** para departamentos, responsables, asuntos y prioridades. No se implementó un catálogo de departamentos en esta entrega.

Referencias del proveedor: [creación de depósitos](https://docs.cloud.google.com/storage/docs/json_api/v1/buckets/insert), [prevención de acceso público](https://cloud.google.com/storage/docs/public-access-prevention).
