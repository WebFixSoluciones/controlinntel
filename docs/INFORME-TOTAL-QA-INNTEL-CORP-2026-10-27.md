# INFORME TOTAL DE QA — INNTEL CORP

**Sistema evaluado:** INNTEL CORP (ISP / ERP)  
**Fecha del informe:** 27/10/2026  
**Ambiente:** local `http://localhost:3001` — Next.js 14 + Firebase/Firestore  
**Usuario de prueba:** `superadmin@inntelcorp.com`  
**Modalidad:** caja negra funcional + auditoría estática de código + verificación de integridad con snapshots de estado.

**Alcance:** clientes, contratos y servicios, facturación recurrente, ventas y notas de venta no-SRI, cobranzas, cuentas por cobrar (CxC), cuentas por pagar (CxP), bancos, movimientos, reportes, inventario e impresión no-SRI.

**Excluido por instrucción:** módulo SRI y ruta `/facturacion`. No se evaluó emisión, firma, XML, autorización, contingencia ni RIDE SRI.

**Veredicto:** **NO APTO para producción** en los flujos evaluados. El sistema “se ve” funcional, pero la contabilidad de soporte no es confiable: se duplican cargos y servicios, se generan comprobantes con numeración repetida, se borran datos de otros clientes y los saldos de clientes, bancos y reportes no cuadran entre sí.

| Severidad | Cantidad | Criterio |
|---|---:|---|
| Crítico | 7 | Pérdida, duplicación o descuadre de dinero/datos; bloquea producción |
| Alto | 10 | Función principal incorrecta o flujo roto con workaround difícil |
| Medio | 9 | Defecto funcional o UX relevante con workaround |
| Bajo | 4 | Cosmético, accesibilidad o mensajes |
| **Total** | **30** | |

---

## 1. Resumen ejecutivo

Los cinco problemas que más riesgo representan para el negocio son:

1. **La facturación recurrente duplica cargos y servicios, e impone IVA 15 % incluso a servicios configurados al 0 %.** Una nota de venta recurrente de $402.50 terminó con dos cargos por cobrar y tres servicios duplicados.
2. **“Facturar Lote” genera varios comprobantes con el mismo número de documento** (`010-001-000000003` en tres clientes) y el alta de cada uno **elimina cargos de otros clientes** que comparten ese número.
3. **Los borrados no son atómicos ni están aislados por cliente.** Abortar el borrado de una factura dejó servicios ya eliminados; reintentarlo borró 4 cargos y 22 servicios de dos clientes distintos.
4. **Eliminar una factura pagada descuadra el banco contra el saldo del cliente.** En la prueba, el banco bajó $100.00 (pago reversado) pero el cliente solo bajó $57.50 (total de la nota): quedaron $42.50 sin explicación.
5. **CxC y reportes no son confiables.** Los cargos se muestran duplicados ($862.50 emitido contra $460.00 de saldo del cliente), se permiten pagos en exceso sin crédito a favor y los reportes cuentan dos veces la recaudación e incluyen transferencias internas como ingreso y gasto.

### Impacto por área

| Área | Impacto observado |
|---|---|
| Facturación | Doble cobro, IVA incorrecto, secuenciales duplicados, servicios facturados fuera de periodo |
| Cobranzas | Saldos de cliente y CxC contradictorios; pagos en exceso no aplicados |
| Bancos | Saldos iniciales sin asiento; movimientos con banco renombrado o inexistente; descuadre al borrar |
| Reportería | Ingresos, gastos y efectividad inflados o falsos; gráficos con datos hardcodeados |
| Auditoría | Facturas, cargos y movimientos huérfanos tras borrar clientes o servicios |
| Operación | Selector de categoría percibido como “muerto”; lote que queda en “Emitiendo…”; modales de borrado sin progreso |

---

## 2. Método, herramientas y limitaciones

### 2.1 Método

- Navegación por UI con Playwright (`playwright-core`) sobre Chrome instalado, sesión persistida en `auth.json`.
- Inspección del estado en `localStorage`, clave `INNTEL_CORP_STATE_CLEAN_V1`, y contraste con Firestore.
- Capturas antes/después y snapshots JSON para cada operación destructiva.
- Lectura del código fuente para confirmar la causa raíz y la línea exacta.
- Reproducción manual asistida de los flujos reportados: prepago, postpago, recurrencia, venta no-SRI, cobro parcial, sobrepago, transferencia, borrados e impresión.

### 2.2 Limitaciones

- El módulo SRI y `/facturacion` quedaron fuera de alcance por instrucción.
- No se ejecutaron pruebas de carga, seguridad, concurrencia multiusuario real ni recuperación ante fallos de red.
- Las pruebas destructivas se hicieron sobre datos QA; los saldos finales del ambiente quedaron contaminados por el propio ejercicio.
- Algunos flujos se validaron solo por código (por ejemplo, la ausencia de acción de borrado en la tabla de CxC).
- Firebase impide usar `networkidle`; se trabajó con esperas explícitas y verificación de DOM/estado.

### 2.3 Evidencias

