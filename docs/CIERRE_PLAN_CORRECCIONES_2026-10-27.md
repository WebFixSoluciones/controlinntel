# Cierre del Plan Integral de Correcciones — Control INNTEL

| Campo | Valor |
|---|---|
| **Documento** | Informe de verificación y cierre |
| **Proyecto** | Control INNTEL — gestión ISP / ARCOTEL / SRI |
| **Fecha de cierre** | 27 de octubre de 2026 |
| **Commit verificado** | `5a0de75` — `fix(commercial): servidor transaccional, idempotencia y conciliacion del flujo comercial` |
| **Commit base del plan** | `365ce42` |
| **Alcance** | Paquetes R01–R27 del *Informe consolidado y plan integral de correcciones* |
| **Exclusiones mantenidas** | Facturación SRI: firma, autorización, transmisión, contingencia y RIDE SRI |
| **Estado** | **Cerrado con reservas de entorno** — ver §10 y §11 |

---

## 1. Resumen ejecutivo

Los **27 paquetes de corrección (R01–R27) están implementados** y verificados contra el código en `HEAD`. La verificación es estática (lectura del código en la ruta crítica) y automatizada (tipos, pruebas, build); **no incluye** recorrido en navegador ni ejecución de la suite de emuladores, por limitaciones del entorno descritas en §10.

### Veredicto por bloque

| Bloque | Paquetes | Estado |
|---|---|---|
| Integridad de identidad y acceso | R01–R04 | ✅ Implementado y verificado |
| Catálogo, servicios y períodos | R05–R10 | ✅ Implementado y verificado |
| Dinero, deuda y correcciones | R11–R17 | ✅ Implementado y verificado |
| Compras e inventario | R18–R19 | ✅ Implementado y verificado |
| Lectura, avisos y operación | R20–R25 | ✅ Implementado y verificado |
| Recuperación y regresión | R26–R27 | ✅ Implementado; ejecución de emuladores pendiente de entorno |

### Cambio arquitectónico que sustenta el cierre

La garantía central del plan —*"cero operaciones comerciales críticas pueden confirmar éxito si alguna escritura inseparable falló"*— se cumple por construcción:

```
Antes                                    Ahora
─────────────────────────────────────    ────────────────────────────────────────────
Navegador → Firestore (reglas abiertas)  Navegador → /api/commercial → Admin SDK
· sin autorización                       · actor() verifica ID token + perfil activo
· N escrituras independientes            · 1 runTransaction por comando
· errores silenciados                    · idempotencia (operationId + hash)
· numeración desde estado del cliente    · correlativo reservado en transacción
```

Las reglas de Firestore son actualmente **deny-all** (`firestore.rules:6-8`): ningún cliente web lee o escribe directamente. Toda persistencia pasa por comandos de servidor autorizados.

---

## 2. Método de verificación

Cada paquete se verificó con **evidencia de código en la ruta crítica**, no con la declaración de su autor:

1. Lectura directa del archivo y línea que implementa la regla de negocio.
2. Comprobación de que la regla se aplica **en servidor**, no solo en la interfaz.
3. Contraste con el criterio de aceptación del plan.
4. Ejecución de la puerta de calidad completa (tipos, pruebas, build con lint).

**Archivos eje de la verificación:** `src/lib/server/commercial.ts` (516 líneas, capa de comandos), `src/lib/commercial-core.ts` (motor de cálculo y períodos), `src/lib/server/operations.ts` (persistencia genérica), `src/lib/server/operation-log.ts` (bitácora transaccional), `src/lib/state.tsx` (cliente delgado sobre la API), `firestore.rules`.

---

## 3. Matriz de cumplimiento R01–R27

**Leyenda:** ✅ implementado y verificado · 🟡 implementado, verificación de entorno pendiente · ❌ no implementado

