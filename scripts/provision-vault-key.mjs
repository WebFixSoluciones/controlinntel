/** Provision the existing vault key in Secret Manager; never rotate or print it. */
import nextEnv from "@next/env";
import { GoogleAuth } from "google-auth-library";
import { setTimeout } from "node:timers/promises";
import { parseVaultKey } from "../src/lib/server/vault-key.ts";

nextEnv.loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply");
const project = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (project !== "inntelcorp-45c89" || process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Proyecto o entorno no admitido para este aprovisionamiento.");
const key = process.env.VAULT_KEY_BASE64;
if (!key) throw new Error("Falta la clave existente; no se generará una distinta.");
parseVaultKey(key);

const auth = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
async function request(url, method = "GET", data) {
  try { return await auth.request({ url, method, ...(data ? { data } : {}), timeout: 15000 }); }
  catch (error) {
    const status = error.response?.status;
    if (status === 404) return { status, data: null };
    // OAuth request objects may contain credentials: never log or rethrow them.
    throw new Error(`No se completó la operación de Secret Manager (HTTP ${status || "sin respuesta"}).`);
  }
}
const service = `https://serviceusage.googleapis.com/v1/projects/${project}/services/secretmanager.googleapis.com`;
const state = await request(service);
console.log(JSON.stringify({ project, apply, serviceState: state.data.state, localKeyValid: true }));
if (!apply) { console.log("Simulación: no se modificó la infraestructura ni la clave."); process.exit(0); }
if (state.data.state !== "ENABLED") {
  const operation = await request(service + ":enable", "POST", {});
  let done = !!operation.data.done;
  for (let attempt = 0; !done && attempt < 12; attempt++) {
    await setTimeout(1000);
    const progress = await request(`https://serviceusage.googleapis.com/v1/${operation.data.name}`);
    if (progress.data.error) throw new Error("No se pudo habilitar Secret Manager.");
    done = !!progress.data.done;
  }
  if (!done) throw new Error("Habilitación en curso; vuelve a ejecutar para verificarla.");
  console.log("Secret Manager habilitado.");
}
const resource = `projects/${project}/secrets/inntel-vault-key`;
const metadata = await request(`https://secretmanager.googleapis.com/v1/${resource}`);
if (metadata.status === 404) {
  await request(`https://secretmanager.googleapis.com/v1/projects/${project}/secrets?secretId=inntel-vault-key`, "POST", { replication: { automatic: {} }, labels: { application: "controlinntel", purpose: "vault-encryption" } });
  const version = await request(`https://secretmanager.googleapis.com/v1/${resource}:addVersion`, "POST", { payload: { data: Buffer.from(key.trim(), "utf8").toString("base64") } });
  if (!version.data.name.endsWith("/versions/1")) throw new Error("Versión inesperada; revisa la referencia antes de publicar.");
}
const stored = await request(`https://secretmanager.googleapis.com/v1/${resource}/versions/1:access`);
if (stored.status === 404) throw new Error("Existe el secreto, pero falta la versión 1; no se alteró su historial.");
const recovered = Buffer.from(stored.data.payload.data, "base64").toString("utf8");
if (!parseVaultKey(recovered).equals(parseVaultKey(key))) throw new Error("La clave gestionada difiere de la local; no se reemplazó ninguna clave.");
console.log(JSON.stringify({ resource: resource + "/versions/1", storedKeyVerified: true, keyRotated: false, permissionsChanged: false }));
process.exit(0);
