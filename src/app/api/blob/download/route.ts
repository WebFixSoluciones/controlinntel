import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { actor, HttpError } from "@/lib/server/security";
import { requireDocumentAccess } from "@/lib/server/document-access";
import { readDocument } from "@/lib/server/document-storage";
import { attachmentDisposition } from "@/lib/server/document-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await actor(request);
    const params = new URL(request.url).searchParams;
    const pathname = params.get("pathname") || "";
    requireDocumentAccess(user, pathname, "read");
    let file;
    if (params.get("provider") === "gcs") file = await readDocument(pathname);
    else {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (!token) throw new HttpError(503, "El almacenamiento anterior no está disponible. Vuelve a cargar el archivo original si nunca se almacenó.");
      const result = await get(pathname, { access: "private", token });
      if (!result || result.statusCode !== 200) throw new HttpError(404, "Archivo no encontrado.");
      file = { stream: result.stream, contentType: result.blob.contentType || "application/octet-stream", size: String(result.blob.size),
        fileName: pathname.split("/").pop() || "documento", sha256: "" };
    }
    return new NextResponse(file.stream, { status: 200, headers: {
      "Content-Type": file.contentType, "Content-Length": file.size,
      "Content-Disposition": attachmentDisposition(file.fileName),
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      ...(file.sha256 ? { "X-Content-SHA256": file.sha256 } : {}),
    } });
  } catch (error) {
    const missing = typeof error === "object" && error !== null && "code" in error && error.code === 404;
    return NextResponse.json({ error: error instanceof HttpError ? error.message : missing ? "No se encontró el archivo original. Vuelve a cargarlo." : "No se pudo descargar el archivo. Intenta nuevamente." },
      { status: error instanceof HttpError ? error.status : missing ? 404 : 503 });
  }
}
