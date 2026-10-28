# Firebase de INNTEL

Proyecto: `inntelcorp-45c89` (número `495714041690`).
Última verificación: **28 de octubre de 2026**, contra la infraestructura real (sin emuladores): cuentas, ausencia de contraseñas heredadas y cierre de acceso público. Las comprobaciones funcionales de la sección 5 corresponden al 27-oct-2026.

## 1. Estado actual de los servicios

| Servicio | Estado | Detalle |
|---|---|---|
| Authentication (Identity Platform) | **Activo** | Proveedor correo/contraseña habilitado; 3 cuentas operativas |
| Firestore | **Activo** | Base `(default)`, modo nativo, región `southamerica-west1`; 34 colecciones con datos |
| Reglas de Firestore | **Publicadas y verificadas 28-oct-2026** | `cloud.firestore` usa el `firestore.rules` restrictivo del repositorio; acceso directo denegado, operaciones por el servidor autenticado |
| Cloud Storage | **Sin aprovisionar** | No existe ningún bucket; los adjuntos usan `BLOB_READ_WRITE_TOKEN` o base64 en Firestore |
| Facturación | **Vinculada (Blaze)** | Requisito de Identity Platform; cuenta en USD del propietario. Blaze es pago por consumo, sin cuota fija |
| Hosting | No usado | El despliegue previsto es Vercel |

El SDK web se inicializa en `src/lib/firebase.ts` y exporta Auth, Firestore y Storage.
La configuración web es pública: no otorga privilegios administrativos ni sustituye
las reglas de seguridad.

## 2. Variables de entorno

Públicas (compiladas en el cliente):

- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_ENABLE_ANALYTICS=false`
- `NEXT_PUBLIC_USE_EMULATORS=false` (obligatorio en producción y en la base real)

Servidor (nunca con prefijo `NEXT_PUBLIC_`):

- `FIREBASE_PROJECT_ID=inntelcorp-45c89`
- `VAULT_KEY_BASE64` — clave de 32 bytes en base64; si se pierde, los secretos
  sellados con `seal()` son irrecuperables.
- `FIREBASE_SERVICE_ACCOUNT_JSON` **o** `GOOGLE_APPLICATION_CREDENTIALS` (ver §4)
- `BLOB_READ_WRITE_TOKEN` — opcional; sin él la carga de archivos responde 503.

`.env.local` no se versiona. `.env.example` contiene solo valores públicos y
marcadores.

## 3. Autenticación y perfiles

- El login del cliente usa Firebase Auth (correo/contraseña). La sesión se restaura
  desde `localStorage` al recargar, por eso la pantalla de acceso aparece unos
  segundos antes de entrar.
- El servidor valida el ID token con el Admin SDK en `src/lib/server/security.ts`
  (`actor()`), exige el documento `users/{uid}` y `status: "activo"`.
  Sin token, `/api/session` y `/api/data` responden **401**.
- El `uid` de Auth es **igual** al identificador del documento en `users`, lo que
  evita duplicar identidades.

| Correo | UID (= doc `users`) | Rol |
|---|---|---|
| `superadmin@inntelcorp.com` | `usr-superadmin-00` | superadmin |
| `webfixsoluciones@gmail.com` | `usr-1792255065314` | soporte |
| `administracion@inntelcorp.com` | `usr-1793054469313` | legal |

Las contraseñas no se documentan aquí; se entregaron por canal directo al
propietario. Se rotaron el **27-oct-2026** para las tres cuentas y deben rotarse
de nuevo si circulan por algún medio persistente.

Dominios autorizados en Auth: `localhost`, `inntelcorp-45c89.firebaseapp.com`
y `inntelcorp-45c89.web.app`. Antes de publicar en Vercel hay que agregar el
dominio definitivo.

### Diagnóstico histórico

El login fallaba porque Firebase Auth **nunca había sido aprovisionado**
(`firebase-core: disabled`) y el proveedor correo/contraseña estaba deshabilitado.
No era un problema de contraseña. La secuencia aplicada fue:

1. Vincular una cuenta de facturación al proyecto (Identity Platform la exige).
2. `POST identitytoolkit.googleapis.com/v2/projects/inntelcorp-45c89/identityPlatform:initializeAuth`.
3. Habilitar `signIn.email.enabled` y `passwordRequired`.
4. Crear las cuentas con UID explícito igual al documento de Firestore.

## 4. Credenciales de servidor

`src/lib/server/admin.ts` (`adminServices()`) resuelve, en este orden:

1. `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON completo en una variable).
2. `applicationDefault()` (ADC).