- Capturas: `docs/qa-2026-10-27/evidencias/` (45 imágenes).
- Scripts y snapshots originales: `C:\Users\WEB FIX\AppData\Local\Temp\opencode\qa\`.
- Snapshot clave: `state-before-*` / `state-after-*` para lote, borrados, pago, sobrepago y transferencia.

---

## 3. Entorno y datos de prueba

### 3.1 Entidades creadas o utilizadas

| Entidad | Identificador | Detalle |
|---|---|---|
| Cliente QA | `cli-006` — PRUEBA CLIENTE | RUC `1790012344001`; creado para el ejercicio |
| Servicio prepago | `INTERNET QA PREPAGO 100MB` | $100.00, IVA 0 %, día de cobro 5, anticipo 20 |
| Servicio postpago | `SOPORTE QA POSTPAGO` | $50.00 + IVA 15 %, día de cobro 10, anticipo 25 |
| Venta no-SRI | `inv-1793075285552` / `010-001-000000001` | $50.00 + $7.50 IVA = $57.50 |
| Recurrente | `inv-1793075432849` / `010-001-000000002` | $402.50; duplicó cargos y servicios |
| Banco QA | `bank-1793075718790-c2c` — BANCO QA AUDITORIA | Saldo inicial $250.00, sin movimiento de apertura |
| Transferencia | `TRF-QA-001` | $100.00 de BANCO GUAYAQUIL a BANCO QA AUDITORIA |
| Cliente eliminado | `cli-005` — PERUGACHI NICOLALDE DIEGO GEOVANNY | Factura huérfana posterior: `010-001-000000003`, $287.50 |

### 3.2 Estado final observado (después de las pruebas)

| Dato | Valor |
|---|---|
| Clientes | 5: `cli-002`, `cli-003`, `cli-004`, `cli-006`, `cli-demo-corp-01` |
| Facturas | 4: `047` $172.50; `002` $402.50; dos `003` (VALLE $3,128.00 y huérfana PERUGACHI $287.50) |
| Cargos mensuales | 0 |
| Servicios | 12 |
| Bancos | BANCO GUAYAQUIL $1,000.00 + BANCO QA AUDITORIA $350.00 = **$1,350.00** |
| Saldos de cliente | ARTEAGA $0.00; `cli-003` $172.50; VALLE $3,760.00; `cli-006` $202.50; demo $218.50 |

> La existencia de **dos facturas con el número `010-001-000000003`** al cierre es, por sí sola, evidencia de que la numeración no es única.

---

## 4. Matriz de hallazgos

| ID | Sev. | Módulo | Hallazgo | Evidencia principal |
|---|---|---|---|---|
| CR-01 | Crítico | Clientes | IDs por longitud (`cli-00N`) colisionan y heredan servicios huérfanos | `state.tsx:1720`; `cli-006` |
| CR-02 | Crítico | Recurrentes | Duplica cargos/servicios, IVA 15 % fijo, ignora configuración del servicio | `state.tsx:3296-3411`, `3315`, `3327`, `3370` |
| CR-03 | Crítico | Ventas/Lote | Numeración duplicada en lote y purga cruzada de cargos por `invoiceNumber` | `state.tsx:2946-2982`, `3203-3208`; 3 facturas `003` |
| CR-04 | Crítico | Facturación | Borrado no atómico y purga de servicios/cargos de otros clientes | `state.tsx:3926-4167`, `4050-4107`, `4128-4167` |
| CR-05 | Crítico | Cobros/Bancos | Borrar factura pagada reversa pago completo pero solo resta el total al cliente | `state.tsx:4024-4042`; $100 vs $57.50 |
| CR-06 | Crítico | Clientes | Borrar cliente deja facturas, cargos y movimientos huérfanos | `state.tsx:1821-1829`; `cli-005` |
| CR-07 | Crítico | Servicios/CxC | Borrar un servicio elimina el cargo completo de varios servicios | `state.tsx:1894-1912`; cargo $402.50 |
| AL-01 | Alto | Servicios | Elegir producto sobrescribe la categoría manual del servicio | `ClientContractTab.tsx:328-382` |
| AL-02 | Alto | Servicios/Recurrentes | IVA inconsistente: 0 % al contratar, 15 % fijo al recurrir | `ClientContractTab.tsx:340`; `state.tsx:3315/3327` |
| AL-03 | Alto | CxC | Cargos duplicados y `balanceRemaining` indefinido tratado como total | `FinancialReportsTab.tsx:142/154` |
| AL-04 | Alto | Cobros | Sobrepago sin validación ni crédito; excedente no contabilizado | `state.tsx:2239-2313`; $42.50 |
| AL-05 | Alto | Cobros | Eliminar cargo revierte banco/movimiento pero no saldo del cliente | `state.tsx:2351-2411` |
| AL-06 | Alto | Reportes | Doble conteo de recaudación y transferencias internas como ingreso/gasto | `FinancialReportsTab.tsx:95-96`, `120-126` |
| AL-07 | Alto | Reportes | Gráfico y totales con datos hardcodeados/fallback | `FinancialReportsTab.tsx:210-226` |
| AL-08 | Alto | Bancos | Saldo inicial sin movimiento; movimientos con banco renombrado/inexistente | `state.tsx:4870-4876`; `MovementsTab.tsx:197` |
| AL-09 | Alto | Impresión | “Precio Total”/“TOTAL” no coincide con “VALOR TOTAL”; campos logísticos irrelevantes | `RidePreviewModal.tsx:746/776/1050` |
| AL-10 | Alto | Recurrentes | Lote queda en “Emitiendo…” y re-factura servicios ya facturados del periodo | `RecurringBillingView.tsx:126-128`, `261-293` |
| ME-01 | Medio | Clientes | `totalActiveServices` inconsistente al crear/heredar | `state.tsx:1735`, `1858-1861` |
| ME-02 | Medio | Servicios | Servicios heredados muestran “Cobro Día 1 / Anticipo Día 26” | `ClientContractTab.tsx:1574-1575` |
| ME-03 | Medio | Ventas | Venta inicia en “Consumidor Final” y el encabezado no se actualiza | `NewSaleView.tsx:556-575` |
| ME-04 | Medio | Ventas/Inventario | Productos a $0.00 y confirmación “descontando inventario” engañosa | `NewSaleView.tsx:1236`; 4 productos en $0 |
| ME-05 | Medio | CxC | La tabla no ofrece acción de eliminar; el borrado vive en otro módulo | `AccountsReceivableTab.tsx` (sin `delete`) |
| ME-06 | Medio | Facturación | Modal de borrado >8-12 s, sin progreso y no idempotente | `ClientProfile360.tsx:910-954` |
| ME-07 | Medio | Navegación | Deep links `/clientes?id=...` no confiables | `src/app/clientes/page.tsx:49-58` |
| ME-08 | Medio | Inventario | Categorías sin productos/servicios y filtros con conteos engañosos | `InventoryManager.tsx:294-311`, `1024-1052` |
| ME-09 | Medio | Impresión | Botón de cierre solo con icono, sin etiqueta accesible | `RidePreviewModal.tsx` |
| BA-01 | Bajo | UI | Formato monetario y de totales inconsistente | Capturas de impresión y CxC |
| BA-02 | Bajo | Inventario | Nombres de categorías inconsistentes (`SERVICIOS`, `OLTS`, etc.) | `final-reportes.png` / inventario |
| BA-03 | Bajo | Consola | Ruido CSP/GTM ajeno a la lógica | Consola del navegador |
| BA-04 | Bajo | Clientes | Advertencia de borrado omite facturas, cargos y movimientos | `ClientProfile360.tsx:918-922` |

---

## 5. Hallazgos críticos

### CR-01 — Los IDs de cliente colisionan y heredan servicios huérfanos

**Descripción.** El ID se construye con la longitud actual del arreglo:

```ts
const newId = "cli-" + (clients.length + 1).toString().padStart(3, "0");
```

(`src/lib/state.tsx:1720`)

Si un cliente fue eliminado, o si ya existe un registro con ese ID, el nuevo cliente reutiliza el ID. `syncToFirestore("clients", newId, ...)` sobrescribe el documento y el estado local termina con dos clientes que comparten `clientId`. Los servicios huérfanos de ese ID aparecen en la ficha del cliente nuevo.

**Reproducción observada.**
1. Crear un cliente nuevo con 5 clientes existentes.
2. El sistema asigna `cli-006`.
3. La ficha muestra servicios que el usuario no cargó; `totalActiveServices` arranca en 0 pese a existir servicios.
4. Al asignar servicios, la lista mezcla servicios heredados con los nuevos.

**Impacto.** Suplantación de identidad de cliente, mezcla de contratos, cobros y saldos entre clientes distintos. Es un fallo de aislamiento de datos.

**Corrección esperada.**
- Generar IDs con `crypto.randomUUID()` o dejar que Firestore asigne el ID (`addDoc`).
- Validar unicidad antes de escribir y migrar los IDs existentes.
- Índice único por `identificationNumber` normalizado.

**Evidencia.** `final-clientes.png`, `final-cliente-006.png`, `ficha-servicios.png`.

---

### CR-02 — La facturación recurrente duplica cargos y servicios, y aplica IVA 15 % fijo

**Descripción.** `emitRecurringInvoiceForClient` toma todos los servicios activos y facturables, sin verificar si ya fueron facturados en el periodo:

```ts
const billableServices = clientServices.filter(
  (s) => s.clientId === clientId && s.status === "activo" &&
         s.isBillableInCurrentCycle !== false
);
```

(`state.tsx:3304-3309`)

Luego calcula el IVA con una constante:

```ts
const ivaAmount = Math.round(unitPrice * 0.15 * 100) / 100;
...
ivaRate: 15,
```

(`state.tsx:3315`, `3327`)

y crea un segundo cargo con ID `chg-${client.id}-${month}-${year}` (`state.tsx:3370`), además del cargo que ya genera `createInvoice`. El resultado es un cargo por factura y otro por cliente/periodo, ambos visibles en CxC.

**Evidencia reproducida.**
- Nota recurrente `inv-1793075432849` / `010-001-000000002`: total **$402.50**.
- Servicio prepago configurado al **0 % de IVA**; la recurrente le aplicó **15 %**.
- CxC mostró **$862.50** emitido contra **$460.00** de saldo del cliente.
- Se crearon **3 servicios duplicados**.
- El cargo recurrente quedó sin `paidAmount` ni `balanceRemaining`, por lo que CxC lo trata como totalmente pendiente.

**Impacto.** Doble cobro al cliente, impuestos incorrectos, saldos inflados y servicios duplicados que luego se vuelven a facturar.

**Corrección esperada.**
- Un solo cargo por factura; clave de idempotencia `clientId + periodKey + serviceId`.
- IVA por línea, tomado del servicio/producto, sin constantes.
- Respetar modalidad (prepago/postpago), día de cobro, anticipo y periodo.
- Saltar servicios con `lastBilledPeriod === periodKey` y no recrear servicios al facturar.

**Evidencia.** `recurrente-generada.png`, `cxc.png`, `cxc-after-payment.png`.

![CxC con cargos duplicados y saldo inflado](evidencias/cxc.png)

---

### CR-03 — Lote con números de documento duplicados y purga cruzada de cargos

**Descripción.** El secuencial se calcula desde el estado de `billingInvoices`:

```ts
const maxSecNota = billingInvoices
  .filter(...)
  .reduce(...);
