import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  // CACHE_SIZE_UNLIMITED, // ใช้ถ้าอยากเปิดแคชใหญ่
} from 'firebase/firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FB_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID,
};

// ตรวจ env ให้ครบ (ถ้าอยากปิด ก็ลบบล็อก for...of นี้ได้)
for (const [k, v] of Object.entries(config)) {
  if (!v) throw new Error(`Missing Firebase env var: ${k}`);
}

export const app = getApps().length ? getApp() : initializeApp(config as any);

// ใช้ initializeFirestore พร้อม fallback โหมดเครือข่าย
export const db = initializeFirestore(app, {
  // ถ้าเครือข่าย/ปลั๊กอินบล็อกสตรีม จะสลับไป long-polling ให้อัตโนมัติ
  experimentalAutoDetectLongPolling: true,
  // ปิด fetch streams เพื่อเลี่ยงปัญหา proxy บางประเภท (ลองเปิดเป็น true หากเครือข่ายคุณรองรับ)
  useFetchStreams: false,
  // cacheSizeBytes: CACHE_SIZE_UNLIMITED,
});
