'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
  Building2,
  Info,
  Truck,
  Download,
  RefreshCw,
  ShoppingCart,
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
  flexRender,
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
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

// services & types
import { InventoryService, StoreService } from '@/lib/services/InventoryService';
import { OrderService } from '@/lib/services/OrderService';
import type { GroupedProduct } from '@/types/inventory';

// ===== Local fallback types (กันคอมไพล์แตกถ้าโปรเจกต์ไม่มี type เดียวกัน) =====
type OrderItem = {
  productId: string;
  productName: string;
  specification: string;
  dotCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantId: string;
};
type Order = {
  id: string;
  orderNumber?: string;
  buyerBranchId: string;
  buyerBranchName: string;
  sellerBranchId: string;
  sellerBranchName: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'requested' | 'confirmed' | 'cancelled' | 'fulfilled';
  createdAt?: { seconds?: number };
};

// ---------- Helpers ----------
function seededRand(seed: string, min: number, max: number) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++)
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
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
}
interface CartItem extends OrderItem {
  branchName: string;
  branchId: string;
  maxQty: number;
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
  dotsAll: {
    dotCode: string;
    qty: number;
    price: number;
    spec: string;
    variantId: string;
  }[];
  dotChips: { dotCode: string; qty: number; price: number }[];
  grouped: GroupedProduct;
  branchNode: any;
  hasPromo: boolean;
};

