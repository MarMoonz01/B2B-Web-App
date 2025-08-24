import { cert, getApps, initializeApp, App, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function buildCredential() {
  // ✅ ถ้ามี GOOGLE_APPLICATION_CREDENTIALS ให้ใช้ ADC ก่อนเลย
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }
  // รองรับใส่ทั้ง JSON เป็นสตริง (ไม่จำเป็นถ้าใช้ ADC)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"));
    return cert(json);
  }
  // ทางเลือกสุดท้าย: ชุดแยก 3 ตัว (เสี่ยงฟอร์แมตผิด)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }
  // ถ้าไม่มีอะไรเลย ให้ใช้ ADC (จะพังชัดๆ ถ้าไม่มีไฟล์)
  return applicationDefault();
}

// สำหรับ debug: ดูว่าใช้ credential เส้นทางไหน
export const CRED_SOURCE =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ? "ADC(GOOGLE_APPLICATION_CREDENTIALS)" :
  process.env.FIREBASE_SERVICE_ACCOUNT ? "SERVICE_ACCOUNT_JSON" :
  process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? "SERVICE_ACCOUNT_BASE64" :
  (process.env.FIREBASE_PRIVATE_KEY ? "TRIPLE_ENV" : "ADC(default)");

let app: App;
if (!getApps().length) {
  app = initializeApp({
    credential: buildCredential(),
    // projectId ไม่จำเป็นถ้าไฟล์ JSON มีอยู่แล้ว
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
} else {
  app = getApps()[0]!;
}

export const adminAuth = getAuth(app);
export const db = getFirestore(app);
