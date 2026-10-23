# Auditoría Integral y Plan de Corrección — CONTROL INNTEL

| Campo | Valor |
|---|---|
| **Proyecto** | Control INNTEL — Sistema de gestión ISP / ARCOTEL / SRI |
| **Repositorio** | `controlinntel` (rama `main`) |
| **Fecha de auditoría** | 23 de octubre de 2026 |
| **Alcance** | 100 % del repositorio: `src/`, configuración, reglas de seguridad, documentación, scripts e historial Git |
| **Modo** | Solo lectura. No se modificó ningún archivo de la aplicación |
| **Auditores** | Revisión estática completa + auditorías paralelas de módulo |
| **Estado del documento** | Entrega final |

---

## 0. Cómo leer este documento

El documento está dividido en dos grandes bloques:

- **Bloque A — Diagnóstico técnico (secciones 1 a 9):** qué está roto, con evidencia `archivo:línea`, severidad y causa raíz.
- **Bloque B — Plan de corrección (secciones 10 a 14):** el estándar de diseño y limpieza visual que hay que adoptar, el plan por fases y el backlog ejecutable con identificadores para seguimiento.

Cada hallazgo tiene un **ID estable** (`P0-01`, `P1-07`, `D-12`, …) para poder asignarlo a un issue, a un commit o a un responsable sin ambigüedad.

**Convención de severidad**

| Nivel | Significado | Criterio |
|---|---|---|
| **P0 — Crítico** | Compromete seguridad, cumplimiento legal o la integridad del dinero. Explotable hoy | Debe corregirse antes de cualquier otra cosa |
| **P1 — Alto** | Produce pérdida de datos, cifras erróneas o incumplimiento. Ocurre en uso normal | Antes de operar con datos reales |
| **P2 — Medio** | Degrada la operación, la confiabilidad o la experiencia | Primer trimestre |
| **P3 — Bajo** | Deuda estética, técnica o de mantenibilidad | Backlog continuo |

---

## 1. Resumen ejecutivo

> **El producto es una aplicación comercialmente presentable montada sobre una capa de seguridad, autorización y contabilidad que no existe.** La interfaz es de nivel producción; la persistencia, los permisos, el cifrado y la facturación electrónica son simulaciones.

Hoy, tal como está el repositorio, el sistema **no es apto para operar datos reales de clientes ni para emitir comprobantes tributarios**.

### 1.1 Tablero de estado

| Dimensión | Estado | Comentario |
|---|---|---|
| Interfaz / UX | 🟡 Buena base, alta inconsistencia | 90 componentes, diseño atractivo, pero 55 estilos de título distintos |
| Modelo de dominio | 🟢 Notable | Clave de acceso SRI, retenciones, kardex, notas de crédito bien tipados |
| Calidad de tipos | 🟡 Buena pero desactivada | `tsc --strict` → 0 errores; el build los ignora |
| Build / despliegue | 🟢 Compila | `next build` OK, 22 rutas |
| Calidad de código | 🟡 Deuda alta | 40 errores de lint, 180 `any`, componentes de hasta 1.900 líneas |
| **Seguridad** | 🔴 **Comprometida** | Base de datos abierta al mundo, bypass de login, secretos en claro |
| **Integridad de datos** | 🔴 **Rota** | Libro contable por navegador, sin transacciones, secuenciales aleatorios |
| **Cumplimiento SRI** | 🔴 **Simulado** | Firma electrónica falsa y respuestas "AUTORIZADO" fabricadas |
| **Diseño / consistencia visual** | 🟠 **Sin estándar** | 4.030 colores en hexadecimal, 22 estilos de tabla, 78 tablas sin componente |
| Pruebas / CI | 🔴 Inexistente | `.github` vacío; 3 scripts ad-hoc sin runner |

### 1.2 Los diez riesgos que justifican detener la operación

| # | Riesgo | Impacto |
|---|---|---|
| 1 | Firestore con `allow read, write: if true` | Cualquier persona en internet lee y borra toda la base |
| 2 | Auto-provisión de administrador en el login | Cualquier correo nuevo obtiene rol `admin` con todos los permisos |
| 3 | Contraseñas en texto plano (campo llamado `passwordHash`) | Filtración directa de credenciales de usuarios |
| 4 | La bóveda "AES-256" es Base64 invertido sin clave | Todos los secretos de clientes y routers son legibles |
| 5 | Firmas electrónicas falsas + respuestas "AUTORIZADO" inventadas | Facturas no autorizadas por el SRI presentadas como autorizadas |
| 6 | El backend seguro existe pero no se usa | Toda la autorización y el cifrado reales están desconectados |
| 7 | Secuenciales de comprobante aleatorios o por longitud de arreglo | Duplicados fiscales y notas de crédito obligatorias |
| 8 | RBAC decorativo (`permissions: ["all"]` por defecto) | Cualquier rol accede a bóveda, finanzas y usuarios |
| 9 | Compras y finanzas nunca se releen de Firestore | Cada navegador tiene su propio libro contable |
| 10 | Datos fabricados indistinguibles de reales | Decisiones de negocio y declaraciones regulatorias sobre cifras inventadas |

### 1.3 Esfuerzo estimado de corrección

| Fase | Contenido | Estimación |
|---|---|---|
| **Fase 0** | Contención de seguridad | 3–5 días |
| **Fase 1** | Columna vertebral (backend + RBAC + CI) | 2–3 semanas |
| **Fase 2** | Integridad contable | 3–4 semanas |
| **Fase 3** | Cumplimiento SRI y evidencia documental | 3–4 semanas |
| **Fase 4** | Estándar de diseño y limpieza visual | 2–3 semanas |
| **Total** | Camino a producción defendible | **≈ 12–17 semanas** con 1–2 desarrolladores |

---

## 2. Contexto del sistema auditado

### 2.1 Métricas del repositorio

| Métrica | Valor |
|---|---|
| Archivos TypeScript / TSX en `src/` | **139** |
| Líneas de código | **57.357** |
| Componentes React | **90** |
| Páginas (App Router) | **16** |
| Rutas API | **4** (2 nunca invocadas) |
| Commits / autores | **162 / 1** (1 sep → 23 oct 2026 ≈ 7,5 semanas) |
| Dependencias de producción | 20 (5 sin uso) |
| Cobertura de pruebas | 0 % automatizado |

### 2.2 Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14.2.18 (App Router, RSC) |
| UI | React 18.3, Tailwind CSS 3.4, `lucide-react` |
| Estado | Contexto React monolítico (`state.tsx`, 3.781 líneas) |
| Base de datos | Firestore (cliente) + `firebase-admin` (servidor, sin usar) |
| Validación | Zod (solo en el servidor, sin usar) |
| Documentos | `docx` y `exceljs` (carga diferida correcta) |
| Mapas | `leaflet` (carga diferida correcta) |
| IA | `@google/generative-ai` (cliente, sin clave) |

### 2.3 Hallazgo estructural que explica casi todo lo demás

El repositorio contiene **dos arquitecturas incompatibles**:

```
   ┌─────────────────────────────────────────────────────────────┐
   │  ARQUITECTURA REAL (en uso)                                 │
   │  Navegador → SDK Firebase → Firestore (reglas abiertas)     │
   │  · sin autorización  · sin validación  · sin transacciones  │
   └─────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────┐
   │  ARQUITECTURA CORRECTA (escrita, nunca invocada)            │
   │  Navegador → /api/data → Admin SDK → Firestore              │
   │  · actor() verifica ID token  · requirePermission()         │
   │  · bloqueo optimista por versión  · Zod  · AES-256-GCM      │
   │  · auditoría en la misma transacción                        │
   └─────────────────────────────────────────────────────────────┘
```

Verificado: `grep -r "/api/data"` en `src/` devuelve **cero** llamadas. Los módulos `api-client.ts`, `firebase-session.ts` y `firebase-repository.ts` tampoco se importan en ningún componente.

**Consecuencia:** el 100 % de las mutaciones pasan por `syncToFirestore` → `setDoc` directo.

---

## 3. Método y evidencia

| Actividad | Herramienta / resultado |
|---|---|
| Lectura íntegra de archivos núcleo | 15 archivos: `state.tsx`, `permissions.ts`, `server/*`, `api/*`, reglas, configuración |
| Verificación de tipos real | `npx tsc --noEmit --incremental false --strict` → **0 errores** |
| Verificación de lint real | `npx next lint` → **40 errores, 12 warnings** |
| Build de producción | `npm run build` → **OK**, 22 rutas, 88 kB compartidos |
| Análisis de historial | `git log -S`, `git shortlog`, `git log --name-only` |
| Auditoría de módulos | 3 revisiones paralelas: facturación/SRI, inventario/compras/finanzas, clientes/red/UI |
| Inventario de diseño | Extracción programática de 198 encabezados, 78 tablas, 4.030 literales de color |

**Limitación declarada:** no se ejecutó la aplicación ni se inspeccionó la base de datos en vivo. La severidad en tiempo de ejecución de P0-09 depende de si ya existen documentos en `suppliers`, `purchaseInvoices` y `bankAccounts`; conviene confirmarlo directamente.

---

## 4. Hallazgos CRÍTICOS (P0)

### P0-01 · Firestore completamente abierta: lectura y escritura mundial sin autenticación

**Archivo:** `firestore.rules:23-25`

```javascript
match /{document=**} {
  allow read, write: if true;
}
```

**Cadena de explotación**

