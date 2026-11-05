# Bóveda, nodos y clientes retirados

Fecha: 4 de noviembre de 2026.

## Bóveda

- Se reprodujo el fallo HTTP 503 de guardado en la web publicada con una credencial temporal. No se creó el registro fallido.
- Se aprovisionó la clave existente en Google Secret Manager, versión fija `inntel-vault-key/versions/1`, dentro del mismo proyecto. Se verificó su igualdad con la clave local sin mostrarla, rotarla ni cambiar permisos IAM.
- El servidor utiliza la variable privada configurada o carga la versión gestionada cuando la variable no existe. La carga se comparte entre solicitudes concurrentes, admite reintentos y no usa una clave de desarrollo incluida en el código.
- El guardado conserva la contraseña al editar únicamente los metadatos. La actualización explícita cambia el secreto cifrado con AES-256-GCM y contexto ligado al registro.
- Se eliminó la retención accidental del campo `password` en el objeto enviado al servidor y en el estado/caché de credenciales del navegador.
- Revelado y eliminación respetan permisos granulares y roles de la bóveda interna. Las respuestas no incluyen secretos sellados.
- La interfaz evita solicitudes repetidas, oculta de nuevo al finalizar el temporizador, limpia contraseñas al cambiar de cliente, informa errores concretos y detecta ediciones sobre una versión antigua.

## Nodos

- El formulario enviaba `activo/suspendido/retirado`, pero el servidor solo aceptaba `online/offline/warning`. Ahora una validación compartida acepta los estados administrativos y los estados de red ya utilizados.
- La validación identifica el campo, proveedor o sistema incorrecto y abre la pestaña correspondiente. No devuelve los valores rechazados en los errores.
- Se evita guardar mientras queda un proveedor o sistema en edición sin agregar y se bloquea el envío duplicado.
- Los mapas utilizan teselas configurables de OpenStreetMap, con atribución visible. Se mantiene la capa de satélite con su atribución y se admiten coordenadas con latitud cero.

## Clientes

- El listado habitual excluye retirados. El filtro «Retirado» permite consultarlos y «Todos los estados» incluye el historial.
- El estado se muestra como etiqueta tanto en la tabla como en la cabecera de la ficha.

## Verificación

- 154 pruebas automatizadas y compilación de producción correctas.
- Los flujos transaccionales de prueba cubren crear, editar, preservar/cambiar contraseña, revelar con auditoría, eliminar, rechazar permisos y revertir escrituras fallidas.
- Se verificó la carga de la clave gestionada sin variable local y su compatibilidad con la clave existente.
- La validación de producción después de publicar se realiza con registros temporales identificados como QA y sin imprimir sus contraseñas.

Referencias: [acceso a secretos gestionados](https://docs.cloud.google.com/secret-manager/docs/reference/rest/v1/projects.secrets.versions/access), [política de teselas de OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/).
