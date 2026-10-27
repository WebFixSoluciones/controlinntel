import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { actor, HttpError } from "@/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descarga autenticada de documentos de cliente.
 *
 * Los expedientes (cédulas, contratos y certificados .p12 con clave privada) se guardan
 * como blobs privados. Este endpoint exige un ID token de Firebase válido y entrega el
 * archivo como adjunto, de modo que nunca queda accesible por URL pública.
 */
export async function GET(request: NextRequest) {
  try {
    await actor(request);
    const pathname = new URL(request.url).searchParams.get("pathname") || "";
    if (!pathname || pathname.includes("..") || pathname.startsWith("/")) {
      throw new HttpError(400, "Ruta de archivo inválida.");
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new HttpError(503, "El almacenamiento de archivos no está configurado.");

    const result = await get(pathname, { access: "private", token });
    if (!result || result.statusCode !== 200) throw new HttpError(404, "Archivo no encontrado.");

    const fileName = pathname.split("/").pop() || "documento";
    const safeName = fileName.replace(/["\r\n]/g, "_");

    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        "Content-Length": String(result.blob.size ?? ""),
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 503;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo descargar el archivo." },
      { status }
    );
  }
}