| ID | Paquete | Estado | Evidencia verificada | Criterio de aceptación |
|---|---|---|---|---|
| **R01** | Identidad única y aislamiento | ✅ | `commercial.ts:307-313` — `randomUUID()`; reserva `identifications` con digest de tipo+número; doble comprobación (reserva + escaneo de clientes); `clients` e `identifications` en la misma transacción | IDs únicos, sin herencia, rechazo consistente de duplicado |
| **R02** | Autenticación y permisos efectivos | ✅ | 0 credenciales maestras; 0 comparación `passwordHash === password`; 0 restauración de sesión desde `localStorage`; `firestore.rules:6-8` deny-all; mapa granular por comando `commercial.ts:490-504`; `consulta` bloqueado en `:492` | Consulta no muta; permiso revocado deja de autorizar |
| **R03** | Contratos de datos interfaz↔servidor | ✅ | Esquemas alineados; `operations.ts:30-36` redacta `baseCost` sin `canViewCosts`, presupuestos sin `manage_finance`, `passwordHash`/`secret`/`totpSecret`/`pppoePassword` siempre | Payloads reales pasan; inválidos fallan sin escrituras parciales |
| **R04** | Comandos de servidor y persistencia | ✅ | `executeCommercial` en **una** `runTransaction` (`:505-515`); idempotencia por `operationId` + `requestHash`; rechaza reutilización con datos distintos (`:509`); devuelve resultado cacheado al reintentar (`:510`); bitácora en la misma transacción (`operation-log.ts:17`) | Fallo a mitad no deja estado parcial; reintento no duplica |
| **R05** | Catálogo y categorías | ✅ | `ClientContractTab.tsx:367` toma `prod.serviceCategory \|\| "otro"`; eliminada la inferencia por nombre ("web", "SSL", "anual") y la sobrescritura a `"internet"` | Categoría de catálogo se conserva; cero inferencia por texto |
| **R06** | Asignación y ciclo de vida | ✅ | `assignService` exige producto/plan vigente; valida nodo solo si se informa; **no inventa** `nodeId` ni IP (`nodeId:source.nodeId\|\|""`); exige `ivaRate`; exige motivo si el precio es 0; valida fechas y día de cobro; recalcula `totalActiveServices` | Sin datos técnicos ficticios; contadores estables |
| **R07** | Calendario prepago/postpago | ✅ | `commercial-core.ts:planServicePeriod` — anclaje calendario/aniversario, frecuencia, primer período, contrato vencido, día de cobro, aviso previo, prorrateo, "no exigible aún" | Prepago y postpago identifican el mismo período con emisión distinta |
| **R08** | Idempotencia por período | ✅ | `billingPeriods` con clave `${service.id}_${periodStart}_${periodEnd}` (`commercial.ts:144`); rechazo si ya existe (`:143`) | Doble clic/petición → una sola emisión |
| **R09** | Correlativos y lote | ✅ | `sequences` + `documentNumbers` reservados **dentro** de la transacción (`:116-125`); control de serie agotada (`:120`); `startRun`/`processRun` con `billingRuns` | Lote de 10 → 10 números únicos, ninguno ajeno |
| **R10** | No recrear el servicio | ✅ | `issueSale:147-150` bloquea reasignación de un servicio ya asignado y actualiza el servicio existente en lugar de crear otro (`:146`) | 12 emisiones → 1 servicio con 12 períodos |
| **R11** | Una cuenta por cobrar | ✅ | Cargo único `chg-inv-${invoiceId}` (`:161`); `recur` exige `expectedTotal` de la vista previa aprobada y revalida la tarifa (`:382-384`) | Una fila de deuda por documento |
| **R12** | Pagos, sobrepagos y reversiones | ✅ | `payCharge` → **409** si `amount > chargeBalance(charge)` (`:82`); exige cuenta bancaria cuando no es anticipo (`:93`); un movimiento, un pago, una aplicación; `clientBalance` derivado (`:101`); `reverseApplication` con evento inverso (`:200-207`) | Sobrepago rechazado o distribuido; cero diferencias sin explicar |
| **R13** | Anticipos | ✅ | Valida cliente, estado y `remaining` (`:89`); descuenta y registra aplicación (`:90-91`); reversión libera saldo o crea crédito `released-*` (`:179-180`) | Anticipo no se consume dos veces; ingreso bancario único |
| **R14** | Anulación y correcciones | ✅ | `cancelSale` valida tipo de documento, consistencia histórica y revierte kardex con costo ponderado (`:407-432`); `cancelCharge` **rechaza** deudas con `invoiceId` y exige anular la venta (`:406`); sin inferencia por texto | Corregir una venta no altera otra ni otro cliente |
| **R15** | Baja de cliente y servicio | ✅ | `retireClient` y `retireService` → baja lógica con `isBillableInCurrentCycle:false` (`:434-438`); no borra deuda devengada | Retirar conserva historial y obligaciones |
| **R16** | Bancos y apertura | ✅ | `createBank` con `initialBalance` separado (`:234-237`); `editBank` **prohíbe** modificar saldo (`:241`); `adjustBank` exige motivo y genera movimiento identificado (`:245`); `bank()` valida cuenta activa y sobregiro (`:57-66`) | $250 + $100 − $40 = $310 explicable; nombre editable sin alterar saldo |
| **R17** | Transferencias internas | ✅ | Dos piernas con `transferId` y categoría `transferencia_interna` (`:450-453`); `externalCash` las excluye de caja (`commercial-core.ts:87-89`) | Transferencia neutra en ingresos y gastos consolidados |
| **R18** | Compras y CxP | ✅ | `purchaseUniqueness` por proveedor+documento (`:469`); CxP separada del pago; `paySupplier` distinto de OPEX; `supplierCredit`/`supplierDebit` | Compra duplicada rechazada; inventario, CxP y banco conciliados |
| **R19** | Kardex y valoración | ✅ | Costo promedio **neto de descuento**: `(stock·baseCost + subtotal)/stock` (`:476`); valida stock en servidor; kardex `PURCHASE_RECEIPT`/`SALE`/`CUSTOMER_RETURN` con costo original en reversión (`:429`) | 10@$50 + 5@$40 → 15 unidades a ≈ $46,6667 |
| **R20** | Informes e indicadores | ✅ | `snapshot` **pagina** en bloques de 500 hasta agotar (`operations.ts:22-29`) — ya no trunca; `externalCash` como fuente única de caja; eliminadas las series hardcodeadas y el fallback `704.25` | Detalle suma los totales; transferencia no altera ingreso; sin tendencias inventadas |
| **R21** | Correo y notificaciones | ✅ | `/api/messages/email:29` exige `messageId` real del proveedor; estado `accepted` solo con ese id, si no `unconfirmed` | Sin proveedor → fallo visible, nunca "Enviado" |
| **R22** | Impresión y exportación | ✅ | `RidePreviewModal.tsx:746` → **"Subtotal sin IVA"**; `:908` "Bodega de Despacho" condicionada a `warehouseName`; exportación XLSX real con ExcelJS (`doc-generator.ts:164`) | Suma de líneas + IVA = total, en A4 y ticket |
| **R23** | Fechas y datos heredados | ✅ | `date-utils.ts:getEcuadorDate` con parseo local de fecha-solo; usado en comandos y emisión | Operar a las 23:30 conserva el día comercial |
| **R24** | Navegación y borradores | ✅ | `clientes/page.tsx` — efecto de URL con `clientsRef` (no depende de `clients`) + reintento de hidratación guardado por `!selectedClient` | Enlace profundo funciona y no cierra la ficha al mutar servicios |
| **R25** | UX/UI y accesibilidad | ✅ | `ModalFocusGuard.tsx:15` aplica `role="dialog"` + `aria-modal` + retorno de foco; montado globalmente en `state.tsx:3593` | Operación completa por teclado; mensajes coherentes |
| **R26** | Reparación de información | ✅ | `/api/recovery` con modo simulación vs `commit`; `recovery.ts:recoverSnapshot` + `rebuildFromLog`; `RecoveryPanel` montado en Configuración | Registros dañados identificados y conciliados, no ocultos |
| **R27** | Regresión y aceptación | 🟡 | 11 archivos de prueba, **111 casos**; script `scripts/qa-commercial-emulator.mjs` (12 escenarios) y `firebase.qa.json` | Ejecución de emuladores y navegador pendiente de entorno (§10) |
| **R28** | Emisión automática al asignar servicio *(requisito añadido el 27/10)* | ✅ | `commercial.ts` — el alta emite la nota del primer período con la fecha del ciclo configurado (`allowFuture`), reserva el número y registra la deuda; guarda de orden cronológico por serie | Nota emitida con fecha del ciclo; una sola por período; serie sin fechas invertidas (§15) |

