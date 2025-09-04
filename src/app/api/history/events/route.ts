export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin'; // ต้องมีตัวแปร db (admin.firestore())
import { getServerSession } from '@/src/lib/session';

/**
 * ถ้ามีระบบ permission แยกสาขา ให้เตรียม helper ง่าย ๆ แบบนี้
 * - คุณสามารถปรับใช้กับของจริงได้ (หรือถ้ายังไม่มี ให้ return true ไปก่อน)
 */
async function hasBranchRead(me: any, branchId: string): Promise<boolean> {
  try {
    if (me?.moderator) return true;
    // ถ้าคุณมี me.branchPerms[branchId]['inventory:read'] ให้เช็คตรงนี้
    // return Boolean(me?.branchPerms?.[branchId]?.['inventory:read']);
    return true; // <-- ถ้ายังไม่มีระบบ permission ให้เปิดใช้ไปก่อน
  } catch {
    return false;
  }
}

type Row = {
  id: string;
  branchId: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  orderId?: string;
  brand?: string;
  model?: string;
  variantId?: string;
  dotCode?: string;
  qtyChange?: number;
  unitPrice?: number | null;
  totalValue?: number | null;
  reasonCode?: string | null;
  source?: { kind: string; id?: string };
  actor?: { uid?: string; email?: string | null };
  occurredAt?: FirebaseFirestore.Timestamp | null;
  createdAt?: FirebaseFirestore.Timestamp | null;
};

function parseISODate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(+d) ? null : d;
}

/**
 * cursor เป็น base64 ของ { t:number, id:string }
 * t = milliseconds ของ occurredAt (ถ้าไม่มี ใช้ createdAt)
 */
function encodeCursor(t: number, id: string) {
  return Buffer.from(JSON.stringify({ t, id }), 'utf8').toString('base64');
}
function decodeCursor(c: string | null): { t: number; id: string } | null {
  if (!c) return null;
  try {
    return JSON.parse(Buffer.from(c, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const me = await getServerSession();
    if (!me) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const branchId = (searchParams.get('branchId') || '').trim();
    if (!branchId) {
      return NextResponse.json({ ok: false, error: 'branchId_required' }, { status: 400 });
    }

    // Permission (ถ้ามีระบบสิทธิ์จริงให้แทนที่ฟังก์ชัน hasBranchRead ด้านบน)
    const allowed = await hasBranchRead(me, branchId);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const typeParam = (searchParams.get('type') || '').trim(); // ชนิดเหตุการณ์เดี่ยว
    const from = parseISODate(searchParams.get('from'));
    const to = parseISODate(searchParams.get('to'));
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);
    const cursor = decodeCursor(searchParams.get('cursor'));

    // สร้าง query
    let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db
      .collection('stockMovements')
      .where('branchId', '==', branchId);

    if (typeParam) {
      q = q.where('eventType', '==', typeParam);
    }

    if (from) {
      const s = new Date(from);
      s.setHours(0, 0, 0, 0);
      q = q.where('occurredAt', '>=', s);
    }
    if (to) {
      const e = new Date(to);
      e.setDate(e.getDate() + 1);
      e.setHours(0, 0, 0, 0);
      q = q.where('occurredAt', '<', e);
    }

    // orderBy สำหรับการ page แบบตายตัว
    q = q.orderBy('occurredAt', 'desc').orderBy('__name__');

    if (cursor) {
      q = q.startAfter(new Date(cursor.t), cursor.id);
    }

    const snap = await q.limit(limit).get();

    const rows: Row[] = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        ...data,
      };
    });

    const last = snap.docs[snap.docs.length - 1];
    const nextCursor =
      last
        ? encodeCursor(
            ((last.get('occurredAt') || last.get('createdAt')) as FirebaseFirestore.Timestamp).toDate().getTime(),
            last.id
          )
        : null;

    return NextResponse.json({ ok: true, rows, nextCursor }, { status: 200 });
  } catch (e: any) {
    // ส่ง JSON เสมอ กัน frontend แตกจาก Unexpected end of JSON
    return NextResponse.json(
      { ok: false, error: e?.message || 'internal_error' },
      { status: 500 }
    );
  }
}
