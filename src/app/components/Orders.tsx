'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'; // Corrected import
import { Separator } from '@/components/ui/separator';
import { Download, Store, CheckCircle2, Clock, XCircle, FileText, Search } from 'lucide-react';
import { Order, OrderService } from '@/lib/services/InventoryService';

// ... (The rest of the Orders.tsx component code remains the same as the previous response) ...
// The component logic itself was correct, only the import was missing a part.

// Paste the rest of the Orders.tsx code from the previous response here.
// For brevity, I'm omitting the full code block as only the import changed.

const thb = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });

interface OrdersProps {
  myBranchId: string;
}

const statusBadge = (s: Order['status']) => {
    const base = 'border text-xs';
    switch (s) {
      case 'pending':    return <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'requested': return <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50"><Clock className="h-3 w-3 mr-1" /> Requested</Badge>;
      case 'confirmed':  return <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">Confirmed</Badge>;
      case 'processing': return <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">Processing</Badge>;
      case 'shipped':    return <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">Shipped</Badge>;
      case 'delivered':  return <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50"><CheckCircle2 className="h-3 w-3 mr-1" /> Delivered</Badge>;
      case 'paid':       return <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50"><CheckCircle2 className="h-3 w-3 mr-1" /> Paid</Badge>;
      case 'cancelled':  return <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50"><XCircle className="h-3 w-3 mr-1" /> Cancelled</Badge>;
    }
  };

const OrderCard = ({
    order, side, onExport, onApprove
  }: {
    order: Order;
    side: 'incoming' | 'mine';
    onExport?: () => void;
    onApprove?: (orderId: string) => void;
  }) => {
    const destination = side === 'mine' ? `To: ${order.sellerBranchName}` : `From: ${order.buyerBranchName}`;
    const rightTotal = (
      <div className="text-right">
        <div className="font-semibold">{thb.format(order.totalAmount)}</div>
        <div className="text-xs text-muted-foreground">{new Date(order.createdAt?.toDate()).toLocaleDateString()}</div>
      </div>
    );
  
    return (
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">{order.orderNumber}</span>
              {statusBadge(order.status)}
            </div>
            {rightTotal}
          </div>
          <Separator />
          <div className="px-4 py-2 text-sm text-muted-foreground">{destination}</div>
          <div className="px-4 py-3">
            {order.items.slice(0, 1).map((it, idx) => (
              <div key={idx}>
                <div className="font-medium">{it.productName}</div>
                <div className="text-xs text-muted-foreground">{it.specification} / DOT {it.dotCode}</div>
              </div>
            ))}
            {order.notes && (
              <div className="mt-3 text-sm">
                <div className="font-medium mb-1">Order Notes</div>
                <div className="text-muted-foreground">{order.notes}</div>
              </div>
            )}
          </div>
          <Separator />
          <div className="px-4 py-3 flex items-center gap-2">
            <Button variant="outline" size="sm">View Details</Button>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <div className="ml-auto">
              {side === 'incoming' && order.status === 'requested' && onApprove && (
                <Button size="sm" onClick={() => onApprove(order.id!)}>Approve</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

export default function Orders({ myBranchId }: OrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [incoming, setIncoming] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'pending'|'requested'|'confirmed'|'processing'|'shipped'|'delivered'|'cancelled'|'paid'>('all');
  const [timeFilter, setTimeFilter] = useState<'all'|'7d'|'30d'|'90d'>('all');

  const load = async () => {
    setLoading(true);
    const mine = await OrderService.getOrdersByBranch(myBranchId, 'buyer');
    const inc = await OrderService.getOrdersByBranch(myBranchId, 'seller');
    setOrders(mine);
    setIncoming(inc);
    setLoading(false);
  };

  useEffect(() => { load(); }, [myBranchId]);

  const kpi = useMemo(() => {
    const pending = orders.filter(o => o.status === 'pending' || o.status === 'requested').length;
    const productCount = new Set(orders.flatMap(o => o.items.map(i => i.productName))).size;
    return {
      dealerNetwork: new Set(orders.flatMap(o => [o.sellerBranchId, o.buyerBranchId])).size,
      yourProducts: productCount,
      pendingOrders: pending,
      monthlySpent: 0,
    };
  }, [orders]);

  const filterOrders = (list: Order[]) => {
    let res = [...list];
    if (search) {
      const q = search.toLowerCase();
      res = res.filter(o =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.sellerBranchName?.toLowerCase().includes(q) ||
        o.buyerBranchName.toLowerCase().includes(q) ||
        o.items.some(i =>
          i.productName.toLowerCase().includes(q) ||
          `${i.specification} / DOT ${i.dotCode}`.toLowerCase().includes(q)
        )
      );
    }
    if (statusFilter !== 'all') res = res.filter(o => o.status === statusFilter);
    if (timeFilter !== 'all') {
      const days = timeFilter === '7d' ? 7 : timeFilter === '30d' ? 30 : 90;
      const from = new Date(Date.now() - days * 86400_000);
      res = res.filter(o => new Date(o.createdAt?.toDate?.() ?? 0) >= from);
    }
    res.sort((a, b) => (new Date(b.createdAt?.toDate()).getTime() - new Date(a.createdAt?.toDate()).getTime()));
    return res;
  };
  

  const incomingFiltered = filterOrders(incoming);
  const myOrdersFiltered = filterOrders(orders);

  const exportOrder = (o: Order) => {
    const blob = new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${o.orderNumber}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleApprove = async (orderId: string) => {
    await OrderService.approveTransfer(orderId);
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-muted-foreground">Manage your sales, purchases, and transfers.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Dealer Network</div><div className="mt-1 text-2xl font-bold">{kpi.dealerNetwork}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Your Products</div><div className="mt-1 text-2xl font-bold">{kpi.yourProducts}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Pending Orders</div><div className="mt-1 text-2xl font-bold">{kpi.pendingOrders}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Monthly Spent</div><div className="mt-1 text-2xl font-bold">{thb.format(0)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="requested">Requested</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
              <SelectTrigger><SelectValue placeholder="All Time" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="incoming">
            <TabsList>
              <TabsTrigger value="incoming">Incoming ({incomingFiltered.length})</TabsTrigger>
              <TabsTrigger value="myorders">My Orders ({myOrdersFiltered.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="incoming" className="mt-3">
              <div className="mt-4 space-y-4">
                {incomingFiltered.map((o) => (
                  <OrderCard key={o.id} order={o} side="incoming" onExport={() => exportOrder(o)} onApprove={handleApprove} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="myorders" className="mt-3">
              <div className="mt-4 space-y-4">
                {myOrdersFiltered.map((o) => (
                  <OrderCard key={o.id} order={o} side="mine" onExport={() => exportOrder(o)} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}