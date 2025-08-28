// src/app/api/admin/roles/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin';
import { getServerSession } from '@/src/lib/session';
import { Role } from '@/types/permission';

// GET: List all roles
export async function GET() {
  const me = await getServerSession();
  if (!me?.moderator) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const rolesSnap = await db.collection('roles').get();
    const roles: Role[] = rolesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Role));
    return NextResponse.json({ ok: true, roles });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
  }
}

// POST: Create a new role
export async function POST(req: Request) {
    const me = await getServerSession();
    if (!me?.moderator) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    try {
        const { name, description, permissions, scope, applicableBranches } = await req.json();

        if (!name || !description || !Array.isArray(permissions) || !scope) {
            return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
        }

        const newRoleData: any = { name, description, permissions, scope };
        if (scope === 'specific') {
            newRoleData.applicableBranches = applicableBranches || [];
        }

        const docRef = await db.collection('roles').add(newRoleData);

        return NextResponse.json({ ok: true, role: { id: docRef.id, ...newRoleData } });
    } catch (error) {
        console.error('Error creating role:', error);
        return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
    }
}