1. El `projectId` y la `apiKey` son públicos por diseño (`NEXT_PUBLIC_*`, visibles en el bundle y en `.env.example:3-8`).
2. Cualquiera ejecuta `GET https://firestore.googleapis.com/v1/projects/inntelcorp-45c89/databases/(default)/documents/users` sin token.
3. Obtiene todos los perfiles con contraseñas en claro (P0-03), la bóveda, datos fiscales de clientes, nodos e IPs.
4. Puede borrar o alterar toda la base.

**Prueba de que está desplegado así:** la aplicación lee y escribe Firestore directamente desde el navegador sin custom claims (`state.tsx:632`, `state.tsx:962`, `state.tsx:454`). Con reglas estrictas esas operaciones fallarían. Funcionan ⇒ las reglas son permisivas.

**Agravante — la auditoría "inmutable" no lo es.** Las reglas de `auditLogs` (`firestore.rules:9-13`) declaran `allow update, delete: if false`, pero el catch-all también coincide con esas rutas. En Firestore las reglas son disyuntivas: si *cualquier* regla coincidente permite, el acceso se concede. El registro WORM es mutable y borrable.

**Corrección requerida**

- Denegar por defecto (`allow read, write: if false;`).
- `users`, `vault`, `clientVaultItems`: **solo** Admin SDK (sin reglas de cliente).
- Resto de colecciones: `request.auth != null` + verificación de rol por colección.
- `auditLogs` / `securityIncidents`: `allow read, create` con `request.auth != null`; `update, delete: if false` **fuera** del alcance del catch-all (usar rutas explícitas, no comodín global).
- Probar con el emulador y con `firebase deploy --only firestore:rules`.

---

### P0-02 · Bypass total de autenticación y autopromoción a administrador

Tres caminos independientes, cualquiera suficiente.

**a) Auto-provisión de admin en login fallido** — `state.tsx:826-848`

```typescript
if (err?.code === "auth/user-not-found" || err?.code === "auth/invalid-credential") {
  const newCred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
  ...
  role: "admin", permissions: ["all"],   // ← se otorga admin a sí mismo
```

Cualquier correo inexistente + contraseña de 6+ caracteres crea una cuenta Firebase y una sesión **admin con todos los permisos**.

**b) Sesión forjada en localStorage** — `state.tsx:510-548`

La sesión se restaura desde `INNTEL_AUTH_USER_PROD_V1`. Si no existe firma, **la genera y la acepta** (`state.tsx:533-537`): se firma sola cualquier rol inyectado. El pepper está hardcodeado en el bundle (`security-shield.ts:17`) y el hash es FNV no criptográfico (`:41-56`), recalculable por cualquiera.

**c) `setUserRole` expuesto en el contexto** — `state.tsx:908-920`

Reescribe el rol propio y **re-firma** la sesión. Ningún componente lo usa aún, pero es alcanzable desde cualquier componente o desde la consola.

**Corrección requerida**

- Eliminar por completo el bloque de auto-provisión.
- Derivar el perfil del ID token verificado en servidor (ya implementado en `server/security.ts:8-19`).
- Eliminar la restauración de sesión desde localStorage; usar `onAuthStateChanged` + `/api/data`.
- Eliminar `setUserRole` del contexto.
- Tratar la firma de cliente como no-seguridad (o eliminarla).

---

### P0-03 · Contraseñas en texto plano, en el código, en la base y en el navegador

| Ubicación | Evidencia |
|---|---|
| Semilla con contraseña real | `mock-data.ts:61` → `passwordHash: "SuperAdmin2026*"` |
| Comparación en claro | `state.tsx:861` → `a.passwordHash === password` |
| Reinyección desde Firestore | `state.tsx:651-654` |
| Persistencia en localStorage | `state.tsx:740` |

Un campo llamado `passwordHash` que contiene la contraseña es el peor escenario posible. **No existe ninguna función de hash en todo el proyecto.**

**Corrección requerida**

- Eliminar `passwordHash` del modelo de cliente y de la base.
- Usar Firebase Auth como única autoridad de credenciales.
- Rotar `SuperAdmin2026*` y toda contraseña sembrada.
- Si se requiere hash local en algún flujo, usar `scrypt`/`argon2` en servidor.

---

### P0-04 · La bóveda "AES-256-GCM" es Base64 invertido, sin clave

**Archivo:** `crypto-vault.ts:6-30` — el archivo se titula *"AES-256-GCM"*:

```typescript
export function simpleEncrypt(text: string, secretKey: string = "INNTEL_MASTER_KEY_2026"): string {
  const encoded = btoa(unescape(encodeURIComponent(text)));
  return "ENC_" + encoded.split("").reverse().join("");
}
```

- **No hay cifrado.** Es `reverse(base64(texto))`, reversible sin clave.
- El parámetro `secretKey` **nunca se usa** en el cuerpo.
- Se descifra en el navegador (`state.tsx:1225`, `state.tsx:1230`).
- `revealCredential` **no verifica ningún permiso** ni el campo `allowedRoles`.
- La UI afirma lo contrario: `SecureVault.tsx:109` ("Credencial cifrada con AES-GCM"), `VaultManager.tsx:205` ("AES-256 GCM"), `UserFormView.tsx:936`.

**Las credenciales de routers no se cifran en absoluto:** `ClientNodeModal.tsx:321-329` guarda `password` y `credentials: "user / pass"` en texto plano dentro de `nodes`. Hay secretos reales versionados: `ClientNodesManager.tsx:79` → `"admin / InntelRouter2026*"`, y el campo de entrada es `type="text"` (`:1189-1193`).

**Corrección requerida**

- Re-cifrar todo con `seal()` (`server/vault.ts:14-28`, AES-256-GCM real con AAD).
- Migrar `vault`, `clientVaultItems` y `nodes[].services[]` al esquema sellado.
- Mover `reveal` detrás de `/api/data` con verificación de `allowedRoles`.
- Rotar la contraseña de router commiteada y auditar el historial Git.
- Retirar toda leyenda "AES" de la UI hasta que sea cierto.

---

### P0-05 · Firma electrónica falsa y respuestas "AUTORIZADO" inventadas ante el SRI

Riesgo **legal y tributario** más grave del sistema.

**a) La firma XAdES-BES no es una firma** — `sri-service.ts:858-936`

```typescript
// Seudo-hash criptográfico representativo para pre-firma estándar XAdES-BES
const fakeDigest   = Buffer.from(xmlSinFirma.slice(0,120)+timeIso).toString("base64").slice(0,28)+"=";
const fakeSigValue = Buffer.from(`INNTEL-SIGNATURE-XADES-BES-...`).toString("base64");
```

- `DigestValue` y `SignatureValue` derivan de un *slice de 120 caracteres*, no del documento.
- El certificado X.509 está **truncado con puntos suspensivos literales** (`MIIF4zCCBMug...U0VS...`).
- El módulo RSA es un placeholder (`AN13Z4/2G849nJ...==`).
- Algoritmo **SHA-1**, obsoleto y rechazado por el SRI.
- El "XML firmado" devuelto es un *echo* del XML sin firma (`api/sri/route.ts:285`).

**b) La API miente sobre la autorización** — `api/sri/route.ts:245-286`

```typescript
estado: "AUTORIZADO",
numeroAutorizacion: claveAcceso,
mensaje: "AUTORIZADO POR SERVICIO DE RENTAS INTERNAS",
```

Sin contactar al SRI. Un usuario verá "AUTORIZADO", imprimirá el RIDE y creerá estar en regla.

**c) La ruta no tiene autenticación.** No invoca `actor()` ni `requirePermission`, y además hace *scraping* de `srienlinea.sri.gob.ec` como proxy abierto (`:40-120`) — riesgo de bloqueo de la IP del despliegue.

**Lo que sí está bien:** `validarClaveAccesoSRI` (`sri-service.ts:283-347`) implementa correctamente los 49 dígitos y el módulo 11.

**Corrección requerida**

- Firma real XAdES-BES con `.p12` en servidor/KMS, o integración con proveedor certificado.
- Llamada SOAP real a recepción y autorización.
- Autenticación obligatoria en `/api/sri` y límite de tasa.
- Retirar el `estado: "AUTORIZADO"` hardcodeado; devolver el estado real o `NO_ENVIADO`.
- **Mientras no exista firma real: bloquear la emisión fiscal** y etiquetar los comprobantes como borrador no enviado.

---

### P0-06 · El backend seguro existe y es código muerto

| Archivo | Lo que hace bien | ¿Se usa? |
|---|---|---|
| `server/vault.ts:14-28` | AES-256-GCM real, IV aleatorio, auth tag, **AAD ligado a `entity/id`** | ❌ |
| `server/security.ts:8-19` | Verifica ID token de Firebase + perfil activo | ❌ |
| `server/operations.ts:33-80` | `requirePermission`, **bloqueo optimista por versión**, saneado de campos, `allowedRoles` | ❌ |
| `server/schemas.ts` | Validación Zod por colección | ❌ |
| `api/data`, `api/users` | Endpoints completos y correctos | ❌ **0 llamadas** |

**Agravante:** `server/vault.ts:3` tiene una **clave maestra por defecto commiteada** (`DEFAULT_VAULT_KEY_BASE64`), así que incluso el código bueno filtraría secretos si `VAULT_KEY_BASE64` no se configura.

**Corrección requerida**

- Cablear la UI a `/api/data` y eliminar todos los `setDoc`/`getDocs` directos.
- Eliminar el fallback de clave y fallar cerrado si `VAULT_KEY_BASE64` no existe.
- Cargar el perfil desde `/api/data` (incluye `modulePermissions` saneado).

---

