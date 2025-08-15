'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OrderService } from '@/lib/services/InventoryService';
import type { Order } from '@/lib/services/InventoryService';

import { toast } from 'sonner';
import {
  Search,
  Building2,
  Eye,
  Check,
  RefreshCw,
  Calendar,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

// ---- Types ----
type TabKey = 'incoming' | 'outgoing';
type SortKey =
  | 'date-desc'
  | 'date-asc'
  | 'amount-high'
  | 'amount-low'
  | 'items-high'
  | 'items-low'
  | 'branch';

type StatusFilter = 'all' | NonNullable<Order['status']>;

// ---- Utils ----
const formatTHB = (n: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

const formatDate = (ts: any) => {
  try {
    if (!ts) return '-';
    const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
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
      return 'secondary' as const;
    case 'confirmed':
      return 'default' as const;
    case 'delivered':
      return 'secondary' as const; // align with shadcn variants
    case 'cancelled':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
};

const getStatusColor = (status: Order['status']) => {
  switch (status) {
    case 'requested':
      return 'text-amber-600';
    case 'confirmed':
      return 'text-blue-600';
    case 'delivered':
      return 'text-green-600';
    case 'cancelled':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function TransferRequestsView({ myBranchId }: { myBranchId: string }) {
  const qc = useQueryClient();

  // Tabs / filters
  const [tab, setTab] = useState<TabKey>('incoming');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('date-desc');

  // Details Sheet
  const [openSheet, setOpenSheet] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Fetch
  const incomingQuery = useQuery({
    queryKey: ['orders', myBranchId, 'seller'],
    queryFn: () => OrderService.getOrdersByBranch(myBranchId, 'seller'),
    enabled: Boolean(myBranchId),
    refetchInterval: 15000,
  });
  const outgoingQuery = useQuery({
    queryKey: ['orders', myBranchId, 'buyer'],
    queryFn: () => OrderService.getOrdersByBranch(myBranchId, 'buyer'),
    enabled: Boolean(myBranchId),
    refetchInterval: 15000,
  });

  const loading = incomingQuery.isLoading || outgoingQuery.isLoading;
  const incoming = (incomingQuery.data ?? []) as Order[];
  const outgoing = (outgoingQuery.data ?? []) as Order[];

  // Approve mutation (incoming only)
  const approveMutation = useMutation({
    mutationFn: (orderId: string) => OrderService.approveTransfer(orderId),
    onSuccess: () => {
      toast.success('Transfer request approved successfully');
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'seller'] });
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'buyer'] });
      setOpenSheet(false);
    },
    onError: (e: any) => {
      toast.error(`Failed to approve request: ${e?.message ?? 'Unknown error'}`);
    },
  });

  // Reject mutation (incoming only)
  const rejectMutation = useMutation({
    mutationFn: (orderId: string) => OrderService.rejectTransfer(orderId),
    onSuccess: () => {
      toast.success('Transfer request rejected');
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'seller'] });
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'buyer'] });
      setOpenSheet(false);
    },
    onError: (e: any) => {
      toast.error(`Failed to reject request: ${e?.message ?? 'Unknown error'}`);
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
    const incItems = incoming.reduce((s, o) => s + (o.items?.length ?? 0), 0);
    const outItems = outgoing.reduce((s, o) => s + (o.items?.length ?? 0), 0);
    return { incPending, outPending, incAmount, outAmount, incItems, outItems };
  }, [incoming, outgoing]);

  // Active list per tab
  const rawList = tab === 'incoming' ? incoming : outgoing;

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    let list = rawList.filter((o) =>
      q
        ? [
            o.orderNumber,
            o.buyerBranchName,
            o.sellerBranchName,
            ...((o.items ?? []).map((i) => `${i.productName} ${i.specification} ${i.dotCode}`) ?? []),
          ]
            .join(' ')
            .toLowerCase()
            .includes(q)
        : true
    );

    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter);

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
  }, [rawList, debouncedSearch, statusFilter, sortBy, tab]);

  const openDetails = (o: Order) => {
    setActiveOrder(o);
    setOpenSheet(true);
  };

  const renderSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      ))}
    </div>
  );

  // UI blocks
  const Header = (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Transfer Requests</h1>
        <p className="text-muted-foreground">Manage your incoming and outgoing inventory transfer requests.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );

  const KPI = (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
      <Card className="rounded-xl shadow-sm border-amber-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-600" />
            Incoming Pending
          </CardTitle>
          <CardDescription>Waiting for your approval</CardDescription>
        </CardHeader>
        <CardContent className="text-2xl font-bold text-amber-600">{kpis.incPending}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-blue-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            Outgoing Pending
          </CardTitle>
          <CardDescription>Requested by your branch</CardDescription>
        </CardHeader>
        <CardContent className="text-2xl font-bold text-blue-600">{kpis.outPending}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-green-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-green-600" />
            Incoming Value
          </CardTitle>
          <CardDescription>Total incoming amount</CardDescription>
        </CardHeader>
        <CardContent className="text-lg font-bold text-green-600">{formatTHB(kpis.incAmount)}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-purple-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-purple-600" />
            Outgoing Value
          </CardTitle>
          <CardDescription>Total outgoing amount</CardDescription>
        </CardHeader>
        <CardContent className="text-lg font-bold text-purple-600">{formatTHB(kpis.outAmount)}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-teal-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Incoming Items</CardTitle>
          <CardDescription>Total items</CardDescription>
        </CardHeader>
        <CardContent className="text-xl font-bold">{kpis.incItems}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-indigo-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Outgoing Items</CardTitle>
          <CardDescription>Total items</CardDescription>
        </CardHeader>
        <CardContent className="text-xl font-bold">{kpis.outItems}</CardContent>
      </Card>
    </div>
  );

  const FilterBar = (
    <div className="border-b bg-muted/20 p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Tabs */}
        <div className="inline-flex rounded-md border bg-background p-1">
          <Button size="sm" variant={tab === 'incoming' ? 'default' : 'ghost'} onClick={() => setTab('incoming')} className="relative">
            Incoming
            {kpis.incPending > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                {kpis.incPending}
              </Badge>
            )}
          </Button>
          <Button size="sm" variant={tab === 'outgoing' ? 'default' : 'ghost'} onClick={() => setTab('outgoing')} className="relative">
            Outgoing
            {kpis.outPending > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                {kpis.outPending}
              </Badge>
            )}
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

          <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
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

          <Select value={sortBy} onValueChange={(v: SortKey) => setSortBy(v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest First</SelectItem>
              <SelectItem value="date-asc">Oldest First</SelectItem>
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

  const RequestCards = (
    <div className="space-y-4">
      {loading ? (
        renderSkeleton()
      ) : filtered.length === 0 ? (
        <Card className="p-10">
          <div className="text-center text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No requests found</h3>
            <p className="text-sm">
              {tab === 'incoming'
                ? "You haven't received any transfer requests yet."
                : "You haven't sent any transfer requests yet."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((order) => (
            <Card key={order.id ?? order.orderNumber} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {tab === 'incoming' ? order.buyerBranchName : order.sellerBranchName}
                        </span>
                      </div>
                      <Badge variant={getStatusVariant(order.status)} className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </div>

                    {/* Order Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Order #</div>
                        <div className="font-medium">{order.orderNumber ?? order.id?.slice(-6)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Date</div>
                        <div>{formatDate(order.createdAt)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Items</div>
                        <div className="font-medium">{order.items?.length ?? 0} item(s)</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Amount</div>
                        <div className="font-medium">{formatTHB(order.totalAmount ?? 0)}</div>
                      </div>
                    </div>

                    {/* Items Preview */}
                    {!!(order.items && order.items.length) && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs text-muted-foreground mb-2">Items:</div>
                        <div className="flex flex-wrap gap-1">
                          {order.items.slice(0, 3).map((item, idx) => (
                            <Badge key={`${item.dotCode}-${idx}`} variant="outline" className="text-xs">
                              {item.productName} ({item.dotCode}) ×{item.quantity}
                            </Badge>
                          ))}
                          {order.items.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{order.items.length - 3} more</Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {order.notes && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs text-muted-foreground mb-1">Notes:</div>
                        <div className="text-sm text-muted-foreground italic">
                          "{order.notes.length > 100 ? order.notes.slice(0, 100) + '...' : order.notes}"
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={() => openDetails(order)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>

                    {/* Quick actions for incoming requests */}
                    {tab === 'incoming' && order.status === 'requested' && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(order.id!)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          {approveMutation.isPending ? 'Approving...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectMutation.mutate(order.id!)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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
      <div>{RequestCards}</div>

      {/* Details Sheet */}
      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Transfer Request Details</SheetTitle>
            {activeOrder && (
              <SheetDescription>
                #{activeOrder.orderNumber ?? activeOrder.id} • {formatDate(activeOrder.createdAt)} •{' '}
                <Badge variant={getStatusVariant(activeOrder.status)} className={getStatusColor(activeOrder.status)}>
                  {activeOrder.status}
                </Badge>
              </SheetDescription>
            )}
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-12rem)] pr-4 mt-6">
            {!activeOrder ? (
              <div className="text-sm text-muted-foreground">No order selected.</div>
            ) : (
              <div className="space-y-6">
                {/* Order Summary */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">From (Buyer)</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{activeOrder.buyerBranchName}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">To (Seller)</Label>
                        <div className="mt-1 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{activeOrder.sellerBranchName}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Items</Label>
                        <div className="mt-1 font-medium">{activeOrder.items?.length ?? 0} item(s)</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Amount</Label>
                        <div className="mt-1 font-medium text-lg">{formatTHB(activeOrder.totalAmount ?? 0)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Line Items */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Requested Items</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {(activeOrder.items ?? []).map((item, idx) => (
                        <div key={`${item.dotCode}-${idx}`} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{item.productName}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {item.specification} • DOT: <span className="font-mono">{item.dotCode}</span>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {item.quantity} units × {formatTHB(item.unitPrice)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{formatTHB(item.totalPrice ?? item.unitPrice * item.quantity)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Notes */}
                {activeOrder.notes && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{activeOrder.notes}</div>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                {tab === 'incoming' && activeOrder.status === 'requested' && (
                  <div className="flex items-center justify-between gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => setOpenSheet(false)}>
                      Close
                    </Button>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="destructive"
                        onClick={() => rejectMutation.mutate(activeOrder.id!)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                      >
                        {rejectMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Rejecting...
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => approveMutation.mutate(activeOrder.id!)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="min-w-[120px]"
                      >
                        {approveMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Approving...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Approve Request
                          </>
                        )}
                      </Button>
                    </div>
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