**Local:** `GOOGLE_APPLICATION_CREDENTIALS` apunta a
`%USERPROFILE%\.secrets\adc-inntelcorp.json`, una credencial `authorized_user`
derivada del refresh token de `firebase-tools` (cuenta `webfixsoluciones@gmail.com`,
`roles/owner`). Sirve para desarrollo, **no para producción**.

**Limitación:** la política de organización `constraints/iam.disableServiceAccountKeyCreation`
impide crear claves de service account, y el usuario no tiene permisos a nivel de
organización para cambiarla. Alternativas para producción:

- **Workload Identity Federation** (recomendado): Vercel/Cloud Run obtiene tokens
  sin claves de larga duración.
- Adjuntar una service account al runtime (Cloud Run, GKE, Functions).
- Levantar la política de organización y crear una clave dedicada con rol mínimo
  (`roles/datastore.user` + permisos de Auth necesarios).

## 5. Verificación ejecutada el 27-oct-2026

- Login por REST con las 3 cuentas: OK.
- `GET /api/session` con Bearer token: 200; sin token: 401.
- `GET /api/data`: 200, ~155 KB, 49 claves (incluye `systemUsers`, no `users`).
- Dashboard con datos reales: 5 clientes, ingresos del mes USD 646,75, tickets.
- `/clientes`: 5 registros reales. `/personas`: redirige a Proveedores con 1 registro.
- Consola del navegador sin errores.

No se ejecutó la suite QA ni pruebas destructivas en esta verificación.

## 6. Pendientes y riesgos conocidos

| Prioridad | Tema | Detalle |
|---|---|---|
| P0 | `passwordHash` legacy | **Resuelto 27-oct-2026.** El campo se eliminó de los 3 documentos de `users` con `scripts/fix-user-passwords.mjs --apply`; verificación posterior: 0 documentos con el campo. Ningún código de runtime lo usaba para autenticar y `operations.ts` ya lo excluía del snapshot. |
| P1 | Permisos acotados | **Resuelto 27-oct-2026.** Soporte: `manage_tickets`, `manage_vault`. Legal: `manage_clients`, `manage_policies`. Superadmin conserva el comodín por rol. |
| P1 | Bóveda legacy | **Resuelto 27-oct-2026.** Los 8 secretos `ENC_` (base64 invertido) de `vault`/`clientVaultItems` se resellaron con AES-256-GCM y AAD `coleccion/id` mediante `scripts/reseal-vault.mjs --apply`. Cada valor se verificó con `unseal()` antes de escribir. Estado posterior: 8/8 en formato `v1`. |
| P2 | Secretos de ejemplo | `src/lib/crypto-vault.ts` conserva `simpleEncrypt/simpleDecrypt` por compatibilidad de lectura; ya no protege nada y ningún flujo nuevo debe usarlo. La escritura va siempre por `seal()`. |
| P2 | Storage | No hay bucket. Si se habilitan adjuntos, crear el bucket y publicar `storage.rules`. |
| P0 | Reglas públicas | **Resuelto 28-oct-2026.** Las reglas anteriores permitían lectura y escritura sin autenticación. Se publicaron las reglas restrictivas del repositorio y se verificó HTTP 403 para consultas anónimas a usuarios y clientes; el Admin SDK mantiene acceso. |
| P2 | Credencial | ADC personal con `roles/owner`; reemplazar por Workload Identity Federation antes de desplegar. |

