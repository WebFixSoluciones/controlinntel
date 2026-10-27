import test from "node:test";
import assert from "node:assert/strict";
import { planUpload, extensionOf, formatBytes, MAX_UPLOAD_BYTES, IMAGE_COMPRESS_THRESHOLD } from "./file-upload.ts";

test("Carga: certificados y documentos arbitrarios se admiten", () => {
  const certificate = planUpload({ name: "firma.p12", size: 8_000, type: "application/x-pkcs12" });
  assert.equal(certificate.ok, true);
  assert.equal(certificate.kind, "certificado");

  const docx = planUpload({ name: "contrato.docx", size: 40_000, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  assert.equal(docx.ok, true);
  assert.equal(docx.kind, "otro");

  const pdf = planUpload({ name: "escaneo.pdf", size: 9 * 1024 * 1024, type: "application/pdf" });
  assert.equal(pdf.ok, true);
  assert.equal(pdf.kind, "pdf");
  assert.equal(pdf.compress, false);
});

test("Carga: ejecutables y documentos activos se rechazan con motivo", () => {
  for (const name of ["virus.exe", "script.bat", "power.ps1", "pagina.html", "libreria.dll"]) {
    const plan = planUpload({ name, size: 1024, type: "application/octet-stream" });
    assert.equal(plan.ok, false, `${name} debería rechazarse`);
    assert.ok(plan.reason && plan.reason.length > 0);
  }
});

test("Carga: el tope de tamaño se aplica y comunica", () => {
  const plan = planUpload({ name: "respaldo.zip", size: MAX_UPLOAD_BYTES + 1 });
  assert.equal(plan.ok, false);
  assert.match(String(plan.reason), /máximo/);
  assert.equal(planUpload({ name: "borde.zip", size: MAX_UPLOAD_BYTES }).ok, true);
});

test("Carga: las imágenes pesadas se marcan para optimizar y las livianas no", () => {
  const heavy = planUpload({ name: "foto.png", size: IMAGE_COMPRESS_THRESHOLD + 1, type: "image/png" });
  assert.equal(heavy.ok, true);
  assert.equal(heavy.kind, "imagen");
  assert.equal(heavy.compress, true);

  const light = planUpload({ name: "logo.jpg", size: 200 * 1024, type: "image/jpeg" });
  assert.equal(light.compress, false);

  const unknownType = planUpload({ name: "captura.WEBP", size: 3 * 1024 * 1024, type: "" });
  assert.equal(unknownType.kind, "imagen");
  assert.equal(unknownType.compress, true);
});

test("Carga: archivo vacío o sin nombre se rechaza", () => {
  assert.equal(planUpload({ name: "vacio.pdf", size: 0 }).ok, false);
  assert.equal(planUpload({ name: "", size: 100 }).ok, false);
});

test("Carga: utilidades de extensión y formato", () => {
  assert.equal(extensionOf("Firma.P12"), "p12");
  assert.equal(extensionOf("sin_extension"), "");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(3 * 1024 * 1024), "3.0 MB");
});
