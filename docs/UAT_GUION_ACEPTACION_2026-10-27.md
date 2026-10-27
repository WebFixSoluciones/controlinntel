# Guion de Aceptación de Usuario (UAT) — Control INNTEL

| Campo | Valor |
|---|---|
| **Documento** | Guion de pruebas de aceptación de usuario |
| **Versión del sistema** | Commit `dd8d4c5` (cierre del plan R01–R27) |
| **Fecha de emisión** | 27 de octubre de 2026 |
| **Casos cubiertos** | T03, T39, T40, T41, T42, T43, T47, T49 |
| **Ejecuta** | Responsable de Finanzas (con acompañamiento de TI) |
| **Duración estimada** | 90–120 minutos |
| **Naturaleza** | Verificación en navegador real. No sustituye a las 107 pruebas automatizadas, las complementa |

---

## 1. Para qué sirve este documento

Las 107 pruebas automatizadas y la revisión de código del informe de cierre verifican la lógica, pero **no pueden comprobar** lo que ocurre en un navegador real: cómo se comporta la impresión en papel, si Excel abre bien un archivo, si el teclado permite operar sin ratón, o si el sistema anuncia correctamente el cliente de un borrador recuperado.

Este guion cubre exactamente esos siete casos. Al firmarlo, Finanzas acepta formalmente el flujo comercial y se cumple la **condición 5** de habilitación del informe de cierre.

> **Regla de oro:** si un paso no produce el resultado esperado, **no se corrige sobre la marcha**. Se registra como defecto con su número y se continúa con el siguiente caso. Un caso con defecto no bloquea los demás.

---

## 2. Requisitos previos (verificar antes de empezar)

| # | Requisito | Cómo comprobarlo | ☐ |
|---|---|---|---|
| 1 | **Credenciales de servidor configuradas** (`FIREBASE_SERVICE_ACCOUNT_JSON` y `VAULT_KEY_BASE64`) | Si faltan, **nada se guarda** y la UAT no es válida. TI debe confirmarlo antes de la sesión | ☐ |
| 2 | Usuario con rol **superadmin** o **finanzas** activo | Iniciar sesión y ver el menú completo | ☐ |
| 3 | **Copia de respaldo** de la base tomada antes de la sesión | TI confirma que existe y es restaurable | ☐ |
| 4 | **Entorno de pruebas**, no producción | La URL no debe ser el dominio productivo | ☐ |
| 5 | Impresora o "Guardar como PDF" disponible | Probar Ctrl+P en cualquier página | ☐ |
| 6 | Microsoft Excel o LibreOffice instalado | Para abrir los archivos exportados | ☐ |
| 7 | Navegador actualizado (Chrome o Edge) | Versión de los últimos 6 meses | ☐ |

**Datos mínimos que deben existir** (crearlos en el paso 3 si no están):

- Dos clientes activos con RUC válido: **CLIENTE UAT A** y **CLIENTE UAT B**.
- Un servicio del catálogo con **IVA 15 %** y otro con **IVA 0 %**.
- Un producto físico con **stock ≥ 10** y precio > 0.
- Una cuenta bancaria activa con saldo inicial > 0.

---

## 3. Preparación de datos (10 minutos)

Ejecutar en este orden y no continuar si algo falla.

| Paso | Acción | Resultado esperado | ☐ |
|---|---|---|---|
| 3.1 | Ir a **Clientes** → botón de alta → crear **CLIENTE UAT A** con RUC válido | Aparece en el directorio | ☐ |
| 3.2 | Repetir para **CLIENTE UAT B** | Dos clientes visibles | ☐ |
| 3.3 | Abrir ficha de **CLIENTE UAT A** → pestaña **Servicios** → **Agregar Servicio** → asignar el servicio con IVA 15 % | Se muestra el aviso **"Servicio Asignado y Facturado"** con el número de nota y su fecha. El servicio aparece en la tabla | ☐ |
| 3.4 | Ir a **Ventas** → **Generar Venta** → emitir una nota a **CLIENTE UAT A** con el producto físico, cantidad 1 | Documento emitido con número visible | ☐ |

> **Cambio funcional del 27/10 (R28):** asignar un servicio **emite de inmediato su nota de venta**, fechada según el ciclo configurado en el propio formulario (modalidad, día de cobro y anticipo). El caso **T49** verifica ese comportamiento en detalle.

