// src/types/permissions.ts

/** ===== Master list of permissions ===== */
export const PERMISSIONS = [
  // Overview (Branch-scoped)
  'overview:read',

  // Inventory Management
  'inventory:read',
  'inventory:write',
  'inventory:delete',

  // Transfer Management
  'transfer:create',
  'transfer:approve',
  'transfer:read',

  // User Management (scoped to a branch)
  'users:manage',
  'users:assign_roles',

  // Branch-level settings
  'branch:settings',

  // History / Audit log
  'history:read',
  'history:export',

  // Admin-level permissions
  'admin:roles:manage',
  'admin:users:manage',
  'admin:branches:manage',
  'admin:view_analytics',
] as const;

export type Permission = typeof PERMISSIONS[number];

/** Quick type guard */
export function isPermission(x: unknown): x is Permission {
  return typeof x === 'string' && (PERMISSIONS as readonly string[]).includes(x);
}

/** Firestore shape (document data) */
export interface RoleDoc {
  name: string;
  description: string;
  permissions: Permission[];
}

/** App shape (document + id) */
export interface Role extends RoleDoc {
  id: string;
}

/** Optional: baseline roles you might seed */
export const DEFAULT_ROLES: RoleDoc[] = [
  {
    name: 'Viewer',
    description: 'Can view overview/inventory/history in allowed branches.',
    permissions: ['overview:read', 'inventory:read', 'history:read'],
  },
  {
    name: 'Branch Manager',
    description: 'Manage inventory & transfers within a branch.',
    permissions: [
      'overview:read',
      'inventory:read',
      'inventory:write',
      'transfer:create',
      'transfer:approve',
      'transfer:read',
      'users:manage',
      'users:assign_roles',
      'branch:settings',
      'history:read',
      'history:export',
    ],
  },
  {
    name: 'System Admin',
    description: 'Full system admin access.',
    permissions: [
      'overview:read',
      'inventory:read',
      'inventory:write',
      'inventory:delete',
      'transfer:create',
      'transfer:approve',
      'transfer:read',
      'users:manage',
      'users:assign_roles',
      'branch:settings',
      'history:read',
      'history:export',
      'admin:roles:manage',
      'admin:users:manage',
      'admin:branches:manage',
      'admin:view_analytics',
    ],
  },
];
