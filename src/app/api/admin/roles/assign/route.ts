// ============================
// FILE: src/app/api/admin/roles/assign/route.ts  (POST)
// ============================
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin';
import { getServerSession } from '@/src/lib/session';

export async function POST(req: Request) {
  const me = await getServerSession();
  if (!me) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!me.moderator) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

  const { uid, branchId, role } = await req.json();
  if (!uid || !branchId || !['SALES', 'ADMIN'].includes(role)) {
    return NextResponse.json({ ok: false, error: 'bad params' }, { status: 400 });
  }

  const docId = `${uid}_${branchId}_${role}`;
  await db.doc(`userBranchRoles/${docId}`).set({
    uid,
    branchId,
    role,
    assignedBy: me.uid,
    assignedAt: new Date(),
  }, { merge: true });

  return NextResponse.json({ ok: true, docId });
}