> **Registrar los datos creados** para poder trazarlos al final:

| Dato | Valor |
|---|---|
| ID de CLIENTE UAT A | |
| Número del documento emitido | |
| Usuario que ejecuta la prueba | |

---

## 4. Cómo registrar el resultado

Para cada caso anotar:

- **Resultado:** `Conforme` / `No conforme` / `Bloqueado` (no se pudo ejecutar).
- **Evidencia:** captura de pantalla o archivo, nombrado `Txx-01`, `Txx-02`…
- **Observaciones:** qué difirió exactamente del resultado esperado.

Al final del documento hay una tabla resumen y un bloque de firmas.

---

# CASOS DE PRUEBA

## T03 — La categoría del servicio proviene del catálogo y no se pierde

| Campo | Detalle |
|---|---|
| **Cubre** | R05 (catálogo y categorías) · hallazgo AL-01 de la auditoría |
| **Riesgo** | Que al elegir un artículo la categoría cambie sola y el servicio quede mal clasificado en filtros y reportes |
| **Precondición** | Existen al menos dos servicios de catálogo con **categorías distintas** (p. ej. "Internet" y "Mantenimiento") |

### Pasos

| # | Acción | Resultado esperado | ☐ |
|---|---|---|---|
| 1 | **Clientes** → ficha de **CLIENTE UAT A** → pestaña **Servicios** → **Agregar Servicio** | Se abre el formulario de asignación | ☐ |
| 2 | Buscar y seleccionar el servicio de categoría **Internet** | Se muestra la ficha resumen del artículo y, en el bloque **Ciclo de Facturación y Vigencia**, el campo **Categoría de Catálogo** con el valor **Internet** | ☐ |
| 3 | Sin guardar, cambiar la búsqueda y seleccionar el servicio de categoría **Mantenimiento** | La **Categoría de Catálogo** pasa a **Mantenimiento**. **No** vuelve a "Internet" por sí sola | ☐ |
| 4 | Completar **Modalidad** (PREPAGO o POSTPAGO), día de facturación y guardar | Se guarda sin error y el servicio aparece en la tabla | ☐ |
| 5 | Recargar la página (F5) y volver a abrir la ficha | El servicio conserva la categoría **Mantenimiento** | ☐ |

### Criterio de aceptación

La categoría mostrada y guardada corresponde **siempre al catálogo del artículo seleccionado**, sin inferencia por nombre ni reversión automática.

> **Nota de diseño:** el selector manual de categoría se retiró por decisión del plan R05 ("no sobrescribir una selección manual; usar la categoría del producto"). Por eso este caso ya **no** prueba "conservar una selección manual", sino "la categoría correcta del catálogo se respeta y persiste".

**Resultado:** ☐ Conforme ☐ No conforme ☐ Bloqueado
**Evidencia:** ______________________ **Observaciones:** ______________________

---

## T39 — El enlace directo a una ficha de cliente funciona con carga lenta

| Campo | Detalle |
|---|---|
| **Cubre** | R24 (navegación) · hallazgo ME-07 |
| **Riesgo** | Que al compartir el enlace de un cliente se abra la lista vacía o un cliente equivocado |

### Pasos

| # | Acción | Resultado esperado | ☐ |
|---|---|---|---|
| 1 | Abrir la ficha de **CLIENTE UAT A** desde el directorio | Se abre la ficha con el nombre correcto | ☐ |
| 2 | Copiar la URL completa de la barra de direcciones (contiene `?id=…`) | La URL incluye el identificador | ☐ |
| 3 | Abrir una **ventana nueva**, pegar la URL y pulsar Enter | Se abre **directamente la ficha de CLIENTE UAT A**, no la lista | ☐ |
| 4 | Repetir con **recarga forzada** (Ctrl+Shift+R) sobre esa URL | La ficha se abre igualmente tras la recarga completa | ☐ |
| 5 | Con la ficha abierta, ir a la pestaña **Servicios** y **Agregar Servicio**; guardar | La ficha **no se cierra** ni vuelve al directorio después de guardar | ☐ |
| 6 | Cambiar la URL a un id inexistente (`?id=no-existe-123`) y recargar | La aplicación no se rompe: mantiene la lista o muestra estado vacío, sin ficha fantasma | ☐ |

### Criterio de aceptación

El enlace profundo abre la ficha correcta aun cuando los datos tarden en cargar, y **guardar un servicio no expulsa al usuario de la ficha**.

