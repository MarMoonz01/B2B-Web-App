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
  selectedBranchId: string | null;
  selectedBranch: Branch | null;
  setSelectedBranchId: (id: string) => void;
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

  // โหลดสาขาแบบ realtime จาก Firestore
  useEffect(() => {
    console.log('🔥 BranchProvider: Setting up Firestore listener...');
    
    const unsub = onSnapshot(
      collection(db, 'stores'), 
      (snap) => {
        console.log('🔥 BranchProvider: Received Firestore update');
        console.log('📋 Raw documents:', snap.docs.map(d => ({ id: d.id, data: d.data() })));
        
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

        console.log('🏪 Processed branches:', list);
        setBranches(list);
        setLoading(false);
        setError(null);

        // ตั้งค่าเริ่มต้นให้ selectedBranchId หากยังไม่มี
        if (!selectedBranchId && list.length > 0) {
          const saved = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
          const validSaved = saved && list.find((b) => b.id === saved) ? saved : null;
          const pick = validSaved ?? list[0]?.id ?? null;
          
          console.log('🎯 Auto-selecting branch:', pick);
          if (pick) setSelectedBranchIdState(pick);
        }
      },
      (err) => {
        console.error('❌ BranchProvider: Firestore error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      console.log('🔥 BranchProvider: Cleaning up Firestore listener');
      unsub();
    };
  }, [selectedBranchId]);

  const setSelectedBranchId = (id: string) => {
    console.log('🎯 BranchProvider: Selecting branch:', id);
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
    error,
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