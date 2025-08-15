'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ChevronRight,
  ChevronDown,
  Building2,
  Info,
  Plus,
  Minus,
  RefreshCw,
  Download,
  LayoutGrid,
  Table as TableIcon,
  Grid3X3,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

// services & types
import { InventoryService, StoreService } from '@/lib/services/InventoryService';
import type { GroupedProduct } from '@/types/inventory';

// shadcn/ui
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

type SortKey =
  | 'relevance'
  | 'qty-high'
  | 'qty-low'
  | 'price-low'
  | 'price-high'
  | 'brand'
  | 'name';

type ViewMode = 'table' | 'grid' | 'matrix';

const formatTHB = (n: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

type Row = {
  key: string;
  productName: string;
  brand: string;
  model: string;
  branchId: string;
  branchName: string;
  specHighlight: string;
  available: number;
  minPrice: number;
  hasPromo: boolean;
  dotChips: { dotCode: string; qty: number; price: number }[];
  dotsAll: {
    dotCode: string;
    qty: number;
    price: number;
    spec: string;
    variantId: string;
  }[];
  grouped: GroupedProduct;
  branchNode: any;
};

import type { ViewKey } from '@/types/nav';

export default function MyInventory({
  myBranchId,
  myBranchName,
  onNavigate,
}: {
  myBranchId: string;
  myBranchName: string;
  onNavigate?: (k: ViewKey) => void;
}) {
  const qc = useQueryClient();

  // ---------- UI State ----------
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounced(searchTerm);
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [selectedSize, setSelectedSize] = useState('All Sizes');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [hasPromotion, setHasPromotion] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('relevance');

  // ---------- Data ----------
  const invQuery = useQuery({
    queryKey: ['inventory', 'store', myBranchId],
    queryFn: async () => {
      const stores = await StoreService.getAllStores();
      const name = stores[myBranchId] ?? myBranchName ?? myBranchId;
      const inv = await InventoryService.fetchStoreInventory(myBranchId, name);
      return { inv, branchName: name };
    },
    enabled: !!myBranchId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const isLoading = invQuery.isLoading || invQuery.isRefetching;
  const inventory = (invQuery.data?.inv ?? []) as GroupedProduct[];
  const branchName = invQuery.data?.branchName ?? myBranchName;

  // ---------- Options Data ----------
  const availableBrands = useMemo(
    () => Array.from(new Set(inventory.map((p) => p.brand ?? 'Unknown'))).sort(),
    [inventory]
  );

  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    for (const p of inventory) {
      for (const b of (p.branches ?? []) as any[]) {
        for (const s of (b.sizes ?? []) as any[]) {
          const spec = String(s.specification ?? '').trim();
          if (spec) set.add(spec);
        }
      }
    }
    return Array.from(set).sort();
  }, [inventory]);

  // ---------- Rows ----------
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const p of inventory) {
      const b = (p.branches ?? [])[0]; // inventory ของสาขานี้
      if (!b) continue;

      const sizes = b.sizes ?? [];
      const allDots: Row['dotsAll'] = [];
      let totalUnits = 0;
      let specHighlight = 'N/A';
      let specQtyMax = -1;
      let hasPromoAny = false;

      for (const s of sizes as any[]) {
        const dots = (s.dots ?? []) as any[];
        const specQty = dots.reduce((sum: number, d: any) => sum + Number(d.qty ?? 0), 0);
        if (specQty > specQtyMax) {
          specQtyMax = specQty;
          specHighlight = s.specification ?? 'N/A';
        }
        for (const d of dots) {
          const qty = Number(d.qty ?? 0);
          const price = Number(d.promoPrice ?? d.basePrice ?? 0);
          if (qty > 0) {
            allDots.push({
              dotCode: d.dotCode,
              qty,
              price,
              spec: s.specification ?? 'N/A',
              variantId: String(s.variantId ?? ''),
            });
            totalUnits += qty;
          }
          if (d.promoPrice != null) hasPromoAny = true;
        }
      }

      if (inStockOnly && totalUnits <= 0) continue;

      allDots.sort((a, b) => b.qty - a.qty || a.price - b.price);
      const minPrice = allDots.length ? Math.min(...allDots.map((d) => d.price)) : 0;

      out.push({
        key: `${p.id}__${b.branchId}`,
        productName: p.name,
        brand: p.brand,
        model: p.model,
        branchId: String(b.branchId),
        branchName: b.branchName,
        specHighlight,
        available: totalUnits,
        minPrice,
        hasPromo: hasPromoAny,
        dotChips: allDots.slice(0, 3),
        dotsAll: allDots,
        grouped: p,
        branchNode: b,
      });
    }

    const q = debouncedSearch.trim().toLowerCase();

    const filtered = out
      .filter((r) => (selectedBrand === 'All Brands' ? true : r.brand === selectedBrand))
      .filter((r) =>
        selectedSize === 'All Sizes' ? true : r.dotsAll.some((d) => d.spec === selectedSize)
      )
      .filter((r) =>
        !q
          ? true
          : `${r.productName} ${r.brand} ${r.model} ${r.specHighlight}`
              .toLowerCase()
              .includes(q)
      )
      .filter((r) => (hasPromotion ? r.hasPromo : true));

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'qty-high':
          return b.available - a.available;
        case 'qty-low':
          return a.available - b.available;
        case 'price-low':
          return (a.minPrice || Infinity) - (b.minPrice || Infinity);
        case 'price-high':
          return (b.minPrice || 0) - (a.minPrice || 0);
        case 'brand':
          return a.brand.localeCompare(b.brand);
        case 'name':
          return a.productName.localeCompare(b.productName);
        case 'relevance':
        default:
          return b.available - a.available;
      }
    });

    return sorted;
  }, [
    inventory,
    inStockOnly,
    debouncedSearch,
    selectedBrand,
    selectedSize,
    hasPromotion,
    sortBy,
  ]);

  // ---------- KPI ----------
  const kpis = useMemo(() => {
    const products = rows.length;
    const units = rows.reduce((s, r) => s + r.available, 0);
    const low = rows.filter((r) => r.available > 0 && r.available < 6).length;
    const avgPrice = rows.length
      ? Math.round(rows.reduce((s, r) => s + r.minPrice, 0) / rows.length)
      : 0;
    return { products, units, low, avgPrice };
  }, [rows]);

  // ---------- Stock adjust ----------
  const adjustMutation = useMutation({
    mutationFn: async (payload: {
      brand: string;
      model: string;
      variantId: string;
      dotCode: string;
      qtyChange: number;
    }) => {
      await InventoryService.createStockMovement(
        myBranchId,
        {
          brand: payload.brand,
          model: payload.model,
          variantId: payload.variantId,
          dotCode: payload.dotCode,
        },
        'adjust' as any,
        payload.qtyChange,
        { reason: 'Manual adjust from Inventory page' }
      );
    },
    onSuccess: () => {
      toast.success('Stock updated');
      qc.invalidateQueries({ queryKey: ['inventory', 'store', myBranchId] });
    },
    onError: (e: any) => {
      toast.error(`Update failed: ${e?.message ?? 'Unknown error'}`);
    },
  });

  const handleAdjust = (
    r: Row,
    d: Row['dotsAll'][number],
    delta: number
  ) => {
    adjustMutation.mutate({
      brand: r.brand,
      model: r.model,
      variantId: d.variantId,
      dotCode: d.dotCode,
      qtyChange: delta,
    });
  };

  // ====== Expanded-row actions state ======
  const [openAddDot, setOpenAddDot] = useState<{ open: boolean; row?: Row | null }>({
    open: false,
    row: null,
  });
  const [openPromo, setOpenPromo] = useState<{
    open: boolean;
    row?: Row | null;
    dot?: Row['dotsAll'][number] | null;
  }>({ open: false, row: null, dot: null });
  const [openDelete, setOpenDelete] = useState<{
    open: boolean;
    row?: Row | null;
    dot?: Row['dotsAll'][number] | null;
  }>({ open: false, row: null, dot: null });

  const [addForm, setAddForm] = useState<{
    variantId: string;
    dotCode: string;
    qty: number;
    promoPrice?: string;
  }>({
    variantId: '',
    dotCode: '',
    qty: 1,
    promoPrice: '',
  });
  const [promoForm, setPromoForm] = useState<{ promoPrice: string }>({ promoPrice: '' });

  // สร้าง DOT / อัปเดต qty+promo พร้อมกัน
  const upsertDotMutation = useMutation({
    mutationFn: async () => {
      const r = openAddDot.row!;
      await InventoryService.upsertDot(myBranchId, {
        brand: r.brand,
        model: r.model,
        variantId: addForm.variantId,
        dotCode: addForm.dotCode.trim(),
        qty: Number(addForm.qty) || 0,
        promoPrice: addForm.promoPrice?.trim() ? Number(addForm.promoPrice) : undefined,
      });
    },
    onSuccess: () => {
      toast.success('DOT saved');
      setOpenAddDot({ open: false, row: null });
      qc.invalidateQueries({ queryKey: ['inventory', 'store', myBranchId] });
    },
    onError: (e: any) => toast.error(`Failed: ${e?.message ?? 'Unknown error'}`),
  });

  const setPromoMutation = useMutation({
    mutationFn: async () => {
      const r = openPromo.row!;
      const d = openPromo.dot!;
      const val = promoForm.promoPrice.trim();
      await InventoryService.setPromoPrice(myBranchId, {
        brand: r.brand,
        model: r.model,
        variantId: d.variantId,
        dotCode: d.dotCode,
        promoPrice: val === '' ? null : Number(val),
      });
    },
    onSuccess: () => {
      toast.success('Promo updated');
      setOpenPromo({ open: false, row: null, dot: null });
      qc.invalidateQueries({ queryKey: ['inventory', 'store', myBranchId] });
    },
    onError: (e: any) => toast.error(`Failed: ${e?.message ?? 'Unknown error'}`),
  });

  const deleteDotMutation = useMutation({
    mutationFn: async () => {
      const r = openDelete.row!;
      const d = openDelete.dot!;
      await InventoryService.deleteDot(myBranchId, {
        brand: r.brand,
        model: r.model,
        variantId: d.variantId,
        dotCode: d.dotCode,
      });
    },
    onSuccess: () => {
      toast.success('DOT deleted');
      setOpenDelete({ open: false, row: null, dot: null });
      qc.invalidateQueries({ queryKey: ['inventory', 'store', myBranchId] });
    },
    onError: (e: any) => toast.error(`Failed: ${e?.message ?? 'Unknown error'}`),
  });

  // ---------- Export CSV ----------
  const exportCSV = () => {
    const header = ['Product', 'Brand', 'Model', 'Spec', 'Available', 'Min Price'];
    const rowsText = rows.map((r) =>
      [r.productName, r.brand, r.model, r.specHighlight, r.available, r.minPrice]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvText = [header.join(','), ...rowsText].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvText], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_inventory_${new Date().toISOString().slice(0, 19)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  // ---------- UI blocks ----------
  const Header = (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">My Inventory</h1>
        <p className="text-muted-foreground">
          View and adjust stock for <span className="font-medium">{branchName}</span>.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => invQuery.refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>
    </div>
  );

  const KPI = (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <Card className="rounded-xl shadow-sm border-emerald-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Products</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{kpis.products}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-blue-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Units in Stock</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{kpis.units}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-amber-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Low Stock</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{kpis.low}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-teal-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Avg Price</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">
          {formatTHB(kpis.avgPrice)}
        </CardContent>
      </Card>
    </div>
  );

  const FilterBar = (
    <div className="border-b bg-muted/20 p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Search & Sort */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search product, brand, or spec..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Most Relevant</SelectItem>
              <SelectItem value="qty-high">Qty: High to Low</SelectItem>
              <SelectItem value="qty-low">Qty: Low to High</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="brand">Brand A-Z</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="ml-auto inline-flex rounded-md border bg-background p-1">
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              onClick={() => setViewMode('table')}
              className="gap-1"
              title="Table view"
            >
              <TableIcon className="h-4 w-4" />
              Table
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
              className="gap-1"
              title="Grid cards"
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'matrix' ? 'default' : 'ghost'}
              onClick={() => setViewMode('matrix')}
              className="gap-1"
              title="Matrix by DOT × Size"
            >
              <Grid3X3 className="h-4 w-4" />
              Matrix
            </Button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Brands">All Brands</SelectItem>
              {availableBrands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSize} onValueChange={setSelectedSize}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Sizes">All Sizes</SelectItem>
              {availableSizes.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Switch
              checked={inStockOnly}
              onCheckedChange={(v) => setInStockOnly(Boolean(v))}
            />
            <Label>In Stock Only</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={hasPromotion}
              onCheckedChange={(v) => setHasPromotion(Boolean(v))}
            />
            <Label>On Sale</Label>
          </div>
        </div>
      </div>
    </div>
  );

  // ---------- Table (expandable rows) ----------
  const GRID_COLS = 'minmax(420px,1.2fr) minmax(220px,0.8fr) 120px 120px 120px';

  const TableHeader = (
    <div
      className="grid gap-4 px-4 py-3 text-xs text-muted-foreground min-w-[980px] bg-slate-50/70 border-b"
      style={{ gridTemplateColumns: GRID_COLS }}
    >
      <div>Product</div>
      <div>Branch</div>
      <div className="text-right">Available</div>
      <div className="text-right">Min Price</div>
      <div />
    </div>
  );

  const TableBody = isLoading ? (
    <div className="p-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  ) : rows.length === 0 ? (
    <div className="p-10 text-center text-muted-foreground">No products found.</div>
  ) : (
    <div>
      {rows.map((r) => {
        const chipsShown = r.dotChips.reduce((s, c) => s + c.qty, 0);
        const expanded = expandedKey === r.key;
        return (
          <div key={r.key} className="border-b px-5 py-4 hover:bg-slate-50/60 transition-colors">
            <div
              className="grid gap-4 items-start min-w-[980px]"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              {/* Product */}
              <div className="flex items-start gap-2">
                <button
                  className="mt-0.5 rounded-md hover:bg-muted p-1"
                  onClick={() =>
                    setExpandedKey((prev) => (prev === r.key ? null : r.key))
                  }
                  aria-label="Expand row"
                  title="Show DOT details"
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <div>
                  <div className="font-medium">{r.productName}</div>
                  {/* chips */}
                  {r.dotChips.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.dotChips.map((chip, i) => (
                        <span
                          key={`${r.key}-chip-${chip.dotCode}-${i}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px]"
                        >
                          <span className="font-mono">{chip.dotCode}</span>
                          <span>×{chip.qty}</span>
                          <span>· {formatTHB(chip.price)}</span>
                        </span>
                      ))}
                      {r.available > chipsShown && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border bg-white">
                          +{r.available - chipsShown} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Branch */}
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <div>
                  <div className="font-medium text-sm">{r.branchName}</div>
                  <div className="text-xs text-muted-foreground">Your Branch</div>
                </div>
              </div>

              {/* Available */}
              <div className="text-right">
                <Badge variant={r.available < 6 ? 'destructive' : 'secondary'}>
                  {r.available} units
                </Badge>
              </div>

              {/* Min Price */}
              <div className="text-right">
                {r.minPrice > 0 ? formatTHB(r.minPrice) : '—'}
              </div>

              {/* Actions */}
              <div className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setExpandedKey((prev) => (prev === r.key ? null : r.key))
                  }
                >
                  Manage
                </Button>
              </div>
            </div>

            {/* Expanded area */}
            {expanded && (
              <div className="bg-slate-50 rounded-lg px-4 py-3 mt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="h-3.5 w-3.5" />
                    DOT details for {r.productName} @ {r.branchName}
                  </div>

                  {/* ปุ่ม Add DOT */}
                  <Button
                    size="sm"
                    onClick={() => {
                      const sizes: Array<{ specification: string; variantId: string }> =
                        (r.branchNode?.sizes ?? []).map((s: any) => ({
                          specification: s.specification,
                          variantId: String(s.variantId ?? ''),
                        }));
                      setAddForm({
                        variantId: sizes[0]?.variantId ?? '',
                        dotCode: '',
                        qty: 1,
                        promoPrice: '',
                      });
                      setOpenAddDot({ open: true, row: r });
                    }}
                  >
                    + Add DOT
                  </Button>
                </div>

                <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground pb-1">
                  <div className="col-span-4">DOT</div>
                  <div className="col-span-3">Specification</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>
                <Separator />

                {r.dotsAll.map((d, i) => (
                  <div
                    key={`${r.key}-expand-${d.variantId}-${d.dotCode}-${i}`}
                    className="grid grid-cols-12 py-2 items-center border-b last:border-b-0"
                  >
                    <div className="col-span-4 font-mono">{d.dotCode}</div>
                    <div className="col-span-3">{d.spec}</div>
                    <div className="col-span-2 text-right">{d.qty}</div>
                    <div className="col-span-2 text-right">{formatTHB(d.price)}</div>
                    <div className="col-span-1">
                      <div className="flex items-center justify-end gap-1">
                        {/* +- ปรับสต็อก */}
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => handleAdjust(r, d, -1)}
                          disabled={adjustMutation.isPending || d.qty <= 0}
                          title="Decrease"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleAdjust(r, d, +1)}
                          disabled={adjustMutation.isPending}
                          title="Increase"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>

                        {/* เมนูเพิ่มเติม */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="More">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setPromoForm({ promoPrice: '' });
                                setOpenPromo({ open: true, row: r, dot: d });
                              }}
                            >
                              Set promo price…
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setOpenDelete({ open: true, row: r, dot: d })}
                            >
                              Delete DOT
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ---------- Grid view ----------
  const GridView = (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {isLoading
        ? Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))
        : rows.length
        ? rows.map((r) => (
            <Card key={r.key} className="relative">
              <div className="absolute top-3 right-3">
                <Badge variant={r.available < 6 ? 'destructive' : 'secondary'}>
                  {r.available} units
                </Badge>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{r.productName}</CardTitle>
                <div className="text-xs text-muted-foreground">{r.specHighlight}</div>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.dotChips.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.dotChips.map((chip, i) => (
                      <span
                        key={`${r.key}-chip-grid-${chip.dotCode}-${i}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px]"
                      >
                        <span className="font-mono">{chip.dotCode}</span>
                        <span>×{chip.qty}</span>
                        <span>· {formatTHB(chip.price)}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{r.branchName}</div>
                      <div className="text-xs text-muted-foreground">Your Branch</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-sm font-semibold">
                      {r.minPrice > 0 ? formatTHB(r.minPrice) : '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => setExpandedKey(r.key)}
                    title="Manage"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>

                {/* inline expanded in card */}
                {expandedKey === r.key && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                      <Info className="h-3.5 w-3.5" />
                      DOT details
                    </div>
                    <div className="space-y-2">
                      {r.dotsAll.map((d, i) => (
                        <div
                          key={`${r.key}-grid-expand-${d.variantId}-${d.dotCode}-${i}`}
                          className="flex items-center justify-between border-b pb-2 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <div className="font-mono text-xs">{d.dotCode}</div>
                            <div className="text-xs text-muted-foreground">{d.spec}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs">{formatTHB(d.price)}</div>
                            <div className="text-xs text-muted-foreground">Qty: {d.qty}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => handleAdjust(r, d, -1)}
                              disabled={adjustMutation.isPending || d.qty <= 0}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleAdjust(r, d, +1)}
                              disabled={adjustMutation.isPending}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        : (
          <div className="col-span-full p-10 text-center text-muted-foreground">
            No products found for the selected filters.
          </div>
        )}
    </div>
  );

  // ---------- Matrix view (Spec × DOT) ----------
  const MatrixView = (
    <div className="space-y-4">
      {isLoading ? (
        Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground">
          No products found for the selected filters.
        </div>
      ) : (
        rows.map((r) => {
          const specs = Array.from(new Set(r.dotsAll.map((d) => d.spec))).sort();
          const dots = Array.from(new Set(r.dotsAll.map((d) => d.dotCode))).sort();

          const cellMap = new Map<string, { qty: number; price: number; variantId: string }>();
          r.dotsAll.forEach((d) => {
            cellMap.set(`${d.spec}__${d.dotCode}`, {
              qty: d.qty,
              price: d.price,
              variantId: d.variantId,
            });
          });

          return (
            <Card key={`matrix-${r.key}`} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{r.productName}</CardTitle>
                <CardDescription>{r.branchName}</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <ScrollArea className="w-full">
                  <div className="min-w-[720px]">
                    {/* header row (dots) */}
                    <div className="grid" style={{ gridTemplateColumns: `200px repeat(${dots.length}, minmax(100px, 1fr)) 120px` }}>
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-slate-50 border">
                        Size / DOT
                      </div>
                      {dots.map((dc) => (
                        <div key={`${r.key}-h-${dc}`} className="px-3 py-2 text-xs font-medium text-muted-foreground text-center bg-slate-50 border font-mono">
                          {dc}
                        </div>
                      ))}
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-slate-50 border text-right">
                        Row total
                      </div>
                    </div>

                    {/* body rows (each spec) */}
                    {specs.map((spec) => {
                      let rowTotal = 0;
                      return (
                        <div
                          key={`${r.key}-row-${spec}`}
                          className="grid items-stretch"
                          style={{ gridTemplateColumns: `200px repeat(${dots.length}, minmax(100px, 1fr)) 120px` }}
                        >
                          <div className="px-3 py-2 text-sm font-medium border bg-white">
                            {spec}
                          </div>
                          {dots.map((dc) => {
                            const cell = cellMap.get(`${spec}__${dc}`);
                            const qty = cell?.qty ?? 0;
                            const price = cell?.price ?? 0;
                            if (qty > 0) rowTotal += qty;
                            return (
                              <div
                                key={`${r.key}-cell-${spec}-${dc}`}
                                className="px-2 py-2 border bg-white"
                              >
                                {qty > 0 ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="text-xs font-mono">{qty}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {formatTHB(price)}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-6 w-6"
                                        onClick={() =>
                                          handleAdjust(
                                            r,
                                            {
                                              dotCode: dc,
                                              qty,
                                              price,
                                              spec,
                                              variantId: cell!.variantId,
                                            },
                                            -1
                                          )
                                        }
                                        disabled={adjustMutation.isPending || qty <= 0}
                                        title="Decrease"
                                      >
                                        <Minus className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() =>
                                          handleAdjust(
                                            r,
                                            {
                                              dotCode: dc,
                                              qty,
                                              price,
                                              spec,
                                              variantId: cell!.variantId,
                                            },
                                            +1
                                          )
                                        }
                                        disabled={adjustMutation.isPending}
                                        title="Increase"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="h-10 flex items-center justify-center text-[10px] text-muted-foreground">
                                    —
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div className="px-3 py-2 text-right text-sm border bg-slate-50">
                            {rowTotal}
                          </div>
                        </div>
                      );
                    })}

                    {/* footer total per column */}
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: `200px repeat(${dots.length}, minmax(100px, 1fr)) 120px` }}
                    >
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-slate-50 border">
                        Column total
                      </div>
                      {dots.map((dc) => {
                        const colTotal = r.dotsAll
                          .filter((d) => d.dotCode === dc)
                          .reduce((s, d) => s + d.qty, 0);
                        return (
                          <div
                            key={`${r.key}-colsum-${dc}`}
                            className="px-3 py-2 text-sm text-center border bg-slate-50"
                          >
                            {colTotal}
                          </div>
                        );
                      })}
                      <div className="px-3 py-2 text-right text-sm border bg-slate-50 font-semibold">
                        {r.available}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );

  return (
    <div className="space-y-6 md:space-y-8">
      {Header}

      {KPI}

      {FilterBar}

      <div className="rounded-xl border bg-white overflow-x-auto shadow-sm">
        {viewMode === 'table' && (
          <>
            {TableHeader}
            {TableBody}
          </>
        )}
        {viewMode === 'grid' && <div className="p-4">{GridView}</div>}
        {viewMode === 'matrix' && <div className="p-4">{MatrixView}</div>}
      </div>

      {/* Add DOT dialog */}
      <Dialog
        open={openAddDot.open}
        onOpenChange={(o) => setOpenAddDot({ open: o, row: o ? openAddDot.row : null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add DOT</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* เลือกสเปค (variant) */}
            <div>
              <Label className="text-xs">Specification</Label>
              <Select
                value={addForm.variantId}
                onValueChange={(v) => setAddForm((f) => ({ ...f, variantId: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select size/spec" />
                </SelectTrigger>
                <SelectContent>
                  {(openAddDot.row?.branchNode?.sizes ?? []).map((s: any) => (
                    <SelectItem key={String(s.variantId)} value={String(s.variantId)}>
                      {s.specification}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">DOT code</Label>
              <Input
                className="mt-1 font-mono"
                value={addForm.dotCode}
                onChange={(e) => setAddForm((f) => ({ ...f, dotCode: e.target.value }))}
                placeholder="e.g. 2325"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  value={addForm.qty}
                  onChange={(e) => setAddForm((f) => ({ ...f, qty: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label className="text-xs">Promo price (optional)</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  value={addForm.promoPrice}
                  onChange={(e) => setAddForm((f) => ({ ...f, promoPrice: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAddDot({ open: false, row: null })}>
              Cancel
            </Button>
            <Button
              onClick={() => upsertDotMutation.mutate()}
              disabled={!addForm.variantId || !addForm.dotCode.trim() || upsertDotMutation.isPending}
            >
              {upsertDotMutation.isPending ? 'Saving…' : 'Save DOT'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set promo dialog */}
      <Dialog
        open={openPromo.open}
        onOpenChange={(o) =>
          setOpenPromo({ open: o, row: o ? openPromo.row : null, dot: o ? openPromo.dot : null })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set promo price</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              DOT: <span className="font-mono">{openPromo.dot?.dotCode}</span> · Spec:{' '}
              {openPromo.dot?.spec}
            </div>
            <div>
              <Label className="text-xs">Promo price (ว่าง = ลบราคาโปร)</Label>
              <Input
                type="number"
                min={0}
                className="mt-1"
                value={promoForm.promoPrice}
                onChange={(e) => setPromoForm({ promoPrice: e.target.value })}
                placeholder="e.g. 2500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenPromo({ open: false, row: null, dot: null })}
            >
              Cancel
            </Button>
            <Button onClick={() => setPromoMutation.mutate()} disabled={setPromoMutation.isPending}>
              {setPromoMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={openDelete.open}
        onOpenChange={(o) =>
          setOpenDelete({
            open: o,
            row: o ? openDelete.row : null,
            dot: o ? openDelete.dot : null,
          })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete DOT</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div>
              ต้องการลบ DOT <span className="font-mono">{openDelete.dot?.dotCode}</span> (
              {openDelete.dot?.spec}) ใช่ไหม?
            </div>
            <div className="text-muted-foreground text-xs">
              การลบนี้จะลบทั้งเอกสาร DOT ออกจาก variant นั้น
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenDelete({ open: false, row: null, dot: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDotMutation.mutate()}
              disabled={deleteDotMutation.isPending}
            >
              {deleteDotMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
