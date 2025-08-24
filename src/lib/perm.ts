// src/lib/perm.ts
export type Role = "ADMIN" | "SALES";
export type Permission = "inventory:read" | "inventory:write" | "transfer:access" | "users:manage";

const rolePerms: Record<Role, Permission[]> = {
  ADMIN: ["inventory:read", "inventory:write", "transfer:access", "users:manage"],
  SALES: ["inventory:read", "inventory:write"],
};

export function canDo(params: { moderator: boolean; roleInBranch?: Role | null; perm: Permission }) {
  if (params.moderator) return true;
  if (!params.roleInBranch) return false;
  return rolePerms[params.roleInBranch]?.includes(params.perm) ?? false;
}
