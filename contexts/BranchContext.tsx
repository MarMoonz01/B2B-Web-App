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
  error: string | null;

  /** ของเดิม */
  selectedBranchId: string | null;
  selectedBranch: Branch | null;
  setSelectedBranchId: (id: string) => void;

  /** เพิ่ม alias เพื่อความเข้ากันได้ย้อนหลัง */
  activeBranchId: string | null;
  activeBranchName: string;
  setActiveBranch: (id: string, name?: string) => void;

  refreshKey: number;
};

const BranchContext = createContext<BranchContextType | null>(null);

const LS_KEY = 'branchId';

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
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
          const validSaved = saved && list.find((b) => b.id === saved) ? saved : null;
          const pick = validSaved ?? list[0]?.id ?? null;
          if (pick) setSelectedBranchIdState(pick);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [selectedBranchId]);

  const setSelectedBranchId = (id: string) => {
    setSelectedBranchIdState(id);
    if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, id);
    setRefreshKey((k) => k + 1);
  };

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) ?? null,
    [branches, selectedBranchId]
  );

  // ===== Aliases เพื่อความเข้ากันได้ย้อนหลัง =====
  const activeBranchId = selectedBranchId;
  const activeBranchName = selectedBranch?.branchName ?? (selectedBranchId ?? '');
  const setActiveBranch = (id: string, _name?: string) => setSelectedBranchId(id);

  const value: BranchContextType = {
    branches,
    loading,
    error,
    selectedBranchId,
    selectedBranch,
    setSelectedBranchId,

    // aliases
    activeBranchId,
    activeBranchName,
    setActiveBranch,

    refreshKey,
  };

  return (
    <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
}
