# INNTEL CORP — Sistema Integral de Gestión ISP & ARCOTEL

Plataforma empresarial centralizada para la gestión operativa, técnica, financiera (órdenes de pedido y pre-facturación) y regulatoria (ARCOTEL) de **INNTEL CORP S.A.** (Proveedor de Servicios de Telecomunicaciones e Internet - ISP en Ecuador).

![INNTEL CORP Logo](/public/logo-inntel.webp)

---

## 🚀 Arquitectura Tecnológica & Escalabilidad

- **Frontend & Backend**: Next.js 14 (App Router, TypeScript, React Server Components).
- **Estilos & UI/UX**: Tailwind CSS con tema **Light Mode por defecto** y paleta corporativa (Azul INNTEL `#0066B3`, Púrpura `#7A4499`, Celeste WebFix `#00AEEF`).
- **Base de Datos & Servicios**: Google Cloud Firestore / Firebase (`inntelcorp-45c89`) con sincronización en la nube y resiliencia local.
- **Seguridad**: Cifrado AES-256 en Bóveda de Credenciales, Cabeceras HTTP endurecidas (HSTS, CSP, X-Frame-Options, X-Content-Type-Options) y control de acceso basado en roles (RBAC).
- **Generador de Documentos**: Creación de contratos Word `.docx` oficiales de ARCOTEL y reportes consolidados en Excel `.xlsx`.
- **Asistente IA**: Gemini Flash 2.5 Lite integrado con contexto en vivo de telecomunicaciones y filtrado de respuestas por rol.

---

## 📦 Módulos Integrados del Sistema

1. **Dashboard Central**: Monitoreo de MRR, abonados activos, estado de POPs y alerta temprana de vencimientos.
2. **M1 — Clientes & Ficha Consolidada 360°**: Gestión de abonados, validación RUC/Cédula, tablero Kanban de proyectos, contratos y bóveda de cliente.
3. **M2 — ARCOTEL & Pólizas**: Monitoreo de pólizas de fiel cumplimiento y responsabilidad civil con semáforo de vencimiento.
4. **M3 — Infraestructura Multi-Nodo & MikroTik**: Supervisión de concentradores PPPoE, capacidad de tráfico (Mbps) y pools IPv4 / IPv6.
5. **M4 — Mesa de Ayuda NOC & Soporte**: Tickets de soporte categorizados, SLA prioritarios y asignación a cuadrillas.
6. **M5 — Control Financiero & Pre-Facturación**: Emisión de cobros recurrentes Día 1, órdenes de pedido y exportación en lote en Excel.
7. **M6 — Automatización de Plantillas Word/Excel**: Contratos de adhesión SAI, formularios de infraestructura técnica y oficios de renovación.
8. **M7 — Bóveda de Credenciales Cifradas**: Almacén con cifrado AES-256 para credenciales de portales regulatorios (SIETEL, FODETEL, QUIPUX).
9. **M8 — Configuración & Usuarios (RBAC)**: Gestión de usuarios del sistema, matriz de permisos y administración de Super Admin.
10. **Asistente IA Gemini Flash**: Soporte operativo interactivo con guardrails de seguridad por rol.

---

## 🛡️ Seguridad en Cabeceras HTTP (`next.config.mjs`)

El sistema incluye cabeceras de seguridad estrictas configuradas en el servidor Next.js:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: SAMEORIGIN` (prevención de Clickjacking)
- `X-Content-Type-Options: nosniff` (prevención de MIME-sniffing)
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 🛠️ Instalación & Despliegue

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Iniciar en producción
npm start
```

Desarrollado para **INNTEL CORP** por **WebFix Soluciones**.