---

## 4. Invariantes transversales (§5.2 del plan)

| # | Invariante | Verificación |
|---|---|---|
| 1 | No sobrescribir un cliente al crear otro | ✅ `createClient` con UUID + reserva de identificación |
| 2 | Un período, una emisión vigente | ✅ `billingPeriods` |
| 3 | Un número visible = un documento | ✅ `sequences` + `documentNumbers` en transacción |
| 4 | Cada deuda pertenece al cliente del documento | ✅ `cancelSale:412` rechaza inconsistencia histórica |
| 5 | Cobrar un período no crea suscripción | ✅ `issueSale:146-150` |
| 6 | Todo movimiento tiene origen identificado | ✅ `relatedEntityId` + `operationId` en cada movimiento |
| 7 | Aplicación positiva y ≤ saldo | ✅ `payCharge:82` |
| 8 | Excedentes permanecen identificados | ✅ Anticipo / crédito `released-*` |
| 9 | Anular no afecta registros de otro | ✅ IDs, nunca número visible |
| 10 | Un evento confirmado no se aplica dos veces | ✅ `operationId` + `requestHash` |
| 11 | Reimprimir no muta datos | ✅ Impresión desde la instantánea del documento |
| 12 | Éxito solo si todas las escrituras inseparables se aplicaron | ✅ Una transacción por comando |

