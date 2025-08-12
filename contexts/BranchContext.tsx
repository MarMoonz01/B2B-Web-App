// contexts/BranchContext.tsx
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export type Branch = {
  id: string;
  branchName: string;
  location?: string;
 isActive?: boolean;
  orgId?: string; 
};

type BranchContextType = {
  branches: Branch[];
  loading: boolean;
  selectedBranchId: string | null;
  selectedBranch: Branch | null;
  setSelectedBranchId: (id: string) => void;
  refreshKey: number; // ไว้ trigger refresh UI ถ้าจำเป็น
};

const BranchContext = createContext<BranchContextType | null>(null);

const LS_KEY = 'selectedBranchId';

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // โหลด branches แบบ realtime
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'stores'), (snap) => {
      const list: Branch[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          branchName: data.branchName ?? d.id,
          location: data.location,
          isActive: data.isActive !== false,
        
          orgId: data.orgId,};
      });
      setBranches(list);
      setLoading(false);

      // เซ็ต default selected ถ้ายังไม่มี
      if (!selectedBranchId) {
        const saved = (typeof window !== 'undefined' && localStorage.getItem(LS_KEY)) || '';
        const pick = saved && list.find((b) => b.id === saved) ? saved : (list[0]?.id ?? null);
        if (pick) setSelectedBranchIdState(pick);
      }
    });

    return () => unsub();
  }, [selectedBranchId]);

  // sync กับ localStorage
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
    selectedBranchId,
    selectedBranch,
    setSelectedBranchId,
    refreshKey,
  };

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
};
