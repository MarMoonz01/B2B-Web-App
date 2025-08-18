'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import Lottie from 'lottie-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Clock3,
  ChevronDown,
  CircleAlert,
  Tags,
} from 'lucide-react';

// UI Components (shadcn)
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

// Services & Types
import { OrderService } from '@/lib/services/InventoryService';
import type { OrderStatus } from '@/lib/services/InventoryService';

// Contexts
import { useBranch } from '@/contexts/BranchContext';

// Animations — make sure these files exist and paths are correct
import truckAnimation from '@/animations/truck-shipping.json';
import receivedAnimation from '@/animations/order-received.json';


// ================================================================
// Types & Utils
// ================================================================

type Order = any;

type OrderItem = {
  id?: string;
  name?: string;
  sku?: string;
  quantity?: number;
  price?: number;
  total?: number;
  // --- ADDED FOR CLARITY ---
  specification?: string; // This will hold the "size" info
  dotCode?: string;
};

function THB(n: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

async function invoke<T = any>(names: string[], ...args: any[]): Promise<T> {
  const svc: any = OrderService as any;
  for (const n of names) {
    if (typeof svc?.[n] === 'function') return await svc[n](...args);
  }
  throw new Error(`Method not found on OrderService: ${names.join(' / ')}`);
}

function extractRawItems(order: Order): any[] {
  return (
    order?.items ||
    order?.lines ||
    order?.orderItems ||
    order?.products ||
    order?.productList ||
    order?.details ||
    []
  );
}

// --- MODIFIED: แก้ไข normalizeItem ให้ดึง size/spec และ dot ---
function normalizeItem(i: any): OrderItem {
  return {
    id: i?.id || i?.itemId || i?.productId || i?.sku,
    name: i?.name || i?.productName || i?.title || i?.sku || 'Item',
    sku: i?.sku,
    quantity: i?.quantity ?? i?.qty ?? i?.amount ?? 0,
    price: i?.price ?? i?.unitPrice ?? undefined,
    total: i?.total ?? i?.lineTotal ?? i?.price ?? i?.unitPrice ?? 0,
    // --- NEW ---
    specification: i?.specification || i?.size || '',
    dotCode: i?.dotCode || '',
  };
}

function getItems(order: Order): OrderItem[] {
  const raw = extractRawItems(order);
  return Array.isArray(raw) ? raw.map(normalizeItem) : [];
}

// ... (ส่วนอื่นๆ ของไฟล์เหมือนเดิม)
// ================================================================
// Status & Visual Meta
// ================================================================

const STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    className: string;
    dot: string;
    step: number; // 0-4
  }
