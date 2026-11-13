# Roles administrables y excepciones por usuario

## Resultado y ubicación

El catálogo está en **Personas → Roles y permisos**. Las cuentas se administran en **Personas → Usuarios**.

Un rol tiene un nombre elegido por la empresa, descripción, estado y una matriz de pantallas, módulos, visibilidad y funciones. El usuario se vincula al rol por su identificador; cambiar el nombre del rol no rompe esa relación.

Se aplica la decisión confirmada: **modificar un rol actualiza a sus usuarios vinculados y conserva las excepciones individuales**. Las antiguas plantillas dejan de ser el mecanismo de asignación independiente dentro del formulario de usuarios: se administran en el catálogo.

## Flujo con el ejemplo de Ventas

1. Entrar en **Personas → Roles y permisos → Nuevo rol** y escribir «Ventas».
2. Configurar sus módulos, pantallas, funciones y visibilidad de importes. Se puede partir de una configuración recomendada o comenzar sin permisos.
3. Guardar el rol. El catálogo permite buscar, editar, duplicar, activar, desactivar y eliminar los roles que no tienen usuarios asignados.
4. Crear «Vendedor1» en **Personas → Usuarios**, seleccionar «Ventas» y guardar.
5. En la edición del usuario se muestran sus permisos efectivos. Sin excepciones, corresponden a los del rol.
6. Si Vendedor1 necesita un módulo adicional, habilitarlo en ese usuario y guardar. La interfaz identifica la excepción; Ventas y los demás vendedores no cambian.
7. Si después se modifica Ventas, sus usuarios reciben los cambios heredados. Los permisos adicionales o bloqueos personales se conservan.
8. Una excepción se puede retirar con la flecha de «Usar el permiso del rol». **Usar solo permisos del rol** elimina todas las excepciones de ese usuario después de confirmar.

## Puntos importantes añadidos al ejemplo

| Punto | Comportamiento implementado |
|---|---|
| Origen de los roles | Los crea y administra el superadministrador en un catálogo independiente. El selector del usuario toma los roles del catálogo. |
| Herencia y excepciones | Se guardan por separado. Editar un usuario nunca modifica su rol. Una excepción explícita de denegación se conserva aunque inicialmente coincida con el rol. |
| Cambios generales | Al editar un rol con usuarios se informa cuántos están vinculados y se solicita confirmación. Los cambios afectan a todos los vinculados, conservando excepciones. |
| Módulo, pantalla y función | Acceder a una pantalla no equivale a poder escribir. Se distinguen, por ejemplo, crear, editar y responder tickets, resolverlos, gestionar proyectos, guardar configuración, administrar categorías de gastos o consultar/revelar credenciales sin poder crearlas ni editarlas. |
| Dependencias | Un módulo desactivado bloquea sus pantallas y acciones. Para conservar un módulo adicional como excepción debe habilitarse el módulo; después se conceden sus funciones necesarias. |
| Importes | Se separan tarifas de servicios, precios de productos, costos, saldos bancarios e importes comerciales. Desactivar importes comerciales bloquea las pantallas financieras correspondientes. Los documentos comerciales autorizados incluyen sus importes; ocultar una tarifa de catálogo no convierte un documento financiero autorizado en un documento sin valores. |
| Rol inactivo | No admite nuevas asignaciones y bloquea el acceso de los usuarios vinculados. Conserva sus cuentas, historial y excepciones. Reactivarlo recupera los accesos de las cuentas que siguen activas. |
| Cuenta inactiva | Es independiente del rol: activar un rol no reactiva una cuenta suspendida. |
| Eliminación | El servidor impide eliminar un rol que tiene usuarios, incluidos los inactivos. Se debe desactivar o reasignar primero. Duplicar un rol no copia sus usuarios. |
| Nombres | Son únicos ignorando mayúsculas, espacios redundantes y acentos. El perfil Superadministrador está reservado. |
| Ediciones simultáneas | Los cambios usan versiones. Se rechaza sobrescribir una edición ajena. Si el rol cambia mientras se edita un usuario, se pueden actualizar los permisos heredados conservando las excepciones pendientes del formulario. |
| Protección administrativa | Un rol de negocio, incluso con todas sus opciones habilitadas, no se convierte en superadministrador ni puede administrar cuentas o roles. |
| Auditoría y persistencia | Se registran creación, cambios y eliminación del rol, sus versiones y asignaciones de usuario. Las operaciones identifican el rol del actor. No se guardan contraseñas en esos registros. |
| Aplicación real | El servidor resuelve el rol actual y las excepciones en cada solicitud protegida. Una copia antigua de permisos en el navegador o en el perfil no concede acceso. |
| Sesiones abiertas | La interfaz verifica los cambios al recuperar el foco y cada 30 segundos mientras esté visible. El servidor aplica los permisos actuales en la siguiente solicitud, sin esperar ese intervalo. |
| Conservación de usuarios existentes | No se asignan ni sustituyen roles de cuentas reales automáticamente. Conservan sus permisos anteriores hasta que el administrador revise y asigne un rol. Las antiguas plantillas se muestran en el catálogo para poder revisarlas y utilizarlas. |
| Datos de otros módulos | Para seleccionar clientes, productos o servicios en una venta o ticket se necesitan los módulos de origen. La matriz advierte estas dependencias; no concede otros módulos automáticamente. Sus pantallas y funciones se pueden limitar por separado. |
| Plantillas anteriores | En el catálogo, los campos que no están definidos explícitamente comienzan desactivados. Deben revisarse antes de asignarlos; no se agregan accesos por el nombre del rol. |
| Alcance de registros | Se mantiene el alcance de datos actual de cada función autorizada. Restringir por cartera de vendedores, sucursal o clientes concretos requiere definir esas asignaciones y reglas adicionales; no se inventan distribuciones de clientes al crear un rol. |
| Funciones futuras | Los roles guardados usan permisos explícitos; una opción ausente no se concede por defecto. El catálogo solo acepta rutas de permisos conocidas. |

## Validación realizada

Pruebas automatizadas de roles, nombres duplicados, auditoría, versiones concurrentes, asignación desde el servidor, actualización en cada solicitud, excepciones positivas y negativas, rol inactivo o ausente, permisos de consulta, configuración, proyectos, archivos y categorías de gastos. Se mantiene la suite de regresión comercial y de autenticación.

En navegador se comprobó el recorrido con Ventas, Vendedor1, Vendedor2 y Vendedor3: creación, asignación desde el administrador real de usuarios, personalización aislada, restablecimiento parcial y total, edición concurrente, inactivación y reactivación, duplicación, eliminación y presentación en 360, 768 y 1440 píxeles.

Las pruebas utilizan datos sintéticos y adaptadores aislados. No se crean usuarios, roles ni movimientos comerciales reales en producción como parte de esta comprobación.

**Resultado final de QA:** 246 pruebas automatizadas aprobadas. El flujo visual también comprobó un conflicto real de versión del rol, la actualización del catálogo sin perder excepciones pendientes y la consulta de bóveda sin crear, editar ni eliminar credenciales.
