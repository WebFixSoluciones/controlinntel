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
          // Se reescribe siempre: en serverless /tmp sobrevive entre invocaciones y una
          // credencial vieja dejaría la aplicación sin datos de forma silenciosa.
          const tmpPath = path.join(os.tmpdir(), "gcp-adc-credentials.json");
          fs.writeFileSync(tmpPath, JSON.stringify(parsed), "utf8");
          process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
          options.credential = applicationDefault();
        } else {
          throw new Error("El JSON de credenciales no es de tipo service account ni authorized_user.");
        }
      } catch (e) {
        // Una credencial presente pero inválida debe fallar de forma visible:
        // caer a applicationDefault() aquí solo produce lecturas vacías sin aviso.
        console.error("Error al configurar credenciales de Firebase en el servidor:", e);
        throw e;
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

