# Plan de integridad y entrega técnica

**Objetivo:** revisar ControlINNTEL, limpiar código sin cambiar las funcionalidades y dejar evidencia de entrega.

**Base:** `27b277ce5896ff075d72df2a54639947f5de0863`, comprobado contra `origin/main` el 24 de noviembre de 2026.

**Criterio:** preservar rutas, permisos, contratos de datos, resultados y efectos externos. Trabajar con fuentes y pruebas locales. Las dependencias, credenciales, migraciones, configuración y servicios de producción requieren su propio ciclo de validación.

- [x] Establecer la línea base mediante inventario del repositorio, pruebas, TypeScript y ESLint.
- [x] Revisar entradas de la aplicación, persistencia, autenticación, archivos y flujos comerciales. Revisar integraciones, respaldo, CI y dependencias de manera estática.
- [x] Aplicar limpiezas con equivalencia verificable. Registrar los cambios funcionales o de plataforma como hallazgos para seguimiento.
- [x] Ejecutar las verificaciones sobre la versión de entrega y comparar contra la base.
- [x] Entregar manual técnico y funcional, evidencia, limitaciones y riesgos priorizados.
