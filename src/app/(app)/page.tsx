import { redirect } from 'next/navigation';
import { getServerSession } from '@/src/lib/session';
import { hasPermission } from '@/src/lib/permissionHelper';
import AppShell, { type View } from '@/src/app/(app)/shell';
import InventoryView from '@/src/app/(app)/app/views/InventoryView';
import TransferView from '@/src/app/(app)/app/views/TransferView';
import TransferRequestsView from '@/src/app/(app)/app/views/TransferRequestView';
import BranchUsersView from '@/src/app/(app)/app/views/BranchUsersView';
import AnalyticsView from '@/src/app/(app)/app/views/AnalyticsView';
import type { Permission } from '@/types/permission';

export const dynamic = 'force-dynamic';

// view ↔ permission
const VIEW_PERMISSIONS: Record<View, Permission> = {
  inventory: 'inventory:read',
  transfer: 'transfer:create',
  'transfer-requests': 'transfer:read',
  branches: 'users:manage',
  analytics: 'admin:view_analytics',
};

export default async function AppPage({ searchParams }: { searchParams: { view?: string } }) {
  const me = await getServerSession();
  if (!me) redirect('/login');

  const currentView: View = (searchParams.view as View | undefined) ?? 'inventory';

  // สร้าง allowedViews จาก permission ใหม่
  const allowedViews: View[] = [];
  for (const v of Object.keys(VIEW_PERMISSIONS) as View[]) {
    if (await hasPermission(me, VIEW_PERMISSIONS[v])) {
      allowedViews.push(v);
    }
  }

  if (allowedViews.length === 0) redirect('/no-permission');
  if (!allowedViews.includes(currentView)) redirect(`/app?view=${allowedViews[0]}`);

  const canWriteInventory = await hasPermission(me, 'inventory:write');

  // ---------- แก้ตรงนี้: map session.me → รูปแบบที่ AppShell ต้องการ ----------
  // รองรับได้ทั้งโครงที่เป็น me.user.* (NextAuth) และฟิลด์แบนที่คุณเคยใช้
  type MaybeUser = {
    id?: string;
    uid?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  type MaybeMe = {
    id?: string;
    uid?: string;
    name?: string | null;
    email?: string | null;
    selectedBranchId?: string | null;
    moderator?: boolean;
    user?: MaybeUser;
  };
  const m = me as unknown as MaybeMe;

  const shellMe: React.ComponentProps<typeof AppShell>['me'] = {
    id: m.id ?? m.uid ?? m.user?.id ?? undefined,
    uid: m.uid ?? m.id ?? m.user?.id ?? undefined,
    name: m.user?.name ?? m.name ?? null,
    email: m.user?.email ?? m.email ?? null,
    selectedBranchId: m.selectedBranchId ?? null,
    avatarUrl: m.user?.image ?? null,
    moderator: Boolean(m.moderator),
  };
  // ---------------------------------------------------------------------------

  return (
    <AppShell me={shellMe} allowedViews={allowedViews} currentView={currentView}>
      {currentView === 'inventory' && (
        <InventoryView
          canWrite={canWriteInventory}
          selectedBranchId={shellMe.selectedBranchId ?? null}
        />
      )}
      {currentView === 'transfer' && <TransferView />}
      {currentView === 'transfer-requests' && <TransferRequestsView />}
      {currentView === 'branches' && <BranchUsersView />}
      {currentView === 'analytics' && <AnalyticsView />}
    </AppShell>
  );
}