### P0-07 · Secuenciales de comprobante aleatorios o por longitud de arreglo

El SRI exige secuenciales **únicos y sin huecos** por establecimiento/punto de emisión.

| Ubicación | Problema |
|---|---|
| `state.tsx:1945` y `FinanceDashboard.tsx:344` | `` `001-100-${Math.floor(Math.random()*900000+100000)}` `` — aleatorio |
| `state.tsx:2451-2471` | `max(arreglo en memoria) + 1` — colisiona con dos usuarios o caché incompleta |
| `inventory-service.ts:88-95` | `generateInventoryDocNumber(prefix, existingCount)` — al borrar se regenera un número usado |
| `PurchaseWithholdingsTab.tsx:49-52` | Retención = `length + 1`, además **editable a mano** |

**Corrección requerida**

- Contadores atómicos por `(tipoComprobante, establecimiento, puntoEmision)` dentro de una transacción de Firestore.
- Nunca derivar la secuencia de la longitud de un arreglo del cliente.
- Campos de número de comprobante de solo lectura, generados en servidor.

---

### P0-08 · RBAC inexistente: `can()` responde `true` para todos

| Punto | Evidencia |
|---|---|
| Todo usuario se crea con `permissions: ["all"]` | `UsersManager.tsx:82` |
| Documento sin permisos ⇒ `["all"]` | `state.tsx:655`, `state.tsx:873` |
| `"all"` ⇒ `true` | `permissions.ts:41-45` |
| `canAccessModule` **fail-open** | `permissions.ts:330` |
| `canUser` **fail-open** si la acción no está declarada | `permissions.ts:449` |
| Único filtro de lectura y nunca filtra | `state.tsx:958` |
| `saveRecord`/`deleteRecord` **sin chequeo alguno** | `state.tsx:1027`, `state.tsx:1204` |
| Único chequeo real en toda la capa de datos | `state.tsx:1813` (responder tickets) |

**Consecuencias medibles**

- `ClientProfile360.tsx:146-147` filtra pestañas con `can()`, que siempre es `true`: todo rol ve Nodos y **Bóveda**. La rama "Pestaña Restringida" (`:207-215`) es inalcanzable.
- `state.tsx:958` nunca omite: `vault`, `clientVaultItems` y `users` se descargan en cualquier navegador.
- 12 acciones granulares definidas y **nunca evaluadas**: `canApprovePayments`, `canViewBankBalances`, `canViewSupplierBank`, `canChangePrices`, `canAdjustStock`, `canDeleteItems`, `canCancelPayments`, `canEditRouterCredentials`, entre otras.
- `/tramites` no está en `routePermissions` (`permissions.ts:380-395`) y las rutas desconocidas se permiten (`:406`) ⇒ cualquier rol lee y borra expedientes regulatorios.

**Corrección requerida**

- Fuente única de verdad: `modulePermissions` / `canAccessModule`.
- `canUser` y `canAccessRoute` **fail-closed** para módulos/acciones/rutas no declarados.
- Autorizar en el punto de mutación (servidor), no en el botón.
- Añadir `"/tramites": "arcotel"` al mapa de rutas.
- Eliminar el arreglo `permissions` legado.

---

### P0-09 · El libro de compras y finanzas vive en cada navegador

`state.tsx:923-953` define `collectionsToSync` y **omite**: `suppliers`, `purchaseInvoices`, `supplierCreditNotes`, `supplierDebitNotes`, `purchaseWithholdings`, `bankAccounts`, `financialMovements`, `supplierPayments`, `sriCompanyConfig`, `hostingDomains`, `regulatoryTramites`.

Se **escriben** a Firestore, se **leen solo de localStorage** (`state.tsx:589-596`) y **nunca se releen de la nube**.

**Consecuencias**

- Dos usuarios ven cuentas por pagar y saldos bancarios distintos.
- Borrar la caché del navegador **hace desaparecer el historial financiero de la UI** (los documentos quedan huérfanos).
- El efecto que persiste a localStorage **ni siquiera incluye esos arreglos en sus dependencias** (`state.tsx:742-776`, 8 warnings de lint) ⇒ la caché también queda obsoleta.

**Corrección requerida**

- Añadir todas las colecciones a `collectionsToSync`.
- Fallar cerrado si una colección no se pudo leer (no renderizar `INITIAL_*`).
- Eliminar la siembra automática de datos demo.

---

### P0-10 · Datos fabricados indistinguibles de datos reales

La aplicación arranca con **2.539 líneas de datos falsos** (`mock-data.ts`, 85 kB) que se **siembran en Firestore** cuando una colección está vacía (`state.tsx:997-1007`), con nombres reales de empresas y RUC inventados.

| Lugar | Dato fabricado |
|---|---|
| `FinancialChart.tsx:24-28` | Histórico May–Ago **hardcodeado** (`180/1200`, `195/1850`…); solo Sep es real |
| `MetricsCards.tsx:34,54` | Badges **"+100 %"** y **"+12 %"** fijos |
| `gemini-ai.ts:37-45` | Sin API key devuelve *"MRR $28.450,00"*, *"82,5 % (1650/2000 Mbps)"* como si fueran reales |
| `ArcotelManager.tsx:251-269` | Export SIETEL con `"Pichincha"`, `"Quito"`, 100/100 Mbps fijos |
| `PurchaseWithholdingsTab.tsx:413-426` | RIDE con RUC de respaldo `"1792458921001"` si falta config |
| `ClientModal.tsx:366,395` | Inventa `email: "facturacion@cliente.ec"` |
| `ClientDossierTab.tsx:72` | Inventa un "Código SAI" a partir del id de Firestore |

**Corrección requerida**

- Mover la semilla a un botón explícito "cargar datos de demostración", nunca automático.
- Sustituir cifras hardcodeadas por `—` o por cálculo real.
- Etiquetar cualquier dato estimado como estimado.
- Eliminar el simulador de IA.

---

## 5. Hallazgos ALTOS (P1)

### P1-01 · Sin transacciones ni idempotencia
`state.tsx:3232-3275` — facturar descuenta stock, mueve caja y crea kardex en operaciones separadas. Registrar dos veces la misma compra duplica stock, cuenta por pagar y movimiento bancario. **Corrección:** una `runTransaction` por documento; escribir primero en estado `pending`, aplicar efectos, luego `posted`.

### P1-02 · Sobreventa silenciosa
`state.tsx:2501` y `inventory-service.ts:142` recortan con `Math.max(0, stock - qty)` mientras el kardex registra la cantidad completa: filas que no cuadran y COGS subvaluado. **Corrección:** validar disponibilidad y **lanzar error**, no recortar; balances derivados, nunca recortados.

### P1-03 · Cobros parciales se registran como pagados
`state.tsx:1980-2015` pasa el cargo a `pagado` con `balanceRemaining: 0` y crea un clon por el saldo. `AccountsReceivableTab.tsx:88-94` suma `c.total` ⇒ "Total Facturación Emitida" sobrestimado y cartera duplicada. **Corrección:** un único registro con `paidAmount`/`balanceRemaining` y estado `parcial`.

### P1-04 · Saldos bancarios con condición de carrera y cuenta equivocada por defecto
`state.tsx:2586-2613` — `bankAccounts.find(...) || bankAccounts[0]`: si falta el id, el dinero cae en la primera cuenta. Sin transacción, último en escribir gana. **Corrección:** derivar de un libro de movimientos append-only o `increment()` transaccional; eliminar todos los fallbacks `[0]`.

### P1-05 · Notas de crédito de proveedor resucitan la deuda
`state.tsx:3443-3445` recalcula `balanceRemaining = total - paidAmount`, descartando el crédito aplicado. **Corrección:** `balanceRemaining = total − paid − créditos + débitos`, en un solo lugar.

### P1-06 · Errores de escritura silenciados con toast de éxito
`state.tsx:451-459` — solo 5 colecciones propagan el error (`clientContracts`, `clientVaultItems`, `vault`, `nodes`, `tickets`); el resto muestra "guardado" y pierde el dato al recargar. **Corrección:** propagar, revertir el estado optimista e informar.

### P1-07 · Fechas con corrimiento UTC-5
`new Date().toISOString().slice(0,10)` produce la fecha de **mañana** después de las 19:00 en Ecuador, en facturas, gastos, pólizas y contratos (`state.tsx:2437`, `PolicyModal.tsx:23,57-59`, `ProjectTaskModal.tsx:116-117`, `ClientContractTab.tsx:53-57`, `ContractsManager.tsx:72-73`). Además `setMonth(+1)` desborda el 31 de enero. **Corrección:** utilidad única de fecha-solo (`YYYY-MM-DD`), nunca `toISOString()` para fechas de calendario. **Existe un patrón correcto en `ClientTasksTab.tsx:220-226`**; adoptarlo.

### P1-08 · Auditoría no confiable
El log lo genera el cliente con `userId` arbitrario (`state.tsx:778-795`); `state.tsx:1185` registra `UPDATE_CLIENT`/`CREATE_CLIENT` para **toda** entidad; ids por `Date.now()` que colisionan; escrituras best-effort y silenciadas; borrados duros sin registro. **Corrección:** auditoría en la misma transacción del servidor, acciones tipadas por entidad, `crypto.randomUUID()`, borrado lógico en registros regulatorios.

### P1-09 · Carga de archivos regulatorios simulada
`ClientContractTab.tsx:312-346` descarta el `File` (solo lee `name`/`size`), guarda `fileUrl: "#"` y anuncia *"se cargó al expediente digital"*. `ArcotelManager.tsx:164-204` igual. Todas las descargas son un toast ("Descarga Simulada": `ArcotelManager.tsx:829,916,998,1078,1166`). **Corrección:** persistir en Storage/Blob con validación de MIME y tamaño, autorización en servidor y descarga real.

