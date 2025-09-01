export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin';
import { getServerSession } from '@/src/lib/session';
import { FieldValue } from 'firebase-admin/firestore';
import type { Permission } from '@/types/permission';

type Body =
  | {
      action?: 'assign';
      branchId?: string;   // required
      roleId?: string;     // optional
      roleName?: string;   // optional
      role?: string;       // optional (UI เดิมส่งมาเป็น 'role')
    }
  | {
      action: 'remove';
      branchId: string;    // required
    };

// ---------- helpers ----------
function safeId(s: string) {
  return String(s).replace(/[\/#?[\]]/g, '_').slice(0, 200);
}

async function getRole(input: { roleId?: string; roleName?: string }) {
  if (input.roleId) {
    const snap = await db.collection('roles').doc(input.roleId).get();
    if (snap.exists) return { id: snap.id, ...(snap.data() as any) };
  }
  if (input.roleName) {
    const q = await db.collection('roles').where('name', '==', input.roleName).limit(1).get();
    if (!q.empty) {
      const d = q.docs[0];
      return { id: d.id, ...(d.data() as any) };
    }
  }
  return null;
}

// ---------- ASSIGN / UPDATE ----------
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const me = await getServerSession();
  if (!me?.moderator) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const uid = params.id;              // <<< ใช้ params.id ให้ตรงกับชื่อโฟลเดอร์
    if (!uid) {
      return NextResponse.json({ ok: false, error: 'bad_user_id' }, { status: 400 });
    }

    const body: any = await req.json();
    const action = body.action ?? 'assign';
    if (action !== 'assign') {
      return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
    }

    const branchId: string | undefined = body.branchId;
    if (!branchId) {
      return NextResponse.json({ ok: false, error: 'branch_required' }, { status: 400 });
    }

    // รองรับทั้ง roleId / roleName / role (alias)
    const roleMeta =
      (await getRole({ roleId: body.roleId, roleName: body.roleName ?? body.role })) || null;

    if (!roleMeta) {
      return NextResponse.json({ ok: false, error: 'role_not_found' }, { status: 404 });
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
    }

    // สร้างแผนที่ permission { perm: true }
    const permsArray = (roleMeta.permissions || []) as Permission[];
    const permsObj = permsArray.reduce<Record<string, boolean>>((acc, p) => {
      acc[p] = true;
      return acc;
    }, {});
    // บังคับให้เห็น overview เสมอ
    if (!('overview:read' in permsObj)) permsObj['overview:read'] = true;

    // 1) เขียนสิทธิ์ลง users/{uid}
    await userRef.set(
      {
        branchIds: FieldValue.arrayUnion(branchId),
        [`branchPerms.${branchId}`]: permsObj,
      },
      { merge: true }
    );

    // 2) เก็บ legacy branches[] = [{id, roles:[name]}]
    const user = userSnap.data()!;
    const currentBranches: Array<{ id: string; roles: string[] }> = Array.isArray(user.branches)
      ? user.branches
      : [];
    const label = roleMeta.name || roleMeta.id;
    const idx = currentBranches.findIndex((b) => b.id === branchId);
    if (idx >= 0) {
      const uniq = Array.from(new Set([...(currentBranches[idx].roles || []), label]));
      currentBranches[idx] = { id: branchId, roles: uniq };
    } else {
      currentBranches.push({ id: branchId, roles: [label] });
    }
    await userRef.update({ branches: currentBranches });

    // 3) audit log
    const logId = `${uid}_${branchId}_${safeId(label)}`;
    await db.collection('userBranchRoles').doc(logId).set({
      uid,
      branchId,
      roleId: roleMeta.id,
      roleName: label,
      assignedBy: me.uid,
      assignedAt: FieldValue.serverTimestamp(),
      scope: 'specific',
    });

    return NextResponse.json({ ok: true, branchId, role: label });
  } catch (err: any) {
    console.error('Assign role error:', err);
    return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
  }
}

// ---------- REMOVE ----------
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const me = await getServerSession();
  if (!me?.moderator) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const uid = params.id;              // <<< ใช้ params.id
    if (!uid) {
      return NextResponse.json({ ok: false, error: 'bad_user_id' }, { status: 400 });
    }

    const { branchId } = (await req.json()) as { branchId: string };
    if (!branchId) {
      return NextResponse.json({ ok: false, error: 'branch_required' }, { status: 400 });
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
    }

    const user = userSnap.data()!;
    const nextBranches = (Array.isArray(user.branches) ? user.branches : []).filter(
      (b: any) => b.id !== branchId
    );

    await userRef.update({
      branchIds: FieldValue.arrayRemove(branchId),
      [`branchPerms.${branchId}`]: FieldValue.delete(),
      branches: nextBranches,
    });

    await db.collection('userBranchRoles').add({
      uid,
      branchId,
      removedBy: me.uid,
      removedAt: FieldValue.serverTimestamp(),
      action: 'remove',
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Remove role error:', err);
    return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
  }
}
