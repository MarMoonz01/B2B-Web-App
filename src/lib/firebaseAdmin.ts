import { cert, getApps, initializeApp, App, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function buildCredential() {
  // ✅ If GOOGLE_APPLICATION_CREDENTIALS is set, use ADC first.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }
  // Support for stringified JSON (not needed if using ADC)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"));
    return cert(json);
  }
  // Final option: separate triple env vars (risk of formatting errors)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }
  // If nothing else is provided, default to ADC (will fail clearly if no file is found)
  return applicationDefault();
}

// For debugging: see which credential path was used
export const CRED_SOURCE =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ? "ADC(GOOGLE_APPLICATION_CREDENTIALS)" :
  process.env.FIREBASE_SERVICE_ACCOUNT ? "SERVICE_ACCOUNT_JSON" :
  process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? "SERVICE_ACCOUNT_BASE64" :
  (process.env.FIREBASE_PRIVATE_KEY ? "TRIPLE_ENV" : "ADC(default)");

let app: App;
if (!getApps().length) {
  app = initializeApp({
    credential: buildCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID, // Not required if the JSON file already has it
  });
} else {
  app = getApps()[0]!;
}

export const adminAuth = getAuth(app);
export const db = getFirestore(app);
