'use client';

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, Warehouse, ArrowLeftRight, BellRing, PackageSearch, PlusCircle, History, FileText, Info, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useBranch } from '@/contexts/BranchContext';
import { useOverviewData } from '@/hooks/useOverviewData';
import { useNotifications } from '@/contexts/NotificationContext'; // ใช้ระบบแจ้งเตือนจริงของคุณ

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

/* ───────────────────────────────── helpers ───────────────────────────────── */

const fmtTHB = (n?: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
    .format(Number.isFinite(n ?? NaN) ? (n as number) : 0);

type IconType = React.ElementType;

function Empty({
  label,
  ctaLabel,
  onCta,
  height = 250,
}: { label: string; ctaLabel?: string; onCta?: () => void; height?: number }) {
  return (
    <div className="flex w-full items-center justify-center text-muted-foreground flex-col gap-3"
         style={{ height }}>
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4" />
        <span>{label}</span>
      </div>
      {ctaLabel && <Button size="sm" variant="outline" onClick={onCta}>{ctaLabel}</Button>}
    </div>
  );
}

function KpiCard({
  title, value, icon: Icon, isLoading, onClick,
}: {
  title: string;
  value: string | number | null | undefined;
  icon: IconType;
  isLoading: boolean;
  onClick?: () => void;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-3/4" />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card
      className={onClick ? 'cursor-pointer transition hover:shadow-md' : undefined}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value ?? '—'}</div>
      </CardContent>
    </Card>
  );
}

function timeAgo(d: Date) {
  const diff = Math.max(0, Date.now() - d.getTime());
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), dd = Math.floor(h / 24);
  if (dd > 0) return `${dd}d`;
  if (h > 0)  return `${h}h`;
  if (m > 0)  return `${m}m`;
  return 'now';
}

/* ───────────────────────────────── component ─────────────────────────────── */

