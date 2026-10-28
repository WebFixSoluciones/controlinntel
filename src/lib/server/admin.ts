import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function adminServices() {
  let app = getApps().find((candidate) => candidate.name === "inntel-server");
  if (!app) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_CREDENTIALS_JSON;
    const options: any = {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "inntelcorp-45c89",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "inntelcorp-45c89.firebasestorage.app",
    };
    if (json) {
      try {
        const parsed = typeof json === "string" ? JSON.parse(json) : json;
        if (parsed.private_key) {
          options.credential = cert(parsed);
        } else if (parsed.type === "authorized_user" || parsed.refresh_token) {
          const tmpPath = path.join(os.tmpdir(), "gcp-adc-credentials.json");
          if (!fs.existsSync(tmpPath)) {
            fs.writeFileSync(tmpPath, typeof json === "string" ? json : JSON.stringify(json), "utf8");
          }
          process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
          options.credential = applicationDefault();
        }
      } catch (e) {
        console.error("Error al configurar credenciales de Firebase en el servidor:", e);
      }
    } else if (!process.env.FIRESTORE_EMULATOR_HOST) {
      try {
        options.credential = applicationDefault();
      } catch {
        // En entornos sin archivo de credenciales explícito
      }
    }
    app = initializeApp(options, "inntel-server");
  }
  return { auth: getAuth(app), db: getFirestore(app), app };
}

