// src/app/api/admin/roles/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin';
import { getServerSession } from '@/src/lib/session';

export async function GET() {
  const me = await getServerSession();
  if (!me?.moderator) return NextResponse.json({ ok:false, error:'forbidden' }, { status:403 });

  const snap = await db.collection('roles').get();
  const roles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ ok:true, roles });
}

export async function POST(req: Request) {
  const me = await getServerSession();
  if (!me?.moderator) return NextResponse.json({ ok:false, error:'forbidden' }, { status:403 });

  const { name, description, permissions } = await req.json();
  if (!name || !description || !Array.isArray(permissions))
    return NextResponse.json({ ok:false, error:'bad_request' }, { status:400 });

  const doc = await db.collection('roles').add({ name, description, permissions });
  return NextResponse.json({ ok:true, role: { id: doc.id, name, description, permissions } });
}
