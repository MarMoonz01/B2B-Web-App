'use client';

import React, { useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Check,
  X,
  Truck,
  PackageCheck,
  Ban,
  RefreshCw,
  Info,
  ClipboardList,
  ArrowLeftRight,
  Building2,
} from 'lucide-react';

// UI
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

// Services & types
import { OrderService } from '@/lib/services/InventoryService';
import type { OrderStatus } from '@/lib/services/InventoryService';

// Branch context
import { useBranch } from '@/contexts/BranchContext';

type Order = any;

// ---------- helpers ----------
function THB(n: number) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(
    Number(n) || 0
  );
}

/**
 * เรียกเมธอดบน OrderService ด้วยชื่อสำรองหลายแบบ
 * เช่น approve → จะลอง ['approveTransfer','approveOrder']
 */
async function invoke<T = any>(names: string[], ...args: any[]): Promise<T> {
  const svc: any = OrderService as any;
  for (const n of names) {
    if (typeof svc?.[n] === 'function') {
      return await svc[n](...args);
    }
  }
  throw new Error(`Method not found on OrderService: ${names.join(' / ')}`);
}

// ---------- UI bits ----------
const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  // โปรเจกต์ของคุณยังมี confirmed/delivered รวมอยู่ใน OrderStatus
  requested: { label: 'Requested', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  approved:  { label: 'Approved',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected:  { label: 'Rejected',  className: 'bg-rose-50 text-rose-700 border-rose-200' },
  shipped:   { label: 'Shipped',   className: 'bg-amber-50 text-amber-700 border-amber-200' },
  received:  { label: 'Received',  className: 'bg-violet-50 text-violet-700 border-violet-200' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  // เพิ่มสองคีย์นี้เพื่อให้ตรงกับ union type ปัจจุบันของคุณ
  confirmed: { label: 'Approved',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  delivered: { label: 'Received',  className: 'bg-violet-50 text-violet-700 border-violet-200' },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

// ---------- main component ----------
export default function TransferRequestsView({
  myBranchId: _myBranchId,
  myBranchName: _myBranchName,
}: {
  myBranchId?: string;
  myBranchName?: string;
}) {
  const qc = useQueryClient();
  const { selectedBranchId, branches } = useBranch();
  const myBranchId = _myBranchId || selectedBranchId || '';
  const myBranchName =
    _myBranchName || (myBranchId ? branches.find((b) => b.id === myBranchId)?.branchName ?? myBranchId : '');

  // --- Queries
  const buyerQ = useQuery({
    queryKey: ['orders', myBranchId, 'buyer'],
    queryFn: () => invoke(['getOrdersByBranch'], myBranchId, 'buyer'),
    enabled: !!myBranchId,
    refetchInterval: 10_000,
    staleTime: 10_000,
  });

  const sellerQ = useQuery({
    queryKey: ['orders', myBranchId, 'seller'],
    queryFn: () => invoke(['getOrdersByBranch'], myBranchId, 'seller'),
    enabled: !!myBranchId,
    refetchInterval: 10_000,
    staleTime: 10_000,
  });

  const loading = buyerQ.isLoading || sellerQ.isLoading;
  const buyerOrders: Order[] = buyerQ.data ?? [];
  const sellerOrders: Order[] = sellerQ.data ?? [];

  const counts = useMemo(() => {
    const all = [...buyerOrders, ...sellerOrders];
    const base: Record<any, number> = {};
    all.forEach((o: any) => {
      base[o.status] = (base[o.status] ?? 0) + 1;
    });
    // ensure keys exist for display
    for (const k of Object.keys(STATUS_META)) {
      base[k] = base[k] ?? 0;
    }
    return base as Record<OrderStatus, number>;
  }, [buyerOrders, sellerOrders]);

  // --- Mutations (รองรับชื่อเมธอดได้หลายแบบ)
  const approveMut = useMutation({
    mutationFn: async (id: string) =>
      invoke(['approveTransfer', 'approveOrder', 'confirmTransfer', 'confirmOrder'], id),
    onSuccess: () => {
      toast.success('Approved');
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'seller'] });
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'buyer'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Approve failed'),
  });

  const rejectMut = useMutation({
    mutationFn: async (id: string) => invoke(['rejectTransfer', 'rejectOrder'], id),
    onSuccess: () => {
      toast.success('Rejected');
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'seller'] });
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'buyer'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Reject failed'),
  });

  const shipMut = useMutation({
    mutationFn: async (id: string) => invoke(['shipTransfer', 'shipOrder'], id),
    onSuccess: () => {
      toast.success('Marked as shipped');
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'seller'] });
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'buyer'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Ship failed'),
  });

  const receiveMut = useMutation({
    mutationFn: async (id: string) => invoke(['receiveTransfer', 'deliverTransfer', 'receiveOrder'], id),
    onSuccess: () => {
      toast.success('Received');
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'buyer'] });
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'seller'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Receive failed'),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => invoke(['cancelTransfer', 'cancelOrder'], id),
    onSuccess: () => {
      toast.success('Cancelled');
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'buyer'] });
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'seller'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Cancel failed'),
  });

  // ---------- UI blocks ----------
  const Header = (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Transfer Requests</h1>
        <p className="text-muted-foreground">
          Branch: <span className="font-medium">{myBranchName || myBranchId || '-'}</span>
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          buyerQ.refetch();
          sellerQ.refetch();
        }}
        disabled={loading}
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  );

  const KPI = (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      {(
        [
          ['requested', 'Requested'],
          ['approved', 'Approved'],
          ['rejected', 'Rejected'],
          ['shipped', 'Shipped'],
          ['received', 'Received'],
          ['cancelled', 'Cancelled'],
        ] as [keyof typeof STATUS_META, string][]
      ).map(([k, label]) => (
        <Card key={k} className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{label}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{counts[k as OrderStatus] ?? 0}</CardContent>
        </Card>
      ))}
    </div>
  );

  function ItemsSummary({ order }: { order: Order }) {
    const items = order?.items ?? [];
    const count = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
    return (
      <span className="text-xs text-muted-foreground">
        {items.length} lines • {count} units
      </span>
    );
  }

  function RowActions({ order, role }: { order: Order; role: 'buyer' | 'seller' }) {
    const s: OrderStatus = order.status;

    if (role === 'seller') {
      if (s === 'requested') {
        return (
          <div className="flex gap-2 justify-end">
            <Button size="sm" onClick={() => approveMut.mutate(order.id)} disabled={approveMut.isPending}>
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => rejectMut.mutate(order.id)}
              disabled={rejectMut.isPending}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        );
      }
      if (s === 'approved' || s === 'confirmed') {
        return (
          <div className="flex gap-2 justify-end">
            <Button size="sm" onClick={() => shipMut.mutate(order.id)} disabled={shipMut.isPending}>
              <Truck className="h-4 w-4 mr-1" />
              Mark Shipped
            </Button>
          </div>
        );
      }
      return null;
    }

    // role === 'buyer'
    if (s === 'requested' || s === 'approved' || s === 'confirmed') {
      return (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => cancelMut.mutate(order.id)}
            disabled={cancelMut.isPending}
          >
            <Ban className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      );
    }
    if (s === 'shipped') {
      return (
        <div className="flex gap-2 justify-end">
          <Button size="sm" onClick={() => receiveMut.mutate(order.id)} disabled={receiveMut.isPending}>
            <PackageCheck className="h-4 w-4 mr-1" />
            Mark Received
          </Button>
        </div>
      );
    }
    // delivered/received: read-only
    return null;
  }

  function OrdersList({
    role,
    orders,
    emptyText,
  }: {
    role: 'buyer' | 'seller';
    orders: Order[];
    emptyText: string;
  }) {
    if (loading) {
      return (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      );
    }
    if (!orders.length) {
      return <div className="p-8 text-center text-muted-foreground">{emptyText}</div>;
    }
    return (
      <div className="divide-y">
        {orders.map((o: any) => (
          <div key={o.id} className="p-4 hover:bg-muted/20 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">#{o.id?.slice?.(0, 8) ?? o.id}</span>
                  <StatusBadge status={o.status} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    {o.buyerBranchName ?? o.buyerBranchId} → {o.sellerBranchName ?? o.sellerBranchId}
                  </span>
                  <Separator orientation="vertical" className="h-4" />
                  <ItemsSummary order={o} />
                  <Separator orientation="vertical" className="h-4" />
                  <span>Total: <span className="font-medium">{THB(o.totalAmount || 0)}</span></span>
                </div>
                {o.notes && <div className="mt-1 text-xs italic text-muted-foreground">“{o.notes}”</div>}
                {o.createdAt && (
                  <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" />
                    Created {new Date(o.createdAt).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="shrink-0">
                <RowActions order={o} role={role} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Header}

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <Card className="md:col-span-4 rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              My Outgoing Requests (Buyer)
            </CardTitle>
            <CardDescription>
              Requests you sent from <span className="font-medium">{myBranchName || myBranchId}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <OrdersList
              role="buyer"
              orders={buyerOrders}
              emptyText="No outgoing requests."
            />
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-3">
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Status Overview</CardTitle>
              <CardDescription>Across incoming & outgoing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(
                [
                  ['requested', 'Requested'],
                  ['approved', 'Approved'],
                  ['rejected', 'Rejected'],
                  ['shipped', 'Shipped'],
                  ['received', 'Received'],
                  ['cancelled', 'Cancelled'],
                ] as [keyof typeof STATUS_META, string][]
              ).map(([k, label]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={k as OrderStatus} />
                    <span>{label}</span>
                  </div>
                  <span className="font-medium">{counts[k as OrderStatus] ?? 0}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Incoming Requests (Seller)
              </CardTitle>
              <CardDescription>
                Requests other branches sent to <span className="font-medium">{myBranchName || myBranchId}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <OrdersList
                role="seller"
                orders={sellerOrders}
                emptyText="No incoming requests."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
