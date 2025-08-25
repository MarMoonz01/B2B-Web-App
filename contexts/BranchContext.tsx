// contexts/BranchContext.tsx
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  getDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

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

  // aliases (compat)
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
  const [error, setError]   = useState<string | null>(null);

  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ---- auth listener ----
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  // เก็บ map ของ unsub ของแต่ละสาขาเพื่อเคลียร์เวลา roles เปลี่ยน
  const storeUnsubsRef = useRef<Record<string, Unsubscribe>>({});

  // ---- subscribe รายชื่อสาขาจาก userBranchRoles แล้วค่อย subscribe stores/{id} ทีละอัน ----
  useEffect(() => {
    // เคลียร์ state ตอนยังไม่มี uid
    if (!uid) {
      // ยกเลิก sub ทั้งหมดของสาขาเดิม
      Object.values(storeUnsubsRef.current).forEach((u) => u?.());
      storeUnsubsRef.current = {};
      setBranches([]);
      setSelectedBranchIdState(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const rolesQ = query(
      collection(db, 'userBranchRoles'),
      where('uid', '==', uid)
    );

    const unsubRoles = onSnapshot(
      rolesQ,
      async (snap) => {
        // branchIds ที่ user เข้าถึงได้
        const branchIds = snap.docs
          .map((d) => (d.data() as any)?.branchId)
          .filter(Boolean) as string[];

        // ยกเลิก sub ของสาขาที่ไม่มีแล้ว
        for (const [bid, unsub] of Object.entries(storeUnsubsRef.current)) {
          if (!branchIds.includes(bid)) {
            unsub?.();
            delete storeUnsubsRef.current[bid];
          }
        }

        if (branchIds.length === 0) {
          setBranches([]);
          setLoading(false);
          setError(null);
          return;
        }

        // subscribe stores/{branchId} ทีละตัว
        const nextBranches: Record<string, Branch> = {};

        await Promise.all(
          branchIds.map(async (branchId) => {
            // ถ้ายังไม่ได้ subscribe ค่อย subscribe
            if (!storeUnsubsRef.current[branchId]) {
              storeUnsubsRef.current[branchId] = onSnapshot(
                doc(db, 'stores', branchId),
                (ds) => {
                  if (!ds.exists()) {
                    // ถ้าเอกสารหาย ให้ลบออก
                    setBranches((prev) => prev.filter((b) => b.id !== branchId));
                    return;
                  }
                  const data = ds.data() as any;
                  const b: Branch = {
                    id: branchId,
                    branchName: data.branchName ?? branchId,
                    location: data.location,
                    isActive: data.isActive !== false,
                    orgId: data.orgId,
                  };
                  // อัปเดตรายการแบบ upsert
                  setBranches((prev) => {
                    const idx = prev.findIndex((x) => x.id === branchId);
                    if (idx === -1) return [...prev, b].sort((a, c) => a.branchName.localeCompare(c.branchName));
                    const copy = [...prev];
                    copy[idx] = b;
                    return copy.sort((a, c) => a.branchName.localeCompare(c.branchName));
                  });
                },
                (err) => {
                  console.error('stores doc subscribe error:', err);
                  setError(err.message);
                }
              );
            }

            // ดึงครั้งแรกเร็ว ๆ ถ้ายังไม่มีใน state (รอ onSnapshot ก็ได้ แต่ทำให้ขึ้นไว)
            if (!branches.find((x) => x.id === branchId)) {
              try {
                const ds = await getDoc(doc(db, 'stores', branchId));
                if (ds.exists()) {
                  const data = ds.data() as any;
                  const b: Branch = {
                    id: branchId,
                    branchName: data.branchName ?? branchId,
                    location: data.location,
                    isActive: data.isActive !== false,
                    orgId: data.orgId,
                  };
                  nextBranches[branchId] = b;
                }
              } catch (e: any) {
                // ถ้า rules ไม่ให้ ก็รอ onSnapshot แทน
                console.debug('getDoc stores/{id} fallback error', branchId, e?.message);
              }
            }
          })
        );

        // merge preload ที่ getDoc มา (ถ้ามี)
        if (Object.keys(nextBranches).length) {
          setBranches((prev) => {
            const map = new Map(prev.map((b) => [b.id, b]));
            for (const b of Object.values(nextBranches)) map.set(b.id, b);
            return Array.from(map.values()).sort((a, c) => a.branchName.localeCompare(c.branchName));
          });
        }

        setLoading(false);

        // ตั้งค่า selectedBranchId ครั้งแรก/เมื่อรายการเปลี่ยน
        setSelectedBranchIdState((cur) => {
          if (cur && branchIds.includes(cur)) return cur;
          const saved = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
          const validSaved = saved && branchIds.includes(saved) ? saved : null;
          return validSaved ?? branchIds[0] ?? null;
        });
      },
      (err) => {
        console.error('userBranchRoles subscribe error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubRoles();
      // ยกเลิก sub stores/{id} ทั้งหมด
      Object.values(storeUnsubsRef.current).forEach((u) => u?.());
      storeUnsubsRef.current = {};
    };
  }, [uid]); // เมื่อ uid เปลี่ยน ค่อยเซ็ตซับใหม่ทั้งหมด

  const setSelectedBranchId = (id: string) => {
    setSelectedBranchIdState(id);
    if (typeof window !== 'undefined') localStorage.setItem(LS_KEY, id);
    setRefreshKey((k) => k + 1);
  };

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) ?? null,
    [branches, selectedBranchId]
  );

  // aliases (compat)
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
