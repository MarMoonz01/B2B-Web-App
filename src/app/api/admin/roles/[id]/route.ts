export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin';
import { getServerSession } from '@/src/lib/session';
import type { Role } from '@/types/permission';

export async function GET() {
  const me = await getServerSession();
  if (!me?.moderator) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

  try {
    const snap = await db.collection('roles').get();
    const roles: Role[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Role));
    return NextResponse.json({ ok: true, roles });
  } catch (e) {
    console.error('roles GET error', e);
    return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const me = await getServerSession();
  if (!me?.moderator) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

  try {
    const { name, description, permissions } = await req.json();
    if (!name || !description || !Array.isArray(permissions)) {
      return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    }
    const data = { name, description, permissions };
    const doc = await db.collection('roles').add(data);
    return NextResponse.json({ ok: true, role: { id: doc.id, ...data } });
  } catch (e) {
    console.error('roles POST error', e);
    return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
  }
}
