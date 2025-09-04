// File: src/app/api/admin/roles/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin';
import { getServerSession } from '@/src/lib/session';
import { PERMISSIONS, type Permission } from 'types/permissions';
import { FieldValue } from 'firebase-admin/firestore';

function sanitizePermissions(list: unknown): Permission[] {
  if (!Array.isArray(list)) return [];
  const allow = new Set<Permission>(PERMISSIONS);
  const cleaned = list.filter(
    (x): x is Permission => typeof x === 'string' && allow.has(x as Permission)
  );
  // unique โดยรักษาลำดับเดิม
  const seen = new Set<string>();
  return cleaned.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
}

// GET /api/admin/roles — list roles
export async function GET() {
  const me = await getServerSession();
  if (!me?.moderator) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const snap = await db.collection('roles').orderBy('name').get();
    const roles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ ok: true, roles });
  } catch (e) {
    console.error('roles GET error', e);
    return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
  }
}

// POST /api/admin/roles — create role
export async function POST(req: Request) {
  const me = await getServerSession();
  if (!me?.moderator) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    const description = String(body?.description ?? '').trim();
    const permissions = sanitizePermissions(body?.permissions);

    if (!name || !description) {
      return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    }

    const data = {
      name,
      description,
      permissions,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const doc = await db.collection('roles').add(data);
    return NextResponse.json({ ok: true, role: { id: doc.id, ...data } });
  } catch (e) {
    console.error('roles POST error', e);
    return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
  }
}
