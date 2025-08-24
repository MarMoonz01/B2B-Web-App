// src/lib/firebaseClient.ts
// ปลอดภัยต่อ SSR: init เฉพาะบน browser + lazy import
let _app: import("firebase/app").FirebaseApp | null = null;

function getConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      "Missing Firebase client envs. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    );
  }
  return { apiKey, authDomain, projectId };
}

export async function getFirebaseApp() {
  if (typeof window === "undefined") {
    throw new Error("getFirebaseApp must be called on the client (window undefined).");
  }
  const { initializeApp, getApps } = await import("firebase/app");
  if (!_app) {
    const config = getConfig();
    _app = getApps().length ? getApps()[0]! : initializeApp(config);
  }
  return _app!;
}

export async function getClientAuth() {
  if (typeof window === "undefined") {
    throw new Error("getClientAuth must be called on the client.");
  }
  const app = await getFirebaseApp();
  const { getAuth } = await import("firebase/auth");
  return getAuth(app);
}