### P1-10 · El widget Gemini exfiltra datos y no tiene guardrails
`GeminiAssistantWidget.tsx:48-59` envía a Google nombre, RUC y saldo de **todos** los clientes, pólizas, tickets y **nombres de servicios de la bóveda**. El rol solo se interpola en el prompt (`gemini-ai.ts:12`). Si se configura `NEXT_PUBLIC_GEMINI_API_KEY`, la clave viaja al bundle (`gemini-ai.ts:8`). Sin delimitadores ⇒ inyección de prompt trivial. **Corrección:** eliminar el widget o enrutarlo por servidor con redacción por rol, aviso de compartición y jerarquía de instrucciones.

### P1-11 · Anulación de factura descuadra la caja
`state.tsx:2746-2801` restaura stock pero no revierte el movimiento financiero, ni el banco, ni el saldo del cliente. **Corrección:** asiento de reverso en una transacción, ligado a la factura.

### P1-12 · Sin CI y sin pruebas
`.github/` está **vacío**. Los 3 scripts (`test-sri.mjs`, `test-purchases.ts`, `check-client-modules.cjs`) no tienen runner. `test-sri.mjs` **duplica** el algoritmo en lugar de importarlo: se prueba a sí mismo. **Corrección:** workflow con typecheck + lint + build + pruebas; pruebas unitarias sobre `sri-service`, `validation-engine`, `inventory-service`, `permissions`.

### P1-13 · El build ignora tipos y lint
`next.config.mjs:7-12` — introducido el 14-sep en el commit `6c9e7f6 "fix(deploy)… add build error fail-safes"`: se desactivó la red de seguridad para poder desplegar en lugar de corregir. **Corrección:** reactivar ambas banderas; el código ya pasa `tsc --strict` con 0 errores, así que el riesgo es bajo; corregir los 40 errores de lint.

### P1-14 · Cualquier usuario puede reiniciar la base de datos
`Header.tsx:208-224` — el botón "Reiniciar Base de Datos" se renderiza **sin comprobación de permiso ni de rol** en el encabezado de toda la aplicación:

```typescript
() => {
  resetDataToDefaults();          // ← no se espera la promesa
  showSuccess("Sistema Restaurado", "…restaurados correctamente.");
}
```

`resetDataToDefaults` (`state.tsx:3544-3582`) vacía las claves de localStorage y reinyecta la semilla demo. Un operador de soporte puede destruir el estado operativo con dos clics, y el toast de éxito aparece antes de que la operación termine. **Corrección:** eliminar el botón de la UI o restringirlo a `superadmin` con reautenticación.

### P1-15 · El checksum de RUC/Cédula se salta a sí mismo
`validation-engine.ts:150`:

```typescript
if (isValidated && /^\d+$/.test(clean) &&
    (clean.length === 10 || (clean.length === 13 && !clean.endsWith("000")))) {
  return { isValid: true };        // ← omite módulo 10/11 por completo
}
```

Y `ClientModal.tsx:377,406` **fuerza `sriValidated: true` en cada guardado**, sin importar si se consultó el catastro. Cualquier cadena de 10 o 13 dígitos pasa como identificación válida y la UI muestra el badge "Validado en Catastro SRI" (`ClientProfile360.tsx:226-230`). **Corrección:** propagar el flag real; nunca omitir el checksum. (La excepción de `validation-engine.ts:140-142` para `"9999999999999"` **sí es correcta**: es el RUC oficial de consumidor final.)

### P1-16 · Las "notas internas privadas" de tickets no son privadas
`TicketDetail.tsx:393` afirma: *"Esta nota técnica es PRIVADA: visible únicamente para administradores y técnicos NOC."* Pero el renderizado (`:519-558`) solo **colorea** la nota; no hay comprobación de rol. El filtro (`:220-221`) es una preferencia de vista. `TicketsBoard.tsx:373-381` muestra el contador de notas internas a todos. **Corrección:** eliminar `isInternal` del payload para roles no autorizados en el servidor.

---

## 6. Hallazgos MEDIOS (P2)

### 6.1 Integridad de inventario y costos

| ID | Hallazgo | Evidencia |
|---|---|---|
| P2-01 | Kardex que no cuadra desde la semilla: ONT `stock: 45` vs kardex 43; Router 24 vs 20 | `mock-data.ts:1413` vs `:1629` |
| P2-02 | Referencias colgantes: compras apuntan a `warehouseId: "bod-central"` inexistente, enmascarado por fallback `[0]` | `mock-data.ts:2287`, `NewPurchaseView.tsx:57` |
| P2-03 | Valorización por almacén usa el costo promedio global | `InventoryManager.tsx:1686-1695` |
| P2-04 | Costo de devolución de proveedor inventado: `total / quantity` con IVA incluido | `SupplierCreditNotesTab.tsx:104` |
| P2-05 | Búsqueda difusa de SKU en compras (`name.includes`) asigna stock al producto equivocado y sobrescribe el SKU | `NewPurchaseView.tsx:133-155` |
| P2-06 | Líneas de compra sin producto coincidente se descartan en silencio, pero la factura se marca "ingresado" si **alguna** línea coincidió | `state.tsx:3182-3229`, `NewPurchaseView.tsx:287` |
| P2-07 | Descuentos de compra se parsean pero no se aplican al costo del kardex | `purchases-service.ts:154-179` |
| P2-08 | Retenciones no reducen la cuenta por pagar y se pueden emitir varias veces por factura | `state.tsx:3403-3415` |
| P2-09 | Cobros de clientes y gastos **no** tocan banco ni movimiento financiero; la etiqueta "Ingresado a bancos y caja" es falsa | `state.tsx:1970-2032`, `AccountsReceivableTab.tsx:120-123` |
| P2-10 | Sin libro de partida doble: caja, gastos y COGS son tres flujos inconexos; se presentan como "Balance Ejecutivo" | `FinancialReportsTab.tsx:22-30` |
| P2-11 | Claves de negocio duplicables: RUC de proveedor, SKU, código de bodega, nombre de categoría, y varias bodegas `isDefault` | `state.tsx:3122`, `:2038`, `WarehouseModal.tsx:59-92` |
| P2-12 | Sin cierre de periodo: cualquier fecha es retroactiva y editable | múltiples |
| P2-13 | IVA hardcodeado al 15 % ignorando tarifas 5 %/0 % | `state.tsx:1929`, `FinanceDashboard.tsx:328` |
| P2-14 | `serialNumberRequired` es decorativo: sin trazabilidad por serie (crítico para ONTs/routers) | `types/inventory.ts:62` |
| P2-15 | Ajustes permiten fijar costo unitario arbitrario sin aprobación y sin contrapartida contable; `SHRINKAGE`/`MASSIVE_ZERO` declarados y nunca producidos | `AdjustmentModal.tsx:41,113` |

### 6.2 Red e infraestructura

| ID | Hallazgo | Evidencia |
|---|---|---|
| P2-16 | Validación IPv4 solo en `mikrotikIp`; subredes de proveedor e `ipv6Prefix` son texto libre | `ClientNodesManager.tsx:245,1091-1112` |
| P2-17 | **Cero soporte IPv6** pese a anunciarlo ("IPv4 / IPv6") | `IpPoolsManager.tsx:14` |
| P2-18 | **Cero detección de IP/subred duplicada o solapada** en todo el proyecto | — |
| P2-19 | Validador de CIDR débil: acepta ceros a la izquierda, descarta segmentos extra, sin checks de host/broadcast | `validation-engine.ts:164-198` |
| P2-20 | Conteos de pool escritos a mano y presentados como calculados; `assigned > usable` no se señala; el "Gestor" es de solo lectura | `IpPoolsManager.tsx:35` |
| P2-21 | División por cero en porcentajes de capacidad ⇒ `NaN%` y `width: NaN%` | `ClientNodesManager.tsx:495`, `NodesList.tsx:106` |
| P2-22 | Coordenadas sin validación de rango; al elegir provincia se guarda el centroide como GPS exacto; `0` se interpreta como "sin coordenada" | `NodeLocationMapPicker.tsx:313-322`, `:87-88` |
| P2-23 | Mapa no se actualiza al mover un nodo (dependencia solo en `length`) | `ClientNodesOverviewMap.tsx:104-185` |

### 6.3 UI, permisos y robustez