> = {
  requested: {
    label: 'Requested',
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-200/60 dark:ring-blue-800/40',
    dot: 'bg-blue-500',
    step: 1,
  },
  approved: {
    label: 'Approved',
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40',
    dot: 'bg-emerald-500',
    step: 2,
  },
  confirmed: {
    label: 'Approved',
    className:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40',
    dot: 'bg-emerald-500',
    step: 2,
  },
  shipped: {
    label: 'Shipped',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-200/60 dark:ring-amber-800/40',
    dot: 'bg-amber-500',
    step: 3,
  },
  received: {
    label: 'Received',
    className:
      'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 ring-1 ring-violet-200/60 dark:ring-violet-800/40',
    dot: 'bg-violet-500',
    step: 4,
  },
  delivered: {
    label: 'Received',
    className:
      'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 ring-1 ring-violet-200/60 dark:ring-violet-800/40',
    dot: 'bg-violet-500',
    step: 4,
  },
  rejected: {
    label: 'Rejected',
    className:
      'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 ring-1 ring-red-200/60 dark:ring-red-800/40',
    dot: 'bg-red-500',
    step: 0,
  },
  cancelled: {
    label: 'Cancelled',
    className:
      'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200 ring-1 ring-zinc-200/60 dark:ring-zinc-700/60',
    dot: 'bg-zinc-500',
    step: 0,
  },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function ProgressRail({ status }: { status: OrderStatus }) {
  const step = STATUS_META[status]?.step ?? 0;
  const pct = Math.min(100, Math.max(0, (step / 4) * 100));
  const labels = ['Requested', 'Approved', 'Shipped', 'Received'];

  return (
    <div className="mt-3 select-none">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 grid grid-cols-4 text-[10px] text-muted-foreground">
        {labels.map((l, index) => (
          <div key={l} className={`text-center ${index + 1 <= step ? 'font-semibold text-primary' : ''}`}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function TransferStatusAnimator({ status }: { status: OrderStatus }) {
  if (status === 'shipped') {
    return <Lottie className="w-14 h-14" animationData={truckAnimation} loop />;
  }
  if (status === 'received' || status === 'delivered') {
    return <Lottie className="w-12 h-12" animationData={receivedAnimation} loop={false} />;
  }
  return <div className="w-14 h-14" />;
}

// ...

function useOrderItems(order: Order) {
  const embedded = getItems(order);
  const enabled = embedded.length === 0 && Boolean(order?.id);
  const q = useQuery({
    queryKey: ['orderItems', order?.id],
    queryFn: async () =>
      await invoke(['getOrderItems', 'getTransferItems', 'getOrderLines', 'getItemsByOrderId'], order?.id),
    enabled,
    staleTime: 60_000,
  });
  const remote = Array.isArray(q.data) ? q.data.map(normalizeItem) : [];
  return { items: embedded.length ? embedded : remote, loading: q.isLoading };
}


// ... (ส่วน Main Component และฟังก์ชันอื่นๆ ที่ไม่เกี่ยวกับการแสดงผล item เหมือนเดิม)
// ... (ขอข้ามไปที่ส่วน UI Bits ที่มีการเปลี่ยนแปลง)

// ================================================================
// Main Component
// ================================================================
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

  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  const buyerQ = useQuery<Order[]>({
    queryKey: ['orders', myBranchId, 'buyer'],
    queryFn: () => invoke(['getOrdersByBranch'], myBranchId, 'buyer'),
    enabled: !!myBranchId,
    refetchInterval: 10_000,
  });

  const sellerQ = useQuery<Order[]>({
    queryKey: ['orders', myBranchId, 'seller'],
    queryFn: () => invoke(['getOrdersByBranch'], myBranchId, 'seller'),
    enabled: !!myBranchId,
    refetchInterval: 10_000,
  });

  const { data: buyerOrders = [], isLoading: isBuyerLoading } = buyerQ;
  const { data: sellerOrders = [], isLoading: isSellerLoading } = sellerQ;
  const loading = isBuyerLoading || isSellerLoading;

  const filteredBuyer = useMemo(
    () => (statusFilter === 'all' ? buyerOrders : buyerOrders.filter((o) => o.status === statusFilter)),
    [buyerOrders, statusFilter],
  );
  const filteredSeller = useMemo(
    () => (statusFilter === 'all' ? sellerOrders : sellerOrders.filter((o) => o.status === statusFilter)),
    [sellerOrders, statusFilter],
  );

  const createMutation = (fnNames: string[], successMsg: string, errorMsg: string) =>
    useMutation({
      mutationFn: (id: string) => invoke(fnNames, id),
      onSuccess: () => {
        toast.success(successMsg);
        qc.invalidateQueries({ queryKey: ['orders', myBranchId] });
      },
      onError: (e: any) => toast.error(e?.message ?? errorMsg),
    });

  const approveMut = createMutation(['approveTransfer', 'approveOrder', 'confirmOrder'], 'Approved', 'Approve failed');
  const rejectMut = createMutation(['rejectTransfer', 'rejectOrder'], 'Rejected', 'Reject failed');
  const shipMut = createMutation(['shipTransfer', 'shipOrder'], 'Marked as shipped', 'Ship failed');
  const receiveMut = createMutation(['receiveTransfer', 'deliverTransfer', 'receiveOrder'], 'Received', 'Receive failed');
  const cancelMut = createMutation(['cancelTransfer', 'cancelOrder'], 'Cancelled', 'Cancel failed');

  const isPending =
    approveMut.isPending || rejectMut.isPending || shipMut.isPending || receiveMut.isPending || cancelMut.isPending;

  // ------------------------------------------------------------
  // UI Sub-Components
  // ------------------------------------------------------------

  function ActionBar({ order, role }: { order: Order; role: 'buyer' | 'seller' }) {
    const s: OrderStatus = order.status;
    if (role === 'seller') {
      if (s === 'requested') {
        return (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => approveMut.mutate(order.id)} disabled={isPending}>
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => rejectMut.mutate(order.id)} disabled={isPending}>
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
          </div>
        );
      }
      if (s === 'approved' || s === 'confirmed') {
        return (
          <Button size="sm" onClick={() => shipMut.mutate(order.id)} disabled={isPending}>
            <Truck className="h-4 w-4 mr-1" /> Mark Shipped
          </Button>
        );
      }
    }
    if (role === 'buyer') {
      if (s === 'requested' || s === 'approved' || s === 'confirmed') {
        return (
          <Button size="sm" variant="outline" onClick={() => cancelMut.mutate(order.id)} disabled={isPending}>
            <Ban className="h-4 w-4 mr-1" /> Cancel
          </Button>
        );
      }
      if (s === 'shipped') {
        return (
          <Button size="sm" onClick={() => receiveMut.mutate(order.id)} disabled={isPending}>
            <PackageCheck className="h-4 w-4 mr-1" /> Mark Received
          </Button>
        );
      }
    }
    return null;
  }

  // --- MODIFIED: แก้ไข ItemsBlock ให้แสดง size และ dot ---
  function ItemsBlock({ order }: { order: Order }) {
    const { items, loading } = useOrderItems(order);

    return (
      <div className="rounded-xl border p-3 bg-card/60">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-sm">Order Items</div>
          <div className="text-xs text-muted-foreground">{loading ? 'Loading...' : `${items.length} items`}</div>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
        ) : items.length ? (
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={it.id ?? idx} className="flex items-center justify-between rounded-lg bg-muted/30 p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{it.name}</div>
                  {/* --- NEW: แสดง Size และ DOT --- */}
                  <div className="text-xs text-muted-foreground">
                    {it.specification && <span>{it.specification}</span>}
                    {it.dotCode && <span className="font-mono ml-2">DOT {it.dotCode}</span>}
                  </div>
                   <div className="text-xs text-muted-foreground">x{it.quantity ?? 0}</div>
                </div>
                <div className="text-sm font-medium">{THB((it.total ?? it.price ?? 0) * (it.quantity ?? 1))}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CircleAlert className="h-3.5 w-3.5" />No items found.</div>
        )}
      </div>
    );
  }

  // --- MODIFIED: แก้ไข ItemPreviewChips ให้แสดง size และ dot ---
  function ItemPreviewChips({ order }: { order: Order }) {
    const { items, loading } = useOrderItems(order);
    if (loading || items.length === 0) return null;

    const list = items.slice(0, 2);
    const more = Math.max(0, items.length - list.length);

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <Tags className="h-3.5 w-3.5 text-muted-foreground" />
        {list.map((it, i) => (
          <span key={i} className="text-[11px] rounded-full border bg-background px-2 py-0.5">
            {it.name} {it.specification && `(${it.specification})`} {it.dotCode && `· ${it.dotCode}`} ×{it.quantity ?? 0}
          </span>
        ))}
        {more > 0 && <span className="text-[11px] rounded-full border bg-background px-2 py-0.5">+{more} more</span>}
      </div>
    );
  }

  function OrderCard({ order, role }: { order: Order; role: 'buyer' | 'seller' }) {
    const created = order.createdAt ? new Date(order.createdAt).toLocaleString() : null;
    const [open, setOpen] = useState(false);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="group p-3 sm:p-4 rounded-2xl border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 shadow-sm hover:shadow-md transition-all"
      >
        <div className="grid grid-cols-[56px_1fr_auto] items-start gap-3 sm:gap-4">
          <div className="flex items-center justify-center h-full pt-1">
            <TransferStatusAnimator status={order.status} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-primary">#{order.id?.slice?.(0, 8) ?? order.id}</span>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-1.5 text-sm text-muted-foreground flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  <span>{order.buyerBranchName ?? order.buyerBranchId} → {order.sellerBranchName ?? order.sellerBranchId}</span>
                </span>
                <Separator orientation="vertical" className="h-4" />
                <span>Total: <span className="font-medium text-foreground">{THB(order.totalAmount || 0)}</span></span>
              </div>
              <ItemPreviewChips order={order} />
            </div>
            <ProgressRail status={order.status} />
            {created && (
              <div className="mt-1.5 text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Clock3 className="h-3 w-3" />
                Created on {created}
              </div>
            )}
            <div className="mt-3">
              <Button variant="ghost" size="sm" className="px-2 py-1 h-auto text-xs" onClick={() => setOpen((v) => !v)}>
                <ChevronDown className={`mr-1 h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                {open ? 'Hide Details' : 'View Items'}
              </Button>
            </div>
          </div>
          <div className="shrink-0 pt-1 flex justify-end">
            <ActionBar order={order} role={role} />
          </div>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: '12px' }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ItemsBlock order={order} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  function OrdersSection({ title, icon: Icon, description, orders, role, emptyText }: { title: string; icon: React.ComponentType<any>; description: string; orders: Order[]; role: 'buyer' | 'seller'; emptyText: string; }) {
    return (
      <Card className="rounded-2xl shadow-sm border-muted/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" /> {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
            </div>
          ) : orders.length ? (
            <div className="p-2 sm:p-3 space-y-2">
              <AnimatePresence initial={false}>
                {orders.map((o: any) => <OrderCard key={o.id} order={o} role={role} />)}
              </AnimatePresence>
            </div>
          ) : (
            <div className="p-10 text-center">
              <div className="mx-auto mb-3 h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                <PackageCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">{emptyText}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const totalOpen = useMemo(() => {
    const all = [...buyerOrders, ...sellerOrders];
    return all.filter((o: any) => !['received', 'delivered', 'rejected', 'cancelled'].includes(o.status)).length;
  }, [buyerOrders, sellerOrders]);

  const Header = (
    <div className="relative overflow-hidden rounded-2xl border bg-card/50 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transfer Requests</h1>
          <p className="text-muted-foreground">
            Branch: <span className="font-medium">{myBranchName || myBranchId || '-'}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
              <Info className="h-3.5 w-3.5" />
              <span>Auto-refresh every 10s</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
              <PackageCheck className="h-3.5 w-3.5" />
              <span>Open requests: {totalOpen}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex rounded-full border bg-background p-0.5">
            {(['all', 'requested', 'approved', 'shipped', 'received'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setStatusFilter(k as any)}
                className={`px-3 py-1.5 text-xs rounded-full transition-colors ${statusFilter === k ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/50'}`}
              >
                {k === 'all' ? 'All' : STATUS_META[k as OrderStatus].label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => { buyerQ.refetch(); sellerQ.refetch(); }} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {Header}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <OrdersSection
          title="My Outgoing Requests (Buyer)"
          icon={ClipboardList}
          description={`Requests sent from ${myBranchName || myBranchId}`}
          orders={filteredBuyer}
          role="buyer"
          emptyText="No outgoing requests found."
        />
        <OrdersSection
          title="Incoming Requests (Seller)"
          icon={Building2}
          description={`Requests sent to ${myBranchName || myBranchId}`}
          orders={filteredSeller}
          role="seller"
          emptyText="No incoming requests found."
        />
      </div>
    </div>
  );
}