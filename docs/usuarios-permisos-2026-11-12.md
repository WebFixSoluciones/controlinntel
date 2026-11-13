# Administración de usuarios, roles y permisos

## Reglas de acceso

- Cada solicitud protegida verifica la identidad en Firebase, la revocación del token y el perfil activo en `users/{uid}`. Sin perfil verificable se deniega el acceso. Se retiraron las identidades de respaldo definidas en el código.
- Solo el superadministrador administra cuentas y plantillas de roles. La pantalla lo indica; el rol administrador general no puede concederse acceso a usuarios mediante una casilla.
- El superadministrador tiene acceso completo. Para limitarlo se debe asignar otro rol. Otro superadministrador debe editar su cuenta; se impide desactivar o degradar al último superadministrador activo.
- El perfil Consulta conserva su naturaleza de solo lectura. Un rol distinto permite delegar funciones de escritura.
- Módulos, submódulos, acciones y visibilidad se comprueban en el servidor y en la interfaz. Los permisos generales compatibles se calculan a partir de la matriz, sin contradecir sus denegaciones.

## Guardado y compatibilidad

Al guardar una cuenta se registra una matriz explícita con `permissionModelVersion: 2`. Los permisos ausentes en este modelo no se habilitan por defecto. Los perfiles anteriores conservan la compatibilidad hasta su siguiente guardado; no se modifican masivamente las cuentas existentes.

Cambiar el rol de un usuario existente conserva sus ajustes personalizados. El restablecimiento de los valores recomendados requiere confirmación y se aplica al guardar. Seleccionar Superadmin habilita el acceso completo, expresamente identificado en pantalla.

“Todos” y “Ninguno” incluyen acciones y visibilidad. El acceso a Usuarios/Equipo permanece reservado al superadministrador. Se corrigió el selector no operativo “Cobranzas & OPEX”: ahora Cobranzas/Anticipos y Gastos son opciones separadas.

Los permisos de precios y descuentos de notas de venta pertenecen a Ventas, independientemente de Facturación SRI. El servidor comprueba cambios de precios, descuentos, edición de clientes, nodos y credenciales. La consulta de saldos y datos bancarios de proveedores oculta esos campos en las respuestas para quienes carecen de permiso. Administrar cuentas bancarias y transferir fondos tienen acciones independientes.

## Cuentas y plantillas

- El alta crea inicialmente una identidad bloqueada; la activa después de guardar el perfil y su operación de auditoría. Si falla el guardado, elimina la identidad recién creada; si falla la activación, la mantiene bloqueada para revisión.
- Las contraseñas no se persisten en el perfil ni en el historial de operaciones. Cambiar una contraseña o desactivar una cuenta revoca sus sesiones.
- Editar una cuenta inactiva conserva el bloqueo en Firebase. Reactivarla lo habilita expresamente. El correo de identidad no se modifica desde este formulario.
- Editar y desactivar exigen la versión revisada por el administrador. Una modificación simultánea devuelve conflicto en lugar de sobrescribir cambios.
- Desactivar conserva el historial y no elimina físicamente la cuenta. Se corrigieron las etiquetas de la interfaz.
- Las plantillas de rol permiten crear, actualizar, aplicar y eliminar configuraciones con nombre. Son copias: sus cambios no modifican automáticamente a los usuarios que las utilizaron.
- Los cambios de permisos se verifican en cada operación del servidor. Una sesión abierta actualiza la interfaz al recuperar el foco y cada 30 segundos mientras esté visible; una cuenta revocada o desactivada cierra la sesión al detectarse.

Firebase Authentication y Firestore son servicios separados. Si hay un fallo entre ambas escrituras, la operación no informa éxito: se debe recargar la cuenta para comprobar su estado antes de reintentar. El perfil inactivo sigue impidiendo el acceso aunque falle la actualización de la identidad.

## Verificación

Pruebas automatizadas de creación, fallos de alta, inactivación, reactivación, versiones concurrentes, último superadministrador, autoedición, correo inmutable, matriz explícita, tokens revocados, ocultamiento de importes y acciones comerciales. Pruebas de navegador del formulario, correo de solo lectura, denegación total y ciclo de creación/actualización/aplicación/eliminación de plantillas, con anchos de 360, 768 y 1440 píxeles.

Las pruebas usan datos sintéticos y adaptadores aislados. No se cambiaron perfiles reales ni se ejecutaron operaciones financieras de producción como parte de estas pruebas.

Resultado: 229 pruebas automatizadas aprobadas, compilación de producción correcta y comprobaciones de navegador aprobadas. Se comprobó además que la exportación Excel respete la restricción de saldos bancarios. Las pantallas de configuración de correo y certificado requieren su permiso específico, y enviar o reintentar documentos al SRI requiere la autorización SRI correspondiente.
