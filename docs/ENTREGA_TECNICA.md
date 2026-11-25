# Manual de entrega de ControlINNTEL

La revisión del 24 de noviembre de 2026 partió del commit `27b277ce5896ff075d72df2a54639947f5de0863`. El informe de integridad acompaña esta guía y detalla qué se comprobó y qué queda pendiente.

## Recorrido funcional

| Área | Entrada y operación |
| --- | --- |
| Dashboard | Panel inicial de indicadores y vencimientos. |
| Clientes | Directorio y ficha 360°. Desde la ficha se gestionan servicios, documentos, nodos, credenciales, tickets y tareas, según permisos. |
| Nodos y credenciales | En Clientes → Nodos se editan ubicación, enlaces, proveedores y sistemas. El proveedor admite notas opcionales. Para persistir un cambio, actualiza la fila y guarda el nodo. Deja vacía la contraseña de un sistema para conservar la almacenada. |
| ARCOTEL | En la ficha del cliente, elige la sección regulatoria y la categoría antes de cargar. Comprueba que el documento aparezca en su lista y pueda descargarse tras recargar. |
| Ventas | Notas de venta, cotizaciones y recurrencia. En Cotizaciones, selecciona **Nro. Cotización** para alternar el orden por número. Verifica cliente, partida, período y forma de pago antes de confirmar. |
| Compras | Registro manual o por XML, historial, notas y retenciones. Las compras elegibles se editan desde Facturas. Las eliminadas quedan en su filtro y la operación registra sus efectos internos. |
| Facturación SRI | Emisión fiscal, consulta de estados, RIDE y correo. La configuración de ambiente y firma se administra en Configuración → SRI. |
| Inventarios | Productos, servicios, categorías, existencias por bodega, Kardex, transferencias y ajustes. |
| Finanzas | Cobranzas, anticipos, gastos, movimientos, bancos, cuentas por cobrar/pagar y reportes. |
| Proyectos, Soporte y Trámites | Seguimiento de tareas, tickets y expedientes. Las funciones visibles dependen del rol. |
| Plantillas, Personas y Configuración | Gestión de plantillas, proveedores, cuentas, roles, parámetros y recuperación. |

El repositorio conserva un componente de asistente Gemini y su adaptador. En la versión revisada no se encontró una entrada activa que monte el componente. El manual documenta los flujos disponibles desde la aplicación.

Los listados comerciales, fiscales y financieros permiten mostrar 10, 20 o 30 filas por página. Usa **Anterior** y **Siguiente** al pie de la tabla. La búsqueda y los filtros se aplican al listado completo. Los totales, las exportaciones y la impresión de reportes abarcan todos los resultados que correspondan a la vista.

En los listados de comprobantes, el orden inicial es numérico de mayor a menor por serie y secuencial. Los gastos, anticipos, pagos recibidos y movimientos aparecen del más reciente al más antiguo. Los archivos de **Reportes → Ventas** y **Reportes → Compras** usan el mismo orden que la tabla.

Al crear una cotización, busca el cliente por razón social, nombre comercial, RUC o cédula y selecciónalo en el resultado. En los listados de ventas, compras, facturación y finanzas, las búsquedas aceptan palabras parciales sin tildes e identificadores con o sin separadores.

## Registro de pagos y cruce bancario

1. En **Finanzas → Cobranzas**, abre el comprobante y usa **Registrar cobro**. Selecciona la cuenta que recibió el dinero e ingresa la fecha, el importe y el número del comprobante del pago tal como aparece en el banco.
2. Si un mismo ingreso se aplicará a varios comprobantes, regístralo una vez en **Finanzas → Anticipos**. Aplica el saldo desde cada comprobante. Las aplicaciones no representan ingresos adicionales.
3. Abre **Finanzas → Reportes → Pagos recibidos** o el enlace **Reporte de pagos** en Cobranzas. Filtra por fecha del pago y cuenta. El buscador acepta la referencia del pago, números de venta, cliente y RUC o cédula.
4. Exporta en Excel para cruzar cuenta, fecha, número de operación e importe con el extracto. El archivo separa el comprobante bancario de los comprobantes de venta. Excel conserva como texto referencias como `00089102`. La exportación requiere el permiso **Exportar informes financieros**.

