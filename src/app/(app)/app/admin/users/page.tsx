import { db, adminAuth } from '@/src/lib/firebaseAdmin';
import UsersManagementClient from './UsersManagementClient';
import { UserRecord } from 'firebase-admin/auth';

export interface UserBranch { id: string; roles: string[]; }
export interface User {
  uid: string;
  email: string | undefined;
  moderator?: boolean;
  branches?: UserBranch[];
}

async function getUsers(): Promise<User[]> {
  try {
    const listUsersResult = await adminAuth.listUsers();
    const authUsers = listUsersResult.users;

    const assignmentsSnap = await db.collection('userBranchRoles').get();
    const assignments = assignmentsSnap.docs.map(d => d.data());

    const firestoreUsersSnap = await db.collection('users').get();
    const firestoreUsers = new Map(firestoreUsersSnap.docs.map(d => [d.id, d.data()]));

    const rolesByUid = new Map<string, UserBranch[]>();
    assignments.forEach((a: any) => {
      const uid = a.uid;
      const branchId = a.branchId;
      const roleLabel = a.role || a.roleName || a.roleId; // ✅ รองรับทุกฟิลด์
      if (!uid || !branchId || !roleLabel) return;

      const userAssignments = rolesByUid.get(uid) || [];
      const idx = userAssignments.findIndex(b => b.id === branchId);
      if (idx >= 0) {
        const next = Array.from(new Set([ ...(userAssignments[idx].roles || []), roleLabel ]));
        userAssignments[idx] = { id: branchId, roles: next };
      } else {
        userAssignments.push({ id: branchId, roles: [roleLabel] });
      }
      rolesByUid.set(uid, userAssignments);
    });

    const combined: User[] = authUsers.map((u: UserRecord) => {
      const extra = firestoreUsers.get(u.uid) as any;
      return {
        uid: u.uid,
        email: u.email ?? undefined,
        moderator: extra?.moderator === true,
        branches: rolesByUid.get(u.uid) || [],
      };
    });

    return combined;
  } catch (e) {
    console.error('Failed to fetch and combine user data:', e);
    return [];
  }
}

export default async function UsersManagementPage() {
  const users = await getUsers();
  return <UsersManagementClient users={users} />;
}
