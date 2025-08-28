// src/lib/permissionsHelper.ts
import { db } from '@/src/lib/firebaseAdmin';
import type { Me } from '@/src/lib/session';
import type { Permission, Role } from '@/types/permission';

// Cache to avoid fetching the same roles multiple times in one request
let rolesCache: Role[] | null = null;

async function getRoles(): Promise<Role[]> {
  if (rolesCache) {
    return rolesCache;
  }
  const rolesSnap = await db.collection('roles').get();
  rolesCache = rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
  return rolesCache;
}

/**
 * Checks if a user has a specific permission.
 * This is a server-side function.
 */
export async function hasPermission(user: Me, permission: Permission): Promise<boolean> {
  // Super-admin (moderator) always has all permissions
  if (user.moderator) {
    return true;
  }

  // Find the role assigned to the user in their currently selected branch
  const userRoleInBranch = user.branches.find(b => b.id === user.selectedBranchId)?.roles?.[0];

  if (!userRoleInBranch) {
    return false; // No role in this branch, so no permissions
  }
  
  const allRoles = await getRoles();
  const roleDetails = allRoles.find(r => r.name === userRoleInBranch); // Assuming role name is stored

  if (!roleDetails) {
    return false; // Role not found in the system
  }
  
  // Check if the role's permissions array includes the required permission
  return roleDetails.permissions.includes(permission);
}