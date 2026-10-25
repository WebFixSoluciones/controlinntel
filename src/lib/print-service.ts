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

  // Crear un iframe temporal fuera de pantalla con dimensiones reales de documento
  // para que las consultas de medios (@media) y grillas calculen el ancho correctamente
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = format === "ticket" ? "320px" : "1024px";
  iframe.style.height = "1200px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.setAttribute("aria-hidden", "true");
  iframe.title = documentTitle;

  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  // Copiar las hojas de estilo globales descartando cualquier regla que oculte el body
  const headElements = Array.from(
    document.querySelectorAll("link[rel='stylesheet'], style")
  )
    .filter((el) => {
      const content = el.textContent || "";
      return !content.includes("visibility: hidden") && !content.includes("visibility:hidden");
    })
    .map((el) => el.outerHTML)
    .join("\n");

  const pageCss =
    format === "ticket"
      ? `@page { size: 80mm auto; margin: 3mm 2mm 3mm 2mm; }`
      : `@page { size: A4 portrait; margin: 8mm 10mm 8mm 10mm; }`;

  const a4GridOverrides =
    format === "a4"
      ? `
          /* Garantizar que las grillas de 2, 3, 4 y 12 columnas mantengan su proporción exacta en A4 */
          .grid {
            display: grid !important;
          }
          .sm\\:grid-cols-2,
          .md\\:grid-cols-2,
          .print\\:grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .md\\:grid-cols-3,
          .print\\:grid-cols-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
          .md\\:grid-cols-4,
          .print\\:grid-cols-4 {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
          .md\\:grid-cols-12,
          .print\\:grid-cols-12 {
            grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
          }
          .sm\\:col-span-2,
          .md\\:col-span-2,
          .print\\:col-span-2 {
            grid-column: span 2 / span 2 !important;
          }
          .md\\:col-span-5,
          .print\\:col-span-5 {
            grid-column: span 5 / span 5 !important;
          }
          .md\\:col-span-7,
          .print\\:col-span-7 {
            grid-column: span 7 / span 7 !important;
          }
        `
      : "";

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
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 11px !important;
          }
          * {
            box-sizing: border-box;
            visibility: visible !important;
          }
          .print-avoid-break, tr, table {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          /* Ocultar cualquier elemento de interfaz no imprimible */
          .print\\:hidden {
            display: none !important;
          }
          #ride-print-area,
          #quote-print-area,
          #ticket-print-area,
          #withholding-print-area,
          #dossier-print-area {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          ${a4GridOverrides}
        </style>
      </head>
      <body>
        <div style="width: 100%; ${format === "a4" ? "max-width: 100%;" : "max-width: 300px;"} margin: 0 auto; background: #ffffff;">
          ${element.outerHTML}
        </div>
      </body>
    </html>
  `);
  iframeDoc.close();

  // Esperar a que carguen imágenes (logo, etc.) y estilos antes de abrir el diálogo de impresión
  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error("Error en impresión mediante iframe:", err);
      window.print();
    } finally {
      setTimeout(() => {
        try {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch {
          // Ignorar si ya fue removido
        }
      }, 2000);
    }
  };

  const images = Array.from(iframeDoc.querySelectorAll("img"));
  if (images.length === 0) {
    setTimeout(triggerPrint, 250);
  } else {
    let loadedCount = 0;
    let printed = false;
    const checkDone = () => {
      loadedCount++;
      if (!printed && loadedCount >= images.length) {
        printed = true;
        setTimeout(triggerPrint, 150);
      }
    };
    images.forEach((img) => {
      if (img.complete) {
        checkDone();
      } else {
        img.addEventListener("load", checkDone, { once: true });
        img.addEventListener("error", checkDone, { once: true });
      }
    });
    // Fallback de seguridad por si alguna imagen tarda demasiado
    setTimeout(() => {
      if (!printed) {
        printed = true;
        triggerPrint();
      }
    }, 600);
  }
}
