// File: src/src/lib/permissionHelper.ts
import { db } from '@/src/lib/firebaseAdmin';
import type { Me } from '@/src/lib/session';
import type { Permission } from '@/types/permission';

/**
 * Structure we expect on user doc/session (but code tolerates missing fields):
 * {
 *   uid: string,
 *   moderator?: boolean,
 *   selectedBranchId?: string|null,
 *   // Optional fast-path from session:
 *   branchPerms?: Record<branchId, Record<Permission | string, boolean>>,
 *   globalPerms?: Record<Permission | string, boolean>
 * }
 */

type BranchPerms = Record<string, Record<string, boolean>>; // branchId -> { perm -> true }
type GlobalPerms = Record<string, boolean>;

function hasWildcard(perms: Record<string, boolean> | undefined, perm: string) {
  if (!perms) return false;
  // support "inventory:*" style
  const [ns] = perm.split(':', 1);
  return Boolean(perms[`${ns}:*`]);
}

function checkGlobal(globalPerms: GlobalPerms | undefined, perm: string) {
  if (!globalPerms) return false;
  return Boolean(globalPerms[perm] || hasWildcard(globalPerms, perm));
}

function checkBranch(
  branchPerms: BranchPerms | undefined,
  branchId: string | null | undefined,
  perm: string
) {
  if (!branchPerms) return false;
  if (branchId && branchPerms[branchId]) {
    const p = branchPerms[branchId];
    return Boolean(p[perm] || hasWildcard(p, perm));
  }
  return false;
}

function checkAnyBranch(branchPerms: BranchPerms | undefined, perm: string) {
  if (!branchPerms) return false;
  for (const bId of Object.keys(branchPerms)) {
    const p = branchPerms[bId];
    if (p?.[perm] || hasWildcard(p, perm)) return true;
  }
  return false;
}

export async function hasPermission(user: Me, permission: Permission): Promise<boolean> {
  // 0) Moderators bypass
  if ((user as any)?.moderator) return true;

  const uid = (user as any)?.uid;
  const selectedBranchId = (user as any)?.selectedBranchId ?? null;

  // 1) Try from session first
  let branchPerms: BranchPerms | undefined = (user as any)?.branchPerms;
  let globalPerms: GlobalPerms | undefined = (user as any)?.globalPerms;

  // 2) Fallback: fetch from Firestore (server)
  if ((!branchPerms || !globalPerms) && uid) {
    try {
      const snap = await db.collection('users').doc(uid).get();
      if (snap.exists) {
        const data = (snap.data() as any) || {};
        branchPerms = branchPerms ?? (data.branchPerms as BranchPerms | undefined);
        globalPerms = globalPerms ?? (data.globalPerms as GlobalPerms | undefined);
      }
    } catch {
      // swallow: non-fatal, will just evaluate to false below
    }
  }

  // 3) Global permission (e.g., admin:view_analytics)
  if (checkGlobal(globalPerms, permission)) return true;

  // 4) Branch-scoped permission on the currently selected branch
  if (checkBranch(branchPerms, selectedBranchId, permission)) return true;

  // 5) If no branch is selected (or view is global), allow if user has the perm on ANY branch
  //    This helps for global pages like analytics/history when branch is chosen later in the UI
  if (!selectedBranchId && checkAnyBranch(branchPerms, permission)) return true;

  // 6) Default deny
  return false;
}