| ID | Hallazgo | Evidencia |
|---|---|---|
| P2-24 | Semáforo de pólizas ARCOTEL congelado: pinta valores persistidos que nunca se recalculan; una póliza que vence mañana sigue en verde | `PoliciesList.tsx:69-70`, `PolicyModal.tsx:71` |
| P2-25 | El expediente imprimible filtra IPv4, **usuario PPPoE** y nombres de servicios de la bóveda, sin permiso ni redacción | `ClientDossierTab.tsx:139-140,195-200` |
| P2-26 | Credenciales en claro en `React state`, portapapeles que nunca se limpia (toast dice "de manera segura") | `SecureVault.tsx:57-63` |
| P2-27 | Cuentas bancarias de proveedor mostradas completas sin `canViewSupplierBank` | `SuppliersManager.tsx:328-336` |
| P2-28 | `showConfirm` no espera la promesa ⇒ el modal cierra antes y **doble clic ejecuta dos veces** | `toast-context.tsx:65-75`, `AlertModal.tsx:25-28` |
| P2-29 | Errores presentados como éxito; "avanzar" un proyecto pausado lo resetea a "inicio" | `TicketsBoard.tsx:108-110`, `ProjectsManager.tsx:441-447` |
| P2-30 | Acceso a campos sin guarda ⇒ pantalla en blanco en lugar de degradación | `ClientsTable.tsx:100-102`, `PoliciesList.tsx:84,86,103` |
| P2-31 | Actualizaciones perdidas por lectura-modificación-escritura en `notesThread` (los tickets sí lo hacen bien con `arrayUnion`) | `state.tsx:1366-1380` |
| P2-32 | Formularios se reinician por refrescos del store ajeno ⇒ pérdida de edición en curso | `ClientModal.tsx:79-155`, `ProjectTaskModal.tsx:231-244` |
| P2-33 | Refs sin limpiar y `setInterval` recreado en cada tick | `ClientNodeModal.tsx:98-117` |
| P2-34 | Sin accesibilidad de modal: ni `role="dialog"`, ni `aria-modal`, ni focus trap, ni `Escape` | todos los modales |
| P2-35 | Export CSV sin escape RFC-4180 y sin BOM ⇒ Excel corrompe acentos y una coma rompe el archivo | `ArcotelManager.tsx:254,257` |
| P2-36 | CORS/OSM: Nominatim llamado desde el navegador sin debounce, caché ni `email` (viola la política de uso) | `NodeLocationMapPicker.tsx:132-135` |

---

## 7. Hallazgos BAJOS (P3)

| ID | Hallazgo |
|---|---|
| P3-01 | IDs generados con `Date.now()` colisionan en el mismo milisegundo (`state.tsx:2039,2217,2323`); usar `crypto.randomUUID()` |
| P3-02 | `key={idx}` en listas mutables (`TramitesManager.tsx:429`, `ClientNodeModal.tsx:697,799`) |
| P3-03 | Formatos inconsistentes: `en-US` vs `es-EC` en importes |
| P3-04 | `URL.revokeObjectURL` síncrono tras `click()` puede cancelar la descarga |
| P3-05 | Errores ortográficos/tipográficos en copy de UI |
| P3-06 | Barra de notificaciones abre la búsqueda global en lugar de notificaciones |
| P3-07 | Semilla sin integridad referencial (kardex ≠ stock, `bod-central`) |
| P3-08 | Código muerto: `RegisterPurchaseModal.tsx` (780 líneas duplicadas, sin uso), `billing/NewSaleModal.tsx`, `updatePurchaseInvoice`, `maskPassword`, `tabPermissions`, `canPerformAction` |
| P3-09 | 5 dependencias sin uso: `clsx`, `tailwind-merge`, `date-fns`, `jspdf`, `jspdf-autotable` |
| P3-10 | Lockfiles inconsistentes: `package-lock.json` versionado, `.pnpm-store` presente, `pnpm-lock.yaml` ausente |
| P3-11 | CSP con `'unsafe-eval'` y `'unsafe-inline'` (`next.config.mjs:54`) |
| P3-12 | Middleware detecta SQLi en URLs de una app sin SQL; falsos positivos con apóstrofes o la palabra "select" |
| P3-13 | `/red` y `/arcotel` son stubs que redirigen a `/clientes` |
| P3-14 | 180 usos de `any`; peor: `InventoryManager.tsx` (12) |
| P3-15 | 21 llamadas a `console.*` en producción |

---

## 8. Lo que está genuinamente bien hecho

Preservar esto durante la refactorización:

1. **Modelo de dominio ecuatoriano** (`types/billing.ts`, `types/purchases.ts`): clave de acceso de 49 dígitos, retenciones separadas renta/IVA, notas de crédito/débito, `taxMode EXCLUIDO/INCLUIDO`, taxonomía bilingüe de kardex. Muy por encima del prototipo típico.
2. **`validarIdentificacionEcuador` y `validarClaveAccesoSRI`**: checksums reales (provincia, tercer dígito, módulo 10/11), no regex. **Corregir P1-15 sin tocarlos.**
3. **`calculateWeightedAverageCost`**: fórmula correcta, redondeo a 4 decimales.
4. **El backend en `src/lib/server/`**: diseño acertado y casi listo — AAD ligado al documento, bloqueo optimista por versión, saneado de campos sensibles, recálculo de estado de pólizas en servidor. **Solo hay que conectarlo.**
5. **Control de negocio real**: no se puede borrar un cliente con saldo pendiente, con modal explicativo (`ClientsTable.tsx:572-646`).
6. **Escritura de tickets**: valida sesión + permiso + longitud + existencia y usa `arrayUnion` (`state.tsx:1807-1874`). El mejor camino de escritura del cliente.
7. **`validateStockAvailability`** existe y se usa bien en transferencias (`state.tsx:2213`); solo falta aplicarlo a las ventas.
8. **Carga diferida correcta** de `docx`, `exceljs` y `leaflet`.
9. **Ciclo de vida del mapa** con guarda `isMounted` y limpieza de marcadores.
10. **Sin secretos de servidor filtrados en Git**: `.env.local` correctamente ignorado.
11. **`tailwind.config.js` ya define un sistema de tokens** (`lumina.*`, 4 sombras). El problema no es la ausencia de sistema, sino que **no se usa** (ver sección 10).

---

## 9. Deriva entre documentación y realidad

| Afirmación | Realidad |
|---|---|
| README: *"Cifrado AES-256 en Bóveda"* | Base64 invertido sin clave |
| README: *"Control de acceso basado en roles (RBAC)"* | `permissions: ["all"]` para todos; fail-open |
| README: *"Gemini Flash 2.5 Lite integrado"* | Sin API key: respuestas simuladas |
| README: *"M2 ARCOTEL"*, *"M3 Red"* | Rutas que redirigen a `/clientes` |
| README: `X-Frame-Options: SAMEORIGIN` | El código pone `DENY` |
| `docs/FIREBASE.md:31-33`: *"reglas pendientes de validación… no se han publicado"* + *"No crear reglas abiertas"* | `firestore.rules` tiene `allow read, write: if true` |
| `docs/PLAN_MAESTRO_MEJORAS.md` (14-sep) | **Ya identificaba** contraseñas en claro, Base64 "invertido", sesión local y permisos no protegidos. Se documentó y **no se corrigió**; en su lugar se desactivaron tipos y lint |

**Este es el hallazgo de proceso más importante:** el diagnóstico existía, era correcto y estaba escrito. La respuesta fue reducir las barreras de calidad para seguir desplegando.

---

## Bloque B — Plan de corrección

## 10. Estándar de diseño y limpieza visual

### 10.1 Diagnóstico medido

La inconsistencia visual no es una impresión: es medible.

| Métrica | Valor actual | Objetivo |
|---|---|---|
| Encabezados `<h1>`–`<h4>` en el código | **198** | ≤ 60 |
| Recetas tipográficas distintas para títulos | **55** | **6** |
| Distribución de niveles | h1: 18 · h2: 36 · h3: 104 · h4: 39 | h1: 16 · h2: ~30 · h3: ~40 · h4: 0 |
| Pantallas con `<h1>` de página | **1 de 16** | **16 de 16** |
| `<h1>` usados dentro de paneles/modales | 17 | **0** |
| Elementos `<table>` | **78** en 49 archivos | 1 componente `DataTable` |
| Recetas de clase distintas en `<table>` | **22** | **3** (densidades) |
| Colores en hexadecimal literal | **4.030** (`text-[#` 2.075 · `border-[#` 1.034 · `bg-[#` 921) | **0** |
| Etiquetas micro en MAYÚSCULAS | **233** | ≤ 40 (solo labels de campo) |
| Párrafos descriptivos > 110 caracteres | 18 | ≤ 3 |
| Usos de `transition-all` / animaciones | 370 | Solo transiciones de estado |
| Escala de radios | `lg`, `xl`, `2xl`, `3xl` = **6 px** (colapsada) | 3 tokens reales |

**Títulos más largos detectados** (todos violan el estándar propuesto):

| Texto actual | Longitud | Archivo |
|---|---|---|
| `Detalle de Productos / Servicios (Los productos asignados ingresarán al Kardex de la bodega)` | 93 | `RegisterPurchaseModal.tsx:568` |
| `Datos del Título Habilitante & Sistemas Concesionarios (INNTEL CORP S.A.)` | 74 | `ArcotelManager.tsx:544` |
| `Gestión de Subredes & Pools de Direccionamiento IP (IPv4 / IPv6)` | 65 | `IpPoolsManager.tsx:12` |
| `Sistema BDH (Bono de Desarrollo Humano - Subsidio Tarifa Social)` | 64 | `ArcotelManager.tsx:1026` |
| `Transformador de Formatos & Validador para ARCOTEL / SIETEL` | 59 | `ArcotelManager.tsx:1196` |
| `Registro y Catastro de Infraestructura Física (ARCOTEL)` | 56 | `ArcotelManager.tsx:1106` |
| `Matriz Granular de Activación por Módulo y Submódulo` | 55 | `UserPermissionsModal.tsx:179` |
| `Detalle de Órdenes de Pedido & Pre-Facturas Emitidas` | 53 | `FinanceDashboard.tsx:468` |

**Patrones de ruido identificados**