export default function OverviewView() {
  const router = useRouter();
  const { selectedBranchId, selectedBranch } = useBranch();

  // Prefetch ปลายทางยอดนิยมให้ลื่นขึ้น
  React.useEffect(() => {
    router.prefetch('/app?view=transfer_platform');
    router.prefetch('/app?view=inventory');
    router.prefetch('/app/admin/users');
    router.prefetch('/app?view=transfer_requests');
    router.prefetch('/app?view=notifications');
  }, [router]);

  if (!selectedBranchId) {
    return (
      <Alert>
        <BellRing className="h-4 w-4" />
        <AlertTitle>เลือกสาขาก่อนเริ่มใช้งาน</AlertTitle>
        <AlertDescription>
          กรุณาเลือกสาขาที่มุมขวาบน (BranchSelect) เพื่อดูภาพรวมของธุรกิจในสาขานั้น
        </AlertDescription>
      </Alert>
    );
  }

  const { kpiData, performanceData, recentTransactions, loading, error } =
    useOverviewData(selectedBranchId);

  // ใช้ระบบแจ้งเตือนจริงจาก Context
  const { notifications, loading: notifLoading, ready, markAsRead, markAllAsRead } = useNotifications();

  const branchName = selectedBranch?.branchName || 'your branch';

  if (error) {
    return (
      <Alert variant="destructive" className="flex items-start justify-between">
        <div>
          <BellRing className="h-4 w-4" />
        </div>
        <div className="flex-1 ml-3">
          <AlertTitle className="mt-2">โหลดข้อมูล Overview ไม่สำเร็จ</AlertTitle>
          <AlertDescription className="whitespace-pre-line mt-1">
            {error.message || `Could not load overview data for ${branchName}.`}
          </AlertDescription>
        </div>
        <Button size="sm" variant="secondary" onClick={() => router.refresh()}>
          Retry
        </Button>
      </Alert>
    );
  }

  const chartData = (performanceData?.length ?? 0) > 0 ? performanceData : [{ day: '', revenue: 0 }];

  // แสดงเฉพาะแจ้งเตือนที่ยังไม่ได้อ่าน
  const unreadNotifs = notifications.filter(n => !n.isRead);

  return (
    <div className="space-y-6" aria-busy={loading} aria-live="polite">
      {/* header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Business Overview</h1>
          <p className="text-muted-foreground">Welcome back! Here’s a summary for {branchName}.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push('/app?view=inventory&action=add')}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Product
          </Button>
          <Button variant="outline" onClick={() => router.push('/app?view=transfer_platform')}>
            <ArrowLeftRight className="mr-2 h-4 w-4" /> New Transfer
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Today's Revenue"
          value={loading || !kpiData ? '...' : fmtTHB(kpiData.revenue)}
          icon={DollarSign}
          isLoading={loading}
          onClick={() => router.push('/app?view=orders&filter=today')}
        />
        <KpiCard
          title="Inventory Value"
          value={loading || !kpiData ? '...' : fmtTHB(kpiData.inventoryValue)}
          icon={Warehouse}
          isLoading={loading}
          onClick={() => router.push('/app?view=inventory')}
        />
        <KpiCard
          title="Open Transfers"
          value={loading || !kpiData ? '...' : Number(kpiData.openTransfers ?? 0)}
          icon={ArrowLeftRight}
          isLoading={loading}
          onClick={() => router.push('/app?view=transfer_requests')}
        />
        <KpiCard
          title="Critical Alerts"
          value={loading || !kpiData ? '...' : Number(kpiData.criticalAlerts ?? 0)}
          icon={BellRing}
          isLoading={loading}
        />
      </div>

      {/* charts + recent */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-12 lg:col-span-4 overflow-hidden">
          <CardHeader>
            <CardTitle>7-Day Performance</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (performanceData.length === 0) ? (
              <Empty
                label="ยังไม่มีข้อมูลยอดขายในช่วง 7 วัน"
                ctaLabel="สร้างคำสั่งขาย"
                onCta={() => router.push('/app?view=orders&action=create')}
              />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmtTHB(Number(v)).replace('฿', '฿ ')}
                  />
                  <Tooltip formatter={(v) => [fmtTHB(Number(v)), 'Revenue']} />
                  <Bar dataKey="revenue" fill="currentColor" radius={[6, 6, 0, 0]} className="fill-primary" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : recentTransactions.length === 0 ? (
              <Empty
                label="ยังไม่มีคำสั่งขายล่าสุด"
                ctaLabel="สร้างคำสั่งขาย"
                onCta={() => router.push('/app?view=orders&action=create')}
                height={220}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.productName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tx.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmtTHB(Number(tx.amount))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* quick actions + System Notifications (neutral) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="w-full justify-start text-left"
              onClick={() => router.push('/app?view=inventory')}
              aria-label="Manage Inventory"
            >
              <PackageSearch className="mr-2 h-4 w-4" />
              <span>Manage Inventory</span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-left"
              onClick={() => router.push('/app?view=transfer_requests')}
              aria-label="View Transfer Requests"
            >
              <History className="mr-2 h-4 w-4" />
              <span>View Transfer Requests</span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-left"
              onClick={() => router.push('/app/admin/branches')}
              aria-label="Generate Report"
            >
              <FileText className="mr-2 h-4 w-4" />
              <span>Generate Report</span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-left"
              onClick={() => router.push('/app/admin/users')}
              aria-label="Add New User"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              <span>Add New User</span>
            </Button>
          </CardContent>
        </Card>

        {/* System Notifications (ไม่ใช้ severity) */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              <CardTitle>System Notifications</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                disabled={!ready || unreadNotifs.length === 0}
              >
                Mark all as read
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push('/app?view=notifications')}>
                View all
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {notifLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : unreadNotifs.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-muted-foreground">
                ไม่มีการแจ้งเตือนใหม่
              </div>
            ) : (
              <ul className="divide-y">
                {unreadNotifs.map((n, idx) => {
                  const createdAt =
                    (n as any)?.createdAt?.toDate?.() ??
                    (typeof (n as any)?.createdAt === 'number' ? new Date((n as any).createdAt) : new Date());

                  return (
                    <li
                      key={n.id}
                      className="relative flex items-start gap-3 p-4 hover:bg-muted/40 transition"
                    >
                      {/* timeline rail */}
                      <div className="absolute left-6 top-0 bottom-0 hidden sm:block">
                        {idx !== unreadNotifs.length - 1 && <div className="mx-auto h-full w-px bg-border" />}
                      </div>

                      {/* dot (neutral) */}
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />

                      {/* body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Notification</Badge>
                          <span className="font-medium">{n.title}</span>
                          <span className="text-xs text-muted-foreground">• {timeAgo(createdAt)}</span>
                        </div>
                        <div className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                          <Info className="mt-0.5 h-4 w-4 opacity-70" />
                          <p className="leading-6">{n.message}</p>
                        </div>
                      </div>

                      {/* dismiss */}
                      <button
                        aria-label="Dismiss notification"
                        className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition"
                        onClick={() => n.id && markAsRead(n.id)}
                        disabled={!ready}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