Los históricos sin número o con una referencia igual al comprobante de venta quedan identificados para revisión. Los cobros sin movimiento vinculado se muestran aparte del total de ingresos con movimiento. El reporte permite hacer el cruce en el extracto, sin marcar automáticamente un pago como conciliado.

### Ajustar un cobro recibido

1. En **Pagos recibidos**, usa **Ver** para identificar el ingreso por cuenta, fecha, importe y comprobantes aplicados. Si una referencia aparece en varios registros, revisa cada importe frente al extracto.
2. Usa **Editar** cuando el dinero sí ingresó y el dato se registró mal. Indica el motivo y revisa el impacto. Corregir la referencia conserva los saldos. Cambiar el importe actualiza el ingreso, el abono y la deuda pendiente. Cambiar la cuenta mueve el importe entre los saldos internos, conservando el comprobante de venta.
3. Usa **Anular** para un ingreso registrado por error o duplicado. Se revierte su efecto sobre el banco y la cartera, y queda el historial. Si el dinero sí ingresó y solo estaba aplicado a una venta equivocada, usa la reversión del abono en Cobranzas para conservar el dinero como saldo a favor y aplicarlo correctamente.

Los anticipos aplicados conservan sus abonos ya realizados. Para anularlos, primero se revisan y revierten las aplicaciones vigentes. Los cobros desaplicados con crédito vinculado admiten correcciones de fecha y referencia. Los históricos cuyo vínculo no puede comprobarse quedan disponibles para consulta. Estas acciones conservan el documento fiscal y su estado. Las transferencias o devoluciones reales se gestionan por el banco.

## Arquitectura y contratos

| Capa | Ubicación y responsabilidad |
| --- | --- |
| Interfaz | `src/app` define rutas Next.js. `src/components/modules` contiene vistas y flujos. `src/components/layout` contiene la navegación compartida. |
| Sesión y datos | `src/lib/state.tsx` coordina el estado de React y carga el snapshot del servidor. `src/lib/api-client.ts` realiza las llamadas autenticadas. Firebase Auth emite el token de sesión. |
| Entrada de servidor | `src/app/api` agrupa sesión y datos, usuarios y roles, operaciones comerciales, archivos, SRI, correo, tickets, historial y recuperación. La búsqueda de identificación SRI y la tarea programada tienen sus propios flujos de acceso. |
| Autorización | `security.ts`, `permissions.ts`, `role-access.ts` y `persistence-contracts.ts` verifican el perfil y delimitan acciones y lectura de colecciones. Ocultar un control es una ayuda visual. El servidor aplica las decisiones de acceso. |
| Operaciones | `src/lib/server/commercial.ts` coordina operaciones transaccionales. `operation-log.ts` registra efectos y permite controlar reintentos. `reconciliation.ts` compara proyecciones con movimientos. |
| Persistencia | Firestore guarda registros de negocio y metadatos. `firestore.rules` restringe el acceso directo. La aplicación consulta los datos mediante el servidor. |
| Archivos | `/api/blob/upload` y `/api/blob/download` controlan el acceso. `document-storage.ts` guarda archivos nuevos en un bucket privado dedicado. Algunos archivos existentes pueden usar el almacenamiento anterior. El respaldo debe cubrir metadatos y objetos. |
| Secretos | `vault.ts` administra el sellado y la clave. Las credenciales se consultan por una acción explícita con verificación de permisos. El material de firma SRI y correo se administra en servidor. |

### Familias de API

- La sesión, los datos y el historial de clientes pasan por `/api/session`, `/api/data`, `/api/clients/history`.
- Los usuarios y roles se administran mediante `/api/users`, `/api/roles`.
- Las operaciones y su recuperación pasan por `/api/commercial`, `/api/commercial/recurring-schedule`, `/api/operations`, `/api/reconciliation`, `/api/recovery`.
- La carga y descarga de archivos pasan por `/api/blob/upload`, `/api/blob/download`.
- Los servicios fiscales y de correo usan `/api/sri`, `/api/sri/emitir`, `/api/sri/certificado`, `/api/settings/email`, `/api/messages/email`.
- Soporte usa `/api/tickets/numeracion`, `/api/tickets/reply`.