const secuencial = data.customSecuencial || (Math.max(maxSecNota, startFromNotaVenta) + 1);
```

(`state.tsx:2962-2969`)

En un lote, las llamadas concurrentes leen el mismo snapshot y calculan el mismo máximo. Las tres facturas del lote salieron con **`010-001-000000003`**.

Además, al crear la factura se eliminan cargos que compartan número, sin filtrar por cliente:

```ts
setMonthlyCharges((prev) => [
  newCharge,
  ...prev.filter(
    (c) => c.invoiceId !== newInvoice.id && c.invoiceNumber !== newInvoice.documentNumber
  ),
]);
```

(`state.tsx:3203-3208`)

**Evidencia reproducida.**
- Lote: ARTEAGA $115.00, VALLE $3,128.00, PERUGACHI $287.50; las tres con `010-001-000000003`.
- PERUGACHI quedó con factura pero **sin cargo**.
- Al borrar después la factura de ARTEAGA, se borraron **4 cargos** con ese número, incluidos los de VALLE.

**Impacto.** Comprobantes no únicos (problema legal/contable), cobros perdidos y cargos de un cliente eliminados por operaciones de otro.

**Corrección esperada.**
- Secuencial transaccional en servidor, con bloqueo o contador atómico.
- Restricción única `(establecimiento, puntoEmision, tipoComprobante, secuencial)`.
- Purga de cargos por `invoiceId`, nunca solo por `invoiceNumber`; incluir `clientId`.

**Evidencia.** `recurrentes-after-batch.png`, `delete-003-after2.png`.

---

### CR-04 — El borrado de factura no es atómico y borra datos de otros clientes

**Descripción.** `deleteInvoice` ejecuta múltiples escrituras secuenciales: inventario/kardex, servicios, contador de servicios, factura, cargos y movimientos. No hay transacción ni rollback (`state.tsx:3926-4167`). Si el usuario aborta o falla una escritura, el estado queda a medias.

Los servicios se seleccionan por documento o por ID de factura **sin acotar por cliente**:

```ts
const linkedServices = clientServices.filter(
  (s) => s.saleInvoiceId === inv.id ||
         s.saleDocNumber === inv.documentNumber ||
         s.lastBilledInvoiceId === inv.id
);
```

(`state.tsx:4050-4055`)

Y los cargos se purgan por `invoiceNumber` global (`state.tsx:4132-4140`).

**Evidencia reproducida.**
- Primer intento: el modal giró más de 8 s; se abortó. Los servicios del documento 003 cayeron de **34 a 22** y el total de **45 a 33**, mientras la factura y los cargos seguían intactos.
- Reintento: terminó en ~12 s y eliminó la factura, **los 4 cargos del documento 003** (incluidos los de VALLE) y **22 servicios** repartidos entre ARTEAGA y VALLE.
- Facturas 6 → 5; cargos 7 → 3; saldo de ARTEAGA $115 → $0; saldo de VALLE $3,760 sin cambios.

**Impacto.** Pérdida de servicios y cobros de clientes que no eran objetivo del borrado; estados imposibles de reconciliar.

**Corrección esperada.**
- Una transacción/batch atómico para todas las colecciones.
- Acotar servicios y cargos por `clientId` + `invoiceId`; nunca por número suelto.
- Borrado idempotente, con progreso y opción de reintentar sin duplicar efectos.
- Bloquear el botón y mostrar resultado final, no un spinner infinito.

**Evidencia.** `delete-003-confirm.png`, `delete-003-after2.png`, `del-service-*`.

![Estado tras el borrado cruzado del documento 003](evidencias/delete-003-after2.png)

---

### CR-05 — Borrar una factura pagada descuadra banco contra saldo del cliente

**Descripción.** Al borrar, el sistema reversa los movimientos bancarios por el **monto pagado**:

```ts
const revertedBankBal = Math.max(0, bank.currentBalance - mov.amount);
```

(`state.tsx:4024-4026`)

Pero al cliente le resta solo el **total de la factura**:

```ts
const revertedClientBal = Math.max(0, clientObj.currentBalance - (inv.total || 0));
```

(`state.tsx:4041-4042`)

**Evidencia reproducida.** Factura pagada `010-001-000000001` ($57.50), con pago de $100.00:
- BANCO GUAYAQUIL: $1,200 → **$1,100** (−$100.00).
- Cliente `cli-006`: $260.00 → **$202.50** (−$57.50).
- Diferencia no explicada: **$42.50**.
- Además se purgó `chg-cli-006-10-2026`, que pertenecía a otra factura del mismo cliente/mes.

**Impacto.** El banco y el cliente quedan descuadrados; el excedente desaparece de la contabilidad.

**Corrección esperada.**
- Reversar exactamente los pagos aplicados, no el total.
- Si hubo sobrepago, generar crédito a favor o nota de crédito, no borrar el excedente.
- Recalcular el saldo del cliente desde el ledger, no con restas parciales.
- Impedir borrar facturas pagadas sin un flujo de anulación/nota de crédito.

**Evidencia.** `delete-paid-after.png`.

---

### CR-06 — Borrar un cliente deja facturas y asientos huérfanos

**Descripción.** `deleteClient` solo elimina el cliente y cinco colecciones relacionadas:

```ts
await deleteFromFirestore("clients", id);
setClients(...);
setClientServices(...);
setClientProjects(...);
setClientQuotes(...);
setClientVaultItems(...);
setClientContracts(...);
```

(`state.tsx:1821-1829`)

No toca `billingInvoices`, `monthlyCharges`, `financialMovements`, anticipos ni pagos.

**Evidencia reproducida.** Se eliminó `cli-005` (PERUGACHI) desde la UI:
- Cliente y sus 2 servicios desaparecieron.
- La factura `inv-1793075956112` / `010-001-000000003` / **$287.50** quedó en el sistema.
- CxC mostró $0 y ningún cargo; la factura huérfana siguió existiendo.

**Impacto.** Documentos fiscales/comerciales sin cliente, reportes que no cuadran, imposibilidad de cobrar o anular correctamente.

**Corrección esperada.**
- Bloquear el borrado si existen facturas, cargos, movimientos o anticipos.
- Alternativa: baja lógica (`status: inactivo`) y conservación del histórico.
- Si se permite borrado en cascada, hacerlo transaccional y con confirmación explícita de documentos afectados.

**Evidencia.** `del-client-confirm.png`, `del-client-after.png`, `del-client-cxc.png`.

---

### CR-07 — Borrar un servicio elimina el cargo completo de varios servicios

**Descripción.** La deducción del cargo se hace por texto:

```ts
if (c.serviceDescription && c.serviceDescription.includes(target.planName) &&
    !c.serviceDescription.includes("+")) {
  return true;
}
```

(`state.tsx:1900-1902`)

Si el cargo agrupa varios servicios y la descripción no contiene `"+"`, borrar uno elimina el cargo entero. Si el cliente se queda sin servicios, se eliminan **todos** los cargos pendientes (`state.tsx:1899`).

**Evidencia reproducida.** Se eliminó el servicio duplicado `SOPORTE QA POSTPAGO (Mensual 10/2026)` de `cli-006`:
- Desapareció el cargo **$402.50** `chg-inv-inv-1793075432849`.
- La factura `010-001-000000002` quedó intacta.
- Servicios 7 → 6; `totalActiveServices` 6 → 5; cargos 1 → 0.
- Saldo del cliente: $202.50 (sin ajuste adicional).

**Impacto.** Se pierde el derecho de cobro de servicios que siguen activos; la factura queda sin sustento en CxC.

**Corrección esperada.**
- Relación explícita `charge.items[].serviceId`.
- Al borrar un servicio, recalcular/prorratear el cargo, no inferir por texto.
- Nunca borrar un cargo con pagos aplicados; generar ajuste o nota de crédito.

**Evidencia.** `del-service-before.png`, `del-service-confirm.png`, `del-service-after.png`.

---

## 6. Hallazgos altos

### AL-01 — Elegir un producto sobrescribe la categoría manual del servicio

**Descripción.** `handleSelectProduct` impone la categoría al final:

```ts
} else {
  setNewSvcCategory("internet");
  setNewSvcFreq("mensual");
  ...
}
```

(`ClientContractTab.tsx:375-381`)

No importa que el usuario haya elegido `mantenimiento`, `soporte` u otra categoría: al seleccionar un producto, vuelve a `internet`. El selector sí funciona si se cambia **después** del producto, hasta que se elige otro producto.

**Reproducción.**
1. Cliente → Servicios → Agregar servicio.
2. Elegir categoría `mantenimiento`.
3. Buscar y seleccionar `ARCOTEL` (ítem `SRV-9152` del desplegable, no la pestaña superior).
4. La categoría se revierte a `internet`.

**Impacto.** El usuario percibe el selector como “muerto”; se clasifican mal los servicios y se filtran mal en inventario/reportes.

**Corrección.** No sobrescribir una selección manual; usar la categoría del producto solo como sugerencia y pedir confirmación si difiere.

**Evidencia.** `cat-after-product3.png`, `test-client-category4.js`.

![La categoría vuelve a “internet” tras seleccionar el producto](evidencias/cat-after-product3.png)

---

### AL-02 — IVA inconsistente entre contratación, venta y recurrencia

**Descripción.** En la contratación se toma `prod.ivaRate ?? 15` (`ClientContractTab.tsx:340`). ARCOTEL tiene IVA 0 %, así que el servicio se guarda al 0 %. En la recurrencia se hardcodea 15 % (`state.tsx:3315/3327`). En la nota de venta no-SRI se fuerza 0 % (`EditSaleModal.tsx:166`). Tres criterios distintos para el mismo servicio.

**Evidencia.** Prepago de $100 al 0 % → recurrente de $402.50 con IVA 15 %. La UI muestra `$100.00 c/IVA` sin desglose, lo que impide detectar el problema.

**Impacto.** Facturas con impuesto incorrecto y totales que no coinciden con el contrato.

**Corrección.** Motor único de impuestos; guardar `ivaRate` por línea; mostrar base, IVA y total; prohibir fallbacks silenciosos.

---

### AL-03 — CxC duplicada y saldos inflados por `balanceRemaining` indefinido

**Descripción.** CxC calcula el saldo así:

```ts
const bal = c.balanceRemaining !== undefined ? c.balanceRemaining : c.status === "pagado" ? 0 : c.total;
```

(`FinancialReportsTab.tsx:142`)

y expone `balanceRemaining: c.balanceRemaining !== undefined ? c.balanceRemaining : c.total` (`:154`). Un cargo sin `balanceRemaining` se considera **totalmente pendiente**, aunque tenga pagos. Si además existen dos cargos por la misma factura, se suma dos veces.

**Evidencia.** CxC mostró **$862.50** emitido contra **$460.00** de saldo del cliente. La tabla listó filas duplicadas para la misma nota.

**Impacto.** Cobranza sobre saldos inexistentes; cliente reportado como moroso sin serlo.

**Corrección.** Normalizar cargos (uno por factura), migrar `balanceRemaining` y calcular `total - paidAmount` cuando falte. Deduplicar por `invoiceId`.

---

### AL-04 — Sobrepago sin validación ni crédito a favor

**Descripción.** El pago se topa al total del cargo:

```ts
const newTotalPaid = Math.min(charge.total, currentPaid + payAmount);
```

(`state.tsx:2241`)

pero el banco recibe el monto completo y el saldo del cliente se resta completo:

```ts
const newBal = Math.max(0, clientObj.currentBalance - payAmount);
```

(`state.tsx:2309`)

**Evidencia.** Cargo de $57.50, pago de $100.00:
- Cargo: pagado $57.50.
- Banco: +$100.00.
- Cliente: −$100.00.
- Excedente: **$42.50** sin crédito, sin devolución, sin registro.

**Impacto.** Dinero cobrado que no se refleja en ningún saldo; cliente con saldo menor al real.

**Corrección.** Rechazar pagos mayores al saldo o aplicar el excedente como anticipo/crédito; registrar el remanente en el ledger.

---

### AL-05 — Eliminar un cargo revierte banco y movimiento, pero no el saldo del cliente

**Descripción.** `deleteMonthlyCharge` reversa movimientos y banco (`state.tsx:2383-2402`) y elimina el cargo (`:2404-2405`), pero no actualiza `clients.currentBalance`.

**Evidencia.** Tras borrar un cargo, el banco volvió al saldo anterior y el movimiento desapareció; el saldo del cliente quedó igual.

**Impacto.** El cliente sigue “debiendo” un cargo que ya no existe; CxC y ficha discrepan.

**Corrección.** Recalcular el saldo desde los cargos vigentes o ajustar por `charge.balanceRemaining` dentro de la misma transacción.

---

### AL-06 — Reportes: doble conteo de recaudación y transferencias internas como ingreso/gasto

**Descripción.**

```ts
const totalIngresos = cobranzasMetrics.totalRecaudado + movIngresos;
```

(`FinancialReportsTab.tsx:124`)

Cada cobro genera un movimiento `ingreso` (`state.tsx:2291-2302`), por lo que la misma recaudación se cuenta dos veces: una en `totalRecaudado` y otra en `movIngresos`.

Además, una transferencia interna crea un `ingreso` en el banco destino y un `egreso` en el origen; ambos entran a los totales y a `byCategory` como “Transferencia entre Cuentas” (`FinancialReportsTab.tsx:95-109`).

**Evidencia.** Reporte capturado: Ingresos $1,004.25; Gastos $300.00; Neto $704.25; CxC $7,191.00; Bancos $1,450.00; Facturado $7,348.50; Recaudado $157.50; efectividad 2.1 %. Tras la transferencia de $100: OPEX $400.00 y “Transferencia entre Cuentas 25.0 % $100.00”.

**Impacto.** Estados financieros y KPIs falsos; decisiones de cobranza y gasto basadas en datos inflados.

**Corrección.** Una sola fuente (ledger). Excluir `transferencia_interna` de ingresos/gastos y mostrarla como movimiento neutro. Conciliar `Facturado` contra `Recaudado`.

---

### AL-07 — Gráfico y totales con datos hardcodeados/fallback

**Descripción.**

```ts
const months = ["May", "Jun", "Jul", "Ago", "Sep", "Oct"];
const baseIngresos = [180, 210, 240, 310, 480, flujoMetrics.totalIngresos || 704.25];
const baseEgresos = [90, 120, 150, 190, 280, flujoMetrics.totalEgresos || 300];
```

(`FinancialReportsTab.tsx:210-226`)

Los cinco primeros meses son constantes; el último usa un fallback fijo si el total es 0. No hay consulta histórica real.

**Impacto.** El dashboard muestra una tendencia inventada; el usuario cree que hay histórico.

**Corrección.** Agregar por mes desde movimientos/facturas; estado vacío explícito; eliminar constantes.

---

### AL-08 — Saldos iniciales sin movimiento y movimientos con banco inválido

**Descripción.** `addBankAccount` crea la cuenta con su saldo, pero no registra movimiento de apertura:

```ts
const newAccount = { ...account, id };
setBankAccounts((prev) => [...prev, newAccount]);
await syncToFirestore("bankAccounts", id, newAccount);
```

(`state.tsx:4870-4876`)

Los movimientos guardan el nombre del banco al momento de crearse (`MovementsTab.tsx:197`); si la cuenta se renombra, el movimiento conserva el nombre viejo. Si se elimina, queda un ID sin cuenta.

**Evidencia.**
- BANCO QA AUDITORIA nació con $250.00 y **sin movimiento de apertura**.
- Movimientos de `Banco Pichincha` siguen apuntando a `bank-pichincha-01`, hoy renombrado `Bco Prueba`.
- Algunos movimientos tienen `bankAccountName` vacío.
- BANCO GUAYAQUIL: saldo inicial $5,000.00 vs. actual $1,000.00, sin asiento de apertura que explique la diferencia.

**Impacto.** Imposible auditar la evolución del efectivo; reportes de banco no reconciliables.

**Corrección.** Movimiento `saldo_inicial` al crear; resolver el nombre por `bankAccountId` en render; migrar nombres/IDs huérfanos.

---

### AL-09 — Impresión no-SRI: totales inconsistentes y campos irrelevantes

**Descripción.** La columna “Precio Total” imprime `item.subtotal` (base sin IVA):

```tsx
<th>Precio Total</th>
...
<td>${safeNumber(item.subtotal)}</td>
```

(`RidePreviewModal.tsx:746`, `:776`)

mientras el pie imprime `total` con IVA (`:1050`). En la nota de venta no-SRI, la cabecera de ítems muestra **$50.00** y el “VALOR TOTAL” **$57.50**. En el ticket ocurre lo mismo con “TOTAL”. Además, una nota solo de servicios imprime “Bodega de Despacho: Bodega Central - Quito (NOC)” y “Guía de Remisión: S/N” (`:670`, `:910`).

**Impacto.** El cliente recibe un documento que parece tener un total distinto al cobrado; se imprimen datos logísticos que no aplican a servicios.

**Corrección.** Renombrar la columna a “Subtotal” o imprimir `unitPrice × quantity + IVA`; unificar la etiqueta “TOTAL” con el valor final; ocultar bodega/guía cuando todos los ítems son servicios.

**Evidencia.** `ride-a4.png`, `ride-ticket.png`.

![A4: “Precio Total” muestra la base y “VALOR TOTAL” el total con IVA](evidencias/ride-a4.png)

---

### AL-10 — “Facturar Lote” se cuelga y re-factura servicios ya facturados

**Descripción.** La elegibilidad se decide con:

```ts
const alreadyBilledInPeriod =
  ...
  billableServices.every((s) => s.lastBilledPeriod === periodKey);
