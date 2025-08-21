'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import Lottie from 'lottie-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GroupedVirtuoso } from 'react-virtuoso';
import {
  Check,
  X,
  Truck,
  PackageCheck,
  Ban,
  ClipboardList,
  ArrowLeftRight,
  Building2,
  Clock3,
  ChevronDown,
  CircleAlert,
  Tags,
  RefreshCw,
  Calendar,
  Factory,
  User,
  Info,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

// shadcn/ui
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';

// Services & Types
import { OrderService, type Order, type OrderItem, type OrderStatus } from '@/lib/services/InventoryService';

// Animations
import truckAnimation from '@/animations/truck-shipping.json';
import receivedAnimation from '@/animations/order-received.json';

/* ===============================================================
 * Realtime hook
 * =============================================================*/
function useRealtimeOrders(branchId: string, role: 'buyer' | 'seller') {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!branchId) {
      setIsLoading(false);
      setOrders([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = OrderService.onOrdersByBranch(branchId, role, (newOrders) => {
      setOrders(newOrders);
      setIsLoading(false);
    });
    return () => unsubscribe?.();
  }, [branchId, role]);

  return { data: orders, isLoading };
}

/* ===============================================================
 * Status Meta & Small UI
 * =============================================================*/
const STATUS_META: Record<
  OrderStatus,
  { label: string; className: string; dot: string; step: number }
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

const STATUS_ORDER: OrderStatus[] = ['requested', 'approved', 'shipped', 'received', 'rejected', 'cancelled'];

function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
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
  if (status === 'shipped' || status === 'delivered') {
    return <Lottie className="w-14 h-14" animationData={truckAnimation} loop />;
  }
  if (status === 'received') {
    return <Lottie className="w-12 h-12" animationData={receivedAnimation} loop={false} />;
  }
  return <div className="w-14 h-14" />;
}

/* ===============================================================
 * Main Component
 * =============================================================*/
