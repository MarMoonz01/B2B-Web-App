import { db, adminAuth } from '@/src/lib/firebaseAdmin';
import UsersManagementClient from './UsersManagementClient';
import { UserRecord } from 'firebase-admin/auth';

// Type ที่จะใช้ส่งไปให้ Client Component
export interface UserBranch {
    id: string;
    roles: string[];
}
export interface User {
    uid: string;
    email: string | undefined;
    moderator?: boolean; // moderator จะถูกดึงมาจาก firestore `users` collection
    branches?: UserBranch[];
}

async function getUsers(): Promise<User[]> {
    try {
        // 1. ดึง User ทั้งหมดจาก Firebase Auth
        const listUsersResult = await adminAuth.listUsers();
        const authUsers = listUsersResult.users;

        // 2. ดึงข้อมูลการมอบหมายสิทธิ์ทั้งหมดจาก userBranchRoles
        const assignmentsSnap = await db.collection('userBranchRoles').get();
        const assignments = assignmentsSnap.docs.map(doc => doc.data());
        
        // 3. ดึงข้อมูลเสริมจาก collection `users` (เช่น moderator)
        const firestoreUsersSnap = await db.collection('users').get();
        const firestoreUsers = new Map(firestoreUsersSnap.docs.map(doc => [doc.id, doc.data()]));

        // 4. จัดกลุ่มสิทธิ์ตาม uid
        const rolesByUid = new Map<string, UserBranch[]>();
        assignments.forEach(assignment => {
            const { uid, branchId, role } = assignment;
            if (!uid || !branchId || !role) return;

            const userAssignments = rolesByUid.get(uid) || [];
            let branch = userAssignments.find(b => b.id === branchId);

            if (branch) {
                branch.roles.push(role);
            } else {
                userAssignments.push({ id: branchId, roles: [role] });
            }
            rolesByUid.set(uid, userAssignments);
        });

        // 5. รวมข้อมูลทั้งหมด
        const combinedUsers: User[] = authUsers.map((userRecord: UserRecord) => {
            const firestoreData = firestoreUsers.get(userRecord.uid);
            return {
                uid: userRecord.uid,
                email: userRecord.email,
                moderator: firestoreData?.moderator === true,
                branches: rolesByUid.get(userRecord.uid) || [],
            };
        });

        return combinedUsers;
    } catch (error) {
        console.error("Failed to fetch and combine user data:", error);
        return [];
    }
}

export default async function UsersManagementPage() {
    const users = await getUsers();
    return <UsersManagementClient users={users} />;
}
