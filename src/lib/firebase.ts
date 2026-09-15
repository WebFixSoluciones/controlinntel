import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import type { Analytics } from "firebase/analytics";

// Configuración oficial de Firebase para INNTEL CORP S.A.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDPRZzOnooech-TcUqEunt0NATaHnxpSzY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "inntelcorp-45c89.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "inntelcorp-45c89",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "inntelcorp-45c89.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "495714041690",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:495714041690:web:f67df905e09e7cd442fd63",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-4DDGPRZJZK",
};

// Inicialización de la aplicación Firebase (patrón singleton para Next.js)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Instancias principales de Firebase & Firestore
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Inicialización segura de Firebase Analytics en Next.js (solo en navegador)
let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  import("firebase/analytics")
    .then(({ getAnalytics, isSupported }) => {
      isSupported().then((supported) => {
        if (supported) {
          analytics = getAnalytics(app);
        }
      });
    })
    .catch(() => {
      // Analytics no bloquea la operatividad del sistema
    });
}

export { analytics };

export async function initializeAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return null;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) {
      analytics = getAnalytics(app);
      return analytics;
    }
    return null;
  } catch {
    return null;
  }
}
