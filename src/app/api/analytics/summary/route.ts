// src/app/api/analytics/summary/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin';
import { getServerSession } from '@/src/lib/session';

// --- เพิ่ม Type Definition ---
interface StoreData {
    id: string;
    branchName?: string;
    // ... any other fields in your store document
}

export async function GET() {
  const me = await getServerSession();
  if (!me?.moderator) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    // --- 1. Summary Card Data ---
    const storesSnap = await db.collection('stores').get();
    const usersSnap = await db.collection('users').get();
    const transfersSnap = await db.collection('transfer_requests').where('status', '==', 'pending').get();
    const inventorySnap = await db.collectionGroup('inventory').get();

    const totalInventoryValue = inventorySnap.docs.reduce((sum, doc) => {
        const item = doc.data();
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        return sum + (price * quantity);
    }, 0);

    const summaryData = {
        totalInventoryValue,
        pendingTransfers: transfersSnap.size,
        branchCount: storesSnap.size,
        totalUsers: usersSnap.size,
    };

    // --- 2. Inventory Value by Branch ---
    const inventoryByBranch: { [key: string]: number } = {};
    inventorySnap.forEach(doc => {
        const item = doc.data();
        const branchId = doc.ref.parent.parent?.id;
        if (branchId) {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            inventoryByBranch[branchId] = (inventoryByBranch[branchId] || 0) + (price * quantity);
        }
    });

    // --- แก้ไขส่วนนี้ ---
    const storesData: StoreData[] = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreData));
    
    const inventoryByBranchData = Object.entries(inventoryByBranch).map(([branchId, value]) => ({
        name: storesData.find(s => s.id === branchId)?.branchName || branchId, // Error should be gone now
        value,
    }));
    
    // --- 3. Transfers Over Time ---
    const allTransfersSnap = await db.collection('transfer_requests').select('createdAt').get();
    const transfersByMonth: { [key: string]: number } = {};
    
    allTransfersSnap.forEach(doc => {
        const transfer = doc.data();
        if (transfer.createdAt?.toDate) {
            const date = transfer.createdAt.toDate();
            const month = date.toLocaleString('default', { month: 'short' });
            transfersByMonth[month] = (transfersByMonth[month] || 0) + 1;
        }
    });
    
    const transfersOverTimeData = Object.entries(transfersByMonth).map(([name, transfers]) => ({ name, transfers }));

    // --- 4. Product Category Distribution ---
    const categories: { [key: string]: number } = {};
    inventorySnap.forEach(doc => {
        const item = doc.data();
        const category = item.category || 'Uncategorized';
        categories[category] = (categories[category] || 0) + (Number(item.quantity) || 0);
    });

    const productCategoriesData = Object.entries(categories).map(([name, value]) => ({ name, value }));


    return NextResponse.json({
      ok: true,
      summaryData,
      inventoryByBranchData,
      transfersOverTimeData,
      productCategoriesData,
    });

  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
  }
}