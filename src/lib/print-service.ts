/**
 * Servicio Centralizado de Impresión y Formateo Numérico Seguro
 * Garantiza que la impresión de Cotizaciones y Documentos (RIDE A4 y Ticket 80mm)
 * se ejecute en un contenedor aislado sin bloqueos del DOM ni errores de estilo de la SPA.
 */

/**
 * Convierte cualquier valor a un número seguro formateado con decimales.
 * Previene TypeError: ...toFixed is not a function cuando un dato viene como string o undefined.
 */
export function safeNumber(val: any, decimals = 2): string {
  if (val === null || val === undefined || val === "") return (0).toFixed(decimals);
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
}

export function safeFloat(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

/**
 * Imprime un elemento HTML en un iframe invisible aislado.
 * Clona todas las hojas de estilo y clases Tailwind para garantizar fidelidad 100%
 * sin que la barra lateral, cabecera ni fondos oscuros del modal afecten la impresión.
 */
export function printHtmlElement(
  element: HTMLElement | null,
  documentTitle = "Documento Oficial",
  format: "a4" | "ticket" = "a4"
): void {
  if (typeof window === "undefined") return;

  if (!element) {
    console.warn("Elemento imprimible no encontrado, ejecutando impresión estándar.");
    window.print();
    return;
  }

  // Crear un iframe temporal oculto
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  iframe.title = documentTitle;

  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  // Copiar todas las etiquetas <style> y <link rel="stylesheet"> del documento principal
  const headElements = Array.from(
    document.querySelectorAll("link[rel='stylesheet'], style")
  )
    .map((el) => el.outerHTML)
    .join("\n");

  const pageCss =
    format === "ticket"
      ? `@page { size: 80mm auto; margin: 3mm 2mm 3mm 2mm; }`
      : `@page { size: A4 portrait; margin: 8mm 10mm 8mm 10mm; }`;

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${documentTitle}</title>
        ${headElements}
        <style>
          ${pageCss}
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          }
          * {
            box-sizing: border-box;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          /* Ocultar cualquier elemento no deseado */
          .print\\:hidden {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div style="width: 100%; ${format === "a4" ? "max-width: 850px;" : "max-width: 320px;"} margin: 0 auto; background: #ffffff;">
          ${element.innerHTML}
        </div>
      </body>
    </html>
  `);
  iframeDoc.close();

  // Esperar a que se apliquen los estilos y renderizar
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error("Error en impresión mediante iframe:", err);
      window.print();
    } finally {
      // Remover el iframe temporal después de 1 segundo
      setTimeout(() => {
        try {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch {
          // Ignorar si ya fue removido
        }
      }, 1500);
    }
  }, 250);
}
