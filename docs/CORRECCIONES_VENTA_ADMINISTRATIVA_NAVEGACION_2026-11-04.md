# Venta administrativa y navegación — 4 de noviembre de 2026

## Creación rápida de productos y servicios

El formulario de Venta Administrativa ahora permite escoger explícitamente **Producto / Servicio** y **Categoría**. Las categorías disponibles corresponden al tipo elegido o a categorías configuradas para ambos tipos. Al cambiar el tipo se limpia una categoría incompatible y se conserva una categoría compartida. “Sin categoría” queda guardado como tal, sin asignar automáticamente la primera categoría del catálogo.

La clasificación se envía al comando comercial existente `createProduct`, que valida la compatibilidad y obtiene el nombre canónico de la categoría. El registro confirmado se agrega al carrito y se mantiene en el catálogo mediante la persistencia existente. Los servicios se guardan con unidad servicio y sin existencias ni Kardex. Un producto sin control de existencias conserva el tipo producto.

También se retiraron dos valores implícitos del formulario: el stock inicial de diez unidades y el costo calculado como 70 % del precio. El stock comienza en cero y el costo explícito cero se conserva. Se validan importes, stock entero no negativo y bodega activa cuando hay existencias iniciales. No se asignan marcas ficticias. El envío se bloquea mientras se guarda para evitar duplicados y los permisos distinguen creación de productos y servicios.

## Encabezado e historial de facturación

Se eliminó el párrafo descriptivo bajo **Nueva Nota de Venta**.

El acceso **Historial de Facturación** ahora apunta a la pestaña **Facturación** de la ficha del cliente. Esta pestaña está disponible también para clientes sin servicios contratados. Su fuente es `billingInvoices`, con facturas y notas de venta emitidas al ID exacto del cliente; no utiliza el listado de deudas ni cobranzas. Excluye borradores y documentos anulados, ordena por número de mayor a menor y permite buscar por número/concepto, filtrar por tipo y abrir el comprobante para verlo o imprimirlo. La autorización de lectura coincide con la del servidor.

## Inventario de controles Volver

Se localizaron y sustituyeron **19 controles de regreso en 16 archivos**, todos mediante el componente compartido `BackButton`.

| Área | Controles |
| --- | ---: |
| Venta administrativa: formulario y resultado | 2 |
| Compras: cabecera y pie del formulario | 2 |
| Tickets: detalle y estado sin registro | 2 |
| Inventario: producto/servicio, categoría/marca, ajuste, transferencia y bodega | 5 |
| Clientes: carpetas, cotizaciones y formulario de usuario | 3 |
| Proyectos | 1 |
| Bóveda | 1 |
| Error, página inexistente y acceso restringido | 3 |
| **Total** | **19** |

El diseño es circular, azul, de 40 × 40 px, con flecha, tooltip y nombre accesible según el destino. Incluye cambio de fondo, sombra y desplazamiento suave de la flecha al pasar el puntero, efecto de pulsación y foco visible para teclado. Respeta la preferencia de movimiento reducido. Conserva destinos, callbacks y estados deshabilitados. Los botones dentro de formularios no los envían accidentalmente y los formularios modificados mantienen la confirmación de descarte al usar Volver.

No se cuentan ni modifican las flechas de paginación o traslado de tareas entre columnas, porque realizan acciones distintas de regresar.

## Verificación

- **167 pruebas automatizadas aprobadas** y compilación de producción completada.
- Comandos comerciales ejecutados con adaptador transaccional de prueba: producto con categoría elegida, existencias iniciales y Kardex; servicio sin existencias; producto sin control de stock conservando tipo; categoría incompatible rechazada sin escrituras parciales.
- Navegador con el formulario real de venta y estado de prueba: selección y filtrado de categorías, cambio de tipo, conservación de categoría compartida, envío correcto de producto/servicio, costo cero y formulario móvil.
- Navegador con venta, ficha del cliente e historial reales y datos de prueba: enlace en pestaña nueva, cliente sin servicios, documentos propios, exclusión de documentos ajenos/borradores/anulados, orden descendente, filtros y visor del comprobante correcto. No se enviaron documentos al SRI ni se crearon ventas reales.
- Auditoría de los controles de regreso: conservación de acciones y destinos originales. Prueba en navegador del componente compartido: forma circular, hover, animación, teclado, enlace, estado deshabilitado, ausencia de envío accidental, movimiento reducido y confirmación de cambios sin guardar.

Estas pruebas de interfaz usan componentes reales con datos aislados. No equivalen a crear operaciones contables nuevas en producción.
