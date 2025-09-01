import { db } from '@/src/lib/firebaseAdmin';
import type { Me } from '@/src/lib/session';
import type { Permission } from '@/types/permission';

export async function hasPermission(user: Me, permission: Permission): Promise<boolean> {
  if (user.moderator) return true;

  const branchId = (user as any).selectedBranchId ?? null;

  // 1) ใช้ branchPerms จาก session ก่อน
  let branchPerms: any = (user as any).branchPerms;

  // 2) ถ้าไม่มีใน session ให้ดึงจาก Firestore (server side เท่านั้น)
  if (!branchPerms && (user as any).uid) {
    try {
      const snap = await db.collection('users').doc((user as any).uid).get();
      if (snap.exists) branchPerms = (snap.data() as any).branchPerms;
    } catch (_) {}
  }

  if (branchId && branchPerms?.[branchId]?.[permission] === true) return true;

  // ถ้าเลิกใช้ระบบ role-table ไปแล้ว ก็จบได้เลย
  return false;
}