```

(`RecurringBillingView.tsx:126-128`)

Si **un solo** servicio del cliente no está marcado, se vuelve a facturar todo el cliente. El lote no bloquea el botón ni espera de forma controlada; la UI queda en “Emitiendo…” (`:472`).

**Evidencia.**
- Lote de 3 clientes: después de 15 s la UI seguía en “Emitiendo…”.
- VALLE tenía 32 servicios; 16 ya estaban en `lastBilledPeriod: "2026-10"`. El lote los volvió a facturar y acumuló sufijos `(Mensual 10/2026)`.
- Un servicio duplicado de ARTEAGA quedó sin `lastBilledPeriod`.

**Impacto.** Doble facturación del mismo periodo, nombres de servicio contaminados y operación que parece colgada.

**Corrección.** Bloqueo por cliente+periodo, idempotencia por servicio, `await` con progreso y límite de tiempo; no re-facturar servicios ya marcados.

---

## 7. Hallazgos medios

### ME-01 — `totalActiveServices` inconsistente

Al crear el cliente se fija en 1 si viene con servicio (`state.tsx:1735`), pero los servicios heredados no se cuentan; al agregar servicios se recalcula dentro de `setClientServices` (`:1858-1861`). En la prueba, la ficha mostró 0 servicios activos teniendo servicios. **Corrección:** derivar el contador de la colección, no almacenarlo.

### ME-02 — Servicios heredados muestran día de cobro/anticipo incorrectos

La ficha imprime `Cobro: Día 1` y `Anticipo: Día 26` en lugar del `cutoffDay` configurado (`ClientContractTab.tsx:1574-1575`). Los servicios creados a mano sí respetan el día; los heredados no. **Corrección:** usar el campo persistido y un fallback explícito, no constantes de UI.

### ME-03 — Venta inicia en “Consumidor Final” y el encabezado no se actualiza

El selector arranca en consumidor final y, tras elegir un cliente, el encabezado sigue mostrando el anterior (`NewSaleView.tsx:556-575`). El usuario puede emitir la nota al cliente equivocado. **Corrección:** estado inicial vacío obligatorio y encabezado derivado del cliente seleccionado.

### ME-04 — Productos a $0.00 y confirmación de inventario engañosa

Los 4 productos de inventario tienen `salePrice: 0`. La venta agrega líneas a $0.00 y la confirmación dice que se está “descontando el inventario” (`NewSaleView.tsx:1236`), aunque los productos sean servicios o no tengan stock. **Corrección:** validar precio > 0, distinguir servicio de producto y ajustar el mensaje.

### ME-05 — CxC sin acción de eliminar en la tabla

`AccountsReceivableTab.tsx` solo importa `CheckCircle`, `Clock`, `DollarSign`, `X` y no expone `delete`/`onDelete`. El borrado de un cargo vive en `FinanceDashboard` (~415), fuera de la tabla de CxC. **Corrección:** acción explícita con permisos, confirmación y motivo, o eliminar la duplicidad de acciones.

### ME-06 — Modal de borrado lento, sin progreso y no idempotente

El modal de `ClientProfile360.tsx:910-954` solo muestra “Eliminando…”. En la práctica tardó >8 s y un reintento ~12 s; abortar dejó servicios borrados y la factura intacta (ver CR-04). **Corrección:** barra/progreso por etapa, timeout, botón cancelar real y operación idempotente.

### ME-07 — Deep links de clientes no confiables

`src/app/clientes/page.tsx:49-58` lee `id` de la URL en un efecto que no depende de `clients`. Si los clientes hidratan después del primer render, `/clientes?id=cli-006` no abre la ficha. **Corrección:** incluir `clients` en dependencias, resolver contra el estado hidratado y mostrar estado de carga/404.

### ME-08 — Inventario muestra categorías vacías

El filtro lista `SERVICIOS`, `OLTS`, `Conectividad & Herrajes`, `Fibra Óptica & Pasivos` y `Equipos de Red & ONTs` (`InventoryManager.tsx:294-311`), pero solo hay 4 productos y varias categorías no tienen ítems. La tabla de servicios (`:1024-1052`) repite categorías sin resultados. **Corrección:** contar ítems por categoría y ocultar/deshabilitar las vacías, o mostrar un estado vacío claro.

### ME-09 — Accesibilidad del modal de impresión

El botón de cierre es solo un icono, sin `aria-label` ni texto visible. Afecta lectores de pantalla y navegación por teclado. **Corrección:** `aria-label="Cerrar"`, foco inicial y cierre con `Esc`.

---

## 8. Hallazgos bajos

### BA-01 — Formato monetario inconsistente

La impresión muestra `$50.00` en la tabla y `$57.50` en el total; CxC y reportes mezclan enteros y decimales, y algunos importes no usan separador de miles. **Corrección:** un formateador único (`Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" })`).

