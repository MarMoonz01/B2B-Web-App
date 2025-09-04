// File: src/app/(app)/history/page.tsx
import { redirect } from 'next/navigation';

import { getServerSession } from '@/src/lib/session';
import { hasPermission } from '@/src/lib/permissionHelper';

// Client comp
import HistoryView from '@/src/app/(app)/app/views/HistoryView';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const me = await getServerSession();
  if (!me) redirect('/login');

  // อนุญาตหากมีสิทธิ์อย่างใดอย่างหนึ่งต่อไปนี้
  const canSeeHistory =
    (await hasPermission(me, 'transfer:read' as any)) ||
    (await hasPermission(me, 'overview:read' as any)) ||
    (await hasPermission(me, 'admin:view_analytics' as any));

  if (!canSeeHistory) redirect('/no-permission');

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 bg-muted/40">
      <HistoryView />
    </div>
  );
}
