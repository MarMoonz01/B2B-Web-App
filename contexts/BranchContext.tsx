// src/contexts/BranchContext.tsx
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  refreshKey: number;
};

const BranchContext = createContext<BranchContextType | null>(null);

// ใช้ key เดียวกับ BranchSelect เพื่อให้ sync กัน
const LS_KEY = 'branchId';

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
    null
  );
  const [refreshKey, setRefreshKey] = useState(0);

  // โหลดสาขาแบบ realtime จาก Firestore (collection: stores)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'stores'), (snap) => {
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

      // ตั้งค่าเริ่มต้นให้ selectedBranchId หากยังไม่มี
      if (!selectedBranchId) {
        const saved =
          (typeof window !== 'undefined' && localStorage.getItem(LS_KEY)) || '';
        const validSaved =
          saved && list.find((b) => b.id === saved) ? saved : null;
        const pick = validSaved ?? (list[0]?.id ?? null);
        if (pick) setSelectedBranchIdState(pick);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync กับ localStorage และ trigger refresh UI
  const setSelectedBranchId = (id: string) => {
    setSelectedBranchIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_KEY, id);
    }
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

  return (
    <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    throw new Error('useBranch must be used within BranchProvider');
  }
  return ctx;
}
