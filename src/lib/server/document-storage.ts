import { getStorage } from "firebase-admin/storage";
import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { adminServices } from "./admin.ts";
import { documentFolder, documentArea } from "./document-path.ts";

function bucket() {
  const { app } = adminServices();
  const name = process.env.DOCUMENTS_BUCKET || `${app.options.projectId}-documents`;
  return getStorage(app).bucket(name);
}

export async function storeDocument(file: File, folder: string) {
  documentFolder(folder);
  const pathname = `${folder}/${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await bucket().file(pathname).save(bytes, {
    resumable: false, validation: "crc32c", preconditionOpts: { ifGenerationMatch: 0 },
    metadata: {
      contentType: file.type || "application/octet-stream", cacheControl: "private, no-store",
      metadata: { originalName: file.name, sha256 },
    },
  });
  const url = `/api/blob/download?provider=gcs&pathname=${encodeURIComponent(pathname)}`;
  return { success: true, url, downloadUrl: url, pathname, access: "private", size: bytes.length,
    fileName: file.name, contentType: file.type || "application/octet-stream", sha256, provider: "gcs" };
}

export async function readDocument(pathname: string) {
  documentArea(pathname);
  const file = bucket().file(pathname);
  const [metadata] = await file.getMetadata();
  // Pin the generation used for headers, so a concurrent replacement cannot change the bytes.
  const stream = bucket().file(pathname, { generation: metadata.generation }).createReadStream();
  return {
    stream: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
    size: String(metadata.size || "0"), contentType: metadata.contentType || "application/octet-stream",
    fileName: String(metadata.metadata?.originalName || pathname.split("/").pop() || "documento"),
    sha256: String(metadata.metadata?.sha256 || ""),
  };
}

export async function removeDocument(pathname: string) {
  documentArea(pathname);
  await bucket().file(pathname).delete();
}
