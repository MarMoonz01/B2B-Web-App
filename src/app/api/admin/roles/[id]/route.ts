import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin';
import { getServerSession } from '@/src/lib/session';
import { FieldValue } from 'firebase-admin/firestore';

// PUT: อัปเดต/เพิ่ม Role ในสาขาให้กับ User
export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const me = await getServerSession();
    if (!me?.moderator) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    try {
        const userId = params.id;
        // Body ที่คาดหวัง: { branchId: "BCH-...", role: "Manager" }
        const { branchId, role } = await req.json();

        if (!userId || !branchId || !role) {
            return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
        }

        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 });
        }

        const userData = userDoc.data()!;
        const currentBranches = (userData.branches || []) as { id: string; roles: string[] }[];

        const branchIndex = currentBranches.findIndex(b => b.id === branchId);

        if (branchIndex > -1) {
            // ถ้า User มีสาขานี้อยู่แล้ว -> ให้อัปเดต Role
            currentBranches[branchIndex].roles = [role]; // สมมติว่ามี 1 role ต่อสาขา
            await userRef.update({ branches: currentBranches });
        } else {
            // ถ้า User ยังไม่มีสาขานี้ -> ให้เพิ่มเข้าไปใหม่
            const newBranchRole = { id: branchId, roles: [role] };
            await userRef.update({
                branches: FieldValue.arrayUnion(newBranchRole)
            });
        }

        return NextResponse.json({ ok: true, message: 'User role updated successfully.' });

    } catch (error) {
        console.error(`Error updating roles for user ${params.id}:`, error);
        return NextResponse.json({ ok: false, error: 'internal_server_error' }, { status: 500 });
    }
}