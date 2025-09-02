'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { getFirebaseApp } from '@/src/lib/firebaseClient';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

export interface UserBranch {
  branchId: string;
  branchName: string;
  roles: string[];
}

interface UseUserBranchesState {
  branches: UserBranch[];
  loading: boolean;
  error: string | null;
  uid: string | null;
}

export function useUserBranches() {
  const [state, setState] = useState<UseUserBranchesState>({
    branches: [],
    loading: true,
    error: null,
    uid: null,
  });

  // ✅ ใช้ Firebase Auth (รอ app ให้พร้อมด้วย await)
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const app = await getFirebaseApp();
        const auth = getAuth(app);
        unsub = onAuthStateChanged(
          auth,
          (user: User | null) => {
            if (cancelled) return;
            setState((s) => ({ ...s, uid: user?.uid ?? null }));
          },
          (err) => {
            console.error('onAuthStateChanged error', err);
            if (cancelled) return;
            setState((s) => ({ ...s, error: err?.message ?? 'Auth error' }));
          }
        );
      } catch (e: any) {
        console.error('init auth error', e);
        if (cancelled) return;
        setState((s) => ({ ...s, error: e?.message ?? 'Auth init error' }));
      }
    })();

    return () => {
      cancelled = true;
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // โหลดรายการสาขาที่ผู้ใช้มีสิทธิ์
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { uid } = state;
      if (!uid) {
        if (!cancelled) {
          setState((s) => ({ ...s, branches: [], loading: false }));
        }
        return;
      }

      if (!cancelled) {
        setState((s) => ({ ...s, loading: true, error: null }));
      }

      try {
        const app = await getFirebaseApp();
        const db = getFirestore(app);

        // จำกัดผลลัพธ์ด้วย where('uid','==', uid)
        const rolesQ = query(collection(db, 'userBranchRoles'), where('uid', '==', uid));
        const rolesSnap = await getDocs(rolesQ);

        // รวม role ต่อสาขา (กันซ้ำด้วย Set)
        const grouped = new Map<string, Set<string>>();
        rolesSnap.forEach((d) => {
          const data = d.data() as any;
          const bId = data?.branchId as string | undefined;
          const role = data?.role as string | undefined;
          if (!bId) return;
          if (!grouped.has(bId)) grouped.set(bId, new Set<string>());
          if (role) grouped.get(bId)!.add(role);
        });

        const results: UserBranch[] = [];
        for (const [bId, rolesSet] of grouped.entries()) {
          try {
            const sDoc = await getDoc(doc(db, 'stores', bId));
            const branchName = sDoc.exists()
              ? ((sDoc.data() as any)?.branchName ?? bId)
              : bId;

            results.push({
              branchId: bId,
              branchName,
              roles: Array.from(rolesSet),
            });
          } catch (e) {
            console.warn('load store name failed', bId, e);
            results.push({
              branchId: bId,
              branchName: bId,
              roles: Array.from(rolesSet),
            });
          }
        }

        // เรียงชื่อสาขา
        results.sort((a, b) => a.branchName.localeCompare(b.branchName));

        if (!cancelled) {
          setState((s) => ({ ...s, branches: results, loading: false, error: null }));
        }
      } catch (e: any) {
        console.error('useUserBranches error', e);
        if (!cancelled) {
          setState((s) => ({
            ...s,
            branches: [],
            loading: false,
            error: e?.message ?? 'Failed to load user branches',
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.uid]);

  return useMemo(
    () => ({ branches: state.branches, loading: state.loading, error: state.error }),
    [state.branches, state.loading, state.error]
  );
}
