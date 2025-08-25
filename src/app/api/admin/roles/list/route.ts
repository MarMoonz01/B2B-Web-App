// ============================
// FILE: src/app/api/admin/roles/list/route.ts  (GET)
// ============================
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin';
import { getServerSession } from '@/src/lib/session';

export async function GET(req: Request) {
  const me = await getServerSession();
  if (!me) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!me.moderator) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const uid = searchParams.get('uid');
  if (!uid) return NextResponse.json({ ok: false, error: 'missing uid' }, { status: 400 });

  const snap = await db.collection('userBranchRoles').where('uid', '==', uid).get();
  const roles = snap.docs.map(d => ({ docId: d.id, ...(d.data() as any) }));
  return NextResponse.json({ ok: true, roles });
}
