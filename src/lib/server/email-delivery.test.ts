import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { sendInvoiceEmail, sendEmailDetailed } from "./email-delivery.ts";
import { DEFAULT_INNTEL_SRI_CONFIG, generarClaveAccesoSRI } from "../sri-service.ts";

async function smtpFixture(rejectCompany = false) {
  const messages: string[] = [], recipients: string[] = [], sockets = new Set<Socket>();
  const server = createServer(socket => {
    sockets.add(socket); socket.on("close", () => sockets.delete(socket)); socket.setEncoding("utf8");
    socket.write("220 localhost QA SMTP\r\n");
    let buffer = "", data = false, message = "";
    socket.on("data", chunk => {
      buffer += chunk;
      while (buffer.includes("\r\n")) {
        const pos = buffer.indexOf("\r\n"), line = buffer.slice(0, pos); buffer = buffer.slice(pos + 2);
        if (data) {
          if (line === ".") { messages.push(message); message = ""; data = false; socket.write("250 Message accepted locally\r\n"); }
          else message += line + "\r\n";
        } else if (/^EHLO|^HELO/.test(line)) socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
        else if (/^AUTH /.test(line)) socket.write("235 Authentication successful\r\n");
        else if (/^RCPT TO:/i.test(line)) {
          recipients.push(line);
          socket.write(rejectCompany && line.includes("company@example.test") ? "550 Recipient rejected for QA\r\n" : "250 Recipient accepted\r\n");
        } else if (line === "DATA") { data = true; socket.write("354 End with dot\r\n"); }
        else if (line === "QUIT") { socket.end("221 Bye\r\n"); }
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  return { port: (server.address() as { port: number }).port, messages, recipients,
    close: async () => { sockets.forEach(socket => socket.destroy()); await new Promise<void>(resolve => server.close(() => resolve())); } };
}

for (const rejectCompany of [false, true]) test(`SMTP local: PDF/XML/CID, copia privada y rechazo parcial=${rejectCompany}`, async t => {
  const smtp = await smtpFixture(rejectCompany); t.after(smtp.close);
  const config = { ...DEFAULT_INNTEL_SRI_CONFIG, razonSocial: "EMISOR QA", ambiente: "2" as const, ruc: "1790016919001", emailEnabled: true,
    emailHost: "127.0.0.1", emailPort: smtp.port, emailSecure: false, emailUser: "sender@example.test", emailFrom: "sender@example.test", emailNotifyClient: true, emailNotifyCompany: true, emailNotificaciones: "company@example.test" };
  const claveAcceso = generarClaveAccesoSRI({ fechaEmision: "2026-11-16", tipoComprobante: "01", ruc: config.ruc, ambiente: "2", establecimiento: "001", puntoEmision: "001", secuencial: 1, codigoNumerico: "87654321" });
  const invoice = { documentType: "factura", documentNumber: "001-001-000000001", claveAcceso, numeroAutorizacion: claveAcceso, date: "2026-11-16", estadoSRI: "AUTORIZADO", ambiente: "2", xmlAutorizado: "<autorizacion>FIXTURE LOCAL</autorizacion>",
    clientName: "CLIENTE QA LOCAL", clientRuc: "1710034065", clientEmail: "client@example.test", items: [{ name: "Servicio QA", sku: "QA", quantity: 1, unitPrice: 100, subtotal: 100, ivaRate: 15, ivaAmount: 15, discount: 0 }], total: 115, ivaTotal: 15, discountTotal: 0, paymentMethod: "credito" };
  const result = await sendInvoiceEmail({ config, invoice }, { readPassword: async () => "LOCAL-QA-ONLY", send: sendEmailDetailed });
  assert.equal(result.sent, !rejectCompany); assert.equal(result.partial, rejectCompany);
  assert.equal(result.deliveryUncertain, false);
  assert.ok(result.recipients.includes("client@example.test"));
  if (rejectCompany) assert.deepEqual(result.rejected, ["company@example.test"]);
  else assert.ok(result.recipients.includes("company@example.test"));
  assert.equal(smtp.messages.length, 1);
  assert.ok(smtp.recipients.some(command => command.includes("company@example.test")));
  const mime = smtp.messages[0];
  assert.match(mime, /Content-Type: application\/pdf/i); assert.match(mime, /Content-Type: application\/xml/i);
  assert.match(mime, /Content-ID: <inntel-logo>/i); assert.match(mime, /Content-Type: image\/png/i);
  assert.match(mime, /To: client@example.test/i); assert.doesNotMatch(mime, /^Bcc:/im);
});
