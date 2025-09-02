'use client';

import { useState, useEffect } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit,
  Firestore,
  DocumentData,
} from 'firebase/firestore';
import { getFirebaseApp } from '@/src/lib/firebaseClient';
import { FirebaseApp } from 'firebase/app';

/* ============================================================================
 * INTERFACES
 * ==========================================================================*/

export interface KpiData {
  revenue: number;
  inventoryValue: number;
  openTransfers: number;
  criticalAlerts: number;
}

export interface PerformanceData {
  day: string;
  revenue: number;
}

export interface RecentTransaction {
  id: string;
  productName: string;
  type: 'Sale' | 'Transfer In' | 'Transfer Out';
  amount: number;
  timestamp: Date;
}

/* ============================================================================
 * UTILS
 * ==========================================================================*/

function tsToDate(v: any): Date {
  if (!v) return new Date(0);
  if (typeof v?.toDate === 'function') return v.toDate(); // Firestore Timestamp
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date(v);
  return new Date(0);
}

function weekdayShort(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

// Firebase Error helpers
function codeOf(e: unknown): string {
  // FirebaseError: { code: 'permission-denied', message: '...' }
  return (e as any)?.code ?? '';
}
function isPermError(e: unknown) {
  const c = codeOf(e);
  if (c) return c === 'permission-denied' || c === 'unauthenticated';
  const msg = (e as any)?.message?.toString?.() ?? '';
  return msg.includes('Missing or insufficient permissions');
}
function isIndexError(e: unknown) {
  const c = codeOf(e);
  if (c) return c === 'failed-precondition';
  const msg = (e as any)?.message?.toString?.() ?? '';
  return msg.includes('FAILED_PRECONDITION') || msg.includes('index');
}

/* ============================================================================
 * MAIN HOOK
 * ==========================================================================*/

export function useOverviewData(branchId: string | null) {
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      // ไม่มี branch — reset state
      if (!branchId) {
        if (!cancelled) {
          setKpiData(null);
          setPerformanceData([]);
          setRecentTransactions([]);
          setError(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // รอให้ Firebase App พร้อม
        const app: FirebaseApp = await getFirebaseApp();
        const db: Firestore = getFirestore(app);

        /* ---------- 1) KPI ---------- */
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // 1.1 รายได้วันนี้
        let todaysRevenue = 0;
        try {
          const ordersQuery = query(
            collection(db, 'orders'),
            where('branchId', '==', branchId),
            where('createdAt', '>=', Timestamp.fromDate(todayStart))
          );
          const ordersSnapshot = await getDocs(ordersQuery);
          todaysRevenue = ordersSnapshot.docs.reduce((sum, d) => {
            const data = d.data() as DocumentData;
            const total = Number(data?.total ?? 0);
            return sum + (Number.isFinite(total) ? total : 0);
          }, 0);
        } catch (e) {
          if (isIndexError(e)) {
            throw new Error(
              'ต้องสร้าง Composite Index สำหรับ orders: where(branchId ==) + where(createdAt >=). เปิดลิงก์สร้างจากคอนโซล Firestore แล้วลองใหม่อีกครั้ง.'
            );
          }
          if (isPermError(e)) {
            // ถ้าอ่าน orders ไม่ได้ ให้รายได้วันนี้เป็น 0 แต่ไม่ล้มทั้งหน้า
            todaysRevenue = 0;
          } else {
            throw e;
          }
        }

        // 1.2 มูลค่าสินค้าคงคลัง
        let totalInventoryValue = 0;
        try {
          const inventoryQuery = query(collection(db, `stores/${branchId}/inventory`));
          const inventorySnapshot = await getDocs(inventoryQuery);
          totalInventoryValue = inventorySnapshot.docs.reduce((sum, d) => {
            const item = d.data() as DocumentData;
            const qty = Number(item?.quantity ?? 0);
            const cost = Number(item?.costPrice ?? 0);
            return sum + (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(cost) ? cost : 0);
          }, 0);
        } catch (e) {
          if (isPermError(e)) {
            // ถ้าคลังอ่านไม่ได้ ตั้งเป็น 0 แล้วไปต่อ
            totalInventoryValue = 0;
          } else {
            throw e;
          }
        }

        // 1.3 จำนวน transfer ค้าง
        let openTransfersCount = 0;
        try {
          // หมายเหตุ: เอกสาร transfers ของคุณควรมีฟิลด์ involvedBranches (array ของ branchId)
          // ถ้าใช้ฟิลด์ชื่ออื่น ให้แก้ที่ฝั่ง rules +/or query นี้
          const transfersQuery = query(
            collection(db, 'transfers'),
            where('involvedBranches', 'array-contains', branchId),
            where('status', 'in', ['pending', 'in-transit'])
          );
          const transfersSnapshot = await getDocs(transfersQuery);
          openTransfersCount = transfersSnapshot.size;
        } catch (e) {
          if (isIndexError(e)) {
            throw new Error(
              "ต้องสร้าง Composite Index สำหรับ transfers: where(involvedBranches array-contains) + where(status in ['pending','in-transit'])."
            );
          }
          if (isPermError(e)) {
            // อย่าทำให้หน้า overview ดับ—ตั้งเป็น 0 แล้วไปต่อ
            openTransfersCount = 0;
          } else {
            throw e;
          }
        }

        if (!cancelled) {
          setKpiData({
            revenue: todaysRevenue,
            inventoryValue: totalInventoryValue,
            openTransfers: openTransfersCount,
            criticalAlerts: 0,
          });
        }

        /* ---------- 2) Performance 7 วัน ---------- */
        try {
          const last7Days = Array.from({ length: 7 })
            .map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - i);
              d.setHours(0, 0, 0, 0);
              return d;
            })
            .reverse();

          const perf = await Promise.all(
            last7Days.map(async (dayStart) => {
              const dayEnd = new Date(dayStart);
              dayEnd.setHours(23, 59, 59, 999);

              const dailyQuery = query(
                collection(db, 'orders'),
                where('branchId', '==', branchId),
                where('createdAt', '>=', Timestamp.fromDate(dayStart)),
                where('createdAt', '<=', Timestamp.fromDate(dayEnd))
              );
              const snapshot = await getDocs(dailyQuery);
              const dailyRevenue = snapshot.docs.reduce((sum, d) => {
                const data = d.data() as DocumentData;
                const total = Number(data?.total ?? 0);
                return sum + (Number.isFinite(total) ? total : 0);
              }, 0);

              return { day: weekdayShort(dayStart), revenue: dailyRevenue } as PerformanceData;
            })
          );

          if (!cancelled) setPerformanceData(perf);
        } catch (e) {
          if (isIndexError(e)) {
            throw new Error(
              'ต้องสร้าง Composite Index สำหรับ orders: where(branchId ==) + createdAt >= / <= (ช่วงเวลาแต่ละวัน).'
            );
          }
          if (isPermError(e)) {
            // ไม่มีสิทธิ์—ล้างกราฟ แต่ไม่ล้มทั้งหน้า
            if (!cancelled) setPerformanceData([]);
          } else {
            throw e;
          }
        }

        /* ---------- 3) Recent Transactions ---------- */
        try {
          const recentOrdersQuery = query(
            collection(db, 'orders'),
            where('branchId', '==', branchId),
            orderBy('createdAt', 'desc'),
            limit(5)
          );
          const recentOrdersSnapshot = await getDocs(recentOrdersQuery);

          const txs: RecentTransaction[] = recentOrdersSnapshot.docs.map((doc) => {
            const data = doc.data() as DocumentData;
            const firstItemName: string =
              data?.items?.[0]?.name ??
              (Array.isArray(data?.items) && data.items.length > 1 ? 'Multiple Items' : 'Unknown');

            return {
              id: doc.id,
              productName: firstItemName,
              type: 'Sale',
              amount: Number(data?.total ?? 0) || 0,
              timestamp: tsToDate(data?.createdAt),
            };
          });

          if (!cancelled) setRecentTransactions(txs);
        } catch (e) {
          if (isIndexError(e)) {
            throw new Error(
              'ต้องสร้าง Composite Index สำหรับ orders: where(branchId ==) + orderBy(createdAt desc).'
            );
          }
          if (isPermError(e)) {
            // ไม่มีสิทธิ์—ล้างรายการ แต่ไม่ล้มทั้งหน้า
            if (!cancelled) setRecentTransactions([]);
          } else {
            throw e;
          }
        }
      } catch (e: any) {
        console.error('Error fetching overview data:', e);
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  return { kpiData, performanceData, recentTransactions, loading, error };
}