export default function TransferRequestsView({ myBranchId, myBranchName }: { myBranchId: string; myBranchName: string }) {
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const toggleExpanded = (id: string) => setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));

  const { data: buyerOrders, isLoading: isBuyerLoading } = useRealtimeOrders(myBranchId, 'buyer');
  const { data: sellerOrders, isLoading: isSellerLoading } = useRealtimeOrders(myBranchId, 'seller');
  const loading = isBuyerLoading || isSellerLoading;

  // ====== Toolbar state ======
  const [searchQ, setSearchQ] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePane, setActivePane] = useState<'both' | 'outgoing' | 'incoming'>('both');
  useEffect(() => { if (typeof window !== 'undefined' && window.innerWidth < 1024) setActivePane('outgoing'); }, []);

  // ====== Keyboard shortcuts ======
  const [focusedIdxOutgoing, setFocusedIdxOutgoing] = useState(0);
  const [focusedIdxIncoming, setFocusedIdxIncoming] = useState(0);
  useEffect(() => {
    const fits = (o: Order) => {
      const q = searchQ.trim().toLowerCase();
      const passQ = !q || o.id?.toLowerCase().includes(q) || `${o.buyerBranchName} ${o.sellerBranchName}`.toLowerCase().includes(q);
      const passStatus = statusFilter === 'all' ? true : o.status === statusFilter || (statusFilter === 'received' && o.status === 'delivered');
      const created = o.createdAt?.toDate?.() as Date | undefined;
      const fromOk = !dateFrom || (created && created >= new Date(dateFrom + 'T00:00:00'));
      const toOk = !dateTo || (created && created <= new Date(dateTo + 'T23:59:59'));
      return passQ && passStatus && fromOk && toOk;
    };

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const inEditable = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === '/' && !inEditable) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      const list = (activePane === 'incoming' ? sellerOrders : buyerOrders).filter(fits);
      if (!list.length) return;

      if (e.key === 'ArrowDown' && !inEditable) {
        e.preventDefault();
        activePane === 'incoming'
          ? setFocusedIdxIncoming((i) => Math.min(i + 1, list.length - 1))
          : setFocusedIdxOutgoing((i) => Math.min(i + 1, list.length - 1));
      }
      if (e.key === 'ArrowUp' && !inEditable) {
        e.preventDefault();
        activePane === 'incoming'
          ? setFocusedIdxIncoming((i) => Math.max(i - 1, 0))
          : setFocusedIdxOutgoing((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && !inEditable) {
        e.preventDefault();
        const idx = activePane === 'incoming' ? focusedIdxIncoming : focusedIdxOutgoing;
        const order = list[idx];
        if (order?.id) openSheet(order); // เปิด drawer เมื่อกด Enter
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activePane, buyerOrders, sellerOrders, searchQ, statusFilter, dateFrom, dateTo, focusedIdxIncoming, focusedIdxOutgoing]);

  // ====== Per-card pending ======
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [modal, setModal] = useState<{ open: boolean; type: 'reject' | 'cancel' | null; orderId: string | null }>({ open: false, type: null, orderId: null });
  const [reason, setReason] = useState('');

  // ====== Drawer state ======
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const openSheet = (o: Order) => {
    setSelectedOrder(o);
    setSheetOpen(true);
  };

  // Mutations
  const approveMut = useMutation({
    mutationFn: (id: string) => OrderService.approveTransfer(id),
    onSuccess: () => toast.success('Request Approved'),
    onError: (e: any) => toast.error('Approve failed', { description: e?.message || String(e) }),
    onSettled: () => setPendingId(null),
  });
  const rejectMut = useMutation({
    mutationFn: (vars: { id: string; reason: string }) => OrderService.rejectTransfer(vars.id, vars.reason),
    onSuccess: () => toast.success('Request Rejected'),
    onError: (e: any) => toast.error('Reject failed', { description: e?.message || String(e) }),
    onSettled: () => setPendingId(null),
  });
  const shipMut = useMutation({
    mutationFn: (id: string) => OrderService.shipTransfer(id),
    onSuccess: () => toast.success('Marked as Shipped'),
    onError: (e: any) => toast.error('Ship failed', { description: e?.message || String(e) }),
    onSettled: () => setPendingId(null),
  });
  const receiveMut = useMutation({
    mutationFn: (id: string) => OrderService.receiveTransfer(id),
    onSuccess: () => toast.success('Marked as Received'),
    onError: (e: any) => toast.error('Receive failed', { description: e?.message || String(e) }),
    onSettled: () => setPendingId(null),
  });
  const cancelMut = useMutation({
    mutationFn: (vars: { id: string; reason: string }) => OrderService.cancelTransfer(vars.id, vars.reason),
    onSuccess: () => toast.success('Request Cancelled'),
    onError: (e: any) => toast.error('Cancel failed', { description: e?.message || String(e) }),
    onSettled: () => setPendingId(null),
  });

  const isAnyPending =
    approveMut.isPending || rejectMut.isPending || shipMut.isPending || receiveMut.isPending || cancelMut.isPending;

  // ====== Filtering helpers ======
  const fitsFilter = (o: Order) => {
    const q = searchQ.trim().toLowerCase();
    const passQ =
      !q ||
      o.id?.toLowerCase().includes(q) ||
      `${o.buyerBranchName} ${o.sellerBranchName}`.toLowerCase().includes(q);

    const passStatus =
      statusFilter === 'all'
        ? true
        : o.status === statusFilter || (statusFilter === 'received' && o.status === 'delivered');

    const created = o.createdAt?.toDate?.() as Date | undefined;
    const passDate = (() => {
      if (!created) return true;
      const fromOk = !dateFrom || created >= new Date(dateFrom + 'T00:00:00');
      const toOk = !dateTo || created <= new Date(dateTo + 'T23:59:59');
      return fromOk && toOk;
    })();

    return passQ && passStatus && passDate;
  };

  const filteredBuyer = useMemo(
    () => buyerOrders.filter(fitsFilter),
    [buyerOrders, searchQ, statusFilter, dateFrom, dateTo]
  );
  const filteredSeller = useMemo(
    () => sellerOrders.filter(fitsFilter),
    [sellerOrders, searchQ, statusFilter, dateFrom, dateTo]
  );

  const buyerPendingCount = filteredBuyer.length;
  const sellerPendingCount = filteredSeller.length;

  // ====== UI Blocks ======
  const ActionBar = ({ order, role }: { order: Order; role: 'buyer' | 'seller' }) => {
    const s: OrderStatus = order.status;
    const disabled = isAnyPending && pendingId === order.id;

    const Btn = ({ tip, children }: { tip: string; children: React.ReactNode }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{children}</div>
        </TooltipTrigger>
        <TooltipContent className="text-xs">{tip}</TooltipContent>
      </Tooltip>
    );

    if (role === 'seller') {
      if (s === 'requested') {
        return (
          <div className="flex flex-wrap gap-2">
            <Btn tip="Approve this request">
              <Button
                size="sm"
                onClick={() => {
                  setPendingId(order.id!);
                  approveMut.mutate(order.id!);
                }}
                disabled={disabled}
                className="shadow-sm transition-transform active:scale-95"
              >
                <Check className="h-4 w-4 mr-1" /> Approve
              </Button>
            </Btn>
            <Btn tip="Reject and provide a reason">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setModal({ open: true, type: 'reject', orderId: order.id! })}
                disabled={disabled}
                className="shadow-sm transition-transform active:scale-95"
              >
                <X className="h-4 w-4 mr-1" /> Reject
              </Button>
            </Btn>
          </div>
        );
      }
      if (s === 'approved' || s === 'confirmed') {
        return (
          <Btn tip="Mark as shipped (stock will be deducted)">
            <Button
              size="sm"
              onClick={() => {
                setPendingId(order.id!);
                shipMut.mutate(order.id!);
              }}
              disabled={disabled}
              className="shadow-sm transition-transform active:scale-95"
            >
              <Truck className="h-4 w-4 mr-1" /> Mark Shipped
            </Button>
          </Btn>
        );
      }
    }
    if (role === 'buyer') {
      if (s === 'requested' || s === 'approved' || s === 'confirmed') {
        return (
          <Btn tip="Cancel this request">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModal({ open: true, type: 'cancel', orderId: order.id! })}
              disabled={disabled}
              className="shadow-sm transition-transform active:scale-95"
            >
              <Ban className="h-4 w-4 mr-1" /> Cancel
            </Button>
          </Btn>
        );
      }
      if (s === 'shipped' || s === 'delivered') {
        return (
          <Btn tip="Confirm goods received (stock will be increased)">
            <Button
              size="sm"
              onClick={() => {
                setPendingId(order.id!);
                receiveMut.mutate(order.id!);
              }}
              disabled={disabled}
              className="shadow-sm transition-transform active:scale-95"
            >
              <PackageCheck className="h-4 w-4 mr-1" /> Mark Received
            </Button>
          </Btn>
        );
      }
    }
    return null;
  };

  const ItemsBlock = ({ order }: { order: Order }) => {
    const items = (order.items || []) as OrderItem[];
    const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
    return (
      <div className="rounded-xl border p-3 bg-card/60">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-sm">Order Items</div>
          <div className="text-xs text-muted-foreground">{items.length} items • {totalQty} pcs</div>
        </div>
        {order.cancelReason && (
          <div className="mb-2 p-2 text-xs rounded-lg bg-red-50 border border-red-200 text-red-700">
            <b>Reason:</b> {order.cancelReason}
          </div>
        )}
        {items.length ? (
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg bg-muted/30 p-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{it.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.specification && <span>{it.specification}</span>}
                    {it.dotCode && <span className="font-mono ml-2">DOT {it.dotCode}</span>}
                  </div>
                </div>
                <div className="text-right text-xs sm:text-sm">
                  <div className="font-medium">x{it.quantity ?? 0}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CircleAlert className="h-3.5 w-3.5" />No items found.
          </div>
        )}
      </div>
    );
  };

  const OrderCard = ({ order, role, selected }: { order: Order; role: 'buyer' | 'seller'; selected?: boolean }) => {
    const created = order.createdAt?.toDate?.() ?? new Date();
    const isOpen = !!expandedOrders[order.id!];
    const isPendingThis = pendingId === order.id && isAnyPending;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className={`group p-3 sm:p-4 rounded-2xl border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 shadow-sm hover:shadow-md transition-all ${selected ? 'ring-2 ring-primary/60' : ''}`}
      >
        <button
          type="button"
          onClick={() => openSheet(order)}
          className="grid grid-cols-[56px_1fr_auto] items-start gap-3 sm:gap-4 w-full text-left"
        >
          <div className="flex items-center justify-center h-full pt-1 opacity-90">
            <TransferStatusAnimator status={order.status} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-primary">#{order.id?.slice?.(0, 8) ?? order.id}</span>
              <StatusBadge status={order.status} />
              {isPendingThis && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Processing...
                </span>
              )}
            </div>
            <div className="mt-1.5 text-sm text-muted-foreground flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  <span>
                    {role === 'buyer' ? <b>You</b> : order.buyerBranchName}
                    <span className="mx-1">→</span>
                    {role === 'seller' ? <b>You</b> : order.sellerBranchName}
                  </span>
                </span>
              </div>
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Tags className="h-3.5 w-3.5" />
                <span>{(order as any).itemCount ?? (order.items?.length || 0)} items</span>
              </div>
            </div>
            <ProgressRail status={order.status} />
            <div className="mt-1.5 text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Clock3 className="h-3 w-3" />
              {format(created, 'dd MMM, HH:mm')} ({formatDistanceToNow(created, { addSuffix: true })})
            </div>
          </div>
          <div className="shrink-0 pt-1 flex justify-end">
            {/* keep action preview small; full actions in sheet */}
            <ChevronDown className="h-4 w-4 opacity-60 group-hover:opacity-100 transition" />
          </div>
        </button>

        {/* (optional) คงปุ่ม View Items เดิมไว้ก็ได้ */}
        <div className="mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="px-2 py-1 h-auto text-xs transition-transform active:scale-95"
            onClick={() => openSheet(order)}
          >
            <ChevronDown className={`mr-1 h-4 w-4`} />
            View Details
          </Button>
        </div>

        {/* legacy inline expand (ซ่อนไว้ แต่ยังเผื่อใช้ได้) */}
        <AnimatePresence initial={false}>
          {isOpen && (
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
  };

  // ====== Group helpers for GroupedVirtuoso ======
  const buildGrouped = (orders: Order[]) => {
    const groups: { label: string; count: number }[] = [];
    const items: Order[] = [];
    STATUS_ORDER.forEach((st) => {
      const chunk = orders.filter((o) => o.status === st || (st === 'received' && o.status === 'delivered'));
      if (chunk.length) {
        groups.push({ label: STATUS_META[st].label, count: chunk.length });
        items.push(...chunk);
      }
    });
    return { groups, items };
  };

  // ====== Orders sections ======
  const OrdersSection = ({
    title,
    icon: Icon,
    description,
    orders,
    role,
    emptyText,
    pendingCount,
    selectedIndex,
    onMoveFocus,
  }: {
    title: string;
    icon: React.ComponentType<any>;
    description: string;
    orders: Order[];
    role: 'buyer' | 'seller';
    emptyText: string;
    pendingCount: number;
    selectedIndex: number;
    onMoveFocus: (idx: number) => void;
  }) => {
    const { groups, items } = useMemo(() => buildGrouped(orders), [orders]);
    const height = Math.max(360, Math.min(720, typeof window !== 'undefined' ? window.innerHeight - 320 : 560));

    useEffect(() => {}, [onMoveFocus]);

    return (
      <Card className="rounded-2xl shadow-sm border-muted/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" /> {title}
            {pendingCount > 0 && <Badge className="bg-blue-500 hover:bg-blue-500">{pendingCount}</Badge>}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-xl" />
              ))}
            </div>
          ) : orders.length ? (
            viewMode === 'list' ? (
              <div className="p-2 sm:p-3 overflow-hidden rounded-b-2xl">
                <GroupedVirtuoso
                  style={{ height }}
                  groupCounts={groups.map((g) => g.count)}
                  groupContent={(index) => (
                    <div className="sticky top-0 z-10 bg-background/90 backdrop-blur px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {groups[index].label}
                    </div>
                  )}
                  increaseViewportBy={{ top: 400, bottom: 800 }}
                  itemContent={(index) => (
                    <div className="px-2 sm:px-3 py-1">
                      <OrderCard order={items[index]} role={role} selected={index === selectedIndex} />
                    </div>
                  )}
                  atBottomThreshold={80}
                  components={{ Footer: () => <div className="h-2" /> }}
                />
              </div>
            ) : (
              <div className="p-2 sm:p-3 overflow-hidden rounded-b-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {orders.map((o: any, i) => (
                    <OrderCard key={o.id} order={o} role={role} selected={i === selectedIndex} />
                  ))}
                </div>
              </div>
            )
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
  };

  return (
    <TooltipProvider delayDuration={120}>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative z-50 overflow-hidden rounded-2xl border bg-gradient-to-br from-background via-background to-muted p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Transfer Requests</h1>
              <p className="text-muted-foreground">
                Manage real-time transfer requests for{' '}
                <span className="font-medium">{myBranchName || myBranchId}</span>
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">Outgoing: {buyerPendingCount}</Badge>
              <Badge variant="outline" className="rounded-full">Incoming: {sellerPendingCount}</Badge>
            </div>
          </div>
          {/* Toolbar */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={searchRef}
                aria-label="Search orders"
                placeholder="Search order id / branch..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <select
                aria-label="Filter status"
                className="w-full h-9 rounded-lg border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All Status</option>
                <option value="requested">Requested</option>
                <option value="approved">Approved</option>
                <option value="shipped">Shipped</option>
                <option value="received">Received</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full h-9 rounded-lg border bg-background px-3 text-sm" />
              <span className="text-xs text-muted-foreground">to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full h-9 rounded-lg border bg-background px-3 text-sm" />
            </div>
            <div className="w-full">
              {/* Segmented control - overflow safe */}
              <div className="flex rounded-lg border overflow-hidden">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setActivePane('outgoing')}
                  variant={activePane === 'outgoing' ? 'default' : 'ghost'}
                  className="h-9 rounded-none flex-1"
                >
                  Outgoing
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setActivePane('incoming')}
                  variant={activePane === 'incoming' ? 'default' : 'ghost'}
                  className="h-9 rounded-none flex-1"
                >
                  Incoming
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setActivePane('both')}
                  variant={activePane === 'both' ? 'default' : 'ghost'}
                  className="h-9 rounded-none hidden xl:inline-flex"
                >
                  Both
                </Button>
              </div>
            </div>
            <div className="lg:col-span-4 flex items-center justify-end gap-2 mt-2">
              <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}>List</Button>
              <Button variant={viewMode === 'board' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('board')}>Board</Button>
            </div>
          </div>
        </div>

        <div className={`relative z-10 grid grid-cols-1 gap-6 items-start ${activePane === 'both' ? 'lg:grid-cols-2' : ''}`}>
          {(activePane === 'both' || activePane === 'outgoing') && (
            <OrdersSection
              title="My Outgoing Requests"
              icon={ClipboardList}
              description={`Requests sent from your branch`}
              orders={filteredBuyer}
              role="buyer"
              emptyText="No outgoing requests found."
              pendingCount={buyerPendingCount}
              selectedIndex={focusedIdxOutgoing}
              onMoveFocus={setFocusedIdxOutgoing}
            />
          )}
          {(activePane === 'both' || activePane === 'incoming') && (
            <OrdersSection
              title="Incoming Requests"
              icon={Building2}
              description={`Requests sent to your branch`}
              orders={filteredSeller}
              role="seller"
              emptyText="No incoming requests found."
              pendingCount={sellerPendingCount}
              selectedIndex={focusedIdxIncoming}
              onMoveFocus={setFocusedIdxIncoming}
            />
          )}
        </div>

        {/* Reason Modal */}
        <AlertDialog open={modal.open} onOpenChange={(o) => setModal({ ...modal, open: o })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Action</AlertDialogTitle>
              <AlertDialogDescription>
                This will {modal.type} the request. This action cannot be undone. Please provide a reason.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              placeholder={`Reason for ${modal.type ?? ''}...`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[96px]"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!reason.trim()) return;
                  if (!modal.orderId || !modal.type) return;
                  if (modal.type === 'reject') rejectMut.mutate({ id: modal.orderId, reason });
                  if (modal.type === 'cancel') cancelMut.mutate({ id: modal.orderId, reason });
                  setModal({ open: false, type: null, orderId: null });
                  setReason('');
                }}
                disabled={!reason.trim() || isAnyPending}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ===== Drawer: Order Details ===== */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Order Details
              </SheetTitle>
              <SheetDescription>
                View transfer information, items and take actions.
              </SheetDescription>
            </SheetHeader>

            {selectedOrder ? (
              <div className="mt-4 space-y-4">
                {/* Top meta */}
                <div className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">
                      #{selectedOrder.id?.slice?.(0, 8) ?? selectedOrder.id}
                    </div>
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Created:{' '}
                        {format(
                          (selectedOrder.createdAt?.toDate?.() as Date) ?? new Date(),
                          'dd MMM yyyy, HH:mm'
                        )}{' '}
                        (
                        {formatDistanceToNow(
                          (selectedOrder.createdAt?.toDate?.() as Date) ?? new Date(),
                          { addSuffix: true }
                        )}
                        )
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Factory className="h-4 w-4" />
                      <span>{selectedOrder.buyerBranchName} → {selectedOrder.sellerBranchName}</span>
                    </div>
                    {(selectedOrder as any).requestedBy && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Requested by {(selectedOrder as any).requestedBy}</span>
                      </div>
                    )}
                  </div>
                  <ProgressRail status={selectedOrder.status} />
                </div>

                {/* Items */}
                <ItemsBlock order={selectedOrder} />

                {/* Reasons (reject/cancel) */}
                {(selectedOrder as any).rejectReason && (
                  <div className="rounded-lg border p-3 bg-red-50/60 text-red-700">
                    <div className="text-xs font-semibold mb-1">Reject Reason</div>
                    <div className="text-sm">{(selectedOrder as any).rejectReason}</div>
                  </div>
                )}
                {selectedOrder.cancelReason && (
                  <div className="rounded-lg border p-3 bg-amber-50/60 text-amber-700">
                    <div className="text-xs font-semibold mb-1">Cancel Reason</div>
                    <div className="text-sm">{selectedOrder.cancelReason}</div>
                  </div>
                )}

                {/* Actions */}
                <div className="rounded-xl border p-3">
                  <div className="text-sm font-medium mb-2">Actions</div>
                  <div className="flex flex-wrap gap-2">
                    {/* reuse ActionBar with role autodetect (if myBranchId === buyer?) */}
                    <ActionBar
                      order={selectedOrder}
                      role={
                        selectedOrder.buyerBranchId === myBranchId ? 'buyer' : 'seller'
                      }
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 text-sm text-muted-foreground">No order selected.</div>
            )}

            <SheetFooter className="mt-6">
              <SheetClose asChild>
                <Button type="button" variant="outline">Close</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
