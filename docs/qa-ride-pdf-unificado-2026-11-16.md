# RIDE A4 unificado — 16 de noviembre de 2026

## Corrección

El adjunto del correo se generaba con una plantilla distinta de la vista imprimible. La factura autorizada ahora utiliza `invoiceRidePdf` (`inntel-a4-v2`) para la vista A4, descarga, impresión y correo. Las notas de venta, documentos pendientes y tickets de 80 mm conservan sus formatos específicos.

- Encabezado en dos columnas, logo sin borde y nombre del emisor en una línea.
- Clave de acceso y autorización completas, cada una en su propia línea, con ajuste de tipografía al ancho disponible. No se recortan ni dividen los 49 dígitos.
- Código de barras compacto dentro del encabezado derecho.
- Datos del cliente, referencia de la nota original, guía autorizada del mismo ambiente, vencimiento, partidas, pagos, impuestos y total.
- Los datos históricos del emisor prevalecen sobre la configuración actual.
- Vista autenticada con archivo privado y sin caché. El transporte JSON del visor evita que IDM intercepte el PDF antes de recibirlo. La descarga binaria sigue disponible bajo los mismos permisos.
- Reenvío manual del PDF actualizado desde el icono de correo. Conserva la entrega anterior en auditoría; no cambia autorización, secuencia ni importes. Los disparadores automáticos siguen omitiendo correos ya confirmados.

## Validación

- Compilación de producción, TypeScript y lint aprobados.
- 292 pruebas automatizadas aprobadas, incluyendo autorización completa, referencias compartidas y reenvío explícito sin duplicar la emisión fiscal.
- Navegador Chrome aislado, Firebase Auth/Firestore locales y datos ficticios: visor cargado, descarga PDF real, acción de impresión y anchos de 360, 768, 844 y 1440 px sin desbordamiento de la página.
- Respuesta PDF privada: tipo `application/pdf`, versión identificada y `Cache-Control: no-store`. Solicitud sin sesión rechazada con 401.
- Lectura de una factura autorizada existente, sin escrituras: PDF de una página y autorización íntegra de 49 dígitos, verificada por extracción de texto y revisión visual. El documento con datos del cliente permanece fuera del repositorio.

No se emitieron documentos SRI ni se enviaron correos reales durante esta corrección. Los adjuntos ya recibidos no cambian: para obtener la nueva versión se debe descargar o reenviar el RIDE desde el sistema.