### BA-02 — Nombres de categorías inconsistentes

`SERVICIOS` está en mayúsculas; `OLTS` no describe el rubro; `Conectividad & Herrajes` y `Equipos de Red & ONTs` mezclan niveles. **Corrección:** catálogo único, con código y etiqueta.

### BA-03 — Ruido de consola CSP/GTM

La consola muestra errores de CSP de Google Tag Manager/gtag. No afecta la lógica evaluada, pero ensucia el diagnóstico y puede ocultar errores reales. **Corrección:** ajustar `Content-Security-Policy` o retirar el tag en QA.

### BA-04 — La advertencia de borrado de cliente omite facturas y cobros

El modal advierte por servicios, proyectos, credenciales y contratos (`ClientProfile360.tsx:918-922`), pero no menciona facturas, cargos, movimientos ni anticipos, que quedan huérfanos (CR-06). **Corrección:** listar el impacto real y exigir confirmación adicional si hay documentos.

---

## 9. Flujos que sí funcionaron

Para evitar un informe sesgado, se registran los flujos que se comportaron correctamente en el alcance probado:

- Inicio de sesión y persistencia de sesión con el usuario administrador.
- Alta, edición y búsqueda básica de clientes; apertura de ficha por clic en fila.
- Alta manual de servicios prepago y postpago, con precio, IVA y día de cobro.
- Selección manual de categoría de servicio (cuando se hace después de elegir el producto y no se cambia de producto).
- Venta no-SRI a crédito: creación de nota, cargo y servicio vendido.
- Cobro parcial: actualización de cargo, banco y saldo del cliente.
- Creación de banco y transferencia interna de $100.00: saldos y dos movimientos con la misma referencia.
- Impresión A4 y ticket: render, logo, datos del cliente y CSS de impresión.
- Filtro de categorías en inventario y listado de los 4 productos.
- Render de reportes y gráfico (aunque los datos sean incorrectos, la UI no falla).
- Borrado de factura y de cliente “completa” desde la UI (con los defectos de integridad descritos).

