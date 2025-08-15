import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  enableNetwork,
  disableNetwork,
} from 'firebase/firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FB_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID,
};

// 🐛 Debug: แสดงค่า config
console.log('🔥 Firebase Config:', {
  hasApiKey: !!config.apiKey,
  hasAuthDomain: !!config.authDomain,
  projectId: config.projectId,
  hasStorageBucket: !!config.storageBucket,
  hasMessagingSenderId: !!config.messagingSenderId,
  hasAppId: !!config.appId,
});

// ตรวจสอบว่ามี env vars ครบไหม
for (const [key, value] of Object.entries(config)) {
  if (!value) {
    console.error(`❌ Missing Firebase env var: NEXT_PUBLIC_FB_${key.toUpperCase()}`);
    throw new Error(`Missing Firebase configuration: ${key}`);
  }
}

export const app = getApps().length ? getApp() : initializeApp(config);

// สร้าง Firestore instance พร้อม debug
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

// 🐛 Debug: ทดสอบการเชื่อมต่อ
console.log('🔥 Firebase App initialized:', app.name);
console.log('🔥 Firestore instance created');