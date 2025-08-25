// ============================
// FILE: src/app/api/admin/users/lookup/route.ts  (POST) — resolve uid by email
// ============================
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/src/lib/firebaseAdmin';
import { getServerSession } from '@/src/lib/session';

export async function POST(req: Request) {
  const me = await getServerSession();
  if (!me) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!me.moderator) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ ok: false, error: 'missing email' }, { status: 400 });

  try {
    const u = await adminAuth.getUserByEmail(email);
    return NextResponse.json({ ok: true, uid: u.uid });
  } catch {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  }
}