**Resultado:** ☐ Conforme ☐ No conforme ☐ Bloqueado
**Evidencia:** ______________________ **Observaciones:** ______________________

---

## T40 — El borrador restaurado anuncia el cliente y los ítems correctos

| Campo | Detalle |
|---|---|
| **Cubre** | R24 (borradores) · hallazgo ME-03 |
| **Riesgo** | Que se restaure una venta de **otro cliente** sin avisar y el documento se emita a quien no corresponde |

### Pasos

| # | Acción | Resultado esperado | ☐ |
|---|---|---|---|
| 1 | Ir a **Ventas** → **Generar Venta** → seleccionar **CLIENTE UAT A** y agregar **2 ítems** | Carrito con 2 líneas y cliente visible | ☐ |
| 2 | **No guardar**. Navegar a otra pantalla (p. ej. **Clientes**) | Se sale de la venta | ☐ |
| 3 | Volver a **Generar Venta** | Aparece el aviso **"Borrador automático recuperado"**, indicando **el nombre de CLIENTE UAT A** y **2 ítems**, con la hora de guardado | ☐ |
| 4 | Verificar que el cliente y el carrito coinciden con lo abandonado | Coinciden exactamente | ☐ |
| 5 | **Cerrar/descartar** el borrador y abrir una venta nueva | La venta arranca **sin cliente seleccionado** (no arrastra el anterior) | ☐ |
| 6 | Seleccionar **CLIENTE UAT B** y comprobar el encabezado | El encabezado muestra **CLIENTE UAT B**, no el anterior | ☐ |

### Criterio de aceptación

Un borrador restaurado **anuncia siempre cliente e ítems**; una venta nueva no hereda el cliente previo; el cliente mostrado coincide con el que se guardará.

**Resultado:** ☐ Conforme ☐ No conforme ☐ Bloqueado
**Evidencia:** ______________________ **Observaciones:** ______________________

---

## T41 — Impresión A4 y ticket: subtotal, IVA y total cuadran

| Campo | Detalle |
|---|---|
| **Cubre** | R22 (impresión) · hallazgo AL-09 |
| **Riesgo** | Que el cliente reciba un documento con un total distinto al cobrado |
| **Precondición** | Una nota emitida con **al menos 3 líneas** y **dos tasas distintas** (IVA 15 % e IVA 0 %) |

### Pasos

| # | Acción | Resultado esperado | ☐ |
|---|---|---|---|
| 1 | Emitir la nota descrita y abrir la vista previa de impresión | Se abre el documento | ☐ |
| 2 | Verificar la columna de importes de línea | Se titula **"Subtotal sin IVA"** y muestra la base de cada línea | ☐ |
| 3 | Sumar a mano: suma de líneas + IVA mostrado | El resultado es **exactamente igual** al **VALOR TOTAL** | ☐ |
| 4 | Comprobar el desglose por tasa | Se muestran las bases y los impuestos separados por tasa, sin mezclarlos | ☐ |
| 5 | Cambiar a formato **Ticket** (80 mm) y repetir la comprobación del total | El **TOTAL** del ticket coincide con el de A4 | ☐ |
| 6 | Imprimir o guardar como PDF en ambos formatos | No hay cortes de página ni columnas truncadas | ☐ |
| 7 | Revisar los datos logísticos | Si la nota **solo contiene servicios**, **no** aparece "Bodega de Despacho" ni "Guía de Remisión" | ☐ |
| 8 | Volver a imprimir el mismo documento | Los importes **no cambian** tras reimprimir | ☐ |

### Criterio de aceptación

Suma de líneas + impuestos = total, en A4 y en ticket; los campos logísticos aparecen solo cuando aplican.

**Resultado:** ☐ Conforme ☐ No conforme ☐ Bloqueado
**Evidencia:** ______________________ **Observaciones:** ______________________

---

## T42 — Exportación: el archivo abre bien y respeta filtros y acentos

| Campo | Detalle |
|---|---|
| **Cubre** | R22 (exportación) · hallazgo BA-01 |
| **Riesgo** | Que Excel destruya tildes o convierta identificaciones en notación científica, inutilizando el archivo |
| **Precondición** | Al menos un cliente con **tildes o eñes** en la razón social y un **RUC de 13 dígitos** |

### Pasos

