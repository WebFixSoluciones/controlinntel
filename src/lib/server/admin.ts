import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function adminServices() {
  let app = getApps().find((candidate) => candidate.name === "inntel-server");
  if (!app) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    try {
      app = initializeApp({
        credential: json ? cert(JSON.parse(json)) : applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || "inntelcorp-45c89",
        storageBucket: "inntelcorp-45c89.firebasestorage.app",
      }, "inntel-server");
    } catch {
      app = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "inntelcorp-45c89",
      }, "inntel-server");
    }
  }
  return { auth: getAuth(app), db: getFirestore(app), app };
}