1. **Ampersand decorativo** (`&`) sustituyendo "y" en títulos.
2. **Paréntesis explicativos** dentro del título (el título no debe explicarse a sí mismo).
3. **Prefijos redundantes**: "Gestión de", "Sistema de", "Registro y Catastro de", "Detalle de", "Módulo de".
4. **Mayúsculas micro** en 233 lugares, compitiendo visualmente con los títulos.
5. **Descripciones repetidas**: el propio título se explica en un subtítulo y otra vez en un párrafo.
6. **Dos familias de gris** intercambiadas: `text-[#0b1c30]`, `text-slate-900`, `text-slate-800`, `text-slate-700`, `text-[#434655]` para el mismo rol visual.
7. **Dos pesos de énfasis** intercambiados: `font-bold` vs `font-black`.
8. **Cada módulo inventa su encabezado** porque no existe un `PageHeader`.

### 10.2 Principios rectores

1. **Una pantalla tiene un título.** Uno solo, de 1 a 3 palabras.
2. **El título no se explica.** Si hace falta explicación, es un problema de diseño, no de copy.
3. **La jerarquía visual se expresa con 6 estilos, no con 55.** Cualquier necesidad nueva se resuelve con los 6, no creando el séptimo.
4. **Los colores vienen de tokens, nunca de literales.** El diseñador cambia el token; el código no cambia.
5. **Una tabla es un componente.** La variación se expresa por props, no copiando clases.
6. **El espacio comunica jerarquía mejor que el color.** Reducir etiquetas y bordes antes de añadir color.
7. **La interfaz no grita.** Sin mayúsculas sostenidas en frases, sin signos decorativos, sin exclamaciones.

### 10.3 Jerarquía tipográfica — 6 tokens, uso obligatorio

| Token | Etiqueta | Tamaño / línea | Peso | Color | Uso permitido |
|---|---|---|---|---|---|
| `display` | `<h1>` en Dashboard | 20 px / 1.25 | 700 | `lumina.on-surface` | Solo el saludo del Dashboard. **1 por pantalla, máximo** |
| `page-title` | `<h1>` de pantalla | 18 px / 1.3 | 700 | `lumina.on-surface` | Exactamente **1 por pantalla**, dentro de `PageHeader` |
| `section-title` | `<h2>` | 14 px / 1.4 | 600 | `lumina.on-surface` | Secciones dentro de una pantalla |
| `card-title` | `<h3>` | 13 px / 1.4 | 600 | `lumina.on-surface` | Título de tarjeta o panel |
| `label` | `<span>` | 11 px / 1.4 | 600 | `lumina.outline` | Etiqueta de campo o de dato. **Uppercase solo aquí** |
| `body` / `caption` | `<p>` | 13 / 11.5 px | 400 | `on-surface` / `outline` | Contenido y metadatos |

**Prohibiciones tipográficas**

- `font-black`, `font-extrabold` en cualquier título.
- `text-2xl`, `text-3xl`, `text-4xl` dentro de componentes (solo `display`).
- `<h1>` dentro de modales, tarjetas o pestañas.
- Más de un `page-title` por pantalla.
- `uppercase` en frases; solo en `label`.
- Mezclar `text-slate-*` con `text-[#…]` en el mismo nivel jerárquico.

**Límites de longitud de copy**

| Elemento | Máximo | Regla |
|---|---|---|
| Título de pantalla | **24 caracteres / 3 palabras** | Sin "Gestión de", sin `&`, sin paréntesis |
| Título de sección | 32 caracteres | Sin `&`, sin paréntesis |
| Título de tarjeta | 28 caracteres | Sustantivo + complemento directo |
| Descripción | **1 por pantalla**, ≤ 110 caracteres | Opcional; si el título basta, se omite |
| Etiqueta | 20 caracteres | Sin dos puntos al final |
| Tooltip de ayuda | ≤ 140 caracteres | Reemplaza al párrafo explicativo |

### 10.4 Encabezado de pantalla — componente único `PageHeader`

Contrato obligatorio para las 16 pantallas:

```
PageHeader
├── title: string            (obligatorio, ≤ 24 caracteres)
├── description?: string     (opcional, ≤ 110 caracteres, se omite por defecto)
├── actions?: ReactNode      (máximo 3; 1 primaria + 2 secundarias)
└── breadcrumb?: boolean     (solo si la pantalla es de 3.er nivel)
```

**Especificación visual**

- Altura fija `h-16` (64 px, ya definido como `spacing.header`).
- Borde inferior `border-b border-lumina-border`, sin sombra.
- Título alineado a la izquierda; acciones a la derecha, mismo eje.
- Sin icono decorativo junto al título.
- Sin fondo de color ni degradado.

**Reemplazos obligatorios** (título actual → título estándar):

| Actual | Nuevo |
|---|---|
| `Gestión de Subredes & Pools de Direccionamiento IP (IPv4 / IPv6)` | **Red** |
| `Registro y Catastro de Infraestructura Física (ARCOTEL)` | **Infraestructura** |
| `Detalle de Órdenes de Pedido & Pre-Facturas Emitidas` | **Órdenes** |
| `Sistema BDH (Bono de Desarrollo Humano - Subsidio Tarifa Social)` | **BDH** |
| `Transformador de Formatos & Validador para ARCOTEL / SIETEL` | **Validador SIETEL** |
| `Datos del Título Habilitante & Sistemas Concesionarios (INNTEL CORP S.A.)` | **Título habilitante** |
| `Detalle de Productos / Servicios (Los productos asignados ingresarán al Kardex de la bodega)` | **Productos** (la explicación va a tooltip) |
| `Matriz Granular de Activación por Módulo y Submódulo` | **Permisos** |
| `Dossier Consolidado & Ficha Técnica Integral 360°` | **Ficha 360°** |
| `Control Regulatorio de Pólizas & Títulos ARCOTEL` | **Pólizas** |
| `Infraestructura Multi-Nodo & MikroTik RouterOS` | **Nodos** |
| `Repositorio Institucional de Documentos & Plantillas` | **Plantillas** |

**Regla de nomenclatura de menú:** el título de pantalla debe ser **idéntico** a la etiqueta del sidebar. Si difieren, uno de los dos está mal.

### 10.5 Componente único `DataTable`

Sustituye las 78 tablas y las 22 recetas actuales.

```
DataTable
├── columns: Column[]        (label, accessor, align, width, sortable)
├── rows: T[]
├── density?: "compact" | "default" | "comfortable"
├── loading?: boolean
├── empty?: { title, hint? }
├── onRowClick?: (row: T) => void
└── stickyHeader?: boolean
```

**Especificación visual única**

| Aspecto | Valor |
|---|---|
| Contenedor | `rounded-card border border-lumina-border bg-white` |
| Alto de fila | compact 36 px · default 44 px · comfortable 52 px |
| Encabezado | `label` (11 px, uppercase, `lumina.outline`), fondo `lumina.surface-container-low` |
| Celda | `body` 13 px; **números alineados a la derecha con `tabular-nums`** |
| Separador | `border-b border-lumina-border` solamente; sin bordes verticales |
| Hover de fila | `bg-lumina.surface-container-low` |
| Estado vacío | Icono + título + una línea de ayuda, centrado, altura 160 px |
| Scroll horizontal | Solo en el contenedor, con `overflow-x-auto`; nunca `min-w-[1050px]` distintos por tabla |
| Ordenación | Un solo indicador, en el encabezado |

**Prohibido:** tablas anidadas, tablas dentro de modales sin `density="compact"`, tablas con estilos de tarjeta propios, `border-collapse` ad-hoc con bordes punteados.

### 10.6 Tokens de diseño — uso obligatorio

`tailwind.config.js` ya define el sistema. **Hay que usarlo.**

**Colores** (mapeo obligatorio de literales a tokens):

| Literal actual | Token a usar |
|---|---|
| `text-[#0b1c30]` · `text-slate-900` · `text-slate-800` | `text-lumina-on-surface` |
| `text-[#434655]` · `text-slate-700` | `text-lumina-on-surface-variant` |
| `text-[#737686]` | `text-lumina-outline` |
| `bg-[#f8f9ff]` | `bg-lumina-surface` |
| `bg-[#eff4ff]` | `bg-lumina-surface-container-low` |
| `bg-white` | `bg-lumina-surface-container-lowest` |
| `border-[#e2e8f0]` | `border-lumina-border` |
| `text-[#004ac6]` · `bg-[#004ac6]` | `lumina-primary` |
| `text-[#712ae2]` | `lumina-secondary` |
| `text-[#10B981]` | `lumina-success` |
| `text-[#F59E0B]` | `lumina-warning` |
| `text-[#EF4444]` | `lumina-error` |

**Radios:** la escala actual colapsa `lg`, `xl`, `2xl` y `3xl` a 6 px, lo que hace que `rounded-xl` y `rounded-2xl` sean idénticos (trampa de mantenimiento). Reemplazar por 3 tokens explícitos:

```javascript
borderRadius: {
  control: "6px",   // inputs, botones, chips
  card:    "8px",   // tarjetas y paneles
  modal:   "12px",  // modales y overlays
  full:    "9999px",
}
```

**Sombras:** usar solo `lumina-subtle`, `lumina-card`, `lumina-dropdown` y `lumina-focus`. Prohibida cualquier sombra arbitraria.

**Espaciado:** escala 4/8/12/16/24/32; `sidebar: 260px` y `header: 64px` ya definidos. Prohibido `p-[13px]`, `mt-[7px]` y similares.

**Estados:** un solo patrón por estado → `hover:bg-lumina-surface-container-low`, `focus-visible:ring-2 ring-lumina-primary`, `disabled:opacity-50 cursor-not-allowed`. Prohibido `transition-all` genérico (usar `transition-colors` o `transition-transform`).

### 10.7 Catálogo de componentes obligatorios