---

## 10. Integridad de datos: pruebas antes/después

| Prueba | Antes | Después | Hallazgo |
|---|---|---|---|
| Lote de 3 facturas | 3 clientes pendientes | 3 facturas con el mismo número `003`; PERUGACHI sin cargo | CR-03 |
| Borrado factura 003 (primer intento abortado) | 34 servicios doc-003; 45 totales | 22 servicios doc-003; 33 totales; factura y cargos intactos | CR-04 |
| Borrado factura 003 (reintento) | 6 facturas; 7 cargos | 5 facturas; 3 cargos; 22 servicios y 4 cargos borrados en 2 clientes | CR-04 |
| Borrado factura pagada 001 | Banco $1,200; cliente $260 | Banco $1,100; cliente $202.50; cargo de otro mes purgado | CR-05 |
| Borrado servicio duplicado | 7 servicios; 1 cargo $402.50 | 6 servicios; 0 cargos; factura 002 intacta | CR-07 |
| Borrado cliente `cli-005` | Cliente + 2 servicios + factura $287.50 | Cliente y servicios fuera; factura huérfana permanece | CR-06 |
| Transferencia QA | GUAYAQUIL $1,100; QA $250 | GUAYAQUIL $1,000; QA $350; 2 movimientos `TRF-QA-001` | Flujo correcto |
| Estado final | — | 5 clientes; 4 facturas; 0 cargos; 12 servicios; bancos $1,350 | Conteo de referencia |

