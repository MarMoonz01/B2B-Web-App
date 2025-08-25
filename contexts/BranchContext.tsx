'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
  PropsWithChildren,
} from 'react';

//
// ===== Types =====
//
export type Branch = {
  id: string;
  branchName: string;
  location?: string;
  isActive: boolean;
  orgId?: string;
};

type BranchContextValue = {
  branches: Branch[];
  selectedBranchId: string | null;
  selectedBranch: Branch | null;
  setSelectedBranchId: (id: string) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

//
// ===== Constants =====
//
const STORAGE_KEY = 'branchId';

//
// ===== Context =====
//
const BranchContext = createContext<BranchContextValue | undefined>(undefined);

//
// ===== Provider =====
//
export function BranchProvider({ children }: PropsWithChildren<{}>) {
  const mounted = useRef<boolean>(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- helpers ---
  const pickInitialBranchId = useCallback(
    (list: Branch[]): string | null => {
      if (!list?.length) return null;

      // 1) ลองดึงจาก localStorage
      let saved: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          saved = localStorage.getItem(STORAGE_KEY);
        } catch {
          // ignore
        }
      }

      const savedExists = saved && list.some((b) => b.id === saved);
      if (saved && savedExists) return saved!;

      // 2) เลือกอันแรกที่ active; ถ้าไม่มี เลือกตัวแรก
      const firstActive = list.find((b) => b.isActive !== false);
      return (firstActive?.id ?? list[0].id) || null;
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/branches/visible', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d?.ok) {
        throw new Error(d?.error || 'Failed to load branches');
      }

      const list: Branch[] = (d.branches as any[]).map((b) => ({
        id: String(b.id),
        branchName: b.branchName ?? String(b.id),
        location: b.location,
        isActive: b.isActive !== false,
        orgId: b.orgId,
      }));

      setBranches(list);

      // ถ้ายังไม่มี selection ให้เลือกตามกติกา
      setSelectedBranchIdState((prev) => prev ?? pickInitialBranchId(list));
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [pickInitialBranchId]);

  // --- mount: load once ---
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    void load();
  }, [load]);

  // --- persist selection to localStorage ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedBranchId) return;
    try {
      localStorage.setItem(STORAGE_KEY, selectedBranchId);
    } catch {
      // ignore
    }
  }, [selectedBranchId]);

  // --- cross-tab sync ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === STORAGE_KEY) {
        setSelectedBranchIdState(ev.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // --- derived selectedBranch ---
  const selectedBranch = useMemo(
    () => (selectedBranchId ? branches.find((b) => b.id === selectedBranchId) ?? null : null),
    [branches, selectedBranchId]
  );

  // --- public setter (ป้องกันกรณีเลือก id ที่ไม่มีในลิสต์) ---
  const setSelectedBranchId = useCallback(
    (id: string) => {
      if (!id) return;
      const exists = branches.some((b) => b.id === id);
      if (exists) {
        setSelectedBranchIdState(id);
      } else {
        // ถ้า id ไม่อยู่ในลิสต์ล่าสุด ให้รีโหลดก่อน แล้วค่อยตั้ง (กัน race)
        void (async () => {
          await load();
          const existsAfter = (prev: Branch[]) => prev.some((b) => b.id === id);
          setBranches((prev) => {
            if (existsAfter(prev)) setSelectedBranchIdState(id);
            return prev;
          });
        })();
      }
    },
    [branches, load]
  );

  const value = useMemo<BranchContextValue>(
    () => ({
      branches,
      selectedBranchId,
      selectedBranch,
      setSelectedBranchId,
      loading,
      error,
      refresh: load,
    }),
    [branches, selectedBranchId, selectedBranch, setSelectedBranchId, loading, error, load]
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

//
// ===== Hooks =====
//
export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return ctx;
}

/**
 * Hook สะดวกใช้ในคอมโพเนนต์ที่ต้อง “ต้องมีสาขาเลือกแล้วเสมอ”
 * - ถ้าไม่มีสาขา และไม่อยู่ระหว่างโหลด → โยน error ให้ page จัดการเอง (เช่น แสดง onboarding)
 */
export function useRequiredBranch() {
  const ctx = useBranch();
  const { selectedBranch, loading } = ctx;

  if (!loading && !selectedBranch) {
    throw new Error('No branch selected or you have no visible branches.');
  }
  return ctx;
}
