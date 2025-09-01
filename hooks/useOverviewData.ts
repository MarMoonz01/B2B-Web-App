import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, Timestamp, orderBy, limit, Firestore } from 'firebase/firestore';
import { getFirebaseApp } from '@/src/lib/firebaseClient';
import { FirebaseApp } from 'firebase/app';

// ============================================================================
// INTERFACE DEFINITIONS
// ============================================================================

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

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useOverviewData(branchId: string | null) {
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // ถ้ายังไม่มี branchId ก็ไม่ต้องทำอะไร
    if (!branchId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // รอให้ Firebase App พร้อมใช้งานก่อน แล้วจึงสร้าง db instance
        const app: FirebaseApp = await getFirebaseApp();
        const db: Firestore = getFirestore(app);

        // --- 1. Fetch KPI Data ---
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        // Query สำหรับหารายได้ของวันนี้
        const ordersQuery = query(
          collection(db, 'orders'),
          where('branchId', '==', branchId),
          where('createdAt', '>=', Timestamp.fromDate(todayStart))
        );
        const ordersSnapshot = await getDocs(ordersQuery);
        const todaysRevenue = ordersSnapshot.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0);

        // Query สำหรับหามูลค่าสินค้าคงคลังทั้งหมด
        const inventoryQuery = query(collection(db, `stores/${branchId}/inventory`));
        const inventorySnapshot = await getDocs(inventoryQuery);
        const totalInventoryValue = inventorySnapshot.docs.reduce((sum, doc) => {
            const item = doc.data();
            return sum + (item.quantity * (item.costPrice || 0));
        }, 0);

        // Query สำหรับหาจำนวนการโอนย้ายที่ยังไม่เสร็จสิ้น
        const transfersQuery = query(
          collection(db, 'transfers'),
          where('involvedBranches', 'array-contains', branchId),
          where('status', 'in', ['pending', 'in-transit'])
        );
        const transfersSnapshot = await getDocs(transfersQuery);
        const openTransfersCount = transfersSnapshot.size;

        setKpiData({
          revenue: todaysRevenue,
          inventoryValue: totalInventoryValue,
          openTransfers: openTransfersCount,
          criticalAlerts: 0, // Placeholder for alerts logic
        });
        
        // --- 2. Fetch 7-Day Performance Data ---
        const last7Days = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d;
        }).reverse();

        const performancePromises = last7Days.map(async (date) => {
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);

            const dailyQuery = query(
              collection(db, 'orders'),
              where('branchId', '==', branchId),
              where('createdAt', '>=', Timestamp.fromDate(dayStart)),
              where('createdAt', '<=', Timestamp.fromDate(dayEnd))
            );
            const snapshot = await getDocs(dailyQuery);
            const dailyRevenue = snapshot.docs.reduce((sum, doc) => sum + (doc.data().total || 0), 0);
            
            return {
                day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                revenue: dailyRevenue,
            };
        });
        setPerformanceData(await Promise.all(performancePromises));

        // --- 3. Fetch Recent Transactions (Efficiently) ---
        // Query ธุรกรรมล่าสุดโดยเรียงลำดับและจำกัดจำนวนที่ฝั่ง database เลย
        const recentOrdersQuery = query(
            collection(db, 'orders'),
            where('branchId', '==', branchId),
            orderBy('createdAt', 'desc'), // เรียงจากใหม่ไปเก่า
            limit(5)                      // เอาแค่ 5 รายการล่าสุด
        );
        const recentOrdersSnapshot = await getDocs(recentOrdersQuery);
        const transactions = recentOrdersSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                productName: data.items?.[0]?.name || 'Multiple Items',
                type: 'Sale' as const,
                amount: data.total || 0,
                timestamp: data.createdAt.toDate(),
            };
        });
        setRecentTransactions(transactions);

      } catch (e) {
        console.error("Error fetching overview data:", e);
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchId]); // Hook นี้จะทำงานใหม่ทุกครั้งที่ branchId เปลี่ยน

  return { kpiData, performanceData, recentTransactions, loading, error };
}

