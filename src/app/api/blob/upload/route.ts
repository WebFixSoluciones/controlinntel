import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { actor, HttpError } from "@/lib/server/security";
import { requireDocumentAccess } from "@/lib/server/document-access";
import { storeDocument, removeDocument } from "@/lib/server/document-storage";
import { planUpload } from "@/lib/file-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof HttpError ? error.message : "No se pudo completar el almacenamiento del archivo. Intenta nuevamente; no se registró una carga exitosa." },
    { status: error instanceof HttpError ? error.status : 503 });
}

export async function POST(request: NextRequest) {
  try {
    const user = await actor(request);
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = String(formData.get("folder") || "templates");
    requireDocumentAccess(user, `${folder}/archivo`, "write");
    if (!(file instanceof File)) throw new HttpError(400, "Selecciona un archivo para cargar.");
    const plan = planUpload(file);
    if (!plan.ok) throw new HttpError(400, plan.reason || "Archivo no permitido.");
    return NextResponse.json(await storeDocument(file, folder));
  } catch (error) { return failure(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await actor(request);
    const reference = new URL(request.url).searchParams.get("url");
    if (!reference) throw new HttpError(400, "Falta la referencia del archivo.");
    const url = new URL(reference, request.nextUrl.origin);
    if (url.origin === request.nextUrl.origin && url.pathname === "/api/blob/download") {
      const pathname = url.searchParams.get("pathname") || "";
      requireDocumentAccess(user, pathname, "delete");
      if (url.searchParams.get("provider") === "gcs") await removeDocument(pathname);
      else {
        if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(503, "El almacenamiento anterior no está disponible. No se eliminó el archivo.");
        await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
      }
    } else if (url.protocol === "https:" && /^[\w-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname)) {
      requireDocumentAccess(user, decodeURIComponent(url.pathname.slice(1)), "delete");
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(503, "El almacenamiento anterior no está disponible. No se eliminó el archivo.");
      await del(url.href, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } else throw new HttpError(400, "Referencia de archivo no permitida.");
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}
