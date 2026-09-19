import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Patrones maliciosos bloqueados en el Edge
const MALICIOUS_PATTERNS = [
  /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e%2e%5c)/i, // Path Traversal
  /(union(\s+all)?\s+select|select\s+.*\s+from|drop\s+table|;\s*shutdown|exec(\s|\()+)/i, // SQLi
  /(<script\b|javascript:|onerror\s*=|onload\s*=|document\.cookie)/i, // XSS
  /(\/\.env|\/\.git|\/wp-login\.php|\/wp-admin|\/phpmyadmin|\/actuator|\/console)/i, // Bot Scanners
  /(etc\/passwd|windows\/system32|boot\.ini)/i, // System Files
];

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathAndQuery = `${url.pathname}${url.search}`.toLowerCase();

  // 1. Detección de amenazas en URL y Query Params
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(pathAndQuery)) {
      console.warn(`[EDGE SECURITY SHIELD] Amenaza bloqueada: ${request.ip || "IP Desconocida"} -> ${url.pathname}`);
      return new NextResponse(
        JSON.stringify({
          error: "ACCESO_DENEGADO",
          message: "Solicitud bloqueada por el Escudo de Seguridad Perimetral de INNTEL CORP S.A.",
          code: 403,
          domain: "https://www.inntelcorp.com/",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "X-Security-Shield": "INNTEL-EDGE-GUARD-ACTIVE",
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
          },
        }
      );
    }
  }

  // 2. Adjuntar Cabeceras de Seguridad Avanzadas a solicitudes legítimas
  const response = NextResponse.next();

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), browsing-topics=()");
  response.headers.set("X-Security-Shield", "INNTEL-EDGE-GUARD-ACTIVE");

  return response;
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto recursos estáticos públicos (_next/static, _next/image, favicon.ico, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
