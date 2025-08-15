'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OrderService } from '@/lib/services/InventoryService';
import type { Order } from '@/types/inventory';

import { toast } from 'sonner';
import {
  Search,
  Building2,
  Eye,
  Check,
  MoreHorizontal,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

type TabKey = 'incoming' | 'outgoing';
type SortKey = 'date-desc' | 'date-asc' | 'amount-high' | 'amount-low' | 'items-high' | 'items-low' | 'branch';

const formatTHB = (n: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(Number(n) || 0);

const formatDate = (ts: any) => {
  // Firestore Timestamp: { seconds, nanoseconds }
  try {
    if (!ts) return '-';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
};

const getStatusVariant = (status: Order['status']) => {
  switch (status) {
    case 'requested':
      return 'secondary';
    case 'confirmed':
      return 'default';
    case 'delivered':
      return 'secondary'; // ใช้ secondary เพื่อความเข้ากันได้
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
};

export default function TransferRequestsView({ myBranchId }: { myBranchId: string }) {
  const qc = useQueryClient();

  // Tabs / filters
  const [tab, setTab] = useState<TabKey>('incoming');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Order['status']>('all');
  const [sortBy, setSortBy] = useState<SortKey>('date-desc');

  // Details Sheet
  const [openSheet, setOpenSheet] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Fetch
  const incomingQuery = useQuery({
    queryKey: ['orders', myBranchId, 'incoming'],
    queryFn: () => OrderService.getOrdersByBranch(myBranchId, 'seller'),
    enabled: Boolean(myBranchId),
    refetchInterval: 15000,
  });
  const outgoingQuery = useQuery({
    queryKey: ['orders', myBranchId, 'outgoing'],
    queryFn: () => OrderService.getOrdersByBranch(myBranchId, 'buyer'),
    enabled: Boolean(myBranchId),
    refetchInterval: 15000,
  });

  const loading = incomingQuery.isLoading || outgoingQuery.isLoading;
  const incoming = (incomingQuery.data ?? []) as Order[];
  const outgoing = (outgoingQuery.data ?? []) as Order[];

  // Approve mutation (สำหรับคำขอ incoming เท่านั้น)
  const approveMutation = useMutation({
    mutationFn: (orderId: string) => OrderService.approveTransfer(orderId),
    onSuccess: () => {
      toast.success('Approved request');
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'incoming'] });
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'outgoing'] });
    },
    onError: (e: any) => {
      toast.error(`Approve failed: ${e?.message ?? 'Unknown error'}`);
    },
  });

  const refresh = () => {
    incomingQuery.refetch();
    outgoingQuery.refetch();
  };

  // Derived KPI
  const kpis = useMemo(() => {
    const incPending = incoming.filter((o) => o.status === 'requested').length;
    const outPending = outgoing.filter((o) => o.status === 'requested').length;
    const incAmount = incoming.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
    const outAmount = outgoing.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
    return { incPending, outPending, incAmount, outAmount };
  }, [incoming, outgoing]);

  // Active list per tab
  const rawList = tab === 'incoming' ? incoming : outgoing;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rawList.filter((o) =>
      q
        ? [
            o.orderNumber,
            o.buyerBranchName,
            o.sellerBranchName,
            ...(o.items?.map((i) => `${i.productName} ${i.specification} ${i.dotCode}`) ?? []),
          ]
            .join(' ')
            .toLowerCase()
            .includes(q)
        : true
    );

    if (statusFilter !== 'all') {
      list = list.filter((o) => o.status === statusFilter);
    }

    const getDate = (o: Order) => (o.createdAt?.seconds ? o.createdAt.seconds * 1000 : 0);
    const getItems = (o: Order) => o.items?.length ?? 0;
    const getAmount = (o: Order) => o.totalAmount ?? 0;
    const getBranch = (o: Order) => (tab === 'incoming' ? o.buyerBranchName : o.sellerBranchName) ?? '';

    list.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return getDate(a) - getDate(b);
        case 'date-desc':
          return getDate(b) - getDate(a);
        case 'amount-high':
          return getAmount(b) - getAmount(a);
        case 'amount-low':
          return getAmount(a) - getAmount(b);
        case 'items-high':
          return getItems(b) - getItems(a);
        case 'items-low':
          return getItems(a) - getItems(b);
        case 'branch':
          return getBranch(a).localeCompare(getBranch(b));
        default:
          return 0;
      }
    });

    return list;
  }, [rawList, search, statusFilter, sortBy, tab]);

  const openDetails = (o: Order) => {
    setActiveOrder(o);
    setOpenSheet(true);
  };

  const renderSkeleton = () => (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );

  // UI blocks
  const Header = (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Transfer Requests</h1>
        <p className="text-muted-foreground">
          Manage your incoming and outgoing inventory transfer requests.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>
  );

  const KPI = (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <Card className="rounded-xl shadow-sm border-amber-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Incoming Pending</CardTitle>
          <CardDescription>Waiting for your approval</CardDescription>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{kpis.incPending}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-blue-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Outgoing Pending</CardTitle>
          <CardDescription>Requested by your branch</CardDescription>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{kpis.outPending}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-green-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Incoming Amount</CardTitle>
          <CardDescription>Total value</CardDescription>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{formatTHB(kpis.incAmount)}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-purple-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Outgoing Amount</CardTitle>
          <CardDescription>Total value</CardDescription>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{formatTHB(kpis.outAmount)}</CardContent>
      </Card>
    </div>
  );

  const FilterBar = (
    <div className="border-b bg-muted/20 p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Tabs (ด้วยปุ่ม 2 อัน แทน Tabs component เพื่อลด dependency) */}
        <div className="inline-flex rounded-md border bg-background p-1">
          <Button
            size="sm"
            variant={tab === 'incoming' ? 'default' : 'ghost'}
            onClick={() => setTab('incoming')}
          >
            Incoming
          </Button>
          <Button
            size="sm"
            variant={tab === 'outgoing' ? 'default' : 'ghost'}
            onClick={() => setTab('outgoing')}
          >
            Outgoing
          </Button>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${tab === 'incoming' ? 'incoming' : 'outgoing'} requests...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter as any}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy as any}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest</SelectItem>
              <SelectItem value="date-asc">Oldest</SelectItem>
              <SelectItem value="amount-high">Amount: High → Low</SelectItem>
              <SelectItem value="amount-low">Amount: Low → High</SelectItem>
              <SelectItem value="items-high">Items: High → Low</SelectItem>
              <SelectItem value="items-low">Items: Low → High</SelectItem>
              <SelectItem value="branch">Branch A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const Table = (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className="grid gap-4 px-4 py-3 text-xs text-muted-foreground min-w-[980px] bg-slate-50/70 border-b"
        style={{ gridTemplateColumns: '160px minmax(220px,1fr) 140px 120px 120px 80px' }}
      >
        <div>Date</div>
        <div>{tab === 'incoming' ? 'From (Buyer)' : 'To (Seller)'}</div>
        <div>Order #</div>
        <div className="text-right">Items</div>
        <div className="text-right">Amount</div>
        <div className="text-right">Status</div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="p-4">{renderSkeleton()}</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground">No requests found.</div>
      ) : (
        <div>
          {filtered.map((o) => (
            <div
              key={o.id}
              className="grid gap-4 px-5 py-4 items-center min-w-[980px] border-b hover:bg-slate-50/60 transition-colors"
              style={{ gridTemplateColumns: '160px minmax(220px,1fr) 140px 120px 120px 80px' }}
            >
              {/* Date */}
              <div className="text-sm">{formatDate(o.createdAt)}</div>

              {/* From/To Branch */}
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <div>
                  <div className="font-medium text-sm">
                    {tab === 'incoming' ? o.buyerBranchName : o.sellerBranchName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tab === 'incoming' ? 'Buyer' : 'Seller'}
                  </div>
                </div>
              </div>

              {/* Order # */}
              <div className="text-sm font-medium">{o.orderNumber ?? o.id}</div>

              {/* Items */}
              <div className="text-right text-sm">{o.items?.length ?? 0}</div>

              {/* Amount */}
              <div className="text-right text-sm">{formatTHB(o.totalAmount ?? 0)}</div>

              {/* Status + Actions */}
              <div className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" aria-haspopup="true">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Toggle menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => openDetails(o)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>

                    {/* Approve เฉพาะ incoming + requested */}
                    {tab === 'incoming' && o.status === 'requested' && (
                      <DropdownMenuItem
                        onClick={() => approveMutation.mutate(o.id!)}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Approve
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="mt-2">
                  <Badge variant={getStatusVariant(o.status)}>{o.status}</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 md:space-y-8">
      {Header}

      {KPI}

      {FilterBar}

      <div>{Table}</div>

      {/* Details Sheet */}
      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Order Details</SheetTitle>
            {activeOrder && (
              <SheetDescription>
                #{activeOrder.orderNumber ?? activeOrder.id} ·{' '}
                {formatDate(activeOrder.createdAt)} ·{' '}
                <Badge variant={getStatusVariant(activeOrder.status)}>
                  {activeOrder.status}
                </Badge>
              </SheetDescription>
            )}
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-10rem)] pr-4 mt-4">
            {!activeOrder ? (
              <div className="text-sm text-muted-foreground">No order selected.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs">From (Buyer)</Label>
                    <div className="mt-1 font-medium">{activeOrder.buyerBranchName}</div>
                  </div>
                  <div>
                    <Label className="text-xs">To (Seller)</Label>
                    <div className="mt-1 font-medium">{activeOrder.sellerBranchName}</div>
                  </div>
                  <div>
                    <Label className="text-xs">Items</Label>
                    <div className="mt-1">{activeOrder.items?.length ?? 0} item(s)</div>
                  </div>
                  <div>
                    <Label className="text-xs">Amount</Label>
                    <div className="mt-1">{formatTHB(activeOrder.totalAmount ?? 0)}</div>
                  </div>
                </div>

                <div className="border rounded-md">
                  <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                    Line Items
                  </div>
                  <div className="divide-y">
                    {(activeOrder.items ?? []).map((it, idx) => (
                      <div key={`${it.dotCode}-${idx}`} className="px-3 py-3 text-sm">
                        <div className="font-medium">{it.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.specification} · DOT: <span className="font-mono">{it.dotCode}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <div>Qty: {it.quantity}</div>
                          <div className="font-semibold">{formatTHB(it.totalPrice ?? it.unitPrice * it.quantity)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {activeOrder.notes && (
                  <div className="border rounded-md p-3">
                    <div className="text-xs text-muted-foreground mb-1">Notes</div>
                    <div className="text-sm whitespace-pre-wrap">{activeOrder.notes}</div>
                  </div>
                )}

                {/* Action in sheet */}
                {tab === 'incoming' && activeOrder.status === 'requested' && (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setOpenSheet(false)}
                    >
                      Close
                    </Button>
                    <Button
                      onClick={() => approveMutation.mutate(activeOrder.id!)}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending ? 'Approving...' : 'Approve Request'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
