/** Provision private document storage. No public access or additional IAM grants. */
import nextEnv from "@next/env";
import { GoogleAuth } from "google-auth-library";
nextEnv.loadEnvConfig(process.cwd());
const project = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (project !== "inntelcorp-45c89" || process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Proyecto no admitido.");
const name = `${project}-documents`;
const apply = process.argv.includes("--apply");
const auth = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
async function request(url, method = "GET", data) {
  try { return await auth.request({ url, method, ...(data ? { data } : {}), timeout: 20000 }); }
  catch (error) {
    if (error.response?.status === 404) return { status: 404 };
    throw new Error(`No se completó la operación de almacenamiento (HTTP ${error.response?.status || "sin respuesta"}).`);
  }
}
let result = await request(`https://storage.googleapis.com/storage/v1/b/${name}`);
console.log(JSON.stringify({ project, bucket: name, exists: result.status !== 404, apply }));
if (!apply) process.exit(0);
if (result.status === 404) result = await request(`https://storage.googleapis.com/storage/v1/b?project=${project}`, "POST", {
  name, location: "southamerica-west1", storageClass: "STANDARD",
  iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: "enforced" },
  labels: { application: "controlinntel", purpose: "private-documents" },
});
if (!result.data.iamConfiguration?.uniformBucketLevelAccess?.enabled || result.data.iamConfiguration?.publicAccessPrevention !== "enforced") {
  throw new Error("El depósito existe pero su privacidad requiere revisión; no se alteraron sus permisos.");
}
console.log(JSON.stringify({ bucket: name, location: result.data.location, publicAccess: false, iamGrantsAdded: false }));
process.exit(0);
