'use client';

import { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { getFirebaseApp } from '@/src/lib/firebaseClient';
// ❗️แก้ตรงนี้
import { useSession } from 'next-auth/react';

export interface UserBranch {
  branchId: string;
  branchName: string;
  roles: string[];
}

export function useUserBranches() {
  const { data: session } = useSession(); // ✅ ถูกต้อง
  const uid = (session?.user as any)?.id as string | undefined; // ปรับตามโครง session ของคุณ

  const [branches, setBranches] = useState<UserBranch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!uid) { setBranches([]); setLoading(false); return; }

      const app = await getFirebaseApp();
      const db = getFirestore(app);

      // ดึงสิทธิ์ของผู้ใช้
      const q = query(collection(db, 'userBranchRoles'), where('uid', '==', uid));
      const snap = await getDocs(q);

      const grouped: Record<string, string[]> = {};
      snap.forEach(d => {
        const { branchId, role } = d.data() as any;
        if (!grouped[branchId]) grouped[branchId] = [];
        grouped[branchId].push(role);
      });

      const results: UserBranch[] = [];
      for (const bId of Object.keys(grouped)) {
        const sDoc = await getDoc(doc(db, 'stores', bId));
        results.push({
          branchId: bId,
          branchName: sDoc.exists() ? (sDoc.data() as any).branchName : bId,
          roles: grouped[bId],
        });
      }
      setBranches(results);
      setLoading(false);
    })();
  }, [uid]);

  return { branches, loading };
}
