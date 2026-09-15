# Firebase de INNTEL

Proyecto configurado: `inntelcorp-45c89`.

El módulo `src/lib/firebase.ts` inicializa la aplicación una sola vez y exporta
Auth, Firestore y Storage. La configuración web proporcionada es pública;
no otorga permisos administrativos ni sustituye las reglas de seguridad.

Las variables de `.env.example` permiten cambiar el destino en Vercel.
Sin variables se utiliza el proyecto INNTEL proporcionado por el propietario.
Para entornos de prueba, configurar un proyecto separado y todas sus variables.
Analytics tiene un inicializador opcional que comprueba compatibilidad en el
navegador; no se activa automáticamente en las pantallas operativas.

## Estado de implementación

- Configuración del SDK: preparada.
- Activación remota de Auth, Firestore y Storage: no comprobada.
- Login y datos operativos: todavía usan el estado local existente.
- Migración de usuarios, permisos y datos: pendiente del plan maestro.
- Compilación: pendiente de restaurar las dependencias locales.

## Infraestructura preparada localmente

- `firebase.json` y `.firebaserc`: destino y puertos de emuladores.
- `firestore.rules`: permisos por colección y perfiles administrados fuera del cliente.
- `storage.rules`: adjuntos bloqueados hasta implementar autorización por documento.
- `src/lib/firebase-session.ts`: acceso mediante Firebase Auth y perfil activo en Firestore.
- `src/lib/firebase-repository.ts`: suscripciones, altas y actualizaciones con versión para detectar conflictos.

Estos módulos todavía no están conectados a `AppProvider`. Las reglas son una
base pendiente de validación de campos y pruebas con emuladores; no se han
publicado en el proyecto remoto. La aplicación sigue usando el estado local.
El gestor de paquetes rechazó la instalación al no poder verificar la firma
de pnpm. Se debe resolver la instalación verificable antes de compilar o desplegar.

## Configuración pendiente en la consola

1. Habilitar Authentication con correo y contraseña.
2. Registrar el dominio real de la aplicación entre los dominios autorizados.
3. Crear Firestore con ubicación elegida por INNTEL y acceso restringido.
4. Habilitar Storage si se utilizarán documentos y adjuntos.
5. Implementar y probar reglas de acceso antes de migrar datos.
6. Preparar el primer administrador mediante un mecanismo confiable de servidor.

La configuración web no permite realizar estas tareas administrativas.
No crear reglas abiertas para hacer funcionar el prototipo.
No importar las contraseñas de demostración ni subir claves privadas a GitHub.

Referencia: [Configuración oficial del SDK web](https://firebase.google.com/docs/web/setup).
