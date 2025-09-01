"use client";

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Legend,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  PackageSearch,
  Boxes,
  ArrowDownUp,
  Building2,
  AlertTriangle,
  TrendingUp,
  Truck,
  Factory,
  Clock,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// ----------------------------------
// Types (match existing /api/analytics/summary)
// ----------------------------------
interface SummaryData {
  totalInventoryValue: number;
  pendingTransfers: number;
  branchCount: number;
  totalUsers: number;
}

interface ChartData { name: string; value: number; [k: string]: any }

interface SummaryResponse {
  ok: boolean;
  summaryData: SummaryData;
  inventoryByBranchData: ChartData[];
  transfersOverTimeData: { name: string; inbound?: number; outbound?: number }[];
  productCategoriesData: ChartData[];
}

// ----------------------------------
// Formatting helpers
// ----------------------------------
const FORMAT_THB = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });
const FORMAT_NUM = new Intl.NumberFormat('th-TH');
const PIE_COLORS = ['#4f46e5', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#84cc16'];

// ----------------------------------
// Component
// ----------------------------------
export default function analyticview() {
  const [range, setRange] = React.useState<'7d'|'30d'|'90d'|'ytd'>('30d');
  const [search, setSearch] = React.useState('');

  const { data, isLoading, isError, refetch } = useQuery<SummaryResponse>({
    queryKey: ['analytics-summary', range],
    queryFn: async () => {
      const params = new URLSearchParams({ range });
      const r = await fetch(`/api/analytics/summary?${params.toString()}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      return d as SummaryResponse;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const summary = data?.summaryData;
  const invByBranch = data?.inventoryByBranchData ?? [];
  const transfersSeries = data?.transfersOverTimeData ?? [];
  const pieCats = data?.productCategoriesData ?? [];

  return (
    <div className="min-h-[100dvh] w-full p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <PackageSearch className="h-7 w-7" />
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Inventory Analytics</h1>
            <p className="text-sm text-muted-foreground">ภาพรวมสต็อก • ช่วงเวลา {range.toUpperCase()}</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center md:justify-end">
          <div className="flex w-full max-w-md items-center gap-2">
            <Input placeholder="ค้นหา SKU / ชื่อสินค้า" value={search} onChange={(e)=>setSearch(e.target.value)} />
            <Select value={range} onValueChange={(v:any)=>setRange(v)}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="ช่วงเวลา" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 วัน</SelectItem>
                <SelectItem value="30d">30 วัน</SelectItem>
                <SelectItem value="90d">90 วัน</SelectItem>
                <SelectItem value="ytd">ตั้งแต่ต้นปี</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={()=>refetch()}>รีเฟรช</Button>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>มูลค่าสต็อกรวม</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {isLoading ? <Skeleton className="h-7 w-32" /> : FORMAT_THB.format(summary?.totalInventoryValue ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" /> ค่าประมาณ ณ ปัจจุบัน</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>คำขอโอนสินค้ารออนุมัติ</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-7 w-12" /> : FORMAT_NUM.format(summary?.pendingTransfers ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-2"><Truck className="h-4 w-4" /> โอนระหว่างสาขา</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>จำนวนสาขา</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {isLoading ? <Skeleton className="h-7 w-10" /> : FORMAT_NUM.format(summary?.branchCount ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-2"><Building2 className="h-4 w-4" /> Branches</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ผู้ใช้งาน</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? <Skeleton className="h-7 w-10" /> : FORMAT_NUM.format(summary?.totalUsers ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> รวมทั้งหมด</CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Left: Charts */}
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-xl flex items-center gap-2"><Boxes className="h-5 w-5" /> มูลค่าคงคลังตามสาขา</CardTitle>
              <CardDescription>รวมมูลค่าสินค้าต่อสาขา</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 h-[340px]">
              {isLoading ? (
                <Skeleton className="h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={invByBranch} margin={{ left: 4, right: 4, top: 8, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={60} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ReTooltip />
                    <Bar dataKey="value" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-xl flex items-center gap-2"><ArrowDownUp className="h-5 w-5" /> Inbound / Outbound</CardTitle>
              <CardDescription>ปริมาณเคลื่อนไหวสินค้า ({range.toUpperCase()})</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 h-[300px]">
              {isLoading ? (
                <Skeleton className="h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={transfersSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ReTooltip />
                    <Line type="monotone" dataKey="inbound" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="outbound" strokeWidth={2} dot={false} />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Categories Pie + Low Stock */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-xl flex items-center gap-2"><Factory className="h-5 w-5" /> สัดส่วนตามหมวดสินค้า</CardTitle>
              <CardDescription>ค่าประมาณจากคลังสินค้า</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 h-[300px]">
              {isLoading ? (
                <Skeleton className="h-full" />
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieCats} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                      {pieCats.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> สินค้าใกล้หมด</CardTitle>
              <CardDescription>Top 5 ตามเกณฑ์ minQty (placeholder)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[{ sku:'SKU-001', name:'ตัวอย่างสินค้า A', qty:3, min:5 },{ sku:'SKU-014', name:'ตัวอย่างสินค้า B', qty:7, min:10 },{ sku:'SKU-221', name:'ตัวอย่างสินค้า C', qty:1, min:4 }].map((r)=> (
                <div key={r.sku} className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <div className="font-medium">{r.sku} <span className="text-muted-foreground">— {r.name}</span></div>
                    <div className="text-xs text-muted-foreground">คงเหลือ {r.qty} / เกณฑ์ขั้นต่ำ {r.min}</div>
                  </div>
                  <Badge variant="destructive">เติมสต็อก</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tables & Insights */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-0">
            <CardTitle className="text-xl flex items-center gap-2"><Boxes className="h-5 w-5" /> SKU เคลื่อนไหวสูงสุด</CardTitle>
            <CardDescription>Top movers by transfer volume (placeholder)</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">SKU</th>
                  <th className="px-2 py-2 font-medium">ชื่อสินค้า</th>
                  <th className="px-2 py-2 font-medium">Inbound</th>
                  <th className="px-2 py-2 font-medium">Outbound</th>
                  <th className="px-2 py-2 font-medium">สาขาหลัก</th>
                </tr>
              </thead>
              <tbody>
                {[{sku:'SKU-001', name:'ตัวอย่างสินค้า A', in:120, out:95, branch:'สาขา 1'}, {sku:'SKU-014', name:'ตัวอย่างสินค้า B', in:90, out:110, branch:'สาขา 3'}, {sku:'SKU-221', name:'ตัวอย่างสินค้า C', in:60, out:70, branch:'สาขา 2'}].map((r)=> (
                  <tr key={r.sku} className="border-t">
                    <td className="px-2 py-2 font-medium">{r.sku}</td>
                    <td className="px-2 py-2">{r.name}</td>
                    <td className="px-2 py-2">{FORMAT_NUM.format(r.in)}</td>
                    <td className="px-2 py-2">{FORMAT_NUM.format(r.out)}</td>
                    <td className="px-2 py-2">{r.branch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-xl flex items-center gap-2"><Clock className="h-5 w-5" /> สต็อกค้าง (Aging)</CardTitle>
            <CardDescription>กลุ่มที่เกิน 90/180 วัน (placeholder)</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {[{ bucket:'>180 วัน', items:24, value: 410000 }, { bucket:'90–180 วัน', items:52, value: 690000 }].map((r)=> (
              <div key={r.bucket} className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <div className="font-medium">{r.bucket}</div>
                  <div className="text-xs text-muted-foreground">{FORMAT_NUM.format(r.items)} รายการ • {FORMAT_THB.format(r.value)}</div>
                </div>
                <Button variant="ghost" size="sm">ดูรายการ</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">Tip: หน้านี้ดึงข้อมูลจาก <code>/api/analytics/summary</code> และสามารถผูก Low Stock / Movers / Aging กับคิวรีจริงได้ภายหลัง</p>
    </div>
  );
}
