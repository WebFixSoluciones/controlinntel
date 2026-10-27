# Firebase de INNTEL

Proyecto: `inntelcorp-45c89` (número `495714041690`).
Última verificación: **27 de octubre de 2026**, contra la infraestructura real (sin emuladores).

## 1. Estado actual de los servicios

| Servicio | Estado | Detalle |
|---|---|---|
| Authentication (Identity Platform) | **Activo** | Proveedor correo/contraseña habilitado; 3 cuentas operativas |
| Firestore | **Activo** | Base `(default)`, modo nativo, región `southamerica-west1`; 34 colecciones con datos |
| Reglas de Firestore | **Publicadas** | Release `cloud.firestore` con ruleset `0dd76e3e-941a-4108-b441-b7ccee74706e` (19-sep-2026) |
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
| P2 | Reglas | Publicadas el 19-sep-2026; no se compararon con el `firestore.rules` actual del repositorio. |
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
