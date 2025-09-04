'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// UI
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'components/ui/card';
import { Button } from 'components/ui/button';
import { Badge } from 'components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'components/ui/tabs';
import {
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  Target,
  AlertTriangle,
  Clock,
  Calendar,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  BarChart3,
} from 'lucide-react';

// contexts
import { useBranch } from 'contexts/BranchContext';

// types
import type { GroupedProduct } from 'types/inventory';

/* ===================== API types (ให้ตรงกับ /api/analytics/summary เวอร์ชันล่าสุด) ===================== */
type SummaryData = {
  totalInventoryValue: number;
  pendingTransfers: number;
  branchCount: number;
  totalUsers: number;
};

type ChartDatum = { name: string; value: number };
type TransfersDatum = { name: string; inbound?: number; outbound?: number };

type SummaryResponse = {
  ok: boolean;
  summaryData: SummaryData;
  inventoryByBranchData: ChartDatum[];
  transfersOverTimeData: TransfersDatum[];
  productCategoriesData: ChartDatum[]; // grouped by brand/category
  error?: string;
};

/* ===================== Utils ===================== */
const THB = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('th-TH');
const PIE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#84cc16', '#64748b'];

function asArray<T = any>(x: any): T[] {
  return Array.isArray(x) ? x : [];
}

