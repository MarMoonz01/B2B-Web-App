'use client';
import React from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, limit, query } from 'firebase/firestore';

export default function DebugPage() {
  const [out, setOut] = React.useState<string>('running...');

  React.useEffect(() => {
    (async () => {
      try {
        const u = auth.currentUser;
        const uid = u?.uid || '(none)';
        const s1 = await getDocs(query(collection(db, 'stores'), limit(1)));
        const first = s1.docs[0]?.id || '(no stores)';
        const n1 = await getDocs(query(collection(db, 'notifications'), limit(1)));
        setOut([
          `auth.currentUser: ${uid}`,
          `stores[0]: ${first}`,
          `notifications count: ${n1.size}`,
        ].join('\n'));
      } catch (e: any) {
        setOut(`ERROR: ${e?.code || e?.message || String(e)}`);
      }
    })();
  }, []);

  return <pre className="p-4 text-sm whitespace-pre-wrap">{out}</pre>;
}
