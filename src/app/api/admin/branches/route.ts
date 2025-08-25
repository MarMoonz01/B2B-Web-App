// ============================
// FILE: src/app/api/admin/branches/route.ts  (GET) — list branch docIds from `stores`
// ============================
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin';
import { getServerSession } from '@/src/lib/session';

export async function GET() {
  const me = await getServerSession();
  if (!me) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!me.moderator) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

  const snap = await db.collection('stores').select().get();
  const branches: string[] = snap.docs.map((d) => d.id);
  return NextResponse.json({ ok: true, branches });
}
