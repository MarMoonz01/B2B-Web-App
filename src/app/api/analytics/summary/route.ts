// src/app/api/analytics/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, db } from '@/src/lib/firebaseAdmin';
import {
  Timestamp,
  FieldPath,
} from 'firebase-admin/firestore';

/** ====== Types ที่หน้า Analytics ใช้ ====== */
type SummaryData = {
  totalInventoryValue: number;   // (optional) ยังไม่คำนวณจริงในรุ่นนี้
  pendingTransfers: number;
  branchCount: number;
  totalUsers: number;            // (optional) ยังไม่คำนวณจริงในรุ่นนี้
};

type ChartDatum = { name: string; value: number };
type TransfersDatum = { name: string; inbound?: number; outbound?: number };

type SummaryResponse = {
  ok: boolean;
  summaryData: SummaryData;
  inventoryByBranchData: ChartDatum[];
  transfersOverTimeData: TransfersDatum[];
  productCategoriesData: ChartDatum[];
  error?: string;
};

function err(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** แปลง range เป็นช่วงเวลา (UTC) */
function parseRange(range: '7d'|'30d'|'90d'|'ytd') {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
  let from = new Date(to);
  if (range === '7d') from.setUTCDate(to.getUTCDate() - 6);
  else if (range === '30d') from.setUTCDate(to.getUTCDate() - 29);
  else if (range === '90d') from.setUTCDate(to.getUTCDate() - 89);
  else { // ytd
    from = new Date(Date.UTC(to.getUTCFullYear(), 0, 1, 0, 0, 0));
  }
  return {
    fromTs: Timestamp.fromDate(from),
    toTs: Timestamp.fromDate(to),
    fromISO: from.toISOString().slice(0,10),
    toISO: to.toISOString().slice(0,10),
  };
}

/** รวมผลรายวัน (label เป็น YYYY-MM-DD) */
function dayKey(d: Date) {
  return d.toISOString().slice(0,10);
}

export async function GET(req: NextRequest) {
  try {
    // ---------- 1) ตรวจ token ----------
    const authz = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authz?.startsWith('Bearer ')) return err(401, 'missing_token');

    const idToken = authz.slice('Bearer '.length);
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null);
    if (!decoded?.uid) return err(401, 'invalid_token');

    const uid = decoded.uid;

    // ---------- 2) อ่าน users/{uid} เพื่อรู้ branchPerms ----------
    const uref = db.collection('users').doc(uid);
    const usnap = await uref.get();
    if (!usnap.exists) return err(403, 'no_user');

    const udata = usnap.data() || {};
    const branchPerms = (udata.branchPerms ?? {}) as Record<
      string,
      Record<string, boolean>
    >;

    const allowedBranchIds = Object.keys(branchPerms);
    const isModerator = !!(udata.moderator === true || decoded.moderator === true);

    // ป้องกัน user ที่ไม่มีสิทธิ์สาขาเลย
    if (!isModerator && allowedBranchIds.length === 0) {
      return err(403, 'no_permissions');
    }

    // ---------- 3) รับพารามิเตอร์ ----------
    const { searchParams } = new URL(req.url);
    const selectedBranchId = (searchParams.get('branchId') || '').trim(); // single-branch analytics
    const rangeParam = (searchParams.get('range') || '90d') as '7d'|'30d'|'90d'|'ytd';
    const { fromTs, toTs } = parseRange(rangeParam);

    // ต้องเลือกสาขาเสมอ (หน้า UI เรามี BranchSelect แล้ว)
    if (!selectedBranchId) return err(400, 'missing_branchId');

    // สิทธิ์สาขา
    if (!isModerator && !allowedBranchIds.includes(selectedBranchId)) {
      return err(403, 'no_permissions');
    }

    // ---------- 4) ดึง movement ของสาขาที่เลือก (โยงกับ History) ----------
    const movRef = db.collection('stockMovements')
      .where('branchId', '==', selectedBranchId)
      .where('createdAt', '>=', fromTs)
      .where('createdAt', '<=', toTs);

    const movSnap = await movRef.get();

    // สร้าง bucket รายวัน inbound/outbound
    const inboundByDay = new Map<string, number>();
    const outboundByDay = new Map<string, number>();
    // สร้างสรุป brand/category แบบเร็ว ๆ จาก movement (proxy)
    const brandValue = new Map<string, number>();

    movSnap.forEach(doc => {
      const d = doc.data() as any;
      const created = d.createdAt?.toDate?.() as Date | undefined;
      if (!created) return;
      const k = dayKey(created);

      const ev = String(d.eventType || '');
      const qty = Number(d.qtyChange || 0);
      // นับ inbound/outbound แบบ count ครั้ง (ไม่ใช่รวม qty) เพื่อ match UI ปัจจุบัน
      if (ev === 'stock.transfer.in' || d.type === 'transfer_in') {
        inboundByDay.set(k, (inboundByDay.get(k) || 0) + 1);
      } else if (ev === 'stock.transfer.out' || d.type === 'transfer_out') {
        outboundByDay.set(k, (outboundByDay.get(k) || 0) + 1);
      }

      // proxy category -> ใช้ brand field จาก movement (ถ้ามี)
      const brand = (d.brand || 'Unknown') as string;
      // ใช้ “จำนวนครั้งของ movement” เป็นค่าประมาณ
      brandValue.set(brand, (brandValue.get(brand) || 0) + 1);
    });

    // รวมเป็น array สำหรับกราฟ
    const allDays: string[] = [];
    {
      const start = fromTs.toDate();
      const end = toTs.toDate();
      const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      while (cur <= end) {
        allDays.push(dayKey(cur));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    const transfersOverTimeData: TransfersDatum[] = allDays.map(name => ({
      name,
      inbound: inboundByDay.get(name) || 0,
      outbound: outboundByDay.get(name) || 0,
    }));

    const productCategoriesData: ChartDatum[] =
      Array.from(brandValue.entries()).map(([name, value]) => ({ name, value }));

    const inventoryByBranchData: ChartDatum[] = [
      { name: selectedBranchId, value: (inboundByDay.size + outboundByDay.size) || 0 },
    ];

    // ---------- 5) Pending transfers (orders ที่เกี่ยวข้องและยังไม่ปิด) ----------
    const statusesOpen = ['requested','approved','confirmed'] as const;
    const ordersRefBuyer = db.collection('orders')
      .where('buyerBranchId', '==', selectedBranchId)
      .where('createdAt', '>=', fromTs)
      .where('createdAt', '<=', toTs)
      .orderBy('createdAt'); // เพิ่มบรรทัดนี้

    const ordersRefSeller = db.collection('orders')
      .where('sellerBranchId', '==', selectedBranchId)
      .where('createdAt', '>=', fromTs)
      .where('createdAt', '<=', toTs)
      .orderBy('createdAt'); // เพิ่มบรรทัดนี้

    const [buyerSnap, sellerSnap] = await Promise.all([ordersRefBuyer.get(), ordersRefSeller.get()]);
    const pendingTransfers =
      buyerSnap.docs.concat(sellerSnap.docs).reduce((acc, d) => {
        const st = (d.data() as any)?.status as string;
        return acc + (statusesOpen.includes(st as any) ? 1 : 0);
      }, 0);

    const summaryData: SummaryData = {
      totalInventoryValue: 0,
      pendingTransfers,
      branchCount: 1,
      totalUsers: 0,
    };

    const resp: SummaryResponse = {
      ok: true,
      summaryData,
      transfersOverTimeData,
      productCategoriesData,
      inventoryByBranchData,
    };

    return NextResponse.json(resp, { status: 200 });
  } catch (e: any) {
    console.error('analytics.summary error', e);
    return err(500, e?.message || 'internal_error');
  }
}