Todo lo que hoy está duplicado debe existir una sola vez en `src/components/ui/`:

| Componente | Reemplaza a | Cantidad de duplicados hoy |
|---|---|---|
| `PageHeader` | encabezados ad-hoc de las 16 pantallas | 16 implementaciones |
| `DataTable` | 78 `<table>` | 22 recetas |
| `Card` | contenedores `rounded-* shadow-lumina-card` | 53 usos dispersos |
| `Modal` | 20+ modales con `<div fixed inset-0>` | 20 implementaciones |
| `Button` (`primary`/`secondary`/`ghost`/`danger`) | cadenas de clase repetidas | cientos |
| `Input`, `Select`, `Textarea`, `DateInput` | inputs ad-hoc | cientos |
| `Badge` (`neutral`/`success`/`warning`/`error`/`info`) | badges con `bg-[#ecfdf5] text-[#065f46]` | 40+ |
| `EmptyState` | bloques vacíos ad-hoc | 15+ |
| `ConfirmDialog` | `showConfirm` actual (sin await) | 1, mal tipado |
| `Field` (label + control + error) | `<label>` sueltos sin asociación | cientos |
| `Stat` | tarjetas de métrica con badges inventados | 4 |
| `Tabs` | pestañas con estilos distintos por módulo | 9 |
| `SectionHeader` | `<h2>` con descripciones | 36 |

### 10.8 Prohibiciones verificables (lint de diseño)

Reglas a implementar como script de CI, no como convención oral:

| Regla | Detección | Nivel |
|---|---|---|
| `no-hex-colors` | `class(Name)?="[^"]*\[#[0-9a-fA-F]{3,8}\]` | error |
| `no-h1-in-panel` | `<h1` fuera de `PageHeader.tsx` | error |
| `single-h1-per-page` | más de un `<h1` por archivo `page.tsx` | error |
| `no-font-black` | `font-black` en cualquier `.tsx` | error |
| `no-uppercase-phrase` | `uppercase` fuera de `label`/`Badge` | warning |
| `no-arbitrary-spacing` | `[mpg][tblrxy]?-\[[0-9]+px\]` | warning |
| `no-transition-all` | `transition-all` | warning |
| `title-max-length` | texto de `<h1>`–`<h3>` > 32 caracteres | warning |
| `no-ampersand-in-title` | `&` dentro de `<h1>`–`<h3>` | warning |
| `no-raw-table` | `<table` fuera de `DataTable.tsx` | error |
| `no-inline-description` | `<p>` > 110 caracteres dentro del header | warning |

Estas reglas son la diferencia entre un estándar y una intención.

### 10.9 Migración por olas

| Ola | Contenido | Días | Riesgo |
|---|---|---|---|
| **Ola 0** | Crear tokens definitivos + script de lint de diseño + `Button`/`Badge`/`Card` | 1–2 | Bajo |
| **Ola 1** | `PageHeader` y aplicar en las 16 pantallas; corregir jerarquía h1–h3 | 2–3 | Bajo |
| **Ola 2** | `DataTable` y migrar las 49 pantallas/tablas | 4–6 | Medio (visual) |
| **Ola 3** | Limpieza de copy: 198 títulos → ≤ 60, eliminar paréntesis y `&` | 2 | Bajo |
| **Ola 4** | Reemplazo mecánico de 4.030 literales de color por tokens | 3–4 | Medio (revisar contraste) |
| **Ola 5** | `Modal`, `Field`, `Tabs`, `EmptyState`; accesibilidad (`role`, focus trap, `Esc`) | 3–4 | Medio |

**Regla de oro de la migración:** cada ola entra en un PR independiente, con captura antes/después de las 16 pantallas y **sin mezclar cambios funcionales**. Si una ola rompe un flujo, se revierte sola.

### 10.10 Checklist de aceptación visual

Una pantalla se considera terminada cuando:

- [ ] Tiene **exactamente un** `<h1>` de 1 a 3 palabras.
- [ ] El título coincide con la etiqueta del sidebar.
- [ ] No hay `&`, paréntesis ni prefijo "Gestión de" en el título.
- [ ] No hay descripción bajo el título (o hay una sola, ≤ 110 caracteres).
- [ ] No existe ningún `text-[#…]`, `bg-[#…]` ni `border-[#…]`.
- [ ] Ninguna tabla fuera de `DataTable`.
- [ ] Ningún `font-black` ni `text-2xl+` fuera de `display`.
- [ ] `uppercase` solo en etiquetas de campo.
- [ ] Máximo un nivel de anidación de tarjetas.
- [ ] Modal con `role="dialog"`, `aria-modal`, focus trap y `Escape`.
- [ ] Estado vacío, de carga y de error presentes.
- [ ] Números con `tabular-nums` y formato `es-EC`.
- [ ] Captura antes/después adjunta al PR.

---

## 11. Plan de remediación por fases

### Fase 0 — Contención (3–5 días)

Objetivo: **que un desconocido no pueda leer ni destruir la base.**

| # | Acción | Hallazgo |
|---|---|---|
| 1 | Reglas Firestore deny-by-default; `users`/`vault`/`clientVaultItems` solo Admin SDK | P0-01 |
| 2 | Eliminar auto-provisión de admin y restauración de sesión por localStorage | P0-02 |
| 3 | Eliminar `setUserRole` del contexto | P0-02 |
| 4 | Rotar `SuperAdmin2026*`, `InntelRouter2026*` y toda contraseña sembrada | P0-03, P0-04 |
| 5 | Retirar leyendas "AES" y el `estado: "AUTORIZADO"`; bloquear emisión fiscal | P0-04, P0-05 |
| 6 | Retirar el botón "Reiniciar Base de Datos" del header | P1-14 |
| 7 | Quitar `NEXT_PUBLIC_GEMINI_API_KEY` y desactivar el widget | P1-10 |
| 8 | Retirar `sriValidated: true` forzado | P1-15 |

**Criterio de salida:** un usuario anónimo con el `projectId` no puede leer ni escribir ninguna colección; ningún correo nuevo obtiene rol admin.

### Fase 1 — Columna vertebral (2–3 semanas)

| # | Acción | Hallazgo |
|---|---|---|
| 9 | Cablear la UI a `/api/data`; eliminar `setDoc`/`getDocs` directos | P0-06 |
| 10 | Migrar secretos a `seal()`; eliminar la clave por defecto | P0-04 |
| 11 | RBAC server-side; `canUser`/`canAccessRoute` fail-closed; mapear `/tramites` | P0-08 |
| 12 | Añadir colecciones faltantes a `collectionsToSync`; eliminar siembra automática | P0-09 |
| 13 | Reactivar `ignoreBuildErrors`/`ignoreDuringBuilds`; corregir 40 errores de lint | P1-13 |
| 14 | CI en `.github/workflows` (typecheck + lint + build + test) | P1-12 |
| 15 | Pruebas unitarias de `validation-engine`, `sri-service`, `inventory-service`, `permissions` | P1-12 |

**Criterio de salida:** dos usuarios en navegadores distintos ven los mismos datos **permitidos**; el pipeline está verde; ningún secreto en el bundle.

### Fase 2 — Integridad contable (3–4 semanas)

| # | Acción | Hallazgo |
|---|---|---|
| 16 | Transacciones por documento + estados `pending`/`posted` | P1-01 |
| 17 | Contadores atómicos de secuenciales en servidor | P0-07 |
| 18 | Unicidad de `(supplierRuc, documentNumber)` y `claveAcceso` | P1-01 |
| 19 | Un solo registro de CxP/CxC con `paidAmount`/`balanceRemaining` | P1-03, P1-05 |
| 20 | Saldos bancarios derivados de movimientos append-only | P1-04 |
| 21 | Validar stock y **lanzar error** en lugar de recortar | P1-02 |
| 22 | Reverso completo al anular factura | P1-11 |
| 23 | Utilidad única de fecha-solo (`YYYY-MM-DD`), sin `toISOString()` | P1-07 |
| 24 | Auditoría en la misma transacción, con acciones tipadas | P1-08 |

**Criterio de salida:** el kardex cuadra con el stock; la caja cuadra con los cobros; dos usuarios concurrentes no pierden escrituras.

### Fase 3 — Cumplimiento y evidencia (3–4 semanas)

| # | Acción | Hallazgo |
|---|---|---|
| 25 | Firma XAdES-BES real (`.p12` en KMS/servidor) o proveedor certificado | P0-05 |
| 26 | SOAP real de recepción y autorización; estados reales | P0-05 |
| 27 | Autenticación y límite de tasa en `/api/sri` | P0-05 |
| 28 | Almacenamiento real de adjuntos con MIME/tamaño validados | P1-09 |
| 29 | Descargas funcionales; eliminar "Descarga Simulada" | P1-09 |
| 30 | Reportes etiquetados honestamente hasta que exista libro diario | P2-10 |
| 31 | Semáforo de pólizas recalculado en render | P2-24 |

**Criterio de salida:** un comprobante emitido tiene firma verificable y estado real del SRI; cada expediente regulatorio tiene evidencia recuperable.

### Fase 4 — Estándar de diseño (2–3 semanas)

Según el plan de olas de la sección 10.9.

**Criterio de salida:** las 11 reglas de lint de diseño pasan en CI; las 16 pantallas superan el checklist 10.10.

---

## 12. Backlog ejecutable

### 12.1 Resumen por severidad

