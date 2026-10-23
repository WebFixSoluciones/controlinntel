import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";

export const runtime = "nodejs";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, limit = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/**
 * Handler POST para subida de archivos a Vercel Blob con fallback elegante para desarrollo local
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!checkRateLimit(`blob-upload-${ip}`, 30)) {
      return NextResponse.json(
        { error: "Demasiadas subidas de archivo en poco tiempo. Espera un momento." },
        { status: 429 }
      );
    }
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "templates";

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo para subir." },
        { status: 400 }
      );
    }

    // Validación de tamaño máximo (15 MB)
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El archivo excede el tamaño máximo permitido de 15 MB." },
        { status: 413 }
      );
    }

    // Validación de extensiones prohibidas (ejecutables y scripts)
    const extension = file.name.split(".").pop()?.toLowerCase();
    const disallowedExtensions = new Set(["exe", "bat", "sh", "cmd", "msi", "vbs", "ps1", "scr", "jar", "bin"]);
    if (extension && disallowedExtensions.has(extension)) {
      return NextResponse.json(
        { error: `Extensión de archivo prohibida por seguridad (.${extension}). Solo se admiten documentos, imágenes y certificados.` },
        { status: 415 }
      );
    }

    const filename = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    // Si el token de Vercel Blob está configurado en el entorno
    if (token) {
      try {
        const blob = await put(filename, file, {
          access: "public",
          token,
        });

        return NextResponse.json({
          success: true,
          url: blob.url,
          downloadUrl: blob.downloadUrl,
          pathname: blob.pathname,
          size: file.size,
          fileName: file.name,
          contentType: file.type,
          provider: "vercel-blob",
        });
      } catch (blobErr: any) {
        console.error("[VERCEL BLOB ERROR]:", blobErr);
        // Continuar hacia fallback si hay error de credenciales
      }
    }

    // Fallback elegante (desarrollo local o sin token de Vercel Blob conectado)
    // Se genera una data URI o blob simulado ligero para mantener operatividad del sistema
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString("base64");
    const mimeType = file.type || "application/octet-stream";
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    return NextResponse.json({
      success: true,
      url: dataUrl,
      downloadUrl: dataUrl,
      pathname: filename,
      size: file.size,
      fileName: file.name,
      contentType: mimeType,
      provider: "local-fallback",
      note: "Archivo procesado con fallback local (configure BLOB_READ_WRITE_TOKEN en Vercel para almacenamiento Blob en la nube)",
    });
  } catch (error: any) {
    console.error("[UPLOAD API ERROR]:", error);
    return NextResponse.json(
      { error: error?.message || "Error al procesar la subida del archivo." },
      { status: 500 }
    );
  }
}

/**
 * Handler DELETE para eliminar archivos de Vercel Blob
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "La URL del archivo a eliminar es requerida." },
        { status: 400 }
      );
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if (token && url.startsWith("https://") && url.includes(".blob.vercel-storage.com")) {
      await del(url, { token });
      return NextResponse.json({ success: true, message: "Archivo eliminado de Vercel Blob." });
    }

    return NextResponse.json({ success: true, message: "Referencia de archivo eliminada." });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al eliminar el archivo." },
      { status: 500 }
    );
  }
}