function toFromTo(range: '1month' | '3months' | '6months' | '1year') {
  const today = new Date();
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysMap: Record<string, number> = { '1month': 30, '3months': 90, '6months': 180, '1year': 365 };
  const d = daysMap[range] ?? 180;
  const from = new Date(to);
  from.setDate(to.getDate() - d);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

// map UI range -> API range param
function toApiRange(range: '1month' | '3months' | '6months' | '1year'): '7d' | '30d' | '90d' | 'ytd' {
  if (range === '1month') return '30d';
  if (range === '3months') return '90d';
  if (range === '6months') return '90d'; // backend ยังไม่รองรับ 180d: ใช้ใกล้สุด
  return 'ytd'; // '1year' -> YTD
}

// ------- helpers from inventory props (fallback) -------
function calcInventoryValue(inventory: GroupedProduct[]) {
  return asArray(inventory).reduce((sum, p) => {
    return (
      sum +
      asArray(p?.branches).reduce((bs, b: any) => {
        return (
          bs +
          asArray(b?.sizes).reduce((ss, s: any) => {
            return (
              ss +
              asArray(s?.dots).reduce((ds, d: any) => {
                const price = Number(d?.promoPrice ?? d?.basePrice ?? 0);
                return ds + Number(d?.qty || 0) * price;
              }, 0)
            );
          }, 0)
        );
      }, 0)
    );
  }, 0);
}

function monthsBetween(a: Date, b: Date) {
  return (a.getUTCFullYear() - b.getUTCFullYear()) * 12 + (a.getUTCMonth() - b.getUTCMonth());
}
function estimateDateFromWWYY(code: string) {
  const m = /^(\d{2})(\d{2})$/.exec(code);
  if (!m) return null;
  const week = Number(m[1]);
  const year = 2000 + Number(m[2]);
  const base = new Date(Date.UTC(year, 0, 1));
  base.setUTCDate(1 + (week - 1) * 7 + 3);
  return base;
}
function getDotCode(d: any): string {
  if (typeof d?.dotCode === 'string') return d.dotCode;
  if (typeof d?.dot === 'string') return d.dot;
  if (typeof d?.code === 'string') return d.code;
  return '';
}

function buildDotAgingFromInventory(inventory: GroupedProduct[]) {
  const now = new Date();
  const buckets = { '0-6 months': 0, '6-12 months': 0, '12-18 months': 0, '18+ months': 0 };
  asArray(inventory).forEach((p) => {
    asArray((p as any)?.branches).forEach((b: any) => {
      asArray(b?.sizes).forEach((s: any) => {
        asArray(s?.dots).forEach((d: any) => {
          const qty = Number(d?.qty || 0);
          const dt = estimateDateFromWWYY(getDotCode(d));
          if (!dt) return;
          const m = monthsBetween(now, dt);
          if (m <= 6) buckets['0-6 months'] += qty;
          else if (m <= 12) buckets['6-12 months'] += qty;
          else if (m <= 18) buckets['12-18 months'] += qty;
          else buckets['18+ months'] += qty;
        });
      });
    });
  });
  return Object.entries(buckets).map(([ageRange, units]) => ({ ageRange, units, percentage: 0, value: 0 }));
}

function buildBranchValueFromInventory(inventory: GroupedProduct[]) {
  const map = new Map<string, number>();
  asArray(inventory).forEach((p) => {
    asArray((p as any)?.branches).forEach((b: any) => {
      const branchName = b?.branchName || 'Unknown';
      let acc = 0;
      asArray(b?.sizes).forEach((s: any) => {
        asArray(s?.dots).forEach((d: any) => {
          const price = Number(d?.promoPrice ?? d?.basePrice ?? 0);
          acc += Number(d?.qty || 0) * price;
        });
      });
      map.set(branchName, (map.get(branchName) || 0) + acc);
    });
  });
  return Array.from(map.entries()).map(([branch, value]) => ({
    branch,
    revenue: value,
    orders: 0,
    inventory: 0,
    utilization: 0,
  }));
}

// กรอง inventory ให้เหลือเฉพาะสาขาที่เลือก
function filterInventoryByBranch(inventory: GroupedProduct[], branchId?: string | null) {
  if (!branchId) return inventory;
  return asArray(inventory).map((p) => {
    const branches = asArray((p as any)?.branches).filter(
      (b: any) => b?.branchId === branchId || b?.id === branchId
    );
    return { ...p, branches };
  });
}

// ---------- build fallback SummaryResponse เมื่อ API ล่ม ----------
function buildFallbackSummaryFromInventory(
  inventory: GroupedProduct[],
  from: string,
  to: string
): SummaryResponse {
  const today = new Date(to);
  const transfersOverTimeData: TransfersDatum[] = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(today);
    d.setMonth(today.getMonth() - (5 - i));
    return { name: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, inbound: 0, outbound: 0 };
  });

  // สร้าง category value จากมูลค่ารวม (proxy)
  const catMap = new Map<string, number>();
  asArray(inventory).forEach((p) => {
    const cat = (p as any)?.name?.split(' ')?.[0] || 'Unknown';
    let totalValue = 0;
    asArray((p as any)?.branches).forEach((b: any) => {
      asArray(b?.sizes).forEach((s: any) => {
        asArray(s?.dots).forEach((d: any) => {
          const price = Number(d?.promoPrice ?? d?.basePrice ?? 0);
          totalValue += Number(d?.qty || 0) * price;
        });
      });
    });
    catMap.set(cat, (catMap.get(cat) || 0) + totalValue);
  });

  const productCategoriesData: ChartDatum[] = Array.from(catMap.entries()).map(([name, value]) => ({
    name,
    value: Math.round(value),
  }));

  return {
    ok: true,
    summaryData: {
      totalInventoryValue: Math.round(calcInventoryValue(inventory)),
      pendingTransfers: 0,
      branchCount: 1,
      totalUsers: 0,
    },
    transfersOverTimeData,
    productCategoriesData,
    inventoryByBranchData: buildBranchValueFromInventory(inventory).map((b) => ({ name: b.branch, value: b.revenue })),
  };
}

/* ===================== Props ===================== */
// ทำให้ props เป็น optional เพื่อให้ <AnalyticsView /> เรียกได้เลย
interface AnalyticsProps {
  inventory?: GroupedProduct[];
  loading?: boolean;
}

/* --- helper: branch label --- */
function makeBranchLabel(selectedBranch: any, fallbackId: string | null) {
  return (
    selectedBranch?.name ??
    selectedBranch?.branchName ??
    selectedBranch?.displayName ??
    selectedBranch?.title ??
    selectedBranch?.code ??
    fallbackId ??
    'Current branch'
  ) as string;
}

