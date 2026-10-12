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

// Caracteres indicadores para fast-path check
const SUSPICIOUS_CHARS = /[%<>;'"\.]|(?:\b(?:select|drop|exec|union|script|passwd)\b)/i;

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const pathAndQuery = `${pathname}${search}`;

  // Fast-path: si la URL y query son limpias (sin caracteres ni tokens sospechosos), pasar de inmediato
  if (!SUSPICIOUS_CHARS.test(pathAndQuery)) {
    return NextResponse.next();
  }

  // Detección profunda solo si hay indicios sospechosos
  const lowerPathAndQuery = pathAndQuery.toLowerCase();
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(lowerPathAndQuery)) {
      console.warn(`[EDGE SECURITY SHIELD] Amenaza bloqueada: ${request.ip || "IP Desconocida"} -> ${pathname}`);
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aplica únicamente a rutas de páginas y APIs activas.
     * Excluye _next/static, _next/image, _next/data, favicon, robots, sitemap y todos los assets estáticos.
     */
    "/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|css|js|map|ico|pdf|docx|xlsx|csv)$).*)",
  ],
};
