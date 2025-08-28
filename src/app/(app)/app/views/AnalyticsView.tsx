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
  Cell,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useBranch } from '@/contexts/BranchContext';
import { cn } from '@/lib/utils';
import { Download, RefreshCcw, Info, Building2, CalendarDays, BarChart3, Activity, PieChart as PieIcon } from 'lucide-react';

// ----------------------------------
// Types (match existing /api/analytics/summary)
// ----------------------------------
interface SummaryData {
  totalInventoryValue: number;
  pendingTransfers: number;
  branchCount: number;
  totalUsers: number;
}

interface ChartData {
  name: string; // label on axis or legend
  value?: number; // generic numeric value
  transfers?: number; // for series named 'transfers'
}

interface SummaryResponse {
  ok: boolean;
  summaryData: SummaryData;
  inventoryByBranchData: ChartData[];
  transfersOverTimeData: ChartData[];
  productCategoriesData: ChartData[];
}

// ----------------------------------
// Helpers
// ----------------------------------
const FORMAT_THB = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });
const FORMAT_NUM = new Intl.NumberFormat('th-TH');

const PIE_COLORS = ['#4f46e5', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#84cc16'];

type RangePreset = '7d' | '30d' | '90d' | 'ytd';

function rangePresetToDates(preset: RangePreset): { from: string; to: string } {
  const now = new Date();
  const to = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  let from = new Date(to);
  if (preset === '7d') from.setUTCDate(to.getUTCDate() - 6);
  if (preset === '30d') from.setUTCDate(to.getUTCDate() - 29);
  if (preset === '90d') from.setUTCDate(to.getUTCDate() - 89);
  if (preset === 'ytd') from = new Date(Date.UTC(to.getUTCFullYear(), 0, 1));
  // return as ISO (date-only)
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

// Small utility to CSV-export any 2D array
function downloadCSV(filename: string, rows: Array<Record<string, any>> | Array<any[]>) {
  let csv = '';
  if (Array.isArray(rows) && rows.length > 0 && !Array.isArray(rows[0])) {
    // rows of objects -> header first
    const keys = Object.keys(rows[0] as Record<string, any>);
    csv += keys.join(',') + '\n';
    (rows as Array<Record<string, any>>).forEach((r) => {
      csv += keys.map((k) => JSON.stringify(r[k] ?? '')).join(',') + '\n';
    });
  } else {
    (rows as any[][]).forEach((r) => {
      csv += r.map((v) => JSON.stringify(v ?? '')).join(',') + '\n';
    });
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ----------------------------------
// Component
// ----------------------------------
export default function AnalyticsView() {
  const { selectedBranchId, selectedBranch } = useBranch();

  // Filters
  const [preset, setPreset] = React.useState<RangePreset>('30d');
  const { from, to } = React.useMemo(() => rangePresetToDates(preset), [preset]);
  const [scope, setScope] = React.useState<'branch' | 'all'>('branch');

  // Data fetching
  const queryKey = React.useMemo(() => ['analytics-summary', scope, selectedBranchId || 'none', from, to], [scope, selectedBranchId, from, to]);

  const { data, isLoading, isFetching, error, refetch } = useQuery<SummaryResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (scope === 'branch' && selectedBranchId) params.set('branchId', selectedBranchId);
      params.set('from', from);
      params.set('to', to);
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

  // ----------------------------------
  // UI
  // ----------------------------------
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <div className="font-semibold">Enterprise Analytics</div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button aria-label="Info" className="inline-flex"><Info className="h-4 w-4 text-muted-foreground" /></button>
                  </TooltipTrigger>
                  <TooltipContent>Scoped by branch or all branches you can access.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex-1" />

            {/* Scope select */}
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={scope} onValueChange={(v) => setScope(v as 'branch' | 'all')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="branch">Selected Branch{selectedBranch ? `: ${selectedBranch.branchName ?? selectedBranch.id}` : ''}</SelectItem>
                  <SelectItem value="all">All My Branches</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date presets */}
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Select value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="ytd">Year to date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCcw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} /> Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const rows = [
                    { metric: 'totalInventoryValue', value: summary?.totalInventoryValue ?? 0 },
                    { metric: 'pendingTransfers', value: summary?.pendingTransfers ?? 0 },
                    { metric: 'branchCount', value: summary?.branchCount ?? 0 },
                    { metric: 'totalUsers', value: summary?.totalUsers ?? 0 },
                  ];
                  downloadCSV('analytics-summary.csv', rows);
                }}
              >
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {isLoading ? (
        <KPISkeleton />
      ) : error ? (
        <ErrorCard message={(error as Error).message} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KPICard title="Inventory Value" value={FORMAT_THB.format(summary?.totalInventoryValue ?? 0)} sub="Total across scope" />
          <KPICard title="Pending Transfers" value={FORMAT_NUM.format(summary?.pendingTransfers ?? 0)} sub="Open requests" />
          <KPICard title="Branches" value={FORMAT_NUM.format(summary?.branchCount ?? 0)} sub="In scope" />
          <KPICard title="Active Users" value={FORMAT_NUM.format(summary?.totalUsers ?? 0)} sub="In last 30 days" />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Transfers over time</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={transfersSeries} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ReTooltip formatter={(v: any) => FORMAT_NUM.format(v)} />
                  <Line type="monotone" dataKey="transfers" stroke="#4f46e5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieIcon className="h-5 w-5" /> Inventory by category</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieCats} dataKey="value" nameKey="name" outerRadius={100} innerRadius={60}>
                    {pieCats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip formatter={(v: any) => FORMAT_NUM.format(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Inventory value by branch</CardTitle>
          </CardHeader>
          <CardContent className="h-[360px]">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={invByBranch} margin={{ left: 4, right: 4, top: 8, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={60} tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ReTooltip formatter={(v: any) => FORMAT_THB.format(v)} />
                  <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer Note */}
      <div className="text-[11px] text-muted-foreground px-1">
        Scope: <span className="font-medium">{scope === 'all' ? 'All my branches' : (selectedBranch?.branchName ?? selectedBranchId ?? '-')}</span>
        <Separator orientation="vertical" className="mx-2 inline-block h-3 align-middle" />
        Range: <span className="font-medium">{from} → {to}</span>
      </div>
    </div>
  );
}

// ----------------------------------
// Sub-components
// ----------------------------------
function KPICard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function KPISkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Skeleton className="xl:col-span-3 h-80" />
        <Skeleton className="xl:col-span-2 h-80" />
        <Skeleton className="xl:col-span-5 h-96" />
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Failed to load analytics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">{message}</div>
      </CardContent>
    </Card>
  );
}