### 10.1 Trazabilidad de los importes más relevantes

| Concepto | Importe | Observación |
|---|---:|---|
| Venta no-SRI 001 | $57.50 | $50.00 base + $7.50 IVA |
| Recurrente 002 | $402.50 | IVA 15 % aplicado a servicios al 0 % |
| CxC duplicada | $862.50 | Contra $460.00 de saldo del cliente |
| Pago parcial | $100.00 | Cargo de $57.50; excedente $42.50 |
| Transferencia | $100.00 | Movimiento neutro contabilizado como ingreso y OPEX |
| Factura huérfana PERUGACHI | $287.50 | Cliente eliminado; factura permanece |
| Saldo final bancos | $1,350.00 | GUAYAQUIL $1,000 + QA $350 |

---

## 11. Plan de remediación priorizado

### P0 — Antes de cualquier uso productivo

1. **Identidad y aislamiento**
   - UUID/Firestore ID para clientes, servicios, facturas y cargos.
   - Índice único de identificación fiscal.
   - Migración de IDs existentes y detección de duplicados.

2. **Facturación idempotente**
   - Un cargo por factura; clave `clientId + periodKey + serviceId`.
   - IVA por línea, sin constantes.
   - Respetar prepago/postpago, día de cobro, anticipo y vigencia.
   - Bloqueo de periodo y secuencial transaccional en servidor.

3. **Borrados transaccionales**
   - Factura, cliente, servicio y cargo en una sola transacción.
   - Acotar siempre por `clientId` + `invoiceId`.
   - Prohibir borrar facturas pagadas; usar anulación/nota de crédito.
   - Progreso, timeout e idempotencia en la UI.

4. **Ledger único**
   - Saldos de cliente y banco derivados de movimientos, no de restas ad hoc.
   - Reversión exacta de pagos; crédito a favor para excedentes.
   - Excluir transferencias internas de ingresos/gastos.

5. **CxC y reportes**
   - Deduplicar cargos; migrar `balanceRemaining`.
   - Eliminar doble conteo `totalRecaudado + movIngresos`.
   - Gráficos y totales desde datos reales; sin fallback.
   - Conciliación Facturado vs. Recaudado vs. Bancos.

6. **Impresión no-SRI**
   - Unificar “Total” con el valor final; renombrar subtotal.
   - Ocultar bodega/guía en notas de servicios.
   - Pruebas de regresión A4/ticket con IVA 0 % y 15 %.

### P1 — Siguiente iteración

- Categoría de servicio: no sobrescribir selección manual; sugerencia explícita.
- Día de cobro/anticipo en servicios heredados.
- Venta: cliente vacío por defecto, encabezado reactivo, precio > 0.
- Lote: progreso, bloqueo y no re-facturar.
- Bancos: asiento de apertura y nombre resuelto por ID.
- CxC: acción de borrado controlada o eliminación de la duplicidad.
- Deep links de clientes.
- Inventario: categorías vacías y conteos.
- Accesibilidad del modal de impresión.

### P2 — Calidad y consistencia

- Formato monetario único.
- Catálogo de categorías.
- CSP/GTM en QA.
- Mensajes de confirmación con consecuencias completas.

### Criterios de aceptación sugeridos

- Crear 100 clientes con IDs únicos; borrar 10 y crear 10 más sin reutilizar IDs.
- Facturar dos veces el mismo periodo: la segunda operación debe ser 0 o idempotente.
- Facturar un lote de 10 clientes: 10 números únicos y 10 cargos, ninguno de otro cliente.
- Borrar una factura pagada: banco y cliente deben variar exactamente el mismo importe; el excedente debe quedar como crédito.
- Borrar un servicio de un cargo múltiple: el cargo debe recalcularse, no desaparecer.
- Borrar un cliente con documentos: debe bloquearse o dejar traza explícita; cero huérfanos.
- Reporte: `Facturado - Recaudado = CxC` y `Bancos = ledger`; transferencias internas no alteran ingreso/gasto.
- Impresión: suma de líneas + IVA = “VALOR TOTAL” en A4 y ticket.

---

## 12. Anexos

### 12.1 Índice de evidencias visuales

