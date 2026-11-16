# Entrega de documentos SRI por correo — 16/11/2026

## Implementación

El envío automático se ejecuta después de guardar la autorización SRI de producción y cubre factura, nota de crédito, nota de débito, retención y guía de remisión. No vuelve a emitir documentos tributarios si falla el correo. Los documentos de pruebas permanecen excluidos del envío a destinatarios reales.

Cada correo incluye PDF RIDE, XML autorizado y logo PNG integrado mediante CID. El destinatario abre los archivos adjuntos sin entrar a Control INNTEL; no se publican enlaces abiertos con información del cliente. El PDF de cada tipo conserva sus datos propios: la guía contiene traslado, transportista y artículos; la retención muestra impuestos, bases, porcentajes y valor retenido.

La factura, NC y ND usan el correo guardado en el documento o el contacto del cliente si falta. La retención busca al proveedor de la compra. La guía utiliza el destinatario de su factura de sustento o un cliente identificado de forma unívoca por RUC. Si falta un correo válido, se registra un error recuperable en lugar de dar el envío por cumplido.

El destinatario principal aparece en «Para». La empresa recibe copia en el correo de «Email Notificaciones RIDE» y las copias adicionales se envían ocultas. Se eliminan direcciones duplicadas. Las notificaciones y los destinatarios se administran en Configuración → SRI → Entrega de Documentos por Correo.

La configuración solicitada habilita envío automático, envío al destinatario y copia a la empresa. La activación se registra con auditoría y se verifica leyendo las tres opciones guardadas; no cambia ambiente, firma, secuenciales ni contraseña SMTP. El botón «Activar cliente y empresa» permite establecer estas opciones juntas desde la pantalla.

## Plantilla

Diseño claro, ancho adaptable de 600 px, tipografía sencilla, franja azul/púrpura, logo sin borde, tipo/número de documento, fecha, importe cuando corresponde, clave y autorización. La guía no muestra un total monetario ficticio. El texto indica expresamente que PDF y XML son adjuntos.

[Abrir vista de diseño con datos de ejemplo](previews/correo-sri-inntel.html).

## Recuperación y permisos

Se conserva estado pendiente, en curso, confirmado, parcial, error o sin confirmación. Una exclusión temporal impide envíos concurrentes. Los destinatarios que el proveedor ya aceptó se conservan y se omiten al repetir una entrega parcial. Un resultado incierto exige comprobar el proveedor y confirmar otro intento, evitando duplicaciones silenciosas. El acuse SMTP no equivale a una lectura del destinatario ni demuestra llegada a su bandeja de entrada.

Los cinco listados SRI incorporan la acción de correo para documentos autorizados de producción. El servidor exige permiso de acceso al submódulo y de autorización SRI. La activación completa también respeta el permiso para editar Configuración SRI.

La autorización registra el correo como pendiente antes de iniciar la entrega; una consulta posterior puede completar un envío que quedó pendiente antes de iniciarse. Los errores y entregas inciertas se recuperan desde la acción de correo; no se incorpora un nuevo servicio externo de colas ni una nueva tarea CRON. Los documentos históricos no se reenvían masivamente por activar la opción.

## Evidencia

- Suite completa: **291 pruebas aprobadas, 0 fallidas**.
- Los cinco tipos: PDF, XML y CID preparados y entregados a un transporte controlado, con correo del cliente/proveedor y copia privada a empresa.
- SMTP real local: conversación de protocolo, composición MIME, PDF/XML/PNG, ausencia de BCC en cabeceras visibles y tratamiento de rechazo parcial.
- Recuperación: una copia rechazada se vuelve a intentar sin repetir al cliente ya confirmado; los envíos completos se omiten al reiterar la petición.
- Validaciones: correo faltante, escape de HTML y bloqueo de pruebas/estado fiscal no autorizado.
- Vista del correo: logo integrado y ausencia de desbordamiento horizontal a 360 y 1000 px en Chrome. No se acredita equivalencia visual exacta en todos los clientes de correo.
- Los cinco PDF de ejemplo se abrieron y se generaron correctamente. Las vistas de factura, retención y guía se revisaron visualmente.
- Servidor SMTP configurado: conexión y autenticación verificadas sin enviar correos reales durante el QA.
- TypeScript y compilación de producción comprobados. Permanecen advertencias previas de imágenes y hooks.

Archivos de ejecución en `%TEMP%`: `sri-mail-tests.log`, `sri-mail-smtp-local.log`, `sri-mail-smtp-verification.log`, `sri-mail-build.log`, `sri-mail-visual.log` e `inntel-sri-email-preview/`.

Esta validación de correo no cierra el pendiente de conciliación comercial de NC/ND/retenciones documentado en el QA integral SRI.
