'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { OrderService, type Order } from '@/lib/services/InventoryService';

import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

import {
  Check, X, Truck, RefreshCw, Search,
} from 'lucide-react';

type Tab = 'incoming' | 'outgoing';

function formatTHB(n: number) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(Number(n) || 0);
}

function StatusBadge({ status }: { status: Order['status'] }) {
  const map: Record<Order['status'], { label: string; className: string }> = {
    requested: { label: 'Requested', className: 'bg-amber-100 text-amber-800' },
    confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-800' },
    delivered: { label: 'Delivered', className: 'bg-emerald-100 text-emerald-800' },
    cancelled: { label: 'Cancelled', className: 'bg-rose-100 text-rose-800' },
  };
  const cfg = map[status];
  return <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

export default function TransferRequestsView({
  myBranchId,
  myBranchName,
}: {
  myBranchId: string;
  myBranchName: string;
}) {
  const [tab, setTab] = useState<Tab>('incoming'); // seller by default
  const [incoming, setIncoming] = useState<Order[] | null>(null);
  const [outgoing, setOutgoing] = useState<Order[] | null>(null);
  const [search, setSearch] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // subscribe realtime
  useEffect(() => {
    const unsubSeller = OrderService.onOrdersByBranch(myBranchId, 'seller', (orders) => {
      setIncoming(orders);
      setLastUpdated(new Date());
    });
    const unsubBuyer = OrderService.onOrdersByBranch(myBranchId, 'buyer', (orders) => {
      setOutgoing(orders);
      setLastUpdated(new Date());
    });
    return () => {
      unsubSeller?.();
      unsubBuyer?.();
    };
  }, [myBranchId]);

  const list = useMemo(() => {
    const src = tab === 'incoming' ? incoming : outgoing;
    const q = search.trim().toLowerCase();
    return (src || []).filter((o) => {
      if (!q) return true;
      const text =
        `${o.orderNumber ?? ''} ${o.buyerBranchName} ${o.sellerBranchName} ${o.notes ?? ''}`
          .toLowerCase();
      return text.includes(q);
    });
  }, [tab, incoming, outgoing, search]);

  const kpis = useMemo(() => {
    const src = tab === 'incoming' ? incoming || [] : outgoing || [];
    const requested = src.filter((o) => o.status === 'requested').length;
    const confirmed = src.filter((o) => o.status === 'confirmed').length;
    const delivered = src.filter((o) => o.status === 'delivered').length;
    const cancelled = src.filter((o) => o.status === 'cancelled').length;
    const total = src.length;
    const amount = src.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    return { requested, confirmed, delivered, cancelled, total, amount };
  }, [tab, incoming, outgoing]);

  const isLoading = incoming === null || outgoing === null;

  async function approve(id: string) {
    setLoadingActionId(id);
    try {
      await OrderService.approveTransfer(id);
      toast.success('Approved transfer request');
    } catch (e: any) {
      toast.error('Approve failed', { description: e?.message || String(e) });
    } finally {
      setLoadingActionId(null);
    }
  }

  function openReject(id: string) {
    setRejectId(id);
    setReason('');
    setRejectOpen(true);
  }

  async function doReject() {
    if (!rejectId) return;
    setLoadingActionId(rejectId);
    try {
      await OrderService.rejectTransfer(rejectId, reason || 'Rejected');
      toast.success('Rejected request');
      setRejectOpen(false);
    } catch (e: any) {
      toast.error('Reject failed', { description: e?.message || String(e) });
    } finally {
      setLoadingActionId(null);
    }
  }

  async function receive(id: string) {
    setLoadingActionId(id);
    try {
      await OrderService.receiveTransfer(id);
      toast.success('Marked as received & stocked');
    } catch (e: any) {
      toast.error('Receive failed', { description: e?.message || String(e) });
    } finally {
      setLoadingActionId(null);
    }
  }

  async function cancelByBuyer(id: string) {
    setLoadingActionId(id);
    try {
      await OrderService.rejectTransfer(id, 'Cancelled by buyer');
      toast.success('Cancelled request');
    } catch (e: any) {
      toast.error('Cancel failed', { description: e?.message || String(e) });
    } finally {
      setLoadingActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Transfer Requests</h1>
          <p className="text-muted-foreground text-sm">
            {tab === 'incoming' ? 'Incoming requests to your branch (Seller)' : 'Outgoing requests from your branch (Buyer)'}
            {lastUpdated ? <span className="ml-2 text-xs">(updated {lastUpdated.toLocaleTimeString()})</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 w-64"
              placeholder="Search order no., branch, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="rounded-lg border p-1 bg-muted/40">
            <Button
              variant={tab === 'incoming' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTab('incoming')}
              className="rounded-md"
            >
              Incoming
            </Button>
            <Button
              variant={tab === 'outgoing' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTab('outgoing')}
              className="rounded-md"
            >
              Outgoing
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.total}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Requested</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.requested}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Confirmed</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.confirmed}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Delivered</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.delivered}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Amount</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatTHB(kpis.amount)}</CardContent></Card>
      </div>

      {/* List */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-base">
            {tab === 'incoming' ? 'Requests to me (Seller)' : 'Requests from me (Buyer)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : list.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No requests</div>
          ) : (
            <div className="divide-y">
              {/* header row */}
              <div className="grid gap-4 px-4 py-3 text-xs font-medium text-muted-foreground bg-muted/30 border-b">
                <div style={{ gridTemplateColumns: '140px 1fr 1fr 120px 120px 200px' }} className="grid gap-4">
                  <div>Order No.</div>
                  <div>From (Buyer)</div>
                  <div>To (Seller)</div>
                  <div>Items</div>
                  <div>Total</div>
                  <div>Status / Actions</div>
                </div>
              </div>

              {list.map((o) => {
                const itemsCount = o.items?.reduce((s, it) => s + Number(it.quantity || 0), 0) || 0;
                const canApprove = tab === 'incoming' && o.status === 'requested';
                const canReject = tab === 'incoming' && o.status === 'requested';
                const canReceive = tab === 'outgoing' && o.status === 'confirmed';
                const canCancel = tab === 'outgoing' && o.status === 'requested';

                return (
                  <div key={o.id} className="px-4 py-3">
                    <div style={{ gridTemplateColumns: '140px 1fr 1fr 120px 120px 200px' }} className="grid gap-4 items-center">
                      <div className="font-medium">{o.orderNumber ?? o.id?.slice(-8)}</div>
                      <div className="truncate">{o.buyerBranchName}</div>
                      <div className="truncate">{o.sellerBranchName}</div>
                      <div>{itemsCount}</div>
                      <div className="font-semibold">{formatTHB(o.totalAmount || 0)}</div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.status} />
                        {o.status === 'cancelled' && o.cancelReason ? (
                          <span className="text-xs text-muted-foreground truncate">• {o.cancelReason}</span>
                        ) : null}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {canApprove && (
                        <Button
                          size="sm"
                          onClick={() => approve(o.id!)}
                          disabled={loadingActionId === o.id}
                        >
                          {loadingActionId === o.id ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                          Approve
                        </Button>
                      )}
                      {canReject && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openReject(o.id!)}
                          disabled={loadingActionId === o.id}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      )}
                      {canReceive && (
                        <Button
                          size="sm"
                          onClick={() => receive(o.id!)}
                          disabled={loadingActionId === o.id}
                        >
                          {loadingActionId === o.id ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                          Mark as Received
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelByBuyer(o.id!)}
                          disabled={loadingActionId === o.id}
                          title="Cancel my request"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel Request
                        </Button>
                      )}
                    </div>

                    {/* Items preview */}
                    {o.items?.length ? (
                      <>
                        <Separator className="my-3" />
                        <div className="grid md:grid-cols-2 gap-2">
                          {o.items.slice(0, 6).map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded border p-2 text-sm">
                              <div className="truncate">
                                <div className="font-medium truncate">{it.productName}</div>
                                <div className="text-muted-foreground text-xs truncate">{it.specification} • {it.dotCode}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{it.quantity} × {formatTHB(it.unitPrice)}</div>
                                <div className="text-xs text-muted-foreground">{formatTHB(it.totalPrice)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>ใส่เหตุผล (ถ้าต้องการ)</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button onClick={doReject} disabled={!rejectId || loadingActionId === rejectId}>
              {loadingActionId === rejectId ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
