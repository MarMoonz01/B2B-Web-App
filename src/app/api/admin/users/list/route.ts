// File: src/app/api/admin/users/list/route.ts

import { NextResponse } from 'next/server';
import { auth } from 'firebase-admin';
// --- แก้ไข Path ---
import { db, adminAuth } from '../../../../../lib/firebaseAdmin'; // ใช้ Relative Path เพื่อความแน่นอน
import { getServerSession } from '../../../../../lib/session';
// --------------------

export async function GET() {
  const user = await getServerSession();

  if (!user || !user.moderator) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const userRecords = await auth().listUsers();
    const users = userRecords.users.map((u) => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      disabled: u.disabled,
      creationTime: u.metadata.creationTime,
      lastSignInTime: u.metadata.lastSignInTime,
      customClaims: u.customClaims,
    }));
    return NextResponse.json(users);
  } catch (error) {
    console.error('Failed to list users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
}