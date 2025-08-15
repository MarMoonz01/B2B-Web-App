// contexts/BranchContext.tsx
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

const LS_KEY = 'selectedBranchId';

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // กันการเซ็ต default ซ้ำๆ เวลา snapshot อัปเดต
  const didSetInitial = useRef(false);

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
          orgId: data.orgId,
        };
      });

      setBranches(list);
      setLoading(false);

      // เซ็ต default branch แค่ครั้งแรกหลังได้ข้อมูล
      if (!didSetInitial.current) {
        didSetInitial.current = true;

        let saved: string | null = null;
        if (typeof window !== 'undefined') {
          try {
            saved = localStorage.getItem(LS_KEY);
          } catch {}
        }

        const pick =
          (saved && list.some((b) => b.id === saved) && saved) ||
          list.find((b) => b.isActive)?.id ||
          list[0]?.id ||
          null;

        if (pick) {
          setSelectedBranchIdState(pick);
          try {
            localStorage.setItem(LS_KEY, pick);
          } catch {}
        }
      }
    });

    return () => unsub();
  }, []);

  // sync setter กับ localStorage + trigger refreshKey
  const setSelectedBranchId = useCallback((id: string) => {
    setSelectedBranchIdState(id);
    try {
      if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, id);
    } catch {}
    setRefreshKey((k) => k + 1);
  }, []);

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
