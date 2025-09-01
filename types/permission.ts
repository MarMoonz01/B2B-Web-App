// types/permissions.ts

// 1. กำหนด Permissions ทั้งหมดในระบบ
export const PERMISSIONS = [
  // Overview (Branch-scoped)
  'overview:read',     // Can view branch overview (KPI, charts, recent activities)

  // Inventory Management
  'inventory:read',    // Can view inventory items
  'inventory:write',   // Can create/edit inventory items
  'inventory:delete',  // Can delete inventory items

  // Transfer Management
  'transfer:create',   // Can create transfer requests
  'transfer:approve',  // Can approve/reject transfer requests
  'transfer:read',     // Can view all transfer requests (for the branch)

  // User Management (scoped to a branch)
  'users:manage',      // Can add/remove users from a branch
  'users:assign_roles',// Can assign roles to users within a branch

  // Branch-level settings
  'branch:settings',   // Can edit branch details

  // Admin-level permissions
  'admin:roles:manage',    // Can create, edit, and delete system-wide roles
  'admin:users:manage',    // Can manage all users across all branches
  'admin:branches:manage', // Can create, edit, and delete branches
  'admin:view_analytics',  // Can view the main analytics dashboard
] as const;

export type Permission = typeof PERMISSIONS[number];

// 2. โครงสร้างข้อมูลสำหรับ Role
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}
