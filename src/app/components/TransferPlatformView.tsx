'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ShoppingCart,
  ChevronRight,
  ChevronDown,
  Building2,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

// services & types
import { InventoryService, OrderService, StoreService } from '@/lib/services/InventoryService';
import type { GroupedProduct, Order, OrderItem } from '@/types/inventory';

// shadcn/ui
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

// dialog (เวอร์ชัน Add-to-Cart)
import RequestTransferDialog from '@/src/app/components/RequestTransferDialog';

// ---------- Local types ----------
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

type Row = {
  key: string;
  productName: string;
  brand: string;
  model: string;
  spec: string; // highlight spec (มีจำนวนมากสุด)
  branchId: string;
  branchName: string;
  available: number;
  minPrice: number;
  dotsAll: { dotCode: string; qty: number; price: number; spec: string; variantId: string }[];
  dotChips: { dotCode: string; qty: number; price: number }[];
  grouped: GroupedProduct;
  branchNode: any;
  hasPromo: boolean;
};

// ---------- helpers ----------
const formatTHB = (n: number) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(Number(n) || 0);

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

// ---------- Component ----------
export default function TransferPlatformView({
  myBranchId,
  myBranchName,
}: {
  myBranchId: string;
  myBranchName: string;
}) {
  const qc = useQueryClient();

  // ----------------- UI State -----------------
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounced(searchTerm, 250);
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [selectedSize, setSelectedSize] = useState('All Sizes');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [hasPromotion, setHasPromotion] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'price-low' | 'price-high' | 'brand'>(
    'relevance'
  );

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  // Request dialog (Add to cart)
  const [reqOpen, setReqOpen] = useState(false);
  const [reqProduct, setReqProduct] = useState<GroupedProduct | null>(null);
  const [reqFromBranch, setReqFromBranch] = useState<{ id: string; name: string } | null>(null);

  const openRequestDialog = (product: GroupedProduct, branch: any) => {
    setReqProduct(product);
    setReqFromBranch({ id: String(branch.branchId), name: branch.branchName });
    setReqOpen(true);
  };

  const handleAddToCartFromDialog = (item: {
    branchId: string;
    branchName: string;
    productId: string;
    productName: string;
    specification: string;
    dotCode: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    variantId: string;
  }) => {
    // จำกัดให้ขอจากหนึ่งสาขาต่อครั้ง
    if (cart.length > 0 && cart[0].branchId !== item.branchId) {
      toast.error('You can only request from one branch at a time. Please clear your cart first or start a new one.');
      return;
    }
    setCart((prev) => {
      const other = prev.filter((x) => x.branchId !== item.branchId);
      const same = prev.filter((x) => x.branchId === item.branchId);

      const newItem: CartItem = {
        branchId: item.branchId,
        branchName: item.branchName,
        productId: item.productId,
        productName: item.productName,
        specification: item.specification,
        dotCode: item.dotCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        variantId: item.variantId,
        maxQty: Number.MAX_SAFE_INTEGER,
      };

      const idx = same.findIndex(
        (x) => x.dotCode === newItem.dotCode && x.variantId === newItem.variantId
      );
      if (idx > -1) same[idx] = newItem;
      else same.push(newItem);

      return [...other, ...same].filter((x) => x.quantity > 0);
    });

    // เปิด cart ให้เห็นรายการ
    setIsCartOpen(true);
    toast.success('Added to cart');
  };

  const removeFromCart = (dotCode: string, branchId: string) => {
    setCart((c) => c.filter((x) => !(x.dotCode === dotCode && x.branchId === branchId)));
  };

  const cartCount = useMemo(() => cart.reduce((s, it) => s + it.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((s, it) => s + it.totalPrice, 0), [cart]);
  const cartSourceBranchName = useMemo(() => (cart.length ? cart[0].branchName : 'your cart'), [cart]);

  // ----------------- Data -----------------
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

  const ordersQuery = useQuery<Order[]>({
    queryKey: ['orders', myBranchId, 'buyer'],
    queryFn: () => OrderService.getOrdersByBranch(myBranchId, 'buyer'),
    refetchInterval: 15_000,
    enabled: Boolean(myBranchId),
  });

  const loading = invQuery.isLoading || invQuery.isRefetching;
  const inventory = (invQuery.data?.inv ?? []) as GroupedProduct[];
  const stores = (invQuery.data?.stores ?? {}) as Record<string, string>;

  // --------- Derive filter options ---------
  const availableBrands = useMemo(
    () => Array.from(new Set(inventory.map((i) => i.brand ?? 'Unknown'))).sort(),
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

  const activeBranchIds = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((p) => (p.branches ?? []).forEach((b: any) => set.add(String(b.branchId))));
    return Array.from(set);
  }, [inventory]);

  // --------- Build rows ---------
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];

    for (const p of inventory) {
      const branchesAll = p.branches ?? [];
      const branchesToShow =
        selectedStore === 'all'
          ? branchesAll
          : branchesAll.filter((b: any) => String(b.branchId) === String(selectedStore));

      for (const b of branchesToShow as any[]) {
        const sizes = b.sizes ?? [];
        const allDots: { dotCode: string; qty: number; price: number; spec: string; variantId: string }[] = [];
        let totalUnits = 0;
        let highlightSpec = 'N/A';
        let highlightQty = -1;
        let hasPromoAny = false;

        for (const s of sizes as any[]) {
          const dots = (s.dots ?? []) as any[];
          const specQty = dots.reduce((sum: number, d: any) => sum + Number(d.qty ?? 0), 0);
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

        allDots.sort((a, b) => b.qty - a.qty || a.price - b.price);
        const minPrice = allDots.length ? Math.min(...allDots.map((d) => d.price)) : 0;

        out.push({
          key: `${p.id}__${b.branchId}`,
          productName: p.name,
          brand: p.brand,
          model: p.model,
          spec: highlightSpec,
          branchId: String(b.branchId),
          branchName: b.branchName,
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
      .filter((r) => (selectedSize === 'All Sizes' ? true : r.dotsAll.some((d) => d.spec === selectedSize)))
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
        case 'brand':
          return a.brand.localeCompare(b.brand);
        case 'relevance':
        default:
          return b.available - a.available; // มากก่อน
      }
    });

    return sorted;
  }, [
    inventory,
    selectedStore,
    inStockOnly,
    debouncedSearch,
    selectedBrand,
    selectedSize,
    hasPromotion,
    sortBy,
  ]);

  // --------- KPI (เล็กๆ) ---------
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

  // --------- Submit order from cart ---------
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

  // --------------------------------- UI blocks ---------------------------------
  const FilterBar = (
    <div className="border-b bg-muted/20 p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Search & Sort */}
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
            <Switch checked={inStockOnly} onCheckedChange={(v) => setInStockOnly(Boolean(v))} />
            <Label>In Stock Only</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={hasPromotion} onCheckedChange={(v) => setHasPromotion(Boolean(v))} />
            <Label>On Sale</Label>
          </div>

          {/* View toggle */}
          <div className="ml-auto inline-flex rounded-md border bg-background p-1">
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              onClick={() => setViewMode('table')}
            >
              Table
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const KPIBar = (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
      <Card className="rounded-xl shadow-sm border-purple-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Branches</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{kpis.branches}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-teal-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Avg Price</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{formatTHB(kpis.avgPrice)}</CardContent>
      </Card>
    </div>
  );

  // ---------- Table view ----------
  const TableView = (
    <div className="rounded-xl border bg-white overflow-x-auto shadow-sm">
      {/* header */}
      <div
        className="grid gap-4 px-4 py-3 text-xs text-muted-foreground min-w-[980px] bg-slate-50/70 border-b"
        style={{ gridTemplateColumns: 'minmax(420px,1.2fr) minmax(240px,0.8fr) 120px 120px 120px' }}
      >
        <div>Product</div>
        <div>Source Branch</div>
        <div className="text-right">Available</div>
        <div className="text-right">Price</div>
        <div />
      </div>

      {/* body */}
      {loading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground">
          No products found for the selected filters.
        </div>
      ) : (
        <div>
          {rows.map((r) => {
            const chipsShown = r.dotChips.reduce((s, c) => s + c.qty, 0);
            const isExpanded = expandedKey === r.key;
            return (
              <div key={r.key} className="border-b px-5 py-4 hover:bg-slate-50/60 transition-colors">
                <div
                  className="grid gap-4 items-start min-w-[980px]"
                  style={{
                    gridTemplateColumns:
                      'minmax(420px,1.2fr) minmax(240px,0.8fr) 120px 120px 120px',
                  }}
                >
                  {/* Product */}
                  <div className="flex items-start gap-2">
                    <button
                      className="mt-0.5 rounded-md hover:bg-muted p-1"
                      onClick={() => setExpandedKey((prev) => (prev === r.key ? null : r.key))}
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
                      {/* เอา size ใต้ชื่อออกตามที่คุยไว้ → ไม่แสดง */}
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
                            <button
                              className="text-[10px] px-2 py-0.5 rounded-full border hover:bg-muted"
                              onClick={() => openRequestDialog(r.grouped, r.branchNode)}
                              title="View & select more DOTs"
                            >
                              +{r.available - chipsShown} more
                            </button>
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
                      <div className="text-xs text-muted-foreground">
                        {r.branchId === myBranchId ? 'Your Branch' : 'Source'}
                      </div>
                    </div>
                  </div>

                  {/* Available */}
                  <div className="text-right">
                    <Badge variant={r.available < 6 ? 'destructive' : 'secondary'}>
                      {r.available} units
                    </Badge>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    {r.minPrice > 0 ? formatTHB(r.minPrice) : '—'}
                  </div>

                  {/* Actions */}
                  <div className="text-right">
                    <Button
                      size="sm"
                      onClick={() => openRequestDialog(r.grouped, r.branchNode)}
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
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="bg-slate-50 rounded-lg px-4 py-3 mt-3">
                    <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                      <Info className="h-3.5 w-3.5" />
                      DOT details for {r.productName} @ {r.branchName}
                    </div>
                    <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground pb-1">
                      <div className="col-span-4">DOT</div>
                      <div className="col-span-3">Specification</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Price</div>
                      <div className="col-span-1" />
                    </div>
                    <div className="border-t" />
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
                            onClick={() => openRequestDialog(r.grouped, r.branchNode)}
                            disabled={r.branchId === myBranchId || d.qty === 0}
                          >
                            Select
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ---------- Grid view ----------
  const GridView = (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {loading
        ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
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
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{r.branchName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.branchId === myBranchId ? 'Your Branch' : 'Source'}
                    </div>
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
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {r.minPrice > 0 ? formatTHB(r.minPrice) : '—'}
                  </div>
                  <Button
                    className="ml-2"
                    onClick={() => openRequestDialog(r.grouped, r.branchNode)}
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

  // ---------- Recent requests (สรุปสั้นๆ) ----------
  const RecentRequests = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Recent Requests</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
          {ordersQuery.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : (ordersQuery.data ?? []).length ? (
            (ordersQuery.data ?? [])
              .sort(
                (a: any, b: any) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
              )
              .map((o: any) => (
                <div key={o.id} className="border rounded-md p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{o.orderNumber ?? o.id}</div>
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
                    To <span className="font-medium">{o.sellerBranchName}</span> ·{' '}
                    {o.items?.length ?? 0} items · {formatTHB(o.totalAmount ?? 0)}
                  </div>
                </div>
              ))
          ) : (
            <div className="text-xs text-muted-foreground">No recent requests.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Transfer Platform</h1>
          <p className="text-muted-foreground">
            Request tire transfers from other branches in the network.
          </p>
        </div>

        {/* Cart button */}
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <Button variant="default" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Transfer Cart ({cartCount}) · {formatTHB(cartTotal)}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
            <SheetHeader>
              <SheetTitle>Transfer Cart</SheetTitle>
              {cart.length > 0 && (
                <SheetDescription>
                  Items will be requested from: <span className="font-semibold">{cartSourceBranchName}</span>
                </SheetDescription>
              )}
            </SheetHeader>

            <ScrollArea className="flex-1 -mx-6 mt-4">
              <div className="px-6 space-y-3">
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">Your cart is empty.</p>
                ) : (
                  cart.map((item) => (
                    <div
                      key={`${item.branchId}-${item.dotCode}-${item.variantId}`}
                      className="border p-3 rounded-md text-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">{item.specification}</p>
                          <p className="font-mono text-xs text-muted-foreground">DOT: {item.dotCode}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeFromCart(item.dotCode, item.branchId)}
                        >
                          ×
                        </Button>
                      </div>
                      <div className="flex justify-between items-end mt-2">
                        <span>Qty: {item.quantity}</span>
                        <span className="font-semibold">{formatTHB(item.totalPrice)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="px-6 py-4">
              <Label htmlFor="transfer-notes">Notes (Optional)</Label>
              <Textarea
                id="transfer-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                placeholder="Add any special instructions..."
              />
            </div>

            <SheetFooter>
              <div className="w-full space-y-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>{formatTHB(cartTotal)}</span>
                </div>
                <Button onClick={handleSubmitOrder} disabled={cart.length === 0 || isSubmitting} className="w-full">
                  {isSubmitting ? 'Submitting...' : 'Submit Transfer Request'}
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* KPI */}
      {KPIBar}

      {/* Filters */}
      {FilterBar}

      {/* Results + Recent requests (right column on wide screen) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {viewMode === 'table' ? TableView : GridView}
        </div>
        <div className="lg:col-span-1">{RecentRequests}</div>
      </div>

      {/* Request dialog (Add-to-Cart) */}
      <RequestTransferDialog
        open={reqOpen}
        onOpenChange={setReqOpen}
        product={reqProduct}
        fromBranchId={reqFromBranch?.id ?? ''}
        fromBranchName={reqFromBranch?.name ?? ''}
        myBranchId={myBranchId}
        myBranchName={myBranchName}
        onAddToCart={handleAddToCartFromDialog}
      />
    </div>
  );
}
