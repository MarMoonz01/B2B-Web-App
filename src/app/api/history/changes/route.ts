export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin';
import { getServerSession, roleIn } from '@/src/lib/session';
import { canDo } from '@/src/lib/perm';

export async function GET(req: Request) {
  const me = await getServerSession();
  if (!me) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('branchId');
  if (!storeId) return NextResponse.json({ ok: false, error: 'branchId_required' }, { status: 400 });

  const role = roleIn(me, storeId);
  if (!canDo({ moderator: me.moderator, roleInBranch: role, perm: 'inventory:read' })) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = Math.min(Number(searchParams.get('limit') || '50'), 200);

  let q: FirebaseFirestore.Query = db
    .collection('stores')
    .doc(storeId)
    .collection('changes')
    .orderBy('changedAt', 'desc');

  if (from) q = q.where('changedAt', '>=', new Date(from));
  if (to) {
    const end = new Date(to);
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    q = q.where('changedAt', '<', end);
  }

  const snap = await q.limit(limit).get();
  const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  return NextResponse.json({ ok: true, rows });
}
