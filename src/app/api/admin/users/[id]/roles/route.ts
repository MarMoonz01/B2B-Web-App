import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin';
import { getServerSession } from '@/src/lib/session';
import { FieldValue } from 'firebase-admin/firestore';

// PUT: สร้าง Document ใหม่ใน userBranchRoles
export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const me = await getServerSession();
    if (!me?.moderator || !me.uid) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    try {
        const userId = params.id;
        const { branchId, role } = await req.json();

        if (!userId || !branchId || !role) {
            return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
        }

        // สร้าง ID ของ Document ใหม่ตามรูปแบบ: uid_branchId_role
        const docId = `${userId}_${branchId}_${role.toUpperCase()}`;
        const docRef = db.collection('userBranchRoles').doc(docId);

        // สร้างข้อมูลที่จะบันทึกลง Document
        const assignmentData = {
            uid: userId,
            branchId: branchId,
            role: role.toUpperCase(),
            assignedAt: FieldValue.serverTimestamp(),
            assignedBy: me.uid, 
        };

        // สร้าง Document ใหม่ (หรือเขียนทับถ้ามี ID ซ้ำ)
        await docRef.set(assignmentData);

        return NextResponse.json({ ok: true, message: 'User role assignment created successfully.' });

    } catch (error) {
        console.error(`Error creating userBranchRole for user ${params.id}:`, error);
        return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
    }
}
