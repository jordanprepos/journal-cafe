import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import { authPersistence } from "./persistence";

// Expo bakes EXPO_PUBLIC_* into the bundle at startup, so edits to .env need a
// Metro restart to take effect — same rule as the old EXPO_PUBLIC_BACKEND_URL.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  throw new Error(
    `Firebase config incomplete — missing ${missing.join(", ")}. ` +
      `Copy frontend/.env.example to frontend/.env, fill it in, and restart Metro.`,
  );
}

// Fast Refresh re-runs this module; initializeApp/initializeAuth both throw on a
// second call, so reuse the existing instance when one is already registered.
const existing = getApps().length > 0;
export const app = existing ? getApp() : initializeApp(firebaseConfig);
export const auth = existing
  ? getAuth(app)
  : initializeAuth(app, { persistence: authPersistence });
export const db = getFirestore(app);
export const storage = getStorage(app);
