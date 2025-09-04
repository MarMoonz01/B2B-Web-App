'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  type Variants as FMVariants,
} from 'framer-motion';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StoreService } from '@/lib/services/InventoryService';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  History,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  Activity,
  Building2,
  ChevronDown,
  ChevronUp,
  Inbox,
} from 'lucide-react';

/* ========== date helpers (lightweight) ========== */
const fmtDateTime = (d: Date) =>
  d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

const timeAgo = (d: Date) => {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const dy = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (h < 24) return `${h} hr ago`;
  if (dy === 1) return 'yesterday';
  return `${dy} days ago`;
};
const isToday = (d: Date) => new Date().toDateString() === d.toDateString();
const isYesterday = (d: Date) => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return y.toDateString() === d.toDateString();
};

/* ========== types ========== */
type MovementType = 'adjust' | 'in' | 'out' | 'transfer_in' | 'transfer_out';
type EventTypeString =
  | 'stock.received'
  | 'stock.issued'
  | 'stock.adjustment'
  | 'stock.transfer.in'
  | 'stock.transfer.out'
  | 'order.requested'
  | 'order.approved'
  | 'order.rejected'
  | 'order.shipped'
  | 'order.received'
  | 'order.cancelled';

type MovementDoc = {
  id: string;
  branchId: string;
  type: MovementType;
  eventType?: EventTypeString;
  qtyChange?: number;
  brand?: string | null;
  model?: string | null;
  variantId?: string | null;
  dotCode?: string | null;
  orderId?: string | null;
  reason?: string | null;
  createdAt?: any;
};

type Category = 'all' | 'inventory' | 'transfer' | 'orders';
const categoryFromRow = (r: MovementDoc): Category => {
  const ev = r.eventType || '';
  if (ev.startsWith('stock.transfer.')) return 'transfer';
  if (ev.startsWith('stock.')) return 'inventory';
  if (ev.startsWith('order.')) return 'orders';
  if (r.type === 'transfer_in' || r.type === 'transfer_out') return 'transfer';
  return 'inventory';
};

const categoryMeta: Record<Category, { label: string; icon: any; color: string; bg: string }> = {
  all: { label: 'All', icon: Activity, color: 'text-foreground', bg: 'bg-muted/20' },
  inventory: { label: 'Inventory', icon: Package, color: 'text-success', bg: 'bg-success/10' },
  transfer: { label: 'Transfers', icon: ArrowLeftRight, color: 'text-warning', bg: 'bg-warning/10' },
  orders: { label: 'Orders', icon: ShoppingCart, color: 'text-primary', bg: 'bg-primary/10' },
};

const movementTypeMeta: Record<MovementType, { label: string; variant?: 'secondary' | 'outline' }> = {
  in: { label: 'Stock In', variant: 'secondary' },
  out: { label: 'Stock Out', variant: 'outline' },
  transfer_in: { label: 'Transfer In', variant: 'secondary' },
  transfer_out: { label: 'Transfer Out', variant: 'outline' },
  adjust: { label: 'Adjust', variant: 'outline' },
};

const PAGE_SIZE = 150;

type Props = {
  /** branchId มาจาก Global Branch Select ภายนอก; ไม่ส่งมา → ใช้ 'all' */
  branchId?: string;
};

