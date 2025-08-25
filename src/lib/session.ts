// src/lib/session.ts
import { cookies as nextCookies } from "next/headers";
import { adminAuth, db } from "@/src/lib/firebaseAdmin";

export type Role = "SALES" | "ADMIN";

export type Me = {
  uid: string;
  email?: string;
  moderator: boolean;
  branches: { id: string; roles: Role[] }[];
  selectedBranchId?: string | null; // <- เพิ่ม
};

export async function getServerSession(): Promise<Me | null> {
  // NOTE: ใน Next เวอร์ชันของคุณ cookies() เป็น async
  const cookieStore = await nextCookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(token, true);
    const uid = decoded.uid;
    const moderator = !!(decoded as any).moderator;
    const selectedBranchId = cookieStore.get("sb")?.value || null;

    // โหลดบทบาทต่อสาขา
    const snap = await db
      .collection("userBranchRoles")
      .where("uid", "==", uid)
      .get();

    const byBranch = new Map<string, Set<Role>>();
    snap.forEach((d) => {
      const { branchId, role } = d.data() as any;
      if (!branchId || !role) return;
      if (!byBranch.has(branchId)) byBranch.set(branchId, new Set<Role>());
      byBranch.get(branchId)!.add(role as Role);
    });

    const branches = [...byBranch.entries()].map(([id, roles]) => ({
      id,
      roles: [...roles],
    }));

    return {
      uid,
      email: (decoded as any).email,
      moderator,
      branches,
      selectedBranchId,
    };
  } catch {
    return null;
  }
}

// helper: หา role ของ user ในสาขา
export function roleIn(me: Me, branchId?: string | null): Role | null {
  if (me.moderator) return "ADMIN";
  const id = branchId ?? me.selectedBranchId ?? undefined;
  if (!id) return null;
  return (me.branches.find((b) => b.id === id)?.roles?.[0] ?? null) as Role | null;
}

// shim เก่า: บางไฟล์อาจ import canDo จากที่นี่
export function canDo(me: Me, branchId?: string | null) {
  return { moderator: me.moderator, roleInBranch: roleIn(me, branchId), perm: {} as any };
}