| # | Acción | Resultado esperado | ☐ |
|---|---|---|---|
| 1 | **Finanzas** → aplicar un **filtro de fechas** que deje pocos registros | La tabla muestra solo lo filtrado | ☐ |
| 2 | Pulsar **Exportar Excel** | Se descarga un archivo `.xlsx` (no `.csv` renombrado) | ☐ |
| 3 | Abrir el archivo en Excel | Abre sin advertencias de formato | ☐ |
| 4 | Comprobar un cliente con tilde o eñe | El texto se ve **correcto**, sin símbolos raros | ☐ |
| 5 | Comprobar una columna de RUC o cédula | Se muestra el número **completo de 13 dígitos**, sin notación científica ni ceros perdidos | ☐ |
| 6 | Comparar las filas del archivo con el filtro aplicado | **Coinciden exactamente** en número y contenido | ☐ |
| 7 | Repetir desde el **Centro de Reportes** exportando en el formato alternativo disponible | También abre correctamente y cuadra con el detalle en pantalla | ☐ |
| 8 | Exportar **sin registros** (filtro que no devuelva nada) | Mensaje claro de "sin registros"; **no** se descarga un archivo vacío engañoso | ☐ |

### Criterio de aceptación

El archivo se abre sin corrupción, conserva acentos e identificaciones completas y contiene exactamente el subconjunto filtrado.

**Resultado:** ☐ Conforme ☐ No conforme ☐ Bloqueado
**Evidencia:** ______________________ **Observaciones:** ______________________

---

## T43 — El correo nunca simula una entrega exitosa

| Campo | Detalle |
|---|---|
| **Cubre** | R21 (correo y notificaciones) · hallazgo QA-12 |
| **Riesgo** | Que el sistema muestre "Enviado" cuando el proveedor de correo no recibió nada |

### Variante A — Sin proveedor de correo configurado (estado actual esperado)

| # | Acción | Resultado esperado | ☐ |
|---|---|---|---|
| 1 | Emitir una nota a **CLIENTE UAT A** con correo registrado | Documento emitido | ☐ |
| 2 | En el bloque **Notificación por Correo Electrónico**, pulsar **Reenviar al Cliente** | Aparece el estado **"Enviando…"** brevemente | ☐ |
| 3 | Observar el mensaje resultante | Mensaje de error o advertencia tipo **"Envío sin confirmar"**. **Nunca** un mensaje que afirme entrega o envío exitoso | ☐ |
| 4 | Pulsar de nuevo | Se puede reintentar; el botón no queda bloqueado | ☐ |

### Variante B — Con proveedor configurado (si TI lo habilitó)

| # | Acción | Resultado esperado | ☐ |
|---|---|---|---|
| 5 | Repetir los pasos 1–2 | El mensaje indica que el proveedor **aceptó** la solicitud, y **aclara que eso no confirma la entrega** al destinatario | ☐ |
| 6 | Pulsar dos veces seguidas | **No se envía dos veces** el mismo correo (idempotencia) | ☐ |
| 7 | Verificar en el panel del proveedor | Llega **un solo** envío | ☐ |

### Criterio de aceptación

El sistema **jamás** presenta como exitoso un envío que el proveedor no confirmó. La aceptación del proveedor se distingue explícitamente de la entrega.

**Resultado:** ☐ Conforme ☐ No conforme ☐ Bloqueado
**Evidencia:** ______________________ **Observaciones:** ______________________

---

## T47 — Operación completa por teclado, foco y vista móvil

| Campo | Detalle |
|---|---|
| **Cubre** | R25 (accesibilidad y UX) · hallazgo ME-09 |
| **Riesgo** | Que un usuario no pueda operar sin ratón o que el foco se pierda dentro de un modal |

### Pasos

| # | Acción | Resultado esperado | ☐ |
|---|---|---|---|
| 1 | Desde **Clientes**, recorrer toda la pantalla solo con **Tab** | El foco avanza de forma visible y lógica (no salta al azar ni se pierde) | ☐ |
| 2 | Abrir un modal de confirmación con **Enter** | El foco entra en el modal | ☐ |
| 3 | Pulsar **Tab** repetidamente dentro del modal | El foco **queda atrapado** en el modal, sin escaparse al fondo | ☐ |
| 4 | Pulsar **Esc** | El modal se cierra | ☐ |
| 5 | Verificar dónde queda el foco tras cerrar | Vuelve al botón que abrió el modal | ☐ |
| 6 | Completar **Agregar Servicio** usando solo teclado (búsqueda, selección, guardado) | Se completa sin ratón | ☐ |
| 7 | Reducir la ventana a ancho de móvil (< 420 px) | Las tablas se desplazan o adaptan; no hay contenido cortado | ☐ |
| 8 | Repetir 1–6 en el ancho móvil | Sigue siendo operable | ☐ |