| Archivo | Qué muestra |
|---|---|
| `evidencias/final-clientes.png` | Listado final de clientes |
| `evidencias/final-cliente-006.png` | Ficha de PRUEBA CLIENTE |
| `evidencias/ficha-servicios.png` | Servicios y configuración heredada |
| `evidencias/qa-servicio-prepago.png` | Servicio prepago $100 / IVA 0 % |
| `evidencias/qa-servicio-postpago.png` | Servicio postpago $50 + IVA 15 % |
| `evidencias/cat-after-product3.png` | Categoría revertida a `internet` tras elegir producto |
| `evidencias/venta-nueva.png` | Venta con “Consumidor Final” |
| `evidencias/venta-credito-confirmado.png` | Nota de venta no-SRI creada |
| `evidencias/recurrente-generada.png` | Recurrente $402.50 y duplicados |
| `evidencias/recurrentes-before-batch.png` | Estado previo al lote |
| `evidencias/recurrentes-after-batch.png` | Lote con números repetidos |
| `evidencias/cxc.png` | CxC duplicada |
| `evidencias/cxc-payment-modal.png` | Cobro parcial |
| `evidencias/cxc-after-overpay.png` | Sobrepago aplicado |
| `evidencias/delete-003-confirm.png` | Confirmación de borrado |
| `evidencias/delete-003-after2.png` | Estado tras borrado cruzado |
| `evidencias/delete-paid-after.png` | Descuadre tras borrar factura pagada |
| `evidencias/del-service-before.png` | Servicio antes de borrar |
| `evidencias/del-service-confirm.png` | Confirmación de borrado de servicio |
| `evidencias/del-service-after.png` | Cargo eliminado con la factura intacta |
| `evidencias/del-client-confirm.png` | Confirmación de borrado de cliente |
| `evidencias/del-client-after.png` | Cliente eliminado |
| `evidencias/del-client-cxc.png` | CxC sin el cliente, factura huérfana |
| `evidencias/bancos-before.png` | Bancos antes de crear |
| `evidencias/bancos-form.png` | Formulario de banco |
| `evidencias/bancos-after-create.png` | Banco creado con $250 |
| `evidencias/transfer-before.png` | Saldos antes de transferir |
| `evidencias/transfer-filled.png` | Transferencia $100 |
| `evidencias/transfer-after.png` | Saldos después |
| `evidencias/transfer-movimientos.png` | Dos movimientos `TRF-QA-001` |
| `evidencias/ride-a4.png` | Impresión A4 |
| `evidencias/ride-ticket.png` | Ticket |
| `evidencias/final-reportes.png` | Reportes con totales inconsistentes |
| `evidencias/reportes.png` | Reportes antes de la transferencia |
| `evidencias/fin-movimientos.png` | Movimientos con banco stale |
| `evidencias/final-bancos.png` | Bancos finales |
| `evidencias/final-cxc.png` | CxC final |
| `evidencias/final-ventas.png` | Ventas finales |
| `evidencias/cliente-detalle.png` | Detalle de cliente |
| `evidencias/assign-service-modal-final.png` | Modal de asignación de servicio |

### 12.2 Índice de evidencia en código

| Archivo:línea | Qué demuestra |
|---|---|
| `src/lib/state.tsx:1720` | ID de cliente por longitud |
| `src/lib/state.tsx:1821-1829` | `deleteClient` sin cascada contable |
| `src/lib/state.tsx:1882-1913` | Borrado de servicio por texto; cargo completo |
| `src/lib/state.tsx:2239-2313` | Pago topado en cargo pero debitado completo al cliente |
| `src/lib/state.tsx:2351-2411` | Borrado de cargo sin ajuste de saldo |
| `src/lib/state.tsx:2946-2982` | Secuencial calculado desde estado |
| `src/lib/state.tsx:3203-3208` | Purga de cargos por `invoiceNumber` global |
| `src/lib/state.tsx:3296-3411` | Recurrencia: servicios, IVA fijo, cargo duplicado |
| `src/lib/state.tsx:3926-4167` | Borrado de factura no atómico y cruzado |
| `src/lib/state.tsx:4024-4042` | Reversión banco vs. total de factura |
| `src/lib/state.tsx:4870-4876` | Alta de banco sin movimiento de apertura |
| `src/components/modules/clients/ClientContractTab.tsx:328-382` | Producto sobrescribe categoría/IVA |
| `src/components/modules/clients/ClientContractTab.tsx:1574-1575` | Día de cobro/anticipo fijos |
| `src/components/modules/finance/FinancialReportsTab.tsx:95-126` | Doble conteo y transferencias |
| `src/components/modules/finance/FinancialReportsTab.tsx:210-226` | Gráfico hardcodeado/fallback |
| `src/components/modules/billing/RecurringBillingView.tsx:126-128` | Chequeo de periodo por “todos” |
| `src/components/modules/billing/RidePreviewModal.tsx:746/776/1050` | Subtotal vs. total en impresión |
| `src/components/modules/billing/NewSaleView.tsx:556-575` | Cliente por defecto/encabezado |
| `src/components/modules/inventory/InventoryManager.tsx:294-311` | Categorías vacías |
| `src/app/clientes/page.tsx:49-58` | Deep link sin dependencia de `clients` |

### 12.3 Scripts de reproducción

En `C:\Users\WEB FIX\AppData\Local\Temp\opencode\qa\`:

- `test-client-category4.js` — categoría sobrescrita.
- `add-two-services.js` — alta prepago/postpago.
- `sale-credit.js` — venta no-SRI a crédito.
- `recurring-single.js` — emisión recurrente.
- `batch-test.js` — lote y numeración.
- `cxc-pay-partial.js` / `cxc-overpay.js` — cobro parcial y sobrepago.
- `test-delete-duplicate-invoice*.js` — borrado de factura 003.
- `test-delete-paid-invoice.js` — borrado de factura pagada.
- `test-delete-service.js` — borrado de servicio.
- `test-delete-client.js` — borrado de cliente.
- `test-bank-transfer.js` — transferencia.
- `print-invoice.js` — A4/ticket.
- `final-captures.js` — capturas finales.

### 12.4 Glosario

- **CxC:** cuentas por cobrar.
- **CxP:** cuentas por pagar.
- **Cargo / cobro:** obligación mensual del cliente, con o sin factura.
- **Nota de venta no-SRI:** documento comercial interno sin autorización SRI.
- **Snapshot:** copia del estado en `localStorage` antes/después de una operación.
- **Idempotencia:** repetir una operación sin duplicar su efecto.

---

**Conclusión.** INNTEL CORP tiene una interfaz amplia y varios flujos operativos completos, pero la capa de datos no garantiza unicidad, aislamiento ni atomicidad. Mientras no se corrijan los siete hallazgos críticos, el sistema no debe usarse para facturar, cobrar ni reportar en producción: los saldos y documentos que muestra no son confiables.
