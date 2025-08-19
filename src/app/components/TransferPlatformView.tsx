'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
  Building2,
  Truck,
  Download,
  RefreshCw,
  ShoppingCart,
  Plus,
  Minus,
  MapPin,
  LayoutGrid,
  Table as TableIcon,
  X,
  Star,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

// react-query
import { useQuery, useQueryClient } from '@tanstack/react-query';

// tanstack table + virtualizer
import type {
  ColumnDef,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

// shadcn/ui
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// services & types
import { InventoryService, StoreService, OrderService } from '@/lib/services/InventoryService';
import type { GroupedProduct, OrderItem } from '@/lib/services/InventoryService';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * Transfer Platform — Top-tier UX/UI Redesign
 * - Adds premium card view for mobile + desktop
 * - Polished KPI tiles, sticky filters, subtle micro‑interactions
 * - Cart FAB for mobile, animated dialogs/sheets
 * - Safer one-branch-per-order logic with helpful toasts
 * - Persisted view and sort preferences
 * ──────────────────────────────────────────────────────────────────────────────
 */

// ---------- Helpers ----------
function seededRand(seed: string, min: number, max: number) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h = (h ^ (h >>> 16)) >>> 0;
  const r = h / 0xffffffff;
  return Math.round((min + (max - min) * r) * 10) / 10;
}
const calcDistanceKm = (branchId: string) => seededRand(branchId, 0.8, 6.8);
const formatTHB = (n: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

// Debounce hook
function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

// ---------- Types ----------
interface DotPick {
  sizeSpec: string;
  variantId: string;
  dotCode: string;
  available: number;
  price: number;
  selected: number;
  hasPromo: boolean;
}

interface CartItem extends Omit<OrderItem, 'unitPrice' | 'totalPrice'> {
  branchName: string;
  branchId: string;
  maxQty: number;
  unitPrice?: number; // Not used for logic, but kept for potential display
  totalPrice?: number; // Not used for logic
}

type TPRow = {
  key: string;
  productName: string;
  brand: string;
  model?: string;
  spec: string;
  branchId: string;
  branchName: string;
  distance: number;
  available: number;
  minPrice: number;
  maxPrice: number;
  dotsAll: {
    dotCode: string;
    qty: number;
    price: number;
    spec: string;
    variantId: string;
    hasPromo: boolean;
    basePrice: number;
  }[];
  dotChips: { dotCode: string; qty: number; price: number; hasPromo: boolean }[];
  grouped: GroupedProduct;
  branchNode: any;
  hasPromo: boolean;
};

// ---------- Component ----------
export default function TransferPlatformViewRedesign({
  myBranchId,
  myBranchName,
}: {
  myBranchId: string;
  myBranchName: string;
}) {
  const qc = useQueryClient();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // UI state
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(
    () => (typeof window !== 'undefined' ? ((localStorage.getItem('tp:view') as any) || 'grid') : 'grid')
  );
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filters
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounced(searchTerm, 300);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'price-low' | 'price-high' | 'rating' | 'popular' | 'distance' | 'brand'>('relevance');
  const [selectedSize, setSelectedSize] = useState<string>('All Sizes');
  const [hasPromotion, setHasPromotion] = useState<boolean>(false);

  // --- NEW: Clear Filters Function ---
  const clearFilters = () => {
    setSelectedBrand('All Brands');
    setSelectedStore('all');
    setSearchTerm('');
    setInStockOnly(true);
    setLowStockOnly(false);
    setSortBy('relevance');
    setSelectedSize('All Sizes');
    setHasPromotion(false);
    toast.info('Filters cleared');
  };
  
  // Check if any filter is active
  const isFiltered = useMemo(() => {
    return (
      selectedBrand !== 'All Brands' ||
      selectedStore !== 'all' ||
      searchTerm !== '' ||
      !inStockOnly ||
      lowStockOnly ||
      sortBy !== 'relevance' ||
      selectedSize !== 'All Sizes' ||
      hasPromotion
    );
  }, [selectedBrand, selectedStore, searchTerm, inStockOnly, lowStockOnly, sortBy, selectedSize, hasPromotion]);

  // Dot picker & cart
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<GroupedProduct | null>(null);
  const [activeBranch, setActiveBranch] = useState<any>(null);
  const [dotPicks, setDotPicks] = useState<DotPick[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  // Column visibility & sorting for table mode
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('tp:sort');
      return raw ? (JSON.parse(raw) as SortingState) : [{ id: 'available', desc: true }];
    } catch {
      return [{ id: 'available', desc: true }];
    }
  });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem('tp:cols');
      return raw ? (JSON.parse(raw) as VisibilityState) : { distance: true, price: true };
    } catch {
      return { distance: true, price: true };
    }
  });

  useEffect(() => {
    localStorage.setItem('tp:view', viewMode);
  }, [viewMode]);
  useEffect(() => {
    localStorage.setItem('tp:sort', JSON.stringify(sorting));
  }, [sorting]);
  useEffect(() => localStorage.setItem('tp:cols', JSON.stringify(columnVisibility)), [columnVisibility]);

  // ------- Data fetching (React Query) -------
  const invQuery = useQuery<{ inv: GroupedProduct[]; stores: Record<string, string> }>({
    queryKey: ['inventory', 'all'],
    queryFn: async () => {
      const [inv, storeMap] = await Promise.all([InventoryService.fetchInventory(), StoreService.getAllStores()]);
      return { inv: inv ?? [], stores: storeMap ?? {} };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (invQuery.isFetched) setLastUpdated(new Date());
  }, [invQuery.data, invQuery.isFetched]);

  const ordersQuery = useQuery({
    queryKey: ['orders', myBranchId, 'buyer'],
    queryFn: () => OrderService.getOrdersByBranch(myBranchId, 'buyer'),
    refetchInterval: 15_000,
    enabled: Boolean(myBranchId),
  });

  const isLoading = invQuery.isLoading || invQuery.isRefetching;
  const inventory = (invQuery.data?.inv ?? []) as GroupedProduct[];
  const stores = (invQuery.data?.stores ?? {}) as Record<string, string>;

  const availableBrands = useMemo(() => Array.from(new Set(inventory.map((i) => i.brand ?? 'Unknown'))).sort(), [inventory]);

  const activeBranchIds = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((p) => (p.branches ?? []).forEach((b: any) => set.add(String(b.branchId))));
    return Array.from(set);
  }, [inventory]);

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

  // ------- Build rows -------
  const rows: TPRow[] = useMemo(() => {
    const out: TPRow[] = [];
    for (const p of inventory) {
      const branchesAll = p.branches ?? [];
      const branchesToShow = selectedStore === 'all' ? branchesAll : branchesAll.filter((b: any) => String(b.branchId) === String(selectedStore));

      for (const b of branchesToShow as any[]) {
        const sizes = b.sizes ?? [];
        const allDots: TPRow['dotsAll'] = [];
        let totalUnits = 0;
        let highlightSpec = 'N/A';
        let highlightQty = -1;
        let hasPromoAny = false;
        let minPrice = Infinity;
        let maxPrice = 0;

        for (const s of sizes as any[]) {
          const dots = (s.dots ?? []) as any[];
          const specQty = dots.reduce((sum: number, d: any) => sum + Number(d.qty ?? 0), 0);
          if (specQty > highlightQty) {
            highlightQty = specQty;
            highlightSpec = s.specification ?? 'N/A';
          }
          for (const d of dots) {
            const basePrice = Number(d.basePrice ?? 0);
            const promoPrice = d.promoPrice != null ? Number(d.promoPrice) : null;
            const price = promoPrice ?? basePrice;
            const qty = Number(d.qty ?? 0);
            const hasPromo = promoPrice != null;

            if (qty > 0) {
              allDots.push({
                dotCode: d.dotCode,
                qty,
                price,
                spec: s.specification ?? 'N/A',
                variantId: String(s.variantId ?? ''),
                hasPromo,
                basePrice,
              });
              totalUnits += qty;
              if (price > 0) {
                minPrice = Math.min(minPrice, price);
                maxPrice = Math.max(maxPrice, price);
              }
            }
            if (hasPromo) hasPromoAny = true;
          }
        }

        if (inStockOnly && totalUnits <= 0) continue;
        if (lowStockOnly && !(totalUnits > 0 && totalUnits < 6)) continue;

        allDots.sort((a, b) => b.qty - a.qty || a.price - b.price);
        if (minPrice === Infinity) minPrice = 0;

        const dotChips = allDots.slice(0, 3).map((d) => ({ dotCode: d.dotCode, qty: d.qty, price: d.price, hasPromo: d.hasPromo }));

        out.push({
          key: `${p.id}__${b.branchId}`,
          productName: p.name,
          brand: p.brand,
          model: p.model,
          spec: highlightSpec,
          branchId: String(b.branchId),
          branchName: b.branchName,
          distance: calcDistanceKm(String(b.branchId)),
          available: totalUnits,
          minPrice,
          maxPrice,
          dotsAll: allDots,
          dotChips,
          grouped: p,
          branchNode: b,
          hasPromo: hasPromoAny,
        });
      }
    }

    const q = debouncedSearch.trim().toLowerCase();

    const filtered = out
      .filter((r) => (selectedBrand === 'All Brands' ? true : r.brand === selectedBrand))
      .filter((r) => (selectedSize === 'All Sizes' ? true : r.dotsAll.some((d) => d.spec === selectedSize)))
      .filter((r) => (!q ? true : `${r.productName} ${r.brand} ${r.model} ${r.spec} ${r.branchName}`.toLowerCase().includes(q)))
      .filter((r) => (hasPromotion ? r.hasPromo : true));

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return (a.minPrice || Infinity) - (b.minPrice || Infinity);
        case 'price-high':
          return (b.maxPrice || 0) - (a.maxPrice || 0);
        case 'distance':
          return a.distance - b.distance;
        case 'brand':
          return a.brand.localeCompare(b.brand);
        case 'popular':
        case 'rating':
        case 'relevance':
        default:
          return b.available - a.available;
      }
    });

    return sorted;
  }, [
    inventory,
    selectedStore,
    inStockOnly,
    lowStockOnly,
    debouncedSearch,
    selectedBrand,
    selectedSize,
    hasPromotion,
    sortBy,
  ]);

  // ------- KPI -------
  const kpis = useMemo(() => {
    const products = new Set(rows.map((r) => r.productName)).size;
    const units = rows.reduce((s, r) => s + r.available, 0);
    const low = rows.filter((r) => r.available > 0 && r.available < 6).length;
    const branches = new Set(rows.map((r) => r.branchId)).size;
    const avgPrice = rows.length ? Math.round(rows.reduce((s, r) => s + r.minPrice, 0) / rows.length) : 0;
    return { products, units, low, branches, avgPrice };
  }, [rows]);

  // ------- Dot Picker & Cart -------
  const openDotPicker = (product: GroupedProduct, branch: any) => {
    setActiveProduct(product);
    setActiveBranch(branch);

    const picks: DotPick[] = (branch.sizes ?? [])
      .flatMap((size: any) =>
        (size.dots ?? []).map((dot: any) => {
          const available = Number(dot.qty ?? 0);
          const basePrice = Number(dot.basePrice ?? 0);
          const promoPrice = dot.promoPrice != null ? Number(dot.promoPrice) : null;
          const price = promoPrice ?? basePrice;
          const hasPromo = promoPrice != null;

          return {
            sizeSpec: size.specification ?? 'N/A',
            variantId: String(size.variantId ?? ''),
            dotCode: dot.dotCode ?? '',
            available,
            price,
            selected: 0,
            hasPromo,
          };
        })
      )
      .filter((p: DotPick) => p.available > 0);

    setDotPicks(picks);
    setIsDialogOpen(true);
  };

  const handlePickChange = (dotCode: string, variantId: string, change: number) => {
    setDotPicks((picks) =>
      picks.map((p) =>
        p.dotCode === dotCode && p.variantId === variantId
          ? { ...p, selected: Math.max(0, Math.min(p.available, p.selected + change)) }
          : p
      )
    );
  };

  const handleAddToCart = () => {
    if (!activeProduct || !activeBranch) return;

    if (cart.length > 0 && cart[0].branchId !== activeBranch.branchId) {
      toast.error('You can only request from one branch at a time. Please clear your cart first.');
      return;
    }

    const itemsToAdd = dotPicks.filter((p) => p.selected > 0);
    const newCartItems: CartItem[] = itemsToAdd.map((item) => ({
      branchId: activeBranch.branchId,
      branchName: activeBranch.branchName,
      productId: activeProduct.id,
      productName: activeProduct.name,
      specification: item.sizeSpec,
      dotCode: item.dotCode,
      quantity: item.selected,
      variantId: item.variantId,
      maxQty: item.available,
    }));

    setCart((prev) => {
      const other = prev.filter((it) => it.branchId !== activeBranch.branchId);
      const same = prev.filter((it) => it.branchId === activeBranch.branchId);
      newCartItems.forEach((ni) => {
        const idx = same.findIndex((x) => x.dotCode === ni.dotCode && x.variantId === ni.variantId);
        if (idx > -1) same[idx] = ni;
        else same.push(ni);
      });
      return [...other, ...same].filter((it) => it.quantity > 0);
    });

    toast.success(`${itemsToAdd.length > 0 ? 'Cart updated' : 'Selection cleared'} for ${activeBranch.branchName}.`);
    setIsDialogOpen(false);
    setIsCartOpen(true);
  };

  const removeFromCart = (dotCode: string, variantId: string, branchId: string) => {
    setCart((c) => c.filter((it) => !(it.dotCode === dotCode && it.variantId === variantId && it.branchId === branchId)));
  };

  const cartCount = useMemo(() => cart.reduce((s, it) => s + it.quantity, 0), [cart]);
  const cartSourceBranchName = useMemo(() => (cart.length ? cart[0].branchName : 'your cart'), [cart]);

  const handleSubmitOrder = async () => {
    if (!cart.length) return;
    setIsSubmitting(true);
    try {
      const sellerBranchId = cart[0].branchId;
      const sellerBranchName = cart[0].branchName;
      await OrderService.createOrder({
        buyerBranchId: myBranchId,
        buyerBranchName: myBranchName,
        sellerBranchId,
        sellerBranchName,
        items: cart.map(({ branchId, branchName, maxQty, ...item }) => item),
        notes,
      });
      toast.success(`Transfer request sent to ${sellerBranchName}!`);
      setCart([]);
      setNotes('');
      setIsCartOpen(false);
      qc.invalidateQueries({ queryKey: ['orders', myBranchId, 'buyer'] });
    } catch (e: any) {
      console.error(e);
      toast.error(`Failed to send request: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ------- Export -------
  const exportCSV = () => {
    const header = ['Product', 'Brand', 'Model', 'Specification', 'Source Branch', 'Available', 'Distance(km)', 'Min Price', 'Max Price'];
    const rowsAsText = rows.map((r) =>
      [r.productName, r.brand, r.model ?? '', r.spec, r.branchName, r.available, r.distance, r.minPrice, r.maxPrice]
        .map((x) => `"${String(x).replace(/\"/g, '\"\"')}"`)
        .join(',')
    );
    const csvText = [header.join(','), ...rowsAsText].join('\\n');
    const BOM = '\\uFEFF';
    const blob = new Blob([BOM + csvText], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transfer_report_${new Date().toISOString().slice(0, 19)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  // ------- Table Setup -------
  const columns: ColumnDef<TPRow>[] = [
    {
      id: 'expand',
      header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setExpandedRow(expandedRow === row.original.key ? null : row.original.key)}>
          {expandedRow === row.original.key ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      ),
      size: 40,
    },
    {
      accessorKey: 'productName',
      header: 'Product',
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{row.original.productName}</div>
          <div className="text-sm text-muted-foreground truncate">{row.original.brand} {row.original.model}</div>
        </div>
      ),
      size: 200,
    },
    {
      accessorKey: 'branchName',
      header: 'Source Branch',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{row.original.branchName}</span>
        </div>
      ),
      size: 160,
    },
    {
      accessorKey: 'available',
      header: 'Available',
      cell: ({ row }) => (
        <div className="text-center">
          <span
            className={cn(
              'font-medium',
              row.original.available === 0 ? 'text-red-600' : row.original.available < 6 ? 'text-amber-600' : 'text-green-600'
            )}
          >
            {row.original.available}
          </span>
        </div>
      ),
      size: 80,
    },
    {
      accessorKey: 'distance',
      header: 'Distance',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          {row.original.distance}km
        </div>
      ),
      size: 80,
    },
    {
      accessorKey: 'minPrice',
      header: 'Price Range',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.minPrice === row.original.maxPrice ? (
            <span className="font-medium">{formatTHB(row.original.minPrice)}</span>
          ) : (
            <span>
              {formatTHB(row.original.minPrice)} - {formatTHB(row.original.maxPrice)}
            </span>
          )}
          {row.original.hasPromo && <Badge variant="secondary" className="ml-1 text-xs">Sale</Badge>}
        </div>
      ),
      size: 120,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button size="sm" onClick={() => openDotPicker(row.original.grouped, row.original.branchNode)} disabled={row.original.available === 0}>
          <Plus className="h-4 w-4 mr-1" />
          Request
        </Button>
      ),
      size: 100,
    },
  ];

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows: tableRows } = table.getRowModel();

  // --- Dynamic row heights for expanded content
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 60,
    overscan: 10,
    measureElement: (el) => (el ? el.getBoundingClientRect().height : 60),
  });

  // UI components
  const HeaderBar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Transfer Platform</h1>
          <Sparkles className="h-5 w-5 text-amber-500" />
        </div>
        <p className="text-muted-foreground">
          ค้นหาและขอสินค้าจากสาขาอื่น • {lastUpdated ? <span className="text-xs">อัปเดต {lastUpdated.toLocaleTimeString()}</span> : null}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList>
              <TabsTrigger value="grid" className="gap-1"><LayoutGrid className="h-4 w-4" /> Cards</TabsTrigger>
              <TabsTrigger value="table" className="gap-1"><TableIcon className="h-4 w-4" /> Table</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Button variant="outline" size="sm" onClick={() => invQuery.refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button size="sm" onClick={() => setIsCartOpen(true)}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Cart ({cartCount})
        </Button>
      </div>
    </div>
  );

  const KpiBar = (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[
        { title: 'Available Products', value: kpis.products },
        { title: 'Units in Stock', value: kpis.units },
        { title: 'Low Stock Items', value: kpis.low },
        { title: 'Active Branches', value: kpis.branches },
        { title: 'Avg Price', value: formatTHB(kpis.avgPrice) },
      ].map((k, i) => (
        <motion.div key={k.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card className="rounded-2xl shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{k.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{k.value}</CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );

  const FilterBar = (
    <div className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-background/80 bg-background/95 border-b">
      <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
        <div className="w-full space-y-4">
          {/* Search + Sort + View */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search products, brands, or stores..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <div className="sm:hidden">
              <Button variant="outline" size="icon" onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')} aria-label="Toggle view">
                {viewMode === 'grid' ? <TableIcon className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              </Button>
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Most Relevant</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="distance">Nearest First</SelectItem>
                <SelectItem value="brand">Brand A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Brands">All Brands</SelectItem>
                {availableBrands.map((brand) => (
                  <SelectItem key={brand} value={brand}>
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSize} onValueChange={setSelectedSize}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Sizes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Sizes">All Sizes</SelectItem>
                {availableSizes.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {activeBranchIds
                  .filter((id) => String(id) !== String(myBranchId))
                  .map((id) => (
                    <SelectItem key={id} value={id}>
                      {stores[id] ?? id}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch checked={inStockOnly} onCheckedChange={(v) => setInStockOnly(Boolean(v))} />
              <Label>In Stock Only</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={lowStockOnly} onCheckedChange={(v) => setLowStockOnly(Boolean(v))} />
              <Label>Low Stock (&lt; 6)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={hasPromotion} onCheckedChange={(v) => setHasPromotion(Boolean(v))} />
              <Label>On Sale</Label>
            </div>
            
            {/* --- NEW: Clear Filters Button --- */}
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ---- Card View (mobile-first)
  const GridCard = ({ r }: { r: TPRow }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="group relative rounded-2xl border bg-white shadow-sm overflow-hidden"
    >
      <div className="absolute right-3 top-3 z-10">
        {r.hasPromo ? <Badge className="bg-green-600 hover:bg-green-600 text-white">Sale</Badge> : null}
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground truncate">{r.brand}{r.model ? ` • ${r.model}` : ''}</div>
            <h3 className="font-semibold leading-tight truncate">{r.productName}</h3>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border p-2 text-center">
            <div className={cn(
              'text-lg font-bold',
              r.available === 0 ? 'text-red-600' : r.available < 6 ? 'text-amber-600' : 'text-green-600'
            )}>{r.available}</div>
            <div className="text-muted-foreground">units</div>
          </div>
          <div className="rounded-lg border p-2 text-center">
            <div className="flex items-center justify-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-lg font-bold">{r.distance}</span>
            </div>
            <div className="text-muted-foreground">km</div>
          </div>
          <div className="rounded-lg border p-2 text-center">
            <div className="text-sm font-semibold">{formatTHB(r.minPrice)}</div>
            <div className="text-muted-foreground">from</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {r.dotChips.map((d, i) => (
            <Badge key={`${r.key}-${d.dotCode}-${i}`} variant="outline" className="font-mono">{d.dotCode} · {d.qty}</Badge>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="truncate max-w-[180px]">{r.branchName}</span>
          </div>
          <Button size="sm" onClick={() => openDotPicker(r.grouped, r.branchNode)} disabled={r.available === 0 || r.branchId === myBranchId}>
            <Plus className="h-4 w-4 mr-1" />
            Request
          </Button>
        </div>
      </div>
    </motion.div>
  );

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-background">
        <div className="w-full p-6 space-y-6 max-w-screen-xl mx-auto">
          {HeaderBar}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (<Skeleton key={i} className="h-48 w-full rounded-2xl" />))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Sticky Filters */}
      {FilterBar}

      <div className="w-full p-4 md:p-6 space-y-6 max-w-screen-xl mx-auto">
        {HeaderBar}
        {KpiBar}

        {/* Content */}
        {viewMode === 'grid' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {rows.length} items • {kpis.branches} branches
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {rows.filter((r) => r.hasPromo).length} on sale
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {rows.filter((r) => r.available < 6 && r.available > 0).length} low stock
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rows.map((r) => (<GridCard key={r.key} r={r} />))}
            </div>
          </div>
        ) : (
          <Card className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Available Inventory</CardTitle>
                  <CardDescription className="mt-1">
                    {rows.length} items found across {kpis.branches} branches • Click on rows to see details
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {rows.filter((r) => r.hasPromo).length} on sale
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {rows.filter((r) => r.available < 6 && r.available > 0).length} low stock
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-0">
                {/* Table Header */}
                <div className="grid gap-4 px-4 py-3 text-xs font-medium text-muted-foreground bg-muted/30 border-b sticky top-[57px] z-10">
                  <div style={{ gridTemplateColumns: '40px 1fr 160px 80px 80px 120px 100px' }} className="grid gap-4">
                    <div></div>
                    <div>Product & Details</div>
                    <div>Source Branch</div>
                    <div className="text-center">Available</div>
                    <div>Distance</div>
                    <div>Price Range</div>
                    <div>Actions</div>
                  </div>
                </div>

                {/* Virtualized Table Body */}
                <div ref={tableContainerRef} className="h-[640px] overflow-auto">
                  <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const row = tableRows[virtualRow.index];
                      const rowData = row.original;
                      const isExpanded = expandedRow === rowData.key;

                      return (
                        <div
                          key={virtualRow.key}
                          ref={virtualizer.measureElement}
                          data-index={virtualRow.index}
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                        >
                          <div className="border-b hover:bg-muted/20 transition-colors">
                            {/* Main Row */}
                            <div style={{ gridTemplateColumns: '40px 1fr 160px 80px 80px 120px 100px' }} className="grid gap-4 px-4 py-3 items-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedRow(isExpanded ? null : rowData.key)}
                                className="h-8 w-8 p-0"
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>

                              <div className="min-w-0">
                                <div className="font-medium truncate">{rowData.productName}</div>
                                <div className="text-sm text-muted-foreground truncate">
                                  {rowData.brand} {rowData.model && `• ${rowData.model}`}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {rowData.spec} • {rowData.dotsAll.length} variants
                                  {rowData.hasPromo && (
                                    <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-800">
                                      On Sale
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <div className="min-w-0">
                                  <div className="font-medium text-sm truncate">{rowData.branchName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {rowData.branchId === myBranchId ? 'Your Branch' : 'Source'}
                                  </div>
                                </div>
                              </div>

                              <div className="text-center">
                                <div className={cn(
                                  'text-lg font-bold',
                                  rowData.available === 0 ? 'text-red-600' : rowData.available < 6 ? 'text-amber-600' : 'text-green-600'
                                )}>
                                  {rowData.available}
                                </div>
                                <div className="text-xs text-muted-foreground">units</div>
                              </div>

                              <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-sm">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium">{rowData.distance}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">km</div>
                              </div>

                              <div className="text-center">
                                {rowData.minPrice === rowData.maxPrice ? (
                                  <div className="font-semibold text-sm">{formatTHB(rowData.minPrice)}</div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">
                                      {formatTHB(rowData.minPrice)} - {formatTHB(rowData.maxPrice)}
                                    </div>
                                  </div>
                                )}
                                {rowData.hasPromo && (
                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                    Sale
                                  </Badge>
                                )}
                              </div>

                              <Button
                                size="sm"
                                onClick={() => openDotPicker(rowData.grouped, rowData.branchNode)}
                                disabled={rowData.available === 0 || rowData.branchId === myBranchId}
                                title={rowData.branchId === myBranchId ? 'Cannot request from your own branch' : 'Request items'}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Request
                              </Button>
                            </div>

                            {/* Expanded Details */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 py-3 bg-muted/20 border-t">
                                    <div className="space-y-4">
                                      {/* Quick Stats */}
                                      <div className="grid grid-cols-3 gap-4">
                                        <div className="text-center p-3 bg-white rounded-lg border">
                                          <div className="text-lg font-bold text-blue-600">{rowData.dotsAll.length}</div>
                                          <div className="text-xs text-muted-foreground">DOT Variants</div>
                                        </div>
                                        <div className="text-center p-3 bg-white rounded-lg border">
                                          <div className="text-lg font-bold text-green-600">{rowData.available}</div>
                                          <div className="text-xs text-muted-foreground">Total Units</div>
                                        </div>
                                        <div className="text-center p-3 bg-white rounded-lg border">
                                          <div className="text-lg font-bold text-purple-600">{formatTHB(rowData.minPrice)}</div>
                                          <div className="text-xs text-muted-foreground">Starting Price</div>
                                        </div>
                                      </div>

                                      {/* DOT Details */}
                                      <div>
                                        <h4 className="font-medium mb-3 text-sm">Available DOT Codes</h4>
                                        <div className="grid gap-2 max-h-48 overflow-y-auto">
                                          {rowData.dotsAll.map((dot, idx) => (
                                            <div key={`${dot.dotCode}-${idx}`} className="flex items-center justify-between p-2 bg-white rounded border hover:border-blue-200 transition-colors">
                                              <div className="flex items-center gap-3">
                                                <Badge variant="outline" className="font-mono text-xs">{dot.dotCode}</Badge>
                                                <span className="text-sm text-muted-foreground">{dot.spec}</span>
                                                {dot.hasPromo && (
                                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">Sale</Badge>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium">{dot.qty} units</span>
                                                <div className="text-right">
                                                  <div className={cn('text-sm font-medium', dot.hasPromo ? 'text-green-600' : undefined)}>{formatTHB(dot.price)}</div>
                                                  {dot.hasPromo && dot.basePrice !== dot.price && (
                                                    <div className="text-xs text-muted-foreground line-through">{formatTHB(dot.basePrice)}</div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Action Button */}
                                      <div className="pt-2 border-t">
                                        <Button className="w-full" onClick={() => openDotPicker(rowData.grouped, rowData.branchNode)} disabled={rowData.available === 0 || rowData.branchId === myBranchId}>
                                          <Plus className="h-4 w-4 mr-2" />
                                          {rowData.branchId === myBranchId ? 'Cannot request from own branch' : 'Request Transfer'}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mobile Cart FAB */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-4 left-0 right-0 z-30 flex justify-center sm:hidden"
          >
            <Button onClick={() => setIsCartOpen(true)} className="rounded-full shadow-lg px-6 py-6">
              <ShoppingCart className="h-4 w-4 mr-2" />
              View Cart ({cartCount} items)
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dot Picker Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Quantities</DialogTitle>
            <DialogDescription>{activeProduct?.name} from {activeBranch?.branchName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {dotPicks.map((pick) => (
              <div key={`${pick.dotCode}_${pick.variantId}`} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{pick.dotCode}</Badge>
                    <span className="text-sm">{pick.sizeSpec}</span>
                    {pick.hasPromo && <Badge variant="secondary" className="text-xs">Sale</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Available: {pick.available} units • {formatTHB(pick.price)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handlePickChange(pick.dotCode, pick.variantId, -1)} disabled={pick.selected === 0}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center">{pick.selected}</span>
                  <Button variant="outline" size="sm" onClick={() => handlePickChange(pick.dotCode, pick.variantId, 1)} disabled={pick.selected >= pick.available}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddToCart}>Add to Cart</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cart Sheet */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Transfer Request</SheetTitle>
            <p className="text-sm text-muted-foreground">Requesting from {cartSourceBranchName}</p>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {cart.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">Your cart is empty</div>
            ) : (
              <>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={`${item.dotCode}_${item.variantId}_${item.branchId}`} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.productName}</div>
                        <div className="text-sm text-muted-foreground">{item.specification} • {item.dotCode}</div>
                        <div className="text-sm font-semibold">Quantity: {item.quantity}</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => removeFromCart(item.dotCode, item.variantId, item.branchId)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between font-medium">
                    <span>Total Items</span>
                    <span>{cartCount}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea id="notes" placeholder="Add any special requests or notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCart([])} className="flex-1">
                    Clear Cart
                  </Button>
                  <Button onClick={handleSubmitOrder} disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Truck className="h-4 w-4 mr-2" />
                        Send Request
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}