### Criterio de aceptación

Asignación de servicio y confirmaciones se completan íntegramente por teclado; el modal aplica trampa de foco, cierra con Esc y devuelve el foco.

**Resultado:** ☐ Conforme ☐ No conforme ☐ Bloqueado
**Evidencia:** ______________________ **Observaciones:** ______________________

---

## T49 — Al asignar el servicio se emite su nota de venta con la fecha del ciclo

| Campo | Detalle |
|---|---|
| **Cubre** | R28 (emisión automática al alta) · requisito incorporado el 27/10/2026 |
| **Riesgo** | Que el servicio quede asignado **sin comprobante**, que la fecha no respete el ciclo configurado, o que se emita dos veces |
| **Precondición** | Un servicio de catálogo con tarifa y IVA configurados; un cliente activo |

### Pasos

| # | Acción | Resultado esperado | ☐ |
|---|---|---|---|
| 1 | **Clientes** → ficha de **CLIENTE UAT A** → **Servicios** → **Agregar Servicio** | Se abre el formulario | ☐ |
| 2 | Seleccionar el servicio y configurar **Modalidad = PREPAGO**, **Día de facturación = 1**, **Anticipo de cobranza = 26**, **Forma de Pago = Efectivo**, con **alta el día 1 del próximo mes** | Los selectores reflejan esos valores. El formulario se ve en dos columnas y **no** muestra un selector de "Tipo / Categoría" | ☐ |
| 3 | Guardar el servicio | Aparece el aviso **"Servicio Asignado y Facturado"** con: número de nota, importe con IVA y **fecha igual al día 1 del próximo mes** | ☐ |
| 4 | Anotar el número de nota y la fecha mostrados | Coinciden con el ciclo configurado, no con la fecha de hoy | ☐ |
| 5 | Ir a **Finanzas → Cobranzas** | Existe **una** deuda por ese cliente, por el importe con IVA, con el número de nota y estado pendiente | ☐ |
| 6 | Abrir el modal de cobro de esa deuda | La forma de pago **aparece preseleccionada en "Efectivo"**, y el importe por defecto es el saldo completo | ☐ |
| 7 | Cerrar sin cobrar y revisar la ficha del cliente | El **saldo** coincide con el importe de la nota **y no existe ningún movimiento bancario** de ese cobro | ☐ |
| 8 | Volver a **Servicios** y **editar** el mismo servicio (por ejemplo, cambiar la descripción) y guardar | Se muestra el aviso habitual, **sin** "Facturado"; el número de notas **no aumenta** | ☐ |
| 9 | Intentar emitir otra venta con **fecha anterior** a la del paso 4 | El sistema **rechaza** la emisión indicando que la fecha es anterior al último comprobante de la serie | ☐ |
| 10 | Asignar un segundo servicio a **CLIENTE UAT B** | El número de nota es **el siguiente correlativo** (…000000002 si el primero terminó en …000000001) | ☐ |

### Criterio de aceptación

El alta emite **una** nota con la fecha que dicta el ciclo configurado, la registra en cobranzas y en el saldo del cliente, **conserva la forma de pago pactada sin aplicarla**, no se duplica al editar, y la serie no admite fechas anteriores a la última emitida.

> **Nota:** el rechazo del paso 9 es **comportamiento correcto**, no un defecto. Al permitir comprobantes posfechados, la serie debe conservar el orden cronológico.

**Resultado:** ☐ Conforme ☐ No conforme ☐ Bloqueado
**Evidencia:** ______________________ **Observaciones:** ______________________

---

# RESUMEN Y FIRMAS

## Tabla de resultados