export default function HistoryView({ branchId: propBranchId }: Props) {
  // ป้องกัน where(undefined)
  const resolvedBranchId = propBranchId && propBranchId.trim() !== '' ? propBranchId : 'all';

  const [branchMap, setBranchMap] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Category>('all');
  const [search, setSearch] = useState('');
  const [movementFilter, setMovementFilter] = useState<'all' | MovementType>('all');
  const [rows, setRows] = useState<MovementDoc[]>([]);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* โหลดชื่อสาขาไว้แสดง */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const m = await StoreService.getAllStores();
        if (mounted) setBranchMap(m);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* โหลด realtime ตามสาขาที่เลือกจากภายนอก */
  useEffect(() => {
    setRows([]);
    lastDocRef.current = null;

    const base = collection(db, 'stockMovements');
    const qRef =
      resolvedBranchId === 'all'
        ? query(base, orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
        : query(base, where('branchId', '==', resolvedBranchId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));

    const unsub = onSnapshot(qRef, (snap) => {
      const list: MovementDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setRows(list);
      lastDocRef.current = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
    });
    return () => {
      unsub();
    };
  }, [resolvedBranchId]);

  const loadMore = () => {
    if (!lastDocRef.current) return;

    const base = collection(db, 'stockMovements');
    const qRef =
      resolvedBranchId === 'all'
        ? query(base, orderBy('createdAt', 'desc'), startAfter(lastDocRef.current), limit(PAGE_SIZE))
        : query(
            base,
            where('branchId', '==', resolvedBranchId),
            orderBy('createdAt', 'desc'),
            startAfter(lastDocRef.current),
            limit(PAGE_SIZE),
          );

    onSnapshot(qRef, (snap) => {
      const more: MovementDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      if (more.length) {
        setRows((prev) => [...prev, ...more]);
        lastDocRef.current = snap.docs[snap.docs.length - 1] ?? lastDocRef.current;
      }
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  /* ฟิลเตอร์ */
  const filtered = useMemo(() => {
    let data = rows;
    if (tab !== 'all') data = data.filter((r) => categoryFromRow(r) === tab);
    if (movementFilter !== 'all') data = data.filter((r) => r.type === movementFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((r) =>
        [r.eventType || '', r.type, r.brand || '', r.model || '', r.dotCode || '', r.orderId || '', r.reason || '']
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    return data;
  }, [rows, tab, movementFilter, search]);

  /* สถิติบนการ์ด */
  const stats = useMemo(() => {
    const today = filtered.filter((r) => (r.createdAt?.toDate ? isToday(r.createdAt.toDate()) : false)).length;
    const yesterday = filtered.filter((r) => (r.createdAt?.toDate ? isYesterday(r.createdAt.toDate()) : false)).length;
    const transfers = filtered.filter((r) => categoryFromRow(r) === 'transfer').length;
    const orders = filtered.filter((r) => categoryFromRow(r) === 'orders').length;
    return { today, yesterday, transfers, orders };
  }, [filtered]);

  const countsByCategory = useMemo(() => {
    const c = { all: rows.length, inventory: 0, transfer: 0, orders: 0 } as Record<Category, number>;
    rows.forEach((r) => {
      const k = categoryFromRow(r);
      c[k] += 1;
    });
    return c;
  }, [rows]);

  /* motion variants */
  const containerVariants: FMVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.02 } } };
  const itemVariants: FMVariants = {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
  };

  const renderCategoryBadge = (r: MovementDoc) => {
    const c = categoryFromRow(r);
    const M = categoryMeta[c];
    const Icon = M.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${M.bg}`}>
        <Icon className={`h-3 w-3 ${M.color}`} />
        {M.label}
      </span>
    );
  };

  const renderMovementBadge = (r: MovementDoc) => {
    const meta = movementTypeMeta[r.type];
    return <Badge variant={meta.variant ?? 'outline'}>{meta.label}</Badge>;
  };

  return (
    <div className="section-padding space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity History</h1>
          <p className="text-muted-foreground mt-1">Inventory / Transfers / Orders — scoped by your branch selector</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="gap-2">
            <motion.div
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 1, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
            >
              <RefreshCw className="h-4 w-4" />
            </motion.div>
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { title: "Today's", value: stats.today, icon: Activity, color: 'text-primary', bg: 'bg-primary/10' },
          { title: 'Yesterday', value: stats.yesterday, icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/10' },
          { title: 'Transfers', value: stats.transfers, icon: ArrowLeftRight, color: 'text-warning', bg: 'bg-warning/10' },
          { title: 'Orders', value: stats.orders, icon: ShoppingCart, color: 'text-primary', bg: 'bg-primary/10' },
        ].map((s) => (
          <motion.div key={s.title} variants={itemVariants}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${s.bg}`}>
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.title}</p>
                    <p className="text-xl font-semibold">{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search event / brand / model / DOT / order / reason"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={movementFilter}
          onChange={(e) => setMovementFilter(e.target.value as any)}
          aria-label="Filter by movement type"
        >
          <option value="all">All movements</option>
          <option value="in">Stock In</option>
          <option value="out">Stock Out</option>
          <option value="transfer_in">Transfer In</option>
          <option value="transfer_out">Transfer Out</option>
          <option value="adjust">Adjust</option>
        </select>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            setSearch('');
            setMovementFilter('all');
          }}
        >
          <Filter className="h-4 w-4" />
          Clear
        </Button>
      </motion.div>

      {/* Tabs + list */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Category)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 md:w-[560px]">
            {(['all', 'inventory', 'transfer', 'orders'] as Category[]).map((k) => (
              <TabsTrigger key={k} value={k}>
                {categoryMeta[k].label}
                <span className="ml-2 text-muted-foreground">({countsByCategory[k] ?? 0})</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Activity Log
                  <Badge variant="outline" className="ml-2">{filtered.length} entries</Badge>
                </CardTitle>
                <CardDescription>
                  Real-time from <code>stockMovements</code>
                  {resolvedBranchId !== 'all' ? ` • ${branchMap[resolvedBranchId] ?? resolvedBranchId}` : ''}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0">
                <ScrollArea className="h-[520px]">
                  {filtered.length === 0 ? (
                    <div className="h-[520px] flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
                      <Inbox className="h-8 w-8" />
                      <div className="text-sm">No activity found with current filters</div>
                    </div>
                  ) : (
                    <motion.div variants={containerVariants} initial="hidden" animate="show" className="divide-y">
                      {filtered.map((r) => {
                        const created = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(0);
                        const isExpanded = expandedId === r.id;
                        const c = categoryFromRow(r);
                        const CatIcon = categoryMeta[c].icon;

                        return (
                          <motion.div key={r.id} variants={itemVariants} className={`p-4 ${isExpanded ? 'bg-accent/20' : ''}`}>
                            <div className="flex items-start gap-4">
                              <div className={`p-2 rounded-md ${categoryMeta[c].bg}`}>
                                <CatIcon className={`h-4 w-4 ${categoryMeta[c].color}`} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="font-medium text-sm">{r.eventType ?? '(no eventType)'}</span>
                                  {renderMovementBadge(r)}
                                  {renderCategoryBadge(r)}
                                </div>

                                <div className="text-sm text-muted-foreground mt-1">
                                  {r.brand && <span>Brand <b className="text-foreground">{r.brand}</b></span>}
                                  {r.model && <span> · Model <b className="text-foreground">{r.model}</b></span>}
                                  {r.variantId && <span> · Var <b className="text-foreground">{r.variantId}</b></span>}
                                  {r.dotCode && <span> · DOT <b className="text-foreground">{r.dotCode}</b></span>}
                                  {typeof r.qtyChange === 'number' && <span> · ΔQty <b className="text-foreground">{r.qtyChange}</b></span>}
                                  {r.reason && <span> · {r.reason}</span>}
                                </div>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                  <div className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {branchMap[r.branchId] ?? r.branchId}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {timeAgo(created)}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{fmtDateTime(created)}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                                  className="h-6 w-6 p-0"
                                  aria-label="Toggle details"
                                >
                                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </Button>
                              </div>
                            </div>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="mt-3 pt-3 border-t"
                                >
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Field</TableHead>
                                        <TableHead>Value</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      <TableRow><TableCell>Doc ID</TableCell><TableCell className="font-mono">{r.id}</TableCell></TableRow>
                                      <TableRow><TableCell>Branch</TableCell><TableCell>{branchMap[r.branchId] ?? r.branchId}</TableCell></TableRow>
                                      <TableRow><TableCell>Event Type</TableCell><TableCell>{r.eventType ?? '-'}</TableCell></TableRow>
                                      <TableRow><TableCell>Movement</TableCell><TableCell>{r.type}</TableCell></TableRow>
                                      <TableRow><TableCell>Qty Change</TableCell><TableCell>{typeof r.qtyChange === 'number' ? r.qtyChange : '-'}</TableCell></TableRow>
                                      <TableRow><TableCell>Brand</TableCell><TableCell>{r.brand ?? '-'}</TableCell></TableRow>
                                      <TableRow><TableCell>Model</TableCell><TableCell>{r.model ?? '-'}</TableCell></TableRow>
                                      <TableRow><TableCell>Variant</TableCell><TableCell>{r.variantId ?? '-'}</TableCell></TableRow>
                                      <TableRow><TableCell>DOT</TableCell><TableCell>{r.dotCode ?? '-'}</TableCell></TableRow>
                                      <TableRow><TableCell>Order ID</TableCell><TableCell>{r.orderId ?? '-'}</TableCell></TableRow>
                                      <TableRow><TableCell>Reason</TableCell><TableCell>{r.reason ?? '-'}</TableCell></TableRow>
                                      <TableRow><TableCell>Created At</TableCell><TableCell>{fmtDateTime(created)}</TableCell></TableRow>
                                    </TableBody>
                                  </Table>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </ScrollArea>

                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {filtered.length} {tab === 'all' ? 'events' : `${categoryMeta[tab].label.toLowerCase()} events`}
                  </p>
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={!lastDocRef.current}>
                    Load more
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