---

## 5. Arquitectura resultante

**Comandos de servidor** (`/api/commercial`), todos autenticados y autorizados por comando:

| Dominio | Comandos |
|---|---|
| Clientes y servicios | `createClient`, `assignService`, `editService`, `retireClient`, `retireService` |
| Emisión | `issueSale`, `editSale`, `recur`, `startRun`, `processRun` |
| Cobranza | `payCharge`, `applyAdvance`, `advance`, `cancelAdvance`, `cancelCharge`, `cancelSale`, `reverseApplication` |
| Bancos | `createBank`, `editBank`, `adjustBank`, `bankMovement`, `transfer` |
| Compras | `purchase`, `paySupplier`, `supplierCredit`, `supplierDebit` |
| Inventario | `createProduct`, `editProduct`, `inventoryTransfer`, `inventoryAdjustment` |
| Otros | `expense`, `manualCharge` |

**Otras rutas de servidor:** `/api/data` (persistencia genérica con versión), `/api/users`, `/api/session`, `/api/operations`, `/api/reconciliation`, `/api/recovery`, `/api/messages/email`, `/api/tickets/reply`, `/api/blob/upload`, `/api/sri` (fuera de alcance).

---

## 6. Puerta de calidad

| Comprobación | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit --strict` | ✅ **0 errores** |
| Pruebas | `npm test` | ✅ **111 / 111** |
| Build de producción | `npm run build` | ✅ **29 rutas** |
| Lint y tipos en build | `next.config.mjs` | ✅ `ignoreBuildErrors: false` · `ignoreDuringBuilds: false` |
| Escrituras directas del cliente a Firestore | búsqueda en `src/` | ✅ **0** |

### Inventario de pruebas

| Archivo | Casos |
|---|---|
| `src/lib/end-to-end-flows.test.ts` | 61 |
| `src/lib/server/commercial.test.ts` | 15 |
| `src/lib/qa-commercial-audit.test.ts` | 7 |
| `src/lib/date-utils.test.ts` | 5 |
| `src/lib/inventory-service.test.ts` | 5 |
| `src/lib/sri-service.test.ts` | 5 |
| `src/lib/server/vault.test.ts` | 3 |
| `src/lib/permissions.test.ts` | 3 |
| `src/lib/validation-engine.test.ts` | 3 |
| `src/lib/server/auth-boundary.test.ts` | 2 |
| `src/lib/print-service.test.ts` | 2 |
| **Total** | **111** |

---

## 7. Correcciones aplicadas en esta sesión de cierre

Sobre el trabajo previo, se corrigieron los defectos que impedían el cierre:

| # | Defecto | Corrección |
|---|---|---|
| 1 | Error `TS2367` en `operations.ts:132`: rama `auditLogs` sobre una entidad ya retirada del tipo | Eliminada la rama muerta; la auditoría vive en `operationLog` |
| 2 | **Regresión real de UX**: añadir `clients` a las dependencias del efecto de URL arreglaba el enlace profundo pero **cerraba la ficha** al mutar servicios | `clientsRef` para el efecto de URL (dependencias intactas) + efecto separado de reintento de hidratación guardado por `!selectedClient` |
| 3 | 5 aserciones apuntaban a `state.tsx`, donde la lógica ya no existe | Reapuntadas a `server/commercial.ts` y `commercial-core.ts`, conservando la intención y dos cambios de invariante documentados (R14 y R15) |
| 4 | 3 aserciones dependían de rótulos de UI que el refactor simplificó | Reescritas contra la capacidad verificable (`handleFreqChange`, `newSvcDuration`, `newSvcAutoRenew`, `getRenewalStatus`, `autoRenew`) |

**Nota de transparencia:** las aserciones 3 y 4 son pruebas de **texto en el código fuente**. Se actualizaron porque el código cambió de ubicación, no para ocultar fallos; cada una se contrastó contra el comportamiento equivalente en la nueva capa. Esto refuerza la recomendación de R27: sustituir las búsquedas de cadenas por pruebas de integración reales.

---

## 8. Cobertura de la matriz de aceptación T01–T48

| Cobertura | Casos | Base |
|---|---|---|
| **Verificado por prueba automatizada o evidencia de emulador previa** | T01, T02, T04, T05, T06, T07, T08, T09, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20, T21, T22, T23, T24, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T44, T45, T46, T48 | 107 pruebas + 12 escenarios de `emulator-results.json` (evidencia previa) |
| **Verificado por código, requiere prueba de carga** | T37 (>2.000 documentos) | Paginación implementada y verificada en código; sin prueba de volumen |
| **Requiere entorno de navegador** | T03, T39, T40, T41, T42, T43, T47 | Cubiertos por `docs/UAT_GUION_ACEPTACION_2026-10-27.md`; pendientes de ejecución y firma |

---

## 9. Riesgos residuales

| # | Riesgo | Severidad | Observación |
|---|---|---|---|
| 1 | `FIREBASE_SERVICE_ACCOUNT_JSON` **no configurado** en `.env.local` | **Alta (operativa)** | Con reglas deny-all y sin fallback, la aplicación **no puede persistir** hasta configurar las credenciales de servidor. Es aprovisionamiento, no código. Documentado en `.env.example` junto con `VAULT_KEY_BASE64`, `EMAIL_DELIVERY_WEBHOOK_URL` y `EMAIL_DELIVERY_WEBHOOK_TOKEN` |
| 2 | `void syncToFirestore(...)` único en `state.tsx:2052` | Baja | Rama **legacy de `factura` SRI**, fuera del alcance declarado. No se modificó para no alterar un flujo excluido |
| 3 | 5 `catch {}` vacíos en `state.tsx` | Aceptable | Todos sobre `localStorage`/`JSON.parse` de caché corrupta y limpieza de sesión en `logout`. Fallar ahí rompería el arranque: es intencional |
| 4 | Lectura de credenciales con `simpleDecrypt` heredado | Media | `operations.ts:10` aún importa el descifrado heredado para datos antiguos; la escritura ya usa sellado AES-256-GCM en servidor |

---

## 10. Limitaciones de esta verificación

Declaradas explícitamente para no sobrestimar el cierre:

1. **Suite de emuladores no ejecutada en esta sesión.** Requiere `firebase-tools` (ausente) y **Java 11+**; el entorno solo tiene JRE 7 y 8. El script pasa validación sintáctica y `firebase.qa.json` está configurado. Los 12 escenarios de `docs/qa-remediacion/emulator-results.json` son **evidencia previa**, no re-verificada aquí.
2. **Sin recorrido en navegador.** No se abrió la aplicación: no hay verificación visual, de impresión física ni de accesibilidad con lector de pantalla.
3. **Sin pruebas de carga ni concurrencia multiusuario real.** El diseño lo soporta (transacción + reserva de correlativo + idempotencia), pero no se midió bajo carga.
4. **Sin restauración de copia real de Firebase.** R26 se verificó por código y por la prueba de importación del conjunto previo, no sobre un respaldo productivo.

### Comandos para completar la verificación

```powershell
# Suite de integración con emuladores (requiere JDK 11+)
npm i -D firebase-tools
npx firebase emulators:start --config firebase.qa.json --project demo-controlinntel-qa
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
$env:QA_BASE_URL="http://127.0.0.1:3040"
node scripts/qa-commercial-emulator.mjs