| Caso | Descripción | Resultado | Defectos |
|---|---|---|---|
| T03 | Categoría de catálogo | ☐ C ☐ NC ☐ B | |
| T39 | Enlace profundo a ficha | ☐ C ☐ NC ☐ B | |
| T40 | Borrador restaurado anuncia cliente | ☐ C ☐ NC ☐ B | |
| T41 | Impresión A4 y ticket cuadran | ☐ C ☐ NC ☐ B | |
| T42 | Exportación abre bien | ☐ C ☐ NC ☐ B | |
| T43 | Correo no simula entrega | ☐ C ☐ NC ☐ B | |
| T47 | Teclado, foco y móvil | ☐ C ☐ NC ☐ B | |
| T49 | Nota automática al asignar servicio | ☐ C ☐ NC ☐ B | |

*C = Conforme · NC = No conforme · B = Bloqueado*

## Registro de defectos

| Nº | Caso | Descripción del defecto | Severidad | Captura |
|---|---|---|---|---|
| 1 | | | ☐ Crítica ☐ Alta ☐ Media ☐ Baja | |
| 2 | | | ☐ Crítica ☐ Alta ☐ Media ☐ Baja | |
| 3 | | | ☐ Crítica ☐ Alta ☐ Media ☐ Baja | |

**Severidades**

- **Crítica:** impide operar o produce cifras/documentos incorrectos.
- **Alta:** la función no cumple su propósito, con solución manual difícil.
- **Media:** funciona con un rodeo razonable.
- **Baja:** cosmético o de redacción.

## Decisión

- ☐ **Se acepta** el flujo comercial. Todos los casos conformes, o los no conformes son de severidad Baja aceptada.
- ☐ **Se acepta con reservas.** Existen defectos Altos o Medios con plan de corrección acordado.
- ☐ **No se acepta.** Existe al menos un defecto Crítico.

**Observaciones de la decisión:**

_______________________________________________________________________________

_______________________________________________________________________________

## Firmas

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Responsable de Finanzas | | | |
| Responsable de Operaciones / NOC | | | |
| Responsable de TI | | | |

---

## Anexo A — Cobertura frente al informe de cierre

Estos siete casos completan la matriz T01–T48, que en el informe de cierre quedó parcialmente pendiente por falta de entorno de navegador.

| Caso UAT | Estado previo | Paquete del plan | Evidencia de implementación |
|---|---|---|---|
| T03 | Sin cobertura de navegador | R05 | `ClientContractTab.tsx:367` — categoría desde `prod.serviceCategory` |
| T39 | Sin cobertura de navegador | R24 | `clientes/page.tsx` — efecto de URL con `clientsRef` + reintento de hidratación |
| T40 | Sin cobertura de navegador | R24 | `NewSaleView.tsx:2103-2110` — banner "Borrador automático recuperado" con cliente e ítems |
| T41 | Sin cobertura de navegador | R22 | `RidePreviewModal.tsx:746` "Subtotal sin IVA"; `:908` bodega condicionada |
| T42 | Sin cobertura de navegador | R22 | `doc-generator.ts:164` ExcelJS; `FinancialReportsTab.tsx:277` XLSX |
| T43 | Sin cobertura de navegador | R21 | `NewSaleView.tsx:1602-1621`; `/api/messages/email:29` exige `messageId` |
| T47 | Sin cobertura de navegador | R25 | `ModalFocusGuard.tsx:15` role/aria-modal/foco; montado en `state.tsx:3593` |
| T49 | Nuevo requisito (27/10) | R28 | `commercial.ts` `firstPeriodFor` + `assignService` → `issueSale` con `allowFuturePeriod`; guarda `sequences.lastDate` |

## Anexo B — Qué hacer si la sesión se bloquea

| Síntoma | Causa probable | Acción |
|---|---|---|
| Nada se guarda y aparece error de sesión | Faltan `FIREBASE_SERVICE_ACCOUNT_JSON` o `VAULT_KEY_BASE64` | Detener la prueba y avisar a TI: la UAT no es válida sin credenciales |
| "No se pudo confirmar la operación" | Fallo de red o del servidor | Reintentar una vez; si persiste, registrar defecto |
| El enlace profundo no abre la ficha | Datos aún cargando | Esperar 3 segundos y recargar; si falla, registrar defecto en T39 |
| Excel muestra símbolos raros | Codificación del archivo | Registrar defecto en T42 (no abrir con importación manual: eso ocultaría el fallo) |

---

**Fin del guion.**

*Versión 1.0 — 27 de octubre de 2026. Sistemas evaluados: `dd8d4c5`. Los defectos detectados deben registrarse con el número del caso para poder trazarlos al paquete del plan correspondiente.*
