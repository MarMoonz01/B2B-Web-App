// src/lib/session.ts
import { cookies } from "next/headers";
import { adminAuth, db } from "@/src/lib/firebaseAdmin";

export type SessionUser = {
  uid: string;
  email?: string | null;
  username?: string | null;
  moderator: boolean;
  selectedBranchId?: string | null;
  branches: { id: string; roles: ("ADMIN" | "SALES")[] }[];
};

export type Permission =
  | "inventory:read"
  | "inventory:write"
  | "users:manage";

const rolePerms: Record<"ADMIN" | "SALES", Permission[]> = {
  ADMIN: ["inventory:read", "inventory:write", "users:manage"],
  SALES: ["inventory:read", "inventory:write"],
};

export function canDo(params: {
  moderator: boolean;
  roleInBranch?: "ADMIN" | "SALES" | null;
  perm: Permission;
}) {
  if (params.moderator) return true;
  if (!params.roleInBranch) return false;
  return rolePerms[params.roleInBranch]?.includes(params.perm) ?? false;
}

export async function getServerSession(): Promise<SessionUser | null> {
  // ⬇️ Next.js 15: cookies() เป็น async
  const cookieStore = await cookies();
  const cookie = cookieStore.get("session")?.value;
  if (!cookie) return null;

  const decoded = await adminAuth.verifySessionCookie(cookie, true).catch(() => null);
  if (!decoded) return null;

  const uid = decoded.uid;
  const userRecord = await adminAuth.getUser(uid);
  const moderator = Boolean(userRecord.customClaims?.moderator);

  // profile
  const profSnap = await db.collection("users").doc(uid).get();
  const username = profSnap.get("username") ?? userRecord.displayName ?? null;
  const email = profSnap.get("email") ?? userRecord.email ?? null;

  // branch roles
  const rolesSnap = await db.collection("userBranchRoles").where("uid", "==", uid).get();
  const map = new Map<string, Set<"ADMIN" | "SALES">>();
  rolesSnap.forEach((d) => {
    const bid = d.get("branchId");
    const role = d.get("role");
    const set = map.get(bid) ?? new Set();
    set.add(role);
    map.set(bid, set);
  });
  const branches = [...map.entries()].map(([id, set]) => ({
    id,
    roles: [...set] as ("ADMIN" | "SALES")[],
  }));

  // ใช้ cookie 'sb' ถ้าอนุญาต
  const sb = cookieStore.get("sb")?.value ?? null;
  const selectedBranchId = moderator
    ? sb
    : branches.some((b) => b.id === sb)
    ? sb
    : branches[0]?.id ?? null;

  return { uid, email, username, moderator, selectedBranchId, branches };
}
