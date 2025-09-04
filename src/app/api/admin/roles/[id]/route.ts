// File: src/app/api/admin/roles/[id]/route.ts
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

// PATCH /api/admin/roles/:id — update role (name/description/permissions)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const me = await getServerSession();
  if (!me?.moderator) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const id = params?.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    const description = String(body?.description ?? '').trim();
    const permissions = sanitizePermissions(body?.permissions);

    if (!name || !description) {
      return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    }

    const ref = db.collection('roles').doc(id);

    // อัปเดตเฉพาะฟิลด์ที่ต้องการ + updatedAt
    await ref.update({
      name,
      description,
      permissions,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, role: { id, name, description, permissions } });
  } catch (e: any) {
    // ถ้าเอกสารยังไม่มี (not-found) จะ fallback เป็น set merge:true
    if (e?.code === 5 /* NOT_FOUND */) {
      try {
        await db.collection('roles').doc(params.id).set(
          {
            name: String((await req.json())?.name ?? '').trim(),
            description: String((await req.json())?.description ?? '').trim(),
            permissions: sanitizePermissions((await req.json())?.permissions),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return NextResponse.json({ ok: true, role: { id: params.id } });
      } catch (err) {
        console.error('roles PATCH fallback set error', err);
      }
    }
    console.error('roles PATCH error', e);
    return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
  }
}

// DELETE /api/admin/roles/:id — delete role
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const me = await getServerSession();
  if (!me?.moderator) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    await db.collection('roles').doc(params.id).delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('roles DELETE error', e);
    return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
  }
}
