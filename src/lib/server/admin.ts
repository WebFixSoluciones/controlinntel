import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function adminServices() {
  let app = getApps().find((candidate) => candidate.name === "inntel-server");
  if (!app) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      const options: any = {
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "inntelcorp-45c89",
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "inntelcorp-45c89.firebasestorage.app",
      };
      if (json) {
        options.credential = cert(JSON.parse(json));
      } else if (!process.env.FIRESTORE_EMULATOR_HOST) {
        options.credential = applicationDefault();
      }
      app = initializeApp(options, "inntel-server");
  }
  return { auth: getAuth(app), db: getFirestore(app), app };
}