export default function Analytics(props: AnalyticsProps = {}) {
  // default props
  const { inventory = [], loading = false } = props;

  const { selectedBranch, selectedBranchId, loading: branchLoading } = useBranch();

  const activeBranchId = selectedBranchId ?? null;
  const branchLabel = useMemo(() => makeBranchLabel(selectedBranch, activeBranchId), [selectedBranch, activeBranchId]);

  // inventory ที่ “กรองตามสาขา”
  const scopedInventory = useMemo(() => filterInventoryByBranch(inventory, activeBranchId), [inventory, activeBranchId]);

  const [timeRange, setTimeRange] = useState<'1month' | '3months' | '6months' | '1year'>('6months');
  const { from, to } = useMemo(() => toFromTo(timeRange), [timeRange]);

  const [apiData, setApiData] = useState<SummaryResponse | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // ===== ยิง API ตาม branch + range และกันยิงซ้ำด้วย key =====
  const apiRange = useMemo(() => toApiRange(timeRange), [timeRange]);
  const apiKey = useMemo(
    () => `/api/analytics/summary?branchId=${encodeURIComponent(activeBranchId ?? '')}&range=${apiRange}`,
    [activeBranchId, apiRange]
  );
  const lastFetchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeBranchId) {
      setApiError('ยังไม่ได้เลือกสาขา');
      const fb = buildFallbackSummaryFromInventory(scopedInventory, from, to);
      setApiData(fb);
      return;
    }

    if (lastFetchedKeyRef.current === apiKey) return;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        setApiLoading(true);
        setApiError(null);

        const r = await fetch(apiKey, { cache: 'no-store', signal: controller.signal });
        const d = await r.json().catch(() => null);

        if (!r.ok || !d?.ok) throw new Error(d?.error || `HTTP ${r.status}`);

        if (!cancelled) {
          setApiData(d as SummaryResponse);
          lastFetchedKeyRef.current = apiKey;
        }
      } catch (e: any) {
        if (!cancelled) {
          setApiError(e?.message || 'internal_server_error');
          setApiData(buildFallbackSummaryFromInventory(scopedInventory, from, to));
          lastFetchedKeyRef.current = apiKey;
        }
      } finally {
        if (!cancelled) setApiLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [apiKey, activeBranchId, scopedInventory, from, to]);

  /* ========== Map API -> UI model ========== */
  const summary = apiData?.summaryData;

  // Orders/Revenue proxy จาก inbound+outbound
  const revenueData = useMemo(() => {
    const src = apiData?.transfersOverTimeData ?? [];
    return src.map((x) => {
      const orders = Number(x.inbound || 0) + Number(x.outbound || 0);
      return { month: x.name, revenue: orders, orders, avgOrderValue: 0 };
    });
  }, [apiData]);

  // Category: ใช้ value เป็นมูลค่า
  const categoryAnalysis = useMemo(() => {
    const src = apiData?.productCategoriesData ?? [];
    return src.map((c, i) => ({
      name: c.name,
      revenue: c.value,
      units: c.value, // ไม่มี units จริงจาก API—ใช้ value เป็น proxy
      margin: undefined as number | undefined,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [apiData]);

  // Branches tab: แสดงเฉพาะสาขาที่เลือก
  const branchPerformance = useMemo(() => {
    if (apiData?.inventoryByBranchData?.length) {
      const filtered = apiData.inventoryByBranchData.filter((b) => b.name === branchLabel);
      const src = (filtered.length ? filtered : apiData.inventoryByBranchData).slice(0, 1);
      return src.map((b) => ({
        branch: b.name,
        revenue: b.value,
        orders: 0,
        inventory: 0,
        utilization: 0,
      }));
    }
    // client fallback: จาก scopedInventory (มีสาขาเดียว)
    return buildBranchValueFromInventory(scopedInventory);
  }, [apiData, scopedInventory, branchLabel]);

  // ไม่มีข้อมูล movement ราย product จาก API—ปล่อยว่าง
  const inventoryTurnover: { product: string; turnover: number; daysStock: number; performance: string }[] = [];
  const topSellingProducts: { name: string; units: number; revenue: number; growth: number }[] = [];

  // DOT aging ด้วย scopedInventory
  const dotCodeAging = useMemo(() => buildDotAgingFromInventory(scopedInventory), [scopedInventory]);

  // KPI
  const totalInventoryValue = useMemo(
    () => Math.round(summary?.totalInventoryValue ?? calcInventoryValue(scopedInventory)),
    [summary, scopedInventory]
  );
  const totalOrders = useMemo(() => revenueData.reduce((s, r) => s + (r.orders || 0), 0), [revenueData]);
  const totalRevenue = useMemo(() => revenueData.reduce((s, r) => s + (r.revenue || 0), 0), [revenueData]);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // “Out of Stock / skuCount” จาก client (สcope ตาม branch)
  const skuAndOOS = useMemo(() => {
    let sku = 0,
      oos = 0;
    asArray(scopedInventory).forEach((p) => {
      asArray((p as any)?.branches).forEach((b: any) => {
        asArray(b?.sizes).forEach((s: any) => {
          asArray(s?.dots).forEach((d: any) => {
            sku += 1;
            if (Number(d?.qty || 0) <= 0) oos += 1;
          });
        });
      });
    });
    return { sku, oos };
  }, [scopedInventory]);

  // รวม inbound/outbound ช่วงที่เลือก
  const inboundSum = useMemo(
    () => (apiData?.transfersOverTimeData ?? []).reduce((acc, x) => acc + (x.inbound || 0), 0),
    [apiData]
  );
  const outboundSum = useMemo(
    () => (apiData?.transfersOverTimeData ?? []).reduce((acc, x) => acc + (x.outbound || 0), 0),
    [apiData]
  );

  // ---------- Loading ----------
  if (loading || branchLoading || apiLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // ---------- UI ----------
  const { from: fFrom, to: fTo } = { from, to };

  return (
    <div className="space-y-6">
      {/* API error banner */}
      {apiError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          โหลดข้อมูลจาก API ไม่สำเร็จ: <span className="font-medium">{apiError}</span> — กำลังแสดงข้อมูลจากสต็อกจริงของสาขาที่เลือกแทน
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1>Analytics &amp; Reports</h1>
          <p className="text-muted-foreground">Deep insights into your tire business performance</p>
          <p className="text-xs text-muted-foreground">
            ช่วงเวลา: {fFrom} – {fTo}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {branchLabel && (
            <Badge variant="secondary">
              <MapPin className="mr-1 h-3 w-3" />
              {branchLabel}
            </Badge>
          )}

          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Last 6 Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last ~3–6 Months</SelectItem>
              <SelectItem value="1year">Year to Date</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => {
              const rows: string[] = [];
              rows.push(`Branch,${branchLabel}`);
              rows.push(`Period,${fFrom} to ${fTo}`);
              if (summary) {
                rows.push(`totalInventoryValue,${summary.totalInventoryValue}`);
                rows.push(`pendingTransfers,${summary.pendingTransfers}`);
                rows.push(`branchCount,${summary.branchCount}`);
                rows.push(`totalUsers,${summary.totalUsers}`);
              }
              rows.push(`skuCount,${skuAndOOS.sku}`);
              rows.push(`outOfStockCount,${skuAndOOS.oos}`);
              rows.push(`inboundTotal,${inboundSum}`);
              rows.push(`outboundTotal,${outboundSum}`);

              rows.push('');
              rows.push('TransfersOverTime,day,inbound,outbound');
              (apiData?.transfersOverTimeData ?? []).forEach((d) =>
                rows.push(`,${d.name},${d.inbound || 0},${d.outbound || 0}`)
              );

              rows.push('');
              rows.push('Category,name,value');
              (apiData?.productCategoriesData ?? []).forEach((d) => rows.push(`,${d.name},${d.value}`));

              rows.push('');
              rows.push('InventoryByBranch,name,value');
              (apiData?.inventoryByBranchData ?? []).forEach((d) => rows.push(`,${d.name},${d.value}`));

              const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `analytics_${activeBranchId ?? 'branch'}_${fFrom}_${fTo}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-medium">{NUM.format(totalRevenue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-chart-1" />
            </div>
            <div className="flex items-center mt-2 text-sm">
              <ArrowUpRight className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-muted-foreground">from transfers (count)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Order Value</p>
                <p className="text-2xl font-medium">{NUM.format(Math.round(avgOrderValue))}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-chart-2" />
            </div>
            <div className="flex items-center mt-2 text-sm">
              <ArrowUpRight className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-muted-foreground">estimated</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inventory Value</p>
                <p className="text-2xl font-medium">{THB.format(Math.round(totalInventoryValue))}</p>
              </div>
              <Package className="h-8 w-8 text-chart-3" />
            </div>
            <div className="flex items-center mt-2 text-sm">
              <ArrowDownRight className="h-4 w-4 text-muted-foreground mr-1" />
              <span className="text-muted-foreground">from current inventory</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-medium">{NUM.format(totalOrders)}</p>
              </div>
              <Target className="h-8 w-8 text-chart-4" />
            </div>
            <div className="flex items-center mt-2 text-sm">
              <ArrowUpRight className="h-4 w-4 text-muted-foreground mr-1" />
              <span className="text-muted-foreground">count of movements</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="revenue" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        {/* Revenue */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>Using inbound+outbound counts as proxy</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RTooltip />
                    <Area type="monotone" dataKey="revenue" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Volume &amp; AOV</CardTitle>
                <CardDescription>Orders count vs average order value</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <RTooltip />
                    <Bar yAxisId="left" dataKey="orders" />
                    <Line yAxisId="right" type="monotone" dataKey="avgOrderValue" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Category Performance</CardTitle>
              <CardDescription>Value by category/brand</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryAnalysis}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="revenue"
                    >
                      {categoryAnalysis.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-4">
                  {categoryAnalysis.map((category, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                        <div>
                          <p className="font-medium">{category.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {THB.format(Math.round(category.revenue || 0))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory */}
        <TabsContent value="inventory" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Inventory Turnover</CardTitle>
                <CardDescription>Top movers (pending backend)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* ไม่มี movement breakdown จาก API ตอนนี้ */}
                  <div className="text-sm text-muted-foreground">No movement breakdown from API yet.</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>DOT Code Aging Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <RBarChart data={dotCodeAging} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="ageRange" type="category" width={100} />
                    <RTooltip />
                    <Bar dataKey="units" />
                  </RBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Critical Stock Alerts</CardTitle>
              <CardDescription>รวมช่วงที่เลือก</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4 bg-red-50 dark:bg-red-900/10">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-600">Out of Stock</span>
                  </div>
                  <p className="text-2xl font-semibold">{NUM.format(skuAndOOS.oos)}</p>
                  <p className="text-xs text-muted-foreground">สินค้าในระบบที่จำนวนรวม ≤ 0</p>
                </div>

                <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/10">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-600">Pending Transfers</span>
                  </div>
                  <p className="text-2xl font-semibold">{NUM.format(summary?.pendingTransfers ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">คำขอย้ายสต็อกที่ยังรอดำเนินการ</p>
                </div>

                <div className="border rounded-lg p-4 bg-orange-50 dark:bg-orange-900/10">
                  <div className="flex items-center space-x-2 mb-2">
                    <Calendar className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-600">Inbound / Outbound</span>
                  </div>
                  <p className="text-2xl font-semibold">
                    {NUM.format(inboundSum)} / {NUM.format(outboundSum)}
                  </p>
                  <p className="text-xs text-muted-foreground">รวมเคลื่อนไหว (ช่วงที่เลือก)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branches */}
        <TabsContent value="branches" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Branch Revenue Comparison</CardTitle>
                <CardDescription>มูลค่าสต็อกต่อสาขา (ตามสาขาที่เลือก)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RBarChart data={branchPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="branch" />
                    <YAxis />
                    <RTooltip />
                    <Bar dataKey="revenue" />
                  </RBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Utilization</CardTitle>
                <CardDescription>relative proxy per branch</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={branchPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="inventory" name="Inventory" />
                    <YAxis dataKey="utilization" name="Utilization %" />
                    <RTooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter dataKey="utilization" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Branch Performance Metrics</CardTitle>
              <CardDescription>รายละเอียดต่อสาขา</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {branchPerformance.map((branch, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <h3 className="font-medium">{branch.branch}</h3>
                      </div>
                      <Badge variant={branch.utilization > 80 ? 'default' : 'secondary'}>
                        {branch.utilization}% efficiency
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Inventory Value</p>
                        <p className="font-medium">{THB.format(Math.round(branch.revenue))}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Orders</p>
                        <p className="font-medium">{branch.orders}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Inventory</p>
                        <p className="font-medium">{branch.inventory} units</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products */}
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
              <CardDescription>จากการเคลื่อนไหว (pending backend)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* ไม่มีข้อมูล movement ราย product ตอนนี้ */}
                <div className="text-sm text-muted-foreground">No product-level movement from API yet.</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing */}
        <TabsContent value="pricing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Price Competitiveness Analysis</CardTitle>
              <CardDescription>ต้องมี market data/API เพิ่มเติม</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                หน้า UI พร้อมแล้ว — แสดงผลได้ทันทีเมื่อมีแหล่งข้อมูลราคาตลาด (brand, avgPrice, marketPrice, margin)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
