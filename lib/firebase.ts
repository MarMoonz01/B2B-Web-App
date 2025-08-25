import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  initializeFirestore,
} from 'firebase/firestore'
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from 'firebase/auth'

const config = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FB_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID,
}

// ตรวจ env ให้ครบ (เหมือนเดิม)
for (const [k, v] of Object.entries(config)) {
  if (!v) throw new Error(`Missing Firebase configuration: ${k}`)
}

export const app = getApps().length ? getApp() : initializeApp(config)

// Firestore
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
})

// 🔐 Auth
export const auth = getAuth(app)

// ให้ client login แบบ anonymous อัตโนมัติ
if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      try {
        const cred = await signInAnonymously(auth)
        console.log('🔐 Signed in anonymously:', cred.user.uid)
      } catch (e) {
        console.error('Failed to sign in anonymously:', e)
      }
    } else {
      console.log('🔐 Firebase user:', user.uid)
    }
  })
}
