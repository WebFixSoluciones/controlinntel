# Revisión de integridad de ControlINNTEL

Revisión del 24 de noviembre de 2026. Base `27b277ce5896ff075d72df2a54639947f5de0863`, cotejada con `origin/main`. Rama de trabajo `codex/revision-integridad-entrega`.

## Resultado y alcance

La intervención retira **309 importaciones no utilizadas en 70 archivos**. El análisis adicional de TypeScript con `--noUnusedLocals --noUnusedParameters` produjo 388 diagnósticos en la base. Se atendieron las importaciones que permiten demostrar equivalencia. Las declaraciones completas y los parámetros con posible efecto en contratos o inicialización quedaron para revisión por módulo. Se limitaron los cambios a importaciones nombradas que conservaban otros miembros de la misma declaración. Se comparó la salida de transpilación de TypeScript antes y después en los 70 archivos y fue idéntica. Se conservaron implementaciones, exportaciones, estructuras de datos y efectos de los flujos de negocio. Se actualizó una comprobación estática de renovaciones para verificar las dos llamadas de cálculo que usa el flujo. CI ahora ejecuta la comprobación de tipos desde `package.json` y limita su token a lectura del repositorio.

Se inventariaron las 18 entradas de página, 19 archivos de rutas API, 16 directorios de módulos y 43 archivos de pruebas bajo `src`. La revisión estática se concentró en el arranque, navegación, autenticación y autorización, contratos de almacenamiento, adjuntos regulados, operaciones comerciales y financieras, dependencias, CI y recuperación. Se revisaron las integraciones desde su código y configuración de repositorio.

El código y la documentación quedan preparados para revisión de entrega. La aceptación final queda pendiente de tratar los riesgos críticos de dependencias, comprobar las reglas efectivas y completar QA con servicios aislados y un ensayo de restauración.

## Evidencia de verificación

| Control | Resultado |
| --- | --- |
| Comparación de salida TypeScript | Idéntica en los 70 archivos intervenidos. |
| Línea base | TypeScript correcto. ESLint con 19 advertencias y 0 errores. Suite con 319 pruebas aprobadas. |
| Versión de entrega | 319 pruebas aprobadas, TypeScript correcto, ESLint con 19 advertencias preexistentes y 0 errores, y compilación de producción de Next.js completada con configuración demo y direcciones locales. |
| Entorno | Windows con Node.js 24.22.3 y dependencias instaladas en el workspace. Las 24 dependencias directas de producción instaladas coinciden con las versiones del lockfile. CI declara Node.js 22 y ejecuta una instalación limpia. |

Las pruebas del repositorio comprueban contratos y regresiones que incluyen autorización, compras, inventario, recurrencia, conciliación, ARCOTEL, credenciales y navegación. La verificación local no ejecutó la instalación limpia de CI, la aceptación funcional desde navegador, los emuladores de Firebase, emisión SRI, correo ni restauración. Se trabajó con el repositorio local y el registro público de dependencias. Durante la revisión no hubo despliegue, migración, restauración ni cambios en Firestore, el almacenamiento o los PDF cargados por la empresa.

## Hallazgos y cierre requerido

| Prioridad | Hallazgo | Cierre requerido |
| --- | --- | --- |
| Crítica | El lockfile fija `next@14.2.18` y `jspdf@2.5.2`, con avisos críticos que coinciden con esas versiones. | Preparar una actualización aislada y volver a cotejar el lockfile. Validar compilación, autenticación, rutas y generación de PDF, incluyendo RIDE, antes de promover esa versión. |
| Alta | `firebase.json` referencia `storage.rules`, que permite leer y escribir cualquier objeto del bucket al que se aplique con cualquier sesión autenticada. La ruta actual de documentos usa el bucket privado configurado en servidor. | Identificar buckets y reglas realmente desplegadas, revisar permisos IAM y referencias históricas. Probar acceso cruzado por rol y cliente en QA, aplicar mínimo privilegio y verificar descargas históricas. |
| Media | `next.config.mjs` permite `unsafe-inline` y `unsafe-eval` en la política de contenido. La línea base de ESLint también reporta 12 avisos de dependencias de hooks y 7 de uso de imágenes HTML. | Endurecer la política de forma gradual y comprobar las integraciones. Corregir hooks por flujo con pruebas enfocadas para evitar renderizados adicionales o pérdida de estado. Medir antes de migrar imágenes. |
| Media | `src/lib/state.tsx` concentra estado, carga de datos y orquestación. Los módulos de servidor `commercial.ts` y `operations.ts` concentran varios dominios. | Extraer por operaciones con contrato y cobertura existentes. Comparar tiempos y volumen de carga del snapshot con datos representativos antes de optimizar. |
| Alta para aceptación | Firestore almacena los metadatos y el objeto reside en un servicio de almacenamiento. La recuperación debe cubrir ambos y el material necesario para operar la bóveda. | Ensayar restauración en un entorno aislado. Verificar relaciones y descargas de ARCOTEL, acceso a credenciales, saldos y conciliación. Registrar el respaldo utilizado y el resultado. |

La consulta al registro público de npm cotejó los rangos de los avisos con las versiones de instalación de producción fijadas en `package-lock.json` (392 nombres de paquete). Se encontraron **104 avisos coincidentes**, de los cuales 6 son críticos, 33 altos, 47 moderados y 18 bajos. El conteo refleja coincidencias de versión. La exposición efectiva requiere validar el código ejecutado y la configuración desplegada.

- **Next.js**, cuatro avisos críticos. [GHSA-f82v-jwr5-mffw](https://github.com/advisories/GHSA-f82v-jwr5-mffw), [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36), [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) y [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw).
- **jsPDF**, dos avisos críticos. [GHSA-f8cm-6447-x5h2](https://github.com/advisories/GHSA-f8cm-6447-x5h2) y [GHSA-wfv2-pwc8-crg5](https://github.com/advisories/GHSA-wfv2-pwc8-crg5).

## Criterios de calidad y entrega

Se utilizaron los modelos como referencia para organizar el trabajo y sus evidencias. Esta revisión no constituye una evaluación de conformidad. [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html) e [ISO/IEC/IEEE 12207:2026](https://www.iso.org/standard/90219.html).

| Criterio | Evidencia y condición de aceptación |
| --- | --- |
| Adecuación funcional y seguridad operacional | Comparación de código emitido y ejecución de pruebas. Completar aceptación por roles y comprobación de operaciones financieras y fiscales con datos de prueba. |
| Mantenibilidad | Importaciones depuradas, comprobación de tipos reproducible en CI y mapa de componentes, rutas y contratos. |
| Fiabilidad | Revisión de transacciones, registros de operación y reconciliación. Completar el ensayo de restauración y validar los casos de reintento y concurrencia en QA. |
| Seguridad | Revisión estática de autorización y almacenamiento y cotejo de dependencias. Confirmar el cierre de los riesgos críticos y la cobertura de los límites de acceso. |
| Eficiencia, compatibilidad, interacción y flexibilidad | Compilación, configuración de entornos y guion de aceptación. Repetir con Node.js 22 en CI, ejecutar el recorrido UAT y obtener una línea base de rendimiento representativa. |
| Procesos de entrega | Registrar commit, resultado de CI, respaldo, evidencias de QA, validación y reversión. Usar el [manual de entrega](ENTREGA_TECNICA.md) para reproducir el entorno y completar la aceptación. |
