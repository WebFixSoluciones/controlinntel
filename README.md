# ControlINNTEL

Sistema de gestión operativa, comercial, financiera y regulatoria para INNTEL CORP. Incluye la ficha del cliente, gestión de nodos, ventas, compras, inventarios, finanzas, facturación electrónica SRI y expedientes ARCOTEL.

![INNTEL CORP](public/logo-inntel.webp)

## Desarrollo

El proyecto usa Next.js, React, TypeScript y Firebase. Usa Node.js 22 actualizado, la misma línea que ejecuta CI, y npm. Instala las versiones registradas en package-lock.json.

```sh
npm ci
npm run dev
```

Antes de conectarte a servicios externos, consulta la sección de entornos del manual y usa un proyecto de pruebas. `.env.example` describe las variables y `.env.local` queda excluido del repositorio.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Documentación

- [Manual de entrega técnica y funcional](docs/ENTREGA_TECNICA.md)
- [Revisión de integridad y calidad del 24 de noviembre de 2026](docs/AUDITORIA_INTEGRIDAD_2026-11-24.md)
- [Usuarios y permisos](docs/usuarios-permisos-2026-11-12.md) y [roles y excepciones](docs/roles-y-excepciones-2026-11-13.md)
- [Guion de aceptación](docs/UAT_GUION_ACEPTACION_2026-10-27.md) e [historial de infraestructura Firebase](docs/FIREBASE.md)

Desarrollado para INNTEL CORP por WebFix Soluciones.