## Instalación y entornos

1. Obtén el repositorio y usa Node.js 22 actualizado y npm, como en CI. Ejecuta `npm ci` desde la raíz.
2. Revisa [la plantilla de variables](../.env.example). Configura el proyecto de pruebas y el entorno de servidor mediante variables locales o el gestor de secretos del entorno.
3. Para QA con emuladores usa el proyecto `demo-controlinntel-qa`, `firebase.qa.json`, Auth en `127.0.0.1:9099` y Firestore en `127.0.0.1:8080`. Define `NEXT_PUBLIC_USE_EMULATORS=true` junto con el identificador demo en cliente y servidor. Para ejecutar `node scripts/qa-commercial-emulator.mjs` y `node scripts/qa-sales-emulator.mjs`, exporta `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` y `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` en el terminal de QA. Configura `QA_BASE_URL` para que apunte al servidor local. Usa instancias desechables de los emuladores, porque los guiones reinician sus datos.
4. Ejecuta `npm run dev` y abre la URL que muestra Next.js. Para el paquete de entrega, ejecuta `npm run typecheck`, `npm run lint`, `npm test` y `npm run build`.

| Grupo | Variables y uso |
| --- | --- |
| Cliente web | `NEXT_PUBLIC_FIREBASE_*` configura Firebase. `NEXT_PUBLIC_ENABLE_ANALYTICS` controla Analytics. Las variables `NEXT_PUBLIC_*` aparecen en el bundle, así que se reservan para configuración pública. |
| Servidor Firebase | `FIREBASE_PROJECT_ID` y credenciales de la identidad de servidor. Usa `FIREBASE_SERVICE_ACCOUNT_JSON` o ADC según el despliegue. |
| Bóveda | `VAULT_KEY_BASE64` o un secreto de Secret Manager mediante `VAULT_KEY_SECRET_VERSION`. Conserva versiones recuperables de la clave junto con el plan de respaldo. Un cambio de clave requiere un procedimiento de migración y validación propios. |
| Adjuntos | `DOCUMENTS_BUCKET` identifica el bucket privado de documentos. `BLOB_READ_WRITE_TOKEN` admite operaciones sobre archivos históricos de Vercel Blob cuando corresponde. |
| Correo y tarea programada | `EMAIL_DELIVERY_WEBHOOK_URL` y `EMAIL_DELIVERY_WEBHOOK_TOKEN` configuran el adaptador opcional. `CRON_SECRET` autentica la tarea de recurrencia declarada en `vercel.json`. |

## Operación, recuperación y aceptación

1. Registra el commit, versión de Node, resultados de CI y entorno de QA asociado a cada entrega.
2. En un entorno aislado verifica sesión y permisos con perfiles representativos, navegación, carga y descarga de un documento, edición de nodo, compra, venta, inventario y conciliación. Usa el ambiente de pruebas SRI para emisión y una dirección controlada para correo.
3. Obtén un respaldo con el procedimiento de infraestructura autorizado. Incluye Firestore, almacenamiento de documentos, cuentas y acceso a las versiones de los secretos necesarios para recuperar el servicio. Registra fecha, alcance y responsable.
4. Ensaya la restauración en QA sobre un destino separado. Coteja las relaciones entre clientes, documentos y operaciones. Para los PDF ya presentados, verifica cliente, categoría, período, nombre y descarga. Compara tamaño y huella SHA-256 si el respaldo conserva una referencia verificable. Previsualiza el impacto de cualquier recuperación y revisa archivos y saldos después del ensayo.
5. En producción verifica la identidad de ejecución, las reglas efectivas, el bucket, el ambiente SRI y la tarea recurrente. Conserva la última versión estable de la aplicación y un procedimiento de reversión. Revertir un despliegue repone el código. Para corregir transacciones y datos se requiere un procedimiento independiente.

Consulta también el [guion UAT](UAT_GUION_ACEPTACION_2026-10-27.md), [usuarios y permisos](usuarios-permisos-2026-11-12.md), [roles y excepciones](roles-y-excepciones-2026-11-13.md) e [historial Firebase](FIREBASE.md).