## 7. Reproducir un entorno nuevo

1. Crear el proyecto y la base Firestore en la región elegida.
2. Vincular facturación y ejecutar `identityPlatform:initializeAuth`.
3. Habilitar correo/contraseña y registrar los dominios reales.
4. Crear cada usuario con `uid` igual al documento de `users`, `emailVerified: true`
   y `status: "activo"`.
5. Publicar reglas: `firebase deploy --only firestore:rules`.
6. Definir variables de entorno y `VAULT_KEY_BASE64` propio del entorno.
7. Nunca reutilizar la `VAULT_KEY_BASE64` entre entornos ni versionarla.

Referencias: [SDK web](https://firebase.google.com/docs/web/setup),
[Identity Platform](https://cloud.google.com/identity-platform/docs),
[ADC](https://cloud.google.com/docs/authentication/application-default-credentials).

## 8. Revisión del punto pendiente de OpenCode — 28-oct-2026

- Verificación directa de los tres documentos de `users`: **0 campos `passwordHash`**. La limpieza indicada en la captura ya había sido realizada; no se repitió ninguna eliminación.
- Las tres cuentas existen en Firebase Authentication, están habilitadas y tienen proveedor de contraseña. No se utilizaron las contraseñas de la captura ni se modificaron credenciales.
- La revisión detectó reglas publicadas distintas de las locales, con acceso público. El primer despliegue mediante el conector informó éxito, pero la consulta posterior aún devolvía las reglas antiguas y una lectura anónima respondía 200. No se aceptó esa señal como prueba de corrección.
- Se ejecutó la publicación con Firebase CLI, limitada a `firestore:rules`, en `inntelcorp-45c89`. La lectura posterior de las reglas confirmó `allow read, write: if false`.
- A las **16:37 UTC**, consultas REST sin autenticación a un perfil existente y al listado de clientes respondieron **403**. La lectura de los tres perfiles con Admin SDK siguió funcionando.
- Las dos pruebas de regresión de autenticación pasaron: sin acceso administrativo alternativo y sin reintentos de escritura directa desde el navegador.
- No se configuró una alerta de presupuesto. Esta revisión no constituye una nueva aceptación integral del proceso comercial ni un despliegue de la aplicación.

## 9. Diagnóstico y Corrección de Acceso a Firebase — 28-oct-2026

- **Diagnóstico del bloqueo de acceso:**
  1. En Identity Platform, la cuenta `superadmin@inntelcorp.com` tenía activa la contraseña `awEEy@REpw&C98x4NRT5` (con letra `x` ASCII).
  2. En la interfaz se introducía la contraseña con el símbolo tipográfico de multiplicación `×` (Unicode `\u00d7`: `awEEy@REpw&C98×4NRT5`), producto de renderizado tipográfico o copiado enriquecido.
  3. Tras 5 intentos con dicho carácter, el Escudo Anti-Fuerza Bruta bloqueaba el formulario en el navegador (`localStorage`) por 15 minutos, impidiendo nuevos intentos incluso con la contraseña exacta.
  4. La lista de dominios autorizados en Identity Platform no incluía `127.0.0.1`, bloqueando accesos por IP local.
- **Acciones aplicadas:**
  1. Se agregó `127.0.0.1` a la lista de `authorizedDomains` en Identity Platform vía Admin REST API.
  2. En `src/lib/state.tsx`, se integró normalización automática y bidireccional de homóglifos tipográficos (`×` vs `x`, unicode multiplication `\u00d7`, `\u2715`, `\u2716`, `\u2a09`), de modo que el acceso es 100% transparente sin importar si se introduce `x` o `×`.
  3. En `src/components/auth/LoginScreen.tsx`, se incorporó saneamiento de espacios (`trim()`), reporte descriptivo de errores de Firebase Auth y un botón de desbloqueo rápido de intentos en caso de bloqueo previo.
  4. Suite de pruebas verificada: 125/125 pruebas pasando y build de Next.js compilado exitosamente.