// ---------- Component ----------
export default function TransferPlatformView({
  myBranchId,
  myBranchName,
}: {
  myBranchId: string;
  myBranchName: string;
}) {
  const qc = useQueryClient();

  // UI state
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() =>
    typeof window !== 'undefined'
      ? ((localStorage.getItem('tp:view') as any) || 'table')
      : 'table'
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
  const [sortBy, setSortBy] = useState<
    'relevance' | 'price-low' | 'price-high' | 'rating' | 'popular' | 'distance' | 'brand'
  >('relevance');
  const [selectedSize, setSelectedSize] = useState<string>('All Sizes');
  const [hasPromotion, setHasPromotion] = useState<boolean>(false);

  // Dot picker & cart
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<GroupedProduct | null>(
    null
  );
  const [activeBranch, setActiveBranch] = useState<any>(null);
  const [dotPicks, setDotPicks] = useState<DotPick[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  // Column visibility & sorting
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('tp:sort');
      return raw ? (JSON.parse(raw) as SortingState) : [{ id: 'available', desc: true }];
    } catch {
      return [{ id: 'available', desc: true }];
    }
  });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => {
      if (typeof window === 'undefined') return {};
      try {
        const raw = localStorage.getItem('tp:cols');
        return raw ? (JSON.parse(raw) as VisibilityState) : { distance: true, price: true };
      } catch {
        return { distance: true, price: true };
      }
    }
  );

  useEffect(() => {
    localStorage.setItem('tp:view', viewMode);
  }, [viewMode]);
  useEffect(() => {
    localStorage.setItem('tp:sort', JSON.stringify(sorting));
    if (typeof window !== 'undefined' && sorting[0]) {
      const s = sorting[0];
      const url = new URL(window.location.href);
      url.searchParams.set('sort', String(s.id));
      url.searchParams.set('dir', s.desc ? 'desc' : 'asc');
      window.history.replaceState({}, '', url.toString());
    }
  }, [sorting]);
  useEffect(
    () => localStorage.setItem('tp:cols', JSON.stringify(columnVisibility)),
    [columnVisibility]
  );

  // ------- Data fetching (React Query) -------
  const invQuery = useQuery<{ inv: GroupedProduct[]; stores: Record<string, string> }>({
    queryKey: ['inventory', 'all'],
    queryFn: async () => {
      const [inv, storeMap] = await Promise.all([
        InventoryService.fetchInventory(),
        StoreService.getAllStores(),
      ]);
      return { inv: inv ?? [], stores: storeMap ?? {} };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (invQuery.isFetched) setLastUpdated(new Date());
  }, [invQuery.data, invQuery.isFetched]);

  const ordersQuery = useQuery<Order[]>({
    queryKey: ['orders', myBranchId, 'buyer'],
    queryFn: () => OrderService.getOrdersByBranch(myBranchId, 'buyer'),
    refetchInterval: 15_000,
    enabled: Boolean(myBranchId),
  });

  const isLoading = invQuery.isLoading || invQuery.isRefetching;
  const inventory = (invQuery.data?.inv ?? []) as GroupedProduct[];
  const stores = (invQuery.data?.stores ?? {}) as Record<string, string>;

  const availableBrands = useMemo(
    () => Array.from(new Set(inventory.map((i) => i.brand ?? 'Unknown'))).sort(),
    [inventory]
  );

  const activeBranchIds = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((p) =>
      (p.branches ?? []).forEach((b: any) => set.add(String(b.branchId)))
    );
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
      const branchesToShow =
        selectedStore === 'all'
          ? branchesAll
          : branchesAll.filter(
              (b: any) => String(b.branchId) === String(selectedStore)
            );

      for (const b of branchesToShow as any[]) {
        const sizes = b.sizes ?? [];
        const allDots: TPRow['dotsAll'] = [];
        let totalUnits = 0;
        let highlightSpec = 'N/A';
        let highlightQty = -1;
        let hasPromoAny = false;

        for (const s of sizes as any[]) {
          const dots = (s.dots ?? []) as any[];
          const specQty = dots.reduce(
            (sum: number, d: any) => sum + Number(d.qty ?? 0),
            0
          );
          if (specQty > highlightQty) {
            highlightQty = specQty;
            highlightSpec = s.specification ?? 'N/A';
          }
          for (const d of dots) {
            const price = Number(d.promoPrice ?? d.basePrice ?? 0);
            const qty = Number(d.qty ?? 0);
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
        if (lowStockOnly && !(totalUnits > 0 && totalUnits < 6)) continue;

        allDots.sort((a, b) => b.qty - a.qty || a.price - b.price);
        const minPrice = allDots.length
          ? Math.min(...allDots.map((d) => d.price))
          : 0;

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
          dotsAll: allDots,
          dotChips: allDots.slice(0, 3),
          grouped: p,
          branchNode: b,
          hasPromo: hasPromoAny,
        });
      }
    }

    const q = debouncedSearch.trim().toLowerCase();

    const filtered = out
      .filter((r) => (selectedBrand === 'All Brands' ? true : r.brand === selectedBrand))
      .filter((r) =>
        selectedSize === 'All Sizes'
          ? true
          : r.dotsAll.some((d) => d.spec === selectedSize)
      )
      .filter((r) =>
        !q
          ? true
          : `${r.productName} ${r.brand} ${r.model} ${r.spec} ${r.branchName}`
              .toLowerCase()
              .includes(q)
      )
      .filter((r) => (hasPromotion ? r.hasPromo : true));

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return (a.minPrice || Infinity) - (b.minPrice || Infinity);
        case 'price-high':
          return (b.minPrice || 0) - (a.minPrice || 0);
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
    const avgPrice = rows.length
      ? Math.round(rows.reduce((s, r) => s + r.minPrice, 0) / rows.length)
      : 0;
    return { products, units, low, branches, avgPrice };
  }, [rows]);

  // ------- Dot Picker & Cart -------
  const openDotPicker = (product: GroupedProduct, branch: any) => {
    setActiveProduct(product);
    setActiveBranch(branch);

    const picks: DotPick[] = (branch.sizes ?? [])
      .flatMap((size: any) =>
        (size.dots ?? []).map((dot: any) => {
          const cartItem = cart.find(
            (c) =>
              c.dotCode === dot.dotCode &&
              c.branchId === branch.branchId &&
              c.variantId === String(size.variantId ?? '')
          );
          const available = Number(dot.qty ?? 0);
          const price = Number(dot.promoPrice ?? dot.basePrice ?? 0);
          return {
            sizeSpec: size.specification ?? 'N/A',
            variantId: String(size.variantId ?? ''),
            dotCode: dot.dotCode ?? '',
            available,
            price,
            selected: cartItem ? cartItem.quantity : 0,
          };
        })
      )
      .filter((p: DotPick) => p.available > 0);

    setDotPicks(picks);
    setIsDialogOpen(true);
  };

  const handlePickChange = (dotCode: string, change: number) => {
    setDotPicks((picks) =>
      picks.map((p) =>
        p.dotCode === dotCode
          ? { ...p, selected: Math.max(0, Math.min(p.available, p.selected + change)) }
          : p
      )
    );
  };

  const handleAddToCart = () => {
    if (!activeProduct || !activeBranch) return;

    if (cart.length > 0 && cart[0].branchId !== activeBranch.branchId) {
      toast.error(
        'You can only request from one branch at a time. Please clear your cart first.'
      );
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
      unitPrice: item.price,
      totalPrice: item.price * item.selected,
      variantId: item.variantId,
      maxQty: item.available,
    }));

    setCart((prev) => {
      const other = prev.filter((it) => it.branchId !== activeBranch.branchId);
      const same = prev.filter((it) => it.branchId === activeBranch.branchId);
      newCartItems.forEach((ni) => {
        const idx = same.findIndex(
          (x) => x.dotCode === ni.dotCode && x.variantId === ni.variantId
        );
        if (idx > -1) same[idx] = ni;
        else same.push(ni);
      });
      return [...other, ...same].filter((it) => it.quantity > 0);
    });

    toast.success(
      `${itemsToAdd.length > 0 ? 'Cart updated' : 'Selection cleared'} for ${
        activeBranch.branchName
      }.`
    );
    setIsDialogOpen(false);
    setIsCartOpen(true);
  };

  const removeFromCart = (dotCode: string, branchId: string) => {
    setCart((c) =>
      c.filter((it) => !(it.dotCode === dotCode && it.branchId === branchId))
    );
  };
  const cartCount = useMemo(
    () => cart.reduce((s, it) => s + it.quantity, 0),
    [cart]
  );
  const cartTotal = useMemo(
    () => cart.reduce((s, it) => s + it.totalPrice, 0),
    [cart]
  );
  const cartSourceBranchName = useMemo(
    () => (cart.length ? cart[0].branchName : 'your cart'),
    [cart]
  );

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
        totalAmount: cartTotal,
        status: 'requested',
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
    const header = [
      'Product',
      'Brand',
      'Model',
      'Specification',
      'Source Branch',
      'Available',
      'Distance(km)',
      'Min Price',
    ];
    const rowsAsText = rows.map((r) =>
      [
        r.productName,
        r.brand,
        r.model ?? '',
        r.spec,
        r.branchName,
        r.available,
        r.distance,
        r.minPrice,
      ]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvText = [header.join(','), ...rowsAsText].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvText], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transfer_report_${new Date().toISOString().slice(0, 19)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  // ------- Table Columns -------
  const columns = useMemo<ColumnDef<TPRow>[]>(
    () => [
      {
        id: 'product',
        header: () => <div className="pl-1">Product</div>,
        accessorFn: (row) => row.productName,
        cell: ({ row }) => {
          const r = row.original as TPRow;
          const isExpanded = expandedRow === r.key;
          const chipsTotalShown = r.dotChips.reduce((s, c) => s + c.qty, 0);
          return (
            <div className="flex items-start gap-2">
              <button
                className="mt-0.5 rounded-md hover:bg-muted p-1"
                onClick={() =>
                  setExpandedRow((prev) => (prev === r.key ? null : r.key))
                }
                aria-label="Expand row"
                title="Show DOT details"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              <div>
                <div className="font-medium">{r.productName}</div>
                <div className="text-xs text-muted-foreground">{r.spec}</div>
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
                    {r.available > chipsTotalShown && (
                      <button
                        className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-muted"
                        onClick={() => openDotPicker(r.grouped, r.branchNode)}
                        title="View all DOTs"
                      >
                        +{r.available - chipsTotalShown} more
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        },
        sortingFn: (a, b) =>
          a.original.productName.localeCompare(b.original.productName),
        size: 420,
      },
      {
        id: 'branch',
        header: () => <div>Source Branch</div>,
        accessorFn: (row) => row.branchName,
        cell: ({ row }) => {
          const r = row.original as TPRow;
          return (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <div>
                <div className="font-medium text-sm">{r.branchName}</div>
                <div className="text-xs text-muted-foreground">
                  {r.branchId === myBranchId ? 'Your Branch' : 'Source'}
                </div>
              </div>
            </div>
          );
        },
        sortingFn: (a, b) =>
          a.original.branchName.localeCompare(b.original.branchName),
        size: 260,
      },
      {
        id: 'available',
        header: () => <div className="text-right">Available</div>,
        accessorFn: (row) => row.available,
        cell: ({ row }) => {
          const r = row.original as TPRow;
          const variant = r.available < 6 ? 'destructive' : 'secondary';
          return (
            <div className="text-right">
              <Badge variant={variant as any}>{r.available} units</Badge>
            </div>
          );
        },
        sortingFn: (a, b) => a.original.available - b.original.available,
        size: 110,
      },
      {
        id: 'distance',
        header: () => <div className="text-right">Distance</div>,
        accessorFn: (row) => row.distance,
        cell: ({ row }) => (
          <div className="text-right">{row.original.distance} km</div>
        ),
        sortingFn: (a, b) => a.original.distance - b.original.distance,
        size: 100,
      },
      {
        id: 'price',
        header: () => <div className="text-right">Price</div>,
        accessorFn: (row) => row.minPrice,
        cell: ({ row }) => (
          <div className="text-right">
            {row.original.minPrice > 0
              ? formatTHB(row.original.minPrice)
              : '—'}
          </div>
        ),
        sortingFn: (a, b) => a.original.minPrice - b.original.minPrice,
        size: 120,
      },
      {
        id: 'actions',
        header: () => <div className="text-right" />,
        cell: ({ row }) => {
          const r = row.original as TPRow;
          return (
            <div className="text-right">
              <Button
                size="sm"
                onClick={() => openDotPicker(r.grouped, r.branchNode)}
                disabled={r.branchId === myBranchId || r.available === 0}
                title={
                  r.branchId === myBranchId
                    ? 'Cannot transfer from your own branch'
                    : 'Request'
                }
              >
                Request
              </Button>
            </div>
          );
        },
        size: 120,
        enableSorting: false,
      },
    ],
    [expandedRow, myBranchId]
  );

  const table = useReactTable<TPRow>({
    data: rows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
  });

  // ------- Virtualizer (table body) -------
  const parentRef = useRef<HTMLDivElement | null>(null);
  const useVirtual = rows.length > 150;
  const rowVirtualizer = useVirtual
    ? useVirtualizer({
        count: table.getRowModel().rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 68,
        overscan: 12,
      })
    : null;

  // ------- UI sections -------
  const HeaderBar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">Transfer Platform</h1>
        <p className="text-muted-foreground">
          Search and request tyres from other branches.
          {lastUpdated ? (
            <span className="ml-2 text-xs">
              (updated {lastUpdated.toLocaleTimeString()})
            </span>
          ) : null}
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
        <Button size="sm" onClick={() => setIsCartOpen(true)}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Cart ({cartCount})
        </Button>
      </div>
    </div>
  );

  const KpiBar = (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      <Card className="rounded-xl shadow-sm border-emerald-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Available Products</CardTitle>
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
          <CardTitle className="text-sm">Low Stock Items</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{kpis.low}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-purple-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Active Branches</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{kpis.branches}</CardContent>
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
        {/* Search and Sort */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products, brands, or stores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-48">
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
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger className="w-36">
              <SelectValue />
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
              <SelectValue />
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
              <SelectValue />
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
            <Switch
              checked={inStockOnly}
              onCheckedChange={(v) => setInStockOnly(Boolean(v))}
            />
            <Label>In Stock Only</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={lowStockOnly}
              onCheckedChange={(v) => setLowStockOnly(Boolean(v))}
            />
            <Label>Low Stock (&lt; 6)</Label>
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

  const GRID_COLS =
    'minmax(420px,1.2fr) minmax(240px,0.7fr) 100px 100px 120px 120px';

  // ------- Table Header / Body -------
  const TableHeader = (
    <div
      className="grid gap-4 px-4 py-3 text-xs text-muted-foreground min-w-[980px] bg-slate-50/70 border-b"
      style={{ gridTemplateColumns: GRID_COLS }}
    >
      {table.getHeaderGroups().map((hg) => (
        <React.Fragment key={hg.id}>
          {hg.headers.map((h) => (
            <div
              key={h.id}
              className={`flex items-center ${
                h.column.getCanSort() ? 'cursor-pointer select-none' : ''
              }`}
              onClick={h.column.getToggleSortingHandler()}
            >
              <div className="flex items-center gap-1">
                {flexRender(h.column.columnDef.header, h.getContext())}
                {h.column.getCanSort() && (
                  <span className="text-muted-foreground/70">
                    {
                      ({
                        asc: '↑',
                        desc: '↓',
                      } as any)[h.column.getIsSorted() as any] ?? '↕'
                    }
                  </span>
                )}
              </div>
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );

  const ExpandedRow = ({ r }: { r: TPRow }) => (
    <div className="bg-slate-50 rounded-lg px-4 py-3 mt-3">
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
        <Info className="h-3.5 w-3.5" /> DOT details for {r.productName} @{' '}
        {r.branchName}
      </div>
      <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground pb-1">
        <div className="col-span-4">DOT</div>
        <div className="col-span-3">Specification</div>
        <div className="col-span-2 text-right">Qty</div>
        <div className="col-span-2 text-right">Price</div>
        <div className="col-span-1" />
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
          <div className="col-span-1 text-right">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openDotPicker(r.grouped, r.branchNode)}
              disabled={r.branchId === myBranchId || d.qty === 0}
              title={
                r.branchId === myBranchId
                  ? 'Cannot transfer from your own branch'
                  : 'Select'
              }
            >
              Select
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  const TableBody = (
    <div className="border-t">
      {useVirtual ? (
        <div ref={parentRef} className="max-h-[70vh] overflow-auto">
          <div
            style={{ height: rowVirtualizer!.getTotalSize() }}
            className="relative"
          >
            {rowVirtualizer!.getVirtualItems().map((vi) => {
              const r = table.getRowModel().rows[vi.index];
              return (
                <div
                  key={r.id}
                  ref={rowVirtualizer ? rowVirtualizer.measureElement : undefined}
                  data-index={vi.index}
                  className="absolute left-0 right-0 border-b px-5 py-4 hover:bg-slate-50/60 transition-colors"
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  <div
                    className="grid gap-4 items-start min-w-[980px]"
                    style={{ gridTemplateColumns: GRID_COLS }}
                  >
                    {r.getVisibleCells().map((cell) => (
                      <div key={cell.id} className="min-h-[28px]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                  </div>
                  <AnimatePresence initial={false}>
                    {expandedRow === (r.original as TPRow).key && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <ExpandedRow r={r.original as TPRow} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          {table.getRowModel().rows.map((r) => (
            <div
              key={r.id}
              className="border-b px-5 py-4 hover:bg-slate-50/60 transition-colors"
            >
              <div
                className="grid gap-4 items-start min-w-[980px]"
                style={{ gridTemplateColumns: GRID_COLS }}
              >
                {r.getVisibleCells().map((cell) => (
                  <div key={cell.id} className="min-h-[28px]">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
              <AnimatePresence initial={false}>
                {expandedRow === (r.original as TPRow).key && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <ExpandedRow r={r.original as TPRow} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ------- Grid View (cards) -------
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
                <div className="text-xs text-muted-foreground">{r.spec}</div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{r.branchName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.branchId === myBranchId ? 'Your Branch' : 'Source'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Truck className="h-4 w-4" />
                    <span>{r.distance} km</span>
                  </div>
                </div>
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
                    {r.available >
                      r.dotChips.reduce((s, c) => s + c.qty, 0) && (
                      <button
                        className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-muted"
                        onClick={() => openDotPicker(r.grouped, r.branchNode)}
                      >
                        +
                        {r.available -
                          r.dotChips.reduce((s, c) => s + c.qty, 0)}{' '}
                        more
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {r.minPrice > 0 ? formatTHB(r.minPrice) : '—'}
                  </div>
                  <Button
                    className="ml-2"
                    onClick={() => openDotPicker(r.grouped, r.branchNode)}
                    disabled={r.branchId === myBranchId || r.available === 0}
                  >
                    Request Transfer
                  </Button>
                </div>
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

  // ------- Recent Requests Panel -------
  const RecentRequests = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Recent Requests</CardTitle>
        <CardDescription>Last 10 requests you sent</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
          {ordersQuery.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))
          ) : (ordersQuery.data ?? []).length ? (
            (ordersQuery.data ?? [])
              .sort(
                (a: any, b: any) =>
                  (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
              )
              .slice(0, 10)
              .map((o: any) => (
                <div key={o.id} className="border rounded-md p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {o.orderNumber ?? o.id.slice(-6)}
                    </div>
                    <Badge
                      variant={
                        o.status === 'confirmed'
                          ? 'secondary'
                          : o.status === 'cancelled'
                          ? 'destructive'
                          : 'outline'
                      }
                    >
                      {o.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    To <span className="font-medium">{o.sellerBranchName}</span>{' '}
                    · {o.items?.length ?? 0} items · {formatTHB(o.totalAmount ?? 0)}
                  </div>
                </div>
              ))
          ) : (
            <div className="text-sm text-muted-foreground">
              No recent requests.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 md:space-y-8">
      {HeaderBar}

      {KpiBar}

      {FilterBar}

      <div className="rounded-xl border bg-white overflow-x-auto shadow-sm">
        {/* Table / Grid */}
        {viewMode === 'table' ? (
          <>
            {TableHeader}
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              TableBody
            )}
          </>
        ) : (
          <div className="p-4">{GridView}</div>
        )}
      </div>

      {/* Right column: recent requests */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2" />
        <div>{RecentRequests}</div>
      </div>

      {/* DOT Picker dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select DOTs to request</DialogTitle>
          </DialogHeader>
          {activeProduct && activeBranch ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {activeProduct.name} · From{' '}
                <span className="font-medium">{activeBranch.branchName}</span>
              </div>
              <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground pb-1">
                <div className="col-span-3">DOT</div>
                <div className="col-span-3">Spec</div>
                <div className="col-span-2 text-right">Available</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-2 text-right">Select</div>
              </div>
              <Separator />
              <div className="max-h-[50vh] overflow-auto pr-1">
                {dotPicks.map((p) => (
                  <div
                    key={`${p.variantId}-${p.dotCode}`}
                    className="grid grid-cols-12 items-center py-2 border-b last:border-b-0"
                  >
                    <div className="col-span-3 font-mono">{p.dotCode}</div>
                    <div className="col-span-3">{p.sizeSpec}</div>
                    <div className="col-span-2 text-right">{p.available}</div>
                    <div className="col-span-2 text-right">{formatTHB(p.price)}</div>
                    <div className="col-span-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePickChange(p.dotCode, -1)}
                          disabled={p.selected <= 0}
                        >
                          −
                        </Button>
                        <div className="w-8 text-center text-sm">{p.selected}</div>
                        <Button
                          size="sm"
                          onClick={() => handlePickChange(p.dotCode, +1)}
                          disabled={p.selected >= p.available}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {dotPicks.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No available DOTs.
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddToCart} disabled={!dotPicks.some((p) => p.selected > 0)}>
              Add to cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cart sheet */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent side="right" className="w-[420px] sm:w-[520px]">
          <SheetHeader>
            <SheetTitle>
              Cart {cart.length ? `· ${cartSourceBranchName}` : ''}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {!cart.length ? (
              <div className="text-sm text-muted-foreground">
                Your cart is empty.
              </div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">
                  {cartCount} items · Total {formatTHB(cartTotal)}
                </div>
                <div className="max-h-[55vh] overflow-auto pr-1 space-y-2">
                  {cart.map((it) => (
                    <div
                      key={`${it.variantId}-${it.dotCode}`}
                      className="border rounded-md p-2 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          {it.productName}{' '}
                          <span className="font-mono text-xs text-muted-foreground">
                            ({it.dotCode})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {it.specification}
                        </div>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <div className="text-xs">
                          Qty {it.quantity}/{it.maxQty}
                        </div>
                        <div className="text-xs">{formatTHB(it.totalPrice)}</div>
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeFromCart(it.dotCode, it.branchId)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Notes</Label>
                  <Input
                    placeholder="Add a note to the seller (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSubmitOrder}
                  disabled={isSubmitting || !cart.length}
                >
                  {isSubmitting ? 'Submitting…' : 'Send Transfer Request'}
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
