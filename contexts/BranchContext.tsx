// contexts/BranchContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export type Branch = { id: string; branchName: string; location?: string; isActive?: boolean; orgId?: string; };

type BranchContextType = {
  branches: Branch[];
  loading: boolean;
  error: string | null;
  selectedBranchId: string | null;
  selectedBranch: Branch | null;
  setSelectedBranchId: (id: string) => void;
  activeBranchId: string | null;
  activeBranchName: string;
  setActiveBranch: (id: string, name?: string) => void;
  refreshKey: number;
};

const BranchContext = createContext<BranchContextType | null>(null);
const LS_KEY = 'branchId';

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // wait for auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) {
      setLoading(true);
      return; // ยังไม่รู้ตัวตน → ยังไม่ subscribe
    }

    const unsub = onSnapshot(
      collection(db, 'stores'),
      (snap) => {
        const list: Branch[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            branchName: data.branchName ?? d.id,
            location: data.location,
            isActive: data.isActive !== false,
            orgId: data.orgId,
          };
        });

        setBranches(list);
        setLoading(false);
        setError(null);

        if (!selectedBranchId && list.length > 0) {
          const saved = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
          const pick = (saved && list.find((b) => b.id === saved)?.id) || list[0]?.id || null;
          if (pick) setSelectedBranchIdState(pick);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid, selectedBranchId]);

  const setSelectedBranchId = (id: string) => {
    setSelectedBranchIdState(id);
    if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, id);
    setRefreshKey((k) => k + 1);
  };

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) ?? null,
    [branches, selectedBranchId]
  );

  const value: BranchContextType = {
    branches,
    loading,
    error,
    selectedBranchId,
    selectedBranch,
    setSelectedBranchId,
    activeBranchId: selectedBranchId,
    activeBranchName: selectedBranch?.branchName ?? (selectedBranchId ?? ''),
    setActiveBranch: (id: string) => setSelectedBranchId(id),
    refreshKey,
  };

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
}