| Severidad | Total | Fase 0 | Fase 1 | Fase 2 | Fase 3 | Fase 4 |
|---|---|---|---|---|---|---|
| **P0** | 10 | 5 | 4 | 1 | — | — |
| **P1** | 16 | 4 | 8 | 3 | 1 | — |
| **P2** | 36 | — | 4 | 14 | 6 | 12 |
| **P3** | 15 | — | 2 | 3 | — | 10 |
| **Diseño (D)** | 12 | — | — | — | — | 12 |
| **Total** | **89** | **9** | **18** | **21** | **7** | **34** |

### 12.2 Backlog de diseño (D)

| ID | Acción | Entregable |
|---|---|---|
| D-01 | Definir tokens definitivos (color, radio, sombra, espaciado) en `tailwind.config.js` | Config + documentación |
| D-02 | Crear `src/components/ui/` con `Button`, `Badge`, `Card`, `Field` | 4 componentes |
| D-03 | Crear `PageHeader` y aplicarlo en las 16 pantallas | 1 componente + 16 usos |
| D-04 | Corregir jerarquía: 1 `<h1>` por pantalla, eliminar 17 `<h1>` en paneles | 198 → ≤ 60 headings |
| D-05 | Reducir 55 recetas tipográficas a 6 | Regla de lint + migración |
| D-06 | Crear `DataTable` y migrar 78 tablas | 1 componente + 49 archivos |
| D-07 | Renombrar los 12 títulos largos listados en 10.4 | Copy |
| D-08 | Eliminar `&`, paréntesis y prefijos "Gestión de" de todos los títulos | Copy |
| D-09 | Reemplazar 4.030 literales hex por tokens | Script + revisión de contraste |
| D-10 | Reducir 233 micro-etiquetas mayúsculas a ≤ 40 | Copy + lint |
| D-11 | Crear `Modal` accesible (role, aria-modal, focus trap, Esc) y migrar 20 modales | 1 componente + 20 usos |
| D-12 | Implementar `EmptyState`, `Tabs`, `Stat` únicos; eliminar badges "+100 %"/"+12 %" | 3 componentes |

### 12.3 Orden recomendado de las primeras 10 tareas

1. `P0-01` Reglas Firestore.
2. `P0-02` Eliminar bypass de auth.
3. `P0-03` Rotar credenciales y quitar `passwordHash`.
4. `P0-05` Detener la emisión fiscal falsa.
5. `P1-14` Quitar el botón de reinicio global.
6. `P0-06` Cablear `/api/data`.
7. `P0-08` RBAC fail-closed.
8. `P1-13` Reactivar tipos y lint + `P1-12` CI.
9. `P0-07` Secuenciales en servidor.
10. `D-01`…`D-04` Estándar visual (paralelizable con 6–9).

---

## 13. Criterios de aceptación globales

El sistema se considera listo para operar con datos reales cuando **todo** lo siguiente es verificable:

| # | Criterio | Verificación |
|---|---|---|
| 1 | Un usuario anónimo no puede leer ni escribir ninguna colección | Prueba con `curl` sin token |
| 2 | Ningún correo nuevo obtiene una cuenta sin aprobación | Prueba de login con correo inexistente |
| 3 | Ninguna contraseña existe en claro en código, base o navegador | `grep` + inspección de Firestore + `localStorage` |
| 4 | Ninguna credencial puede recuperarse desde el navegador sin autorización de servidor | Prueba de `reveal` con rol no autorizado |
| 5 | Cada operación se autoriza en servidor | Prueba de mutación directa a Firestore desde consola |
| 6 | Dos usuarios concurrentes no pierden escrituras | Prueba de edición simultánea |
| 7 | El kardex cuadra con el stock y la caja con los cobros | Reporte de conciliación |
| 8 | Los secuenciales son únicos y sin huecos | Consulta de duplicados |
| 9 | Un comprobante emitido tiene firma verificable y estado real del SRI | Validación con el SRI |
| 10 | Cada expediente regulatorio tiene archivo recuperable | Descarga real |
| 11 | El pipeline está verde (tipos, lint, build, pruebas) | CI |
| 12 | Las 11 reglas de lint de diseño pasan | CI |
| 13 | Las 16 pantallas superan el checklist 10.10 | Revisión con capturas |
| 14 | Ninguna cifra de la UI es fabricada | Revisión de cada KPI contra su fuente |

---

## 14. Riesgos del propio plan

| Riesgo | Mitigación |
|---|---|
| Cablear `/api/data` requiere credenciales de servicio que hoy no existen en `.env.local` | Configurar `FIREBASE_SERVICE_ACCOUNT_JSON` en Vercel antes de Fase 1 |
| Migrar 4.030 colores puede romper contraste y accesibilidad | Revisión con el checklist y prueba con lector de pantalla |
| Migrar 78 tablas a `DataTable` toca 49 archivos | Una ola por PR, con capturas; nunca junto a cambios funcionales |
| Reactivar `ignoreBuildErrors` puede destapar errores ocultos | El código ya pasa `tsc --strict` con 0 errores; el riesgo es bajo |
| La firma real exige un certificado `.p12` y su clave | Gestionar con INNTEL el certificado y su bóveda antes de Fase 3 |
| La base actual puede estar ya filtrada | Asumir compromiso: rotar todo secreto y revisar accesos |

---

## Anexo A · Índice de evidencia principal

| Tema | Archivo | Líneas |
|---|---|---|
| Reglas Firestore | `firestore.rules` | 9-25 |
| Estado global y persistencia | `src/lib/state.tsx` | 451-459, 510-548, 589-596, 651-654, 693-776, 826-848, 923-953, 997-1007, 1027, 1220-1232, 1945, 2451-2471, 2501, 2586-2613 |
| Cifrado falso | `src/lib/crypto-vault.ts` | 6-30 |
| Cifrado real (sin usar) | `src/lib/server/vault.ts` | 3, 14-28 |
| Backend seguro (sin usar) | `src/lib/server/operations.ts`, `security.ts`, `schemas.ts` | — |
| SRI | `src/lib/sri-service.ts`, `src/app/api/sri/route.ts` | 283-347, 858-936 / 245-286 |
| Permisos | `src/lib/permissions.ts` | 41-45, 330, 380-395, 406, 449 |
| Validación | `src/lib/validation-engine.ts` | 15-125, 150, 164-198 |
| Seguridad de cliente | `src/lib/security-shield.ts` | 17, 41-56, 142-220 |
| Datos semilla | `src/lib/mock-data.ts` | 52-96, 1413, 1629, 2160-2263 |
| Configuración de build | `next.config.mjs` | 7-12, 54 |
| Tokens de diseño | `tailwind.config.js` | 9-20, 22-87 |
| Encabezado global | `src/components/layout/Header.tsx` | 208-224 |
| Tabla de clientes | `src/components/modules/clients/ClientsTable.tsx` | 92-122, 572-646 |
| Bóveda | `src/components/modules/vault/SecureVault.tsx` | 57-63, 103, 109 |
| Nodos y credenciales | `src/components/modules/network/ClientNodesManager.tsx` | 79, 245, 495, 575-583, 1189-1193 |
| ARCOTEL | `src/components/modules/arcotel/ArcotelManager.tsx` | 164-204, 251-269 |
| IA | `src/components/modules/ai/GeminiAssistantWidget.tsx`, `src/lib/gemini-ai.ts` | 48-59 / 8, 12, 18-20, 37-45 |
| Finanzas | `src/components/modules/finance/FinanceDashboard.tsx` | 162-172, 344 |
| Inventario | `src/components/modules/inventory/InventoryManager.tsx` | 1415-1501, 1686-1695 |
| Compras | `src/components/modules/purchases/NewPurchaseView.tsx` | 133-155, 254, 287 |

## Anexo B · Comandos de verificación

```bash
# Tipos reales (no lo que dice el build)
npx tsc --noEmit --incremental false --pretty false

# Lint real
npx next lint --max-warnings 9999

# Build
npm run build

# Inventario de diseño (literales de color)
npx rg -c "\[#" src --glob "*.tsx" | sort

# Tablas fuera del componente estándar
npx rg "<table" src --glob "*.tsx" -l

# Encabezados por archivo
npx rg "<h[1-4]" src --glob "*.tsx" -c | sort -t: -k2 -nr

# Colecciones nunca releídas de Firestore
npx rg -n 'collectionsToSync' src/lib/state.tsx -A 32

# Rutas API sin autenticación
npx rg -n "export async function (GET|POST)" src/app/api -A 4
```

## Anexo C · Glosario

| Término | Significado |
|---|---|
| **P0/P1/P2/P3** | Niveles de severidad definidos en la sección 0 |
| **D-xx** | Backlog de diseño (sección 12.2) |
| **XAdES-BES** | Estándar de firma electrónica exigido por el SRI de Ecuador |
| **Clave de acceso** | Código de 49 dígitos que identifica un comprobante ante el SRI |
| **Kardex** | Registro cronológico de entradas y salidas de inventario |
| **CxP / CxC** | Cuentas por pagar / cuentas por cobrar |
| **RIDE** | Representación impresa del documento electrónico |
| **Fail-open / fail-closed** | Permitir u denegar por defecto cuando falta información |
| **AAD** | *Additional Authenticated Data*: datos asociados al cifrado que impiden mover un texto cifrado de un documento a otro |
| **Token de diseño** | Valor semántico de estilo (`lumina.primary`) en lugar de un literal (`#004ac6`) |

---

**Fin del documento.**

*Auditoría basada en lectura estática completa, ejecución real de `tsc`/`next lint`/`next build`, análisis del historial Git e inventario programático de estilos. No se ejecutó la aplicación ni se inspeccionó la base de datos en vivo.*