# Servidor local para recorrido manual (requiere FIREBASE_SERVICE_ACCOUNT_JSON)
npm run dev
```

---

## 11. Condición de habilitación comercial

Según §12 del plan, el flujo puede proponerse para habilitación cuando se cumplan siete condiciones. Estado actual:

| # | Condición | Estado |
|---|---|---|
| 1 | Paquetes P0 con pruebas aprobadas y evidencia | ✅ 111 pruebas verdes; evidencia por paquete en §3 |
| 2 | Sin identidades ni documentos duplicados sin resolver | ✅ Prevención implementada; **saneamiento de datos históricos corresponde a R26 en producción** |
| 3 | Diferencias de cartera, anticipos, bancos e inventario resueltas o aisladas | 🟡 Depende de ejecutar R26 sobre la base real |
| 4 | Persistencia, reglas y API probadas con fallos y concurrencia | 🟡 Implementado; prueba de emuladores pendiente de entorno |
| 5 | Caso de negocio de punta a punta validado por un responsable | 🟡 **Guion emitido**: `docs/UAT_GUION_ACEPTACION_2026-10-27.md` (T03, T39–T43, T47). Pendiente de ejecución y firma de Finanzas |
| 6 | Copia recuperable, reversión de despliegue y seguimiento de fallos | ✅ `/api/recovery`, `operationLog`, reversión por commit |
| 7 | Limitaciones visibles y no presentadas como funciones activas | ✅ §10 de este documento y exclusiones en §1 |

**Conclusión:** el sistema está **técnicamente listo para UAT**, no para producción. Faltan la ejecución de la suite de emuladores, el recorrido en navegador, el saneamiento de datos históricos y la aceptación formal del negocio.

---

## 12. Trazabilidad

| Origen | Paquetes |
|---|---|
| Auditoría A (28 hallazgos QA-01…QA-28) | R01–R27 según §11 del plan integral |
| Auditoría B (30 hallazgos CR/AL/ME/BA) | R01–R27 según §11 del plan integral |
| Hallazgos propios de esta revisión | Integrados en R02 (credenciales maestras), R03 (redacción de campos), R20 (paginación) y §9 |

---

## 13. Declaración de cierre

Se declara **cerrada la implementación** del Plan Integral de Correcciones (R01–R27) sobre el commit `5a0de75`, con las siguientes salvedades:

- La verificación es **estática y automatizada**, no de aceptación en entorno real.
- Cuatro limitaciones de entorno quedan documentadas en §10 y cuatro riesgos residuales en §9.
- La habilitación productiva requiere **UAT del negocio** y el **saneamiento de datos históricos** (R26) sobre la base real.

Los informes de auditoría de referencia y su evidencia visual **no se versionan**: permanecen solo en el entorno local del equipo, excluidos mediante `.gitignore`. Este documento es el artefacto oficial de cierre.

---

## 15. Anexo — R28: emisión automática al asignar servicio

Requisito incorporado el **27/10/2026**, después del cierre del plan original. No sustituye a R07/R08: los completa adelantando la primera emisión al momento del alta.

### Decisión funcional (aprobada por el negocio)

| Aspecto | Decisión |
|---|---|
| Momento de emisión | **Al guardar el servicio**, en la misma operación |
| Fecha del comprobante | La que dicta el **ciclo configurado en el formulario de asignación** (modalidad, día de cobro, anticipo). Para prepago es el **inicio del período**: un alta con ciclo que inicia el 01/11 emite la nota con fecha **01/11/2026** |
| Naturaleza | **Documento posfechado**: se crea hoy, fechado al inicio del ciclo |
| Períodos posteriores | Se siguen emitiendo por el proceso recurrente ya existente (R07/R08) |
| Numeración | Se **reserva en el momento del alta** dentro de la transacción |

### Implementación

| Elemento | Ubicación |
|---|---|
| Cálculo del primer período | `commercial.ts` → `firstPeriodFor()` sobre `planServicePeriod(..., { allowFuture: true })` |
| Emisión | `assignService` invoca `issueSale` con `allowFuturePeriod: true`, `paymentMethod: "credito"` y `creditDueDate` del ciclo |
| Cadena comercial | La nota genera su **cuenta por cobrar** (`chg-inv-…`), actualiza `clientBalance` y entra a cobranzas y bancos por los mismos comandos que cualquier venta |
| Idempotencia | `billingPeriods` impide emitir dos veces el mismo período; `editService` **no** emite |
| Orden cronológico | `sequences.lastDate` guarda la última fecha emitida por serie y **rechaza** cualquier comprobante anterior: requisito indispensable al permitir posfechado |
| Sin emisión | Si el período no es elegible (servicio no facturable, sin tarifa o sin impuesto), el servicio **se guarda igual** y se devuelve `firstInvoiceSkipped` con el motivo, que la interfaz muestra como advertencia |

### Efecto en la interfaz

Al guardar el servicio, el aviso cambia según el resultado:

- **Con documento**: *"Servicio Asignado y Facturado — Nota de venta 010-001-000000001 por $115.00 con fecha 2026-11-01. Ya está registrada en cobranzas."*
- **Sin documento**: *"Servicio Asignado sin Nota — No se emitió el comprobante: <motivo>."*
- **Edición**: mensaje habitual, sin emisión.

### Pruebas añadidas (4)

| Prueba | Verifica |
|---|---|
| `R28: assigning a service issues its first note dated by the configured cycle…` | Fecha 2026-11-01, número de serie válido, deuda por 115 en el mes 11/2026, saldo del cliente, `billingPeriods` y `lastBilledPeriod` |
| `R28: editing the assigned service never issues a second note…` | Sin duplicado al editar |
| `R28: a post-dated note blocks any earlier date in the same series` | Guarda cronológica de la serie |
| `R28: a non-billable service is saved without a note and reports the reason` | Persistencia sin emisión y motivo devuelto |
| `R28: consecutive assignments take sequential numbers and keep the agreed payment method` | Series 001 y 002 consecutivas; `paymentMethod` en el servicio y `expectedPaymentMethod` en la deuda; sin cobro aplicado |

### Forma de pago pactada y ajustes del formulario

El formulario de asignación ahora **define cómo pagará el cliente sus facturas**:

| Aspecto | Implementación |
|---|---|
| Selector | **Forma de Pago**: Crédito (a cuenta), Efectivo, Transferencia bancaria, Tarjeta de crédito |
| Persistencia | `clientServices.paymentMethod` y `monthlyCharges.expectedPaymentMethod` |
| Efecto | **Preferencia, no cobro**: la nota nace pendiente con `paidAmount: 0` y sin movimiento bancario |
| Uso | El modal de cobro de Finanzas **preselecciona** la forma pactada (`PREFERRED_PAYMENT_LABEL`) |

**Cambios de interfaz en la misma iteración:**

- Se **eliminó el selector "Tipo / Categoría"**: era informativo y no intervenía en el proceso comercial. La categoría sigue visible en el buscador y en la ficha del artículo.
- El formulario pasó a **dos columnas**: el buscador comparte fila con el nombre del servicio, y la descripción ocupa una sola línea de ancho completo.
- El bloque de ciclo mantiene cuatro columnas por fila con el nuevo selector en el lugar liberado.

### Riesgo introducido y su control

El posfechado permite que un comprobante con fecha 01/11 exista el 27/10. Sin control, un documento fechado 27/10 emitido después dejaría la serie con fechas invertidas. **Mitigación:** la guarda de `sequences.lastDate` rechaza esa emisión con un mensaje accionable.

**Consecuencia operativa asumida:** una vez emitido un documento posfechado, no se pueden emitir documentos con fecha anterior en la misma serie hasta que el negocio decida abrir otra serie o ajustar el período.

---

**Fin del informe.**

*Documento generado el 27 de octubre de 2026. Verificado contra `5a0de75`; anexo R28 incorporado sobre el árbol de trabajo posterior.*
