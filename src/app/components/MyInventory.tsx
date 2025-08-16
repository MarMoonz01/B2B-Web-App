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
  Settings,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Boxes,
  ArrowLeftRight,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  InventoryService,
  StoreService,
  type GroupedProduct,
} from '@/lib/services/InventoryService';

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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ----------------------------------------

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
  maxPrice: number;
  hasPromo: boolean;
  lowStock: boolean;
  dotChips: { dotCode: string; qty: number; price: number; hasPromo: boolean }[];
  dotsAll: {
    dotCode: string;
    qty: number;
    price: number;
    spec: string;
    variantId: string;
    hasPromo: boolean;
    basePrice: number;
    promoPrice?: number | null;
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
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('myinv:viewMode') as ViewMode) || 'table';
    }
    return 'table';
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounced(searchTerm);
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [selectedSize, setSelectedSize] = useState('All Sizes');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [hasPromotion, setHasPromotion] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('relevance');

  // Dialog states: Add DOT / Promo / Delete DOT
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

  // Dialog states: Add Product / Edit Product
  const [openAddProduct, setOpenAddProduct] = useState(false);
  const [openEditProduct, setOpenEditProduct] = useState<{ open: boolean; row?: Row | null }>({
    open: false,
    row: null,
  });

  // Add DOT form
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
  const [availableVariants, setAvailableVariants] = useState<
    Array<{ variantId: string; specification: string; basePrice?: number }>
  >([]);

  // Add Product form
  const [addProductForm, setAddProductForm] = useState<{
    brandName: string;
    modelName: string;
    size: string;
    loadIndex: string;
    basePrice?: string;
    dotCode: string;
    qty: number;
    promoPrice?: string;
  }>({
    brandName: '',
    modelName: '',
    size: '',
    loadIndex: '',
    basePrice: '',
    dotCode: '',
    qty: 1,
    promoPrice: '',
  });

  // Edit Product form
  const [editProductForm, setEditProductForm] = useState<{
    brandName: string;
    modelName: string;
    // quick add variant section
    newSize: string;
    newLoadIndex: string;
    newBasePrice?: string;
  }>({
    brandName: '',
    modelName: '',
    newSize: '',
    newLoadIndex: '',
    newBasePrice: '',
  });

  // Save view mode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('myinv:viewMode', viewMode);
    }
  }, [viewMode]);

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

  // ---------- Options ----------
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
      let minPrice = Infinity;
      let maxPrice = 0;

      for (const s of sizes as any[]) {
        const dots = (s.dots ?? []) as any[];
        const specQty = dots.reduce((sum: number, d: any) => sum + Number(d.qty ?? 0), 0);
        if (specQty > specQtyMax) {
          specQtyMax = specQty;
          specHighlight = s.specification ?? 'N/A';
        }
        for (const d of dots) {
          const qty = Number(d.qty ?? 0);
          const basePrice = Number(d.basePrice ?? 0);
          const promoPrice = d.promoPrice != null ? Number(d.promoPrice) : null;
          const price = promoPrice ?? basePrice;
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
              promoPrice,
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

      const dotChips = allDots.slice(0, 3).map((d) => ({
        dotCode: d.dotCode,
        qty: d.qty,
        price: d.price,
        hasPromo: d.hasPromo,
      }));

      out.push({
        key: `${p.id}__${b.branchId}`,
        productName: p.name,
        brand: p.brand,
        model: p.model || '',
        branchId: String(b.branchId),
        branchName: b.branchName,
        specHighlight,
        available: totalUnits,
        minPrice,
        maxPrice,
        hasPromo: hasPromoAny,
        lowStock: totalUnits > 0 && totalUnits < 6,
        dotChips,
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
        !q ? true : `${r.productName} ${r.brand} ${r.model} ${r.specHighlight}`.toLowerCase().includes(q)
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
          return (b.maxPrice || 0) - (a.maxPrice || 0);
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
    lowStockOnly,
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
    const low = rows.filter((r) => r.lowStock).length;
    const promo = rows.filter((r) => r.hasPromo).length;
    const value = rows.reduce((s, r) => s + r.available * r.minPrice, 0);
    const avgPrice = rows.length ? Math.round(rows.reduce((s, r) => s + r.minPrice, 0) / rows.length) : 0;
    return { products, units, low, promo, value, avgPrice };
  }, [rows]);

  // ---------- Mutations ----------
  const adjustMutation = useMutation({
    mutationFn: async (payload: {
      storeId: string;
      brandId: string;
      modelId: string;
      variantId: string;
      dotCode: string;
      qtyChange: number;
    }) => {
      await InventoryService.adjustDotQuantity(
        payload.storeId,
        payload.brandId,
        payload.modelId,
        payload.variantId,
        payload.dotCode,
        payload.qtyChange
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

  const upsertDotMutation = useMutation({
    mutationFn: async () => {
      const r = openAddDot.row!;
      const productInfo = InventoryService.parseProductInfo(r.grouped, myBranchId, addForm.variantId, addForm.dotCode);

      await InventoryService.addNewDot(
        productInfo.storeId,
        productInfo.brandId,
        productInfo.modelId,
        productInfo.variantId,
        {
          dotCode: addForm.dotCode.trim(),
          qty: Number(addForm.qty) || 0,
          promoPrice: addForm.promoPrice?.trim() ? Number(addForm.promoPrice) : undefined,
        }
      );
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
      const productInfo = InventoryService.parseProductInfo(r.grouped, myBranchId, d.variantId, d.dotCode);

      await InventoryService.setPromoPrice(
        productInfo.storeId,
        productInfo.brandId,
        productInfo.modelId,
        productInfo.variantId,
        productInfo.dotCode,
        val === '' ? null : Number(val)
      );
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
      const productInfo = InventoryService.parseProductInfo(r.grouped, myBranchId, d.variantId, d.dotCode);

      await InventoryService.deleteDot(
        productInfo.storeId,
        productInfo.brandId,
        productInfo.modelId,
        productInfo.variantId,
        productInfo.dotCode
      );
    },
    onSuccess: () => {
      toast.success('DOT deleted');
      setOpenDelete({ open: false, row: null, dot: null });
      qc.invalidateQueries({ queryKey: ['inventory', 'store', myBranchId] });
    },
    onError: (e: any) => toast.error(`Failed: ${e?.message ?? 'Unknown error'}`),
  });

  const updateProductMetaMutation = useMutation({
    mutationFn: async (payload: {
      storeId: string;
      brandId: string;
      modelId: string;
      brandName?: string;
      modelName?: string;
    }) => {
      await InventoryService.updateProductMeta(
        payload.storeId,
        payload.brandId,
        payload.modelId,
        { brandName: payload.brandName, modelName: payload.modelName }
      );
    },
    onSuccess: () => {
      toast.success('Product updated');
      setOpenEditProduct({ open: false, row: null });
      qc.invalidateQueries({ queryKey: ['inventory', 'store', myBranchId] });
    },
    onError: (e: any) => toast.error(`Failed: ${e?.message ?? 'Unknown error'}`),
  });

  const ensureVariantMutation = useMutation({
    mutationFn: async (payload: {
      storeId: string;
      brandId: string;
      modelId: string;
      variantId: string;
      init?: { size?: string; loadIndex?: string; basePrice?: number };
    }) => {
      await InventoryService.ensureVariantPath(
        payload.storeId,
        payload.brandId,
        payload.modelId,
        payload.variantId,
        payload.init
      );
    },
    onSuccess: () => {
      toast.success('Variant added/updated');
      setOpenEditProduct((p) => ({ open: true, row: p.row })); // keep open
      qc.invalidateQueries({ queryKey: ['inventory', 'store', myBranchId] });
    },
    onError: (e: any) => toast.error(`Failed: ${e?.message ?? 'Unknown error'}`),
  });

  const addProductMutation = useMutation({
    mutationFn: async () => {
      const brandName = addProductForm.brandName.trim();
      const modelName = addProductForm.modelName.trim();
      const size = addProductForm.size.trim();
      const loadIndex = addProductForm.loadIndex.trim();
      const basePrice = addProductForm.basePrice?.trim() ? Number(addProductForm.basePrice) : undefined;
      const dotCode = addProductForm.dotCode.trim();
      const qty = Number(addProductForm.qty) || 0;
      const promoPrice = addProductForm.promoPrice?.trim() ? Number(addProductForm.promoPrice) : undefined;

      if (!brandName || !modelName || !size || !dotCode) throw new Error('Please fill in required fields');

      // 1) ensure brand/model
      const { brandId } = await InventoryService.ensureBrandDoc(myBranchId, brandName);
      const mm = await InventoryService.ensureModelDoc(myBranchId, brandId, modelName);
      const modelId = mm.modelId;

      // 2) ensure variant
      const variantId = `${size.replace(/\s+/g, '').toLowerCase()}${loadIndex ? `-${loadIndex.replace(/\s+/g, '').toLowerCase()}` : ''}`;
      await InventoryService.ensureVariantPath(myBranchId, brandId, modelId, variantId, {
        size,
        loadIndex,
        basePrice,
      });

      // 3) add first DOT
      await InventoryService.addNewDot(myBranchId, brandId, modelId, variantId, {
        dotCode,
        qty,
        promoPrice,
      });
    },
    onSuccess: () => {
      toast.success('Product created');
      setOpenAddProduct(false);
      setAddProductForm({
        brandName: '',
        modelName: '',
        size: '',
        loadIndex: '',
        basePrice: '',
        dotCode: '',
        qty: 1,
        promoPrice: '',
      });
      qc.invalidateQueries({ queryKey: ['inventory', 'store', myBranchId] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  // ---------- Handlers ----------
  const handleAdjust = (r: Row, d: Row['dotsAll'][number], delta: number) => {
    const productInfo = InventoryService.parseProductInfo(r.grouped, myBranchId, d.variantId, d.dotCode);

    adjustMutation.mutate({
      storeId: productInfo.storeId,
      brandId: productInfo.brandId,
      modelId: productInfo.modelId,
      variantId: productInfo.variantId,
      dotCode: productInfo.dotCode,
      qtyChange: delta,
    });
  };

  const openAddDotDialog = async (r: Row) => {
    const productInfo = InventoryService.parseProductInfo(r.grouped, myBranchId, '', '');

    try {
      const variants = await InventoryService.getVariantsForProduct(
        productInfo.storeId,
        productInfo.brandId,
        productInfo.modelId
      );

      setAddForm({
        variantId: variants[0]?.variantId ?? '',
        dotCode: '',
        qty: 1,
        promoPrice: '',
      });

      setAvailableVariants(variants);
      setOpenAddDot({ open: true, row: r });
    } catch (error) {
      toast.error('Failed to load variants');
    }
  };

  const handleOpenEditProduct = (r: Row) => {
    // เตรียมค่าเริ่มต้นจากชื่อที่แสดงอยู่
    setEditProductForm({
      brandName: r.brand,
      modelName: r.model,
      newSize: '',
      newLoadIndex: '',
      newBasePrice: '',
    });
    setOpenEditProduct({ open: true, row: r });
  };

  // ---------- Export CSV ----------
  const exportCSV = () => {
    const header = ['Product', 'Brand', 'Model', 'Spec', 'Available', 'Min Price', 'Max Price', 'Has Promo'];
    const rowsText = rows.map((r) =>
      [r.productName, r.brand, r.model, r.specHighlight, r.available, r.minPrice, r.maxPrice, r.hasPromo ? 'Yes' : 'No']
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvText = [header.join(','), ...rowsText].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvText], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_${myBranchId}_${new Date().toISOString().slice(0, 19)}.csv`;
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
          View and manage stock for <span className="font-medium">{branchName}</span>.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => invQuery.refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button size="sm" onClick={() => setOpenAddProduct(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
        {onNavigate && (
          <Button size="sm" onClick={() => onNavigate('transfer_platform')}>
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Transfer Platform
          </Button>
        )}
      </div>
    </div>
  );

  const KPI = (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
      <Card className="rounded-xl shadow-sm border-emerald-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Boxes className="h-4 w-4" />
            Products
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{kpis.products}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-blue-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Units in Stock
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{kpis.units}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-amber-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Low Stock
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold text-amber-600">{kpis.low}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-green-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            On Sale
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold text-green-600">{kpis.promo}</CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-teal-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Inventory Value</CardTitle>
        </CardHeader>
        <CardContent className="text-lg font-bold">
          {formatTHB(kpis.value)}
        </CardContent>
      </Card>
      <Card className="rounded-xl shadow-sm border-purple-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Avg Price</CardTitle>
        </CardHeader>
        <CardContent className="text-lg font-bold">
          {formatTHB(kpis.avgPrice)}
        </CardContent>
      </Card>
    </div>
  );

  const FilterBar = (
    <div className="border-b bg-muted/20 p-6">
      <div className="w-full space-y-4">
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('table')}
                    className="gap-1"
                  >
                    <TableIcon className="h-4 w-4" />
                    Table
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Table view with expandable rows</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('grid')}
                    className="gap-1"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Grid
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Grid cards view</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant={viewMode === 'matrix' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('matrix')}
                    className="gap-1"
                  >
                    <Grid3X3 className="h-4 w-4" />
                    Matrix
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Matrix view (DOT × Size)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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

  // ---------- Table (expandable rows) ----------
  const GRID_COLS = 'minmax(420px,1.2fr) minmax(220px,0.8fr) 120px 160px 160px';

  const TableHeader = (
    <div
      className="grid gap-4 px-4 py-3 text-xs text-muted-foreground min-w-[1080px] bg-slate-50/70 border-b"
      style={{ gridTemplateColumns: GRID_COLS }}
    >
      <div>Product</div>
      <div>Branch</div>
      <div className="text-right">Available</div>
      <div className="text-right">Price Range</div>
      <div className="text-right">Actions</div>
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
              className="grid gap-4 items-start min-w-[1080px]"
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
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.productName}</span>
                    {r.hasPromo && (
                      <Badge variant="secondary" className="text-xs">
                        Sale
                      </Badge>
                    )}
                    {r.lowStock && (
                      <Badge variant="destructive" className="text-xs">
                        Low
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.brand} {r.model && `• ${r.model}`}
                  </div>
                  {/* chips */}
                  {r.dotChips.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.dotChips.map((chip, i) => (
                        <span
                          key={`${r.key}-chip-${chip.dotCode}-${i}`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                            chip.hasPromo
                              ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-50'
                              : 'bg-muted'
                          }`}
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
                <Badge variant={r.lowStock ? 'destructive' : 'secondary'}>
                  {r.available} units
                </Badge>
              </div>

              {/* Price Range */}
              <div className="text-right">
                {r.minPrice > 0 ? (
                  r.minPrice === r.maxPrice ? (
                    formatTHB(r.minPrice)
                  ) : (
                    <div className="text-xs">
                      {formatTHB(r.minPrice)} - {formatTHB(r.maxPrice)}
                    </div>
                  )
                ) : (
                  '—'
                )}
              </div>

              {/* Actions */}
              <div className="text-right">
                <div className="inline-flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setExpandedKey((prev) => (prev === r.key ? null : r.key))
                    }
                  >
                    Manage
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleOpenEditProduct(r)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </div>
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
                  <Button size="sm" onClick={() => openAddDotDialog(r)}>
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
                    <div className="col-span-2 text-right">
                      <div className="flex flex-col items-end">
                        <span className={d.hasPromo ? 'text-green-600 font-medium' : ''}>
                          {formatTHB(d.price)}
                        </span>
                        {d.hasPromo && d.basePrice !== d.price && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatTHB(d.basePrice)}
                          </span>
                        )}
                      </div>
                    </div>
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
                                setPromoForm({
                                  promoPrice: d.promoPrice ? String(d.promoPrice) : '',
                                });
                                setOpenPromo({ open: true, row: r, dot: d });
                              }}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Set promo price…
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
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
        ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
        : rows.length
        ? rows.map((r) => (
            <Card key={r.key} className="relative hover:shadow-md transition-shadow">
              <div className="absolute top-3 right-3 flex gap-1">
                <Badge variant={r.lowStock ? 'destructive' : 'secondary'}>{r.available} units</Badge>
                {r.hasPromo && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Sale
                  </Badge>
                )}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base pr-24 flex items-center justify-between">
                  <span className="truncate">{r.productName}</span>
                  <Button size="icon" variant="ghost" onClick={() => handleOpenEditProduct(r)} title="Edit product">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {r.brand} {r.model && `• ${r.model}`}
                </CardDescription>
                <div className="text-xs text-muted-foreground">{r.specHighlight}</div>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.dotChips.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.dotChips.map((chip, i) => (
                      <span
                        key={`${r.key}-chip-grid-${chip.dotCode}-${i}`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                          chip.hasPromo ? 'bg-green-100 text-green-800' : 'bg-muted'
                        }`}
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
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {r.minPrice > 0 ? (
                          r.minPrice === r.maxPrice ? (
                            formatTHB(r.minPrice)
                          ) : (
                            <div className="text-xs">
                              {formatTHB(r.minPrice)} - {formatTHB(r.maxPrice)}
                            </div>
                          )
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button size="sm" variant="outline" onClick={() => openAddDotDialog(r)}>
                    + Add DOT
                  </Button>
                  <Button size="sm" onClick={() => setExpandedKey(r.key)} title="Manage">
                    <Settings className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                </div>

                {/* inline expanded in card */}
                {expandedKey === r.key && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2 mt-3">
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
                            <div className={`text-xs ${d.hasPromo ? 'text-green-600' : ''}`}>
                              {formatTHB(d.price)}
                            </div>
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

          const cellMap = new Map<string, { qty: number; price: number; variantId: string; hasPromo: boolean }>();
          r.dotsAll.forEach((d) => {
            cellMap.set(`${d.spec}__${d.dotCode}`, {
              qty: d.qty,
              price: d.price,
              variantId: d.variantId,
              hasPromo: d.hasPromo,
            });
          });

          return (
            <Card key={`matrix-${r.key}`} className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{r.productName}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleOpenEditProduct(r)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    {r.hasPromo && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Sale
                      </Badge>
                    )}
                    <Badge variant={r.lowStock ? 'destructive' : 'secondary'}>
                      {r.available} units
                    </Badge>
                  </div>
                </CardTitle>
                <CardDescription>
                  {r.branchName} • {r.brand} {r.model}
                </CardDescription>
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
                            const hasPromo = cell?.hasPromo ?? false;
                            if (qty > 0) rowTotal += qty;
                            return (
                              <div key={`${r.key}-cell-${spec}-${dc}`} className="px-2 py-2 border bg-white">
                                {qty > 0 ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="text-xs font-mono">{qty}</div>
                                    <div className={`text-[10px] ${hasPromo ? 'text-green-600' : 'text-muted-foreground'}`}>
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
                                              hasPromo,
                                              basePrice: price,
                                              promoPrice: hasPromo ? price : null,
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
                                              hasPromo,
                                              basePrice: price,
                                              promoPrice: hasPromo ? price : null,
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
                    <div className="grid" style={{ gridTemplateColumns: `200px repeat(${dots.length}, minmax(100px, 1fr)) 120px` }}>
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-slate-50 border">
                        Column total
                      </div>
                      {dots.map((dc) => {
                        const colTotal = r.dotsAll
                          .filter((d) => d.dotCode === dc)
                          .reduce((s, d) => s + d.qty, 0);
                        return (
                          <div key={`${r.key}-colsum-${dc}`} className="px-3 py-2 text-sm text-center border bg-slate-50">
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

  // ---------- Promo form state ----------
  const [promoForm, setPromoForm] = useState<{ promoPrice: string }>({ promoPrice: '' });

  // ---------- Render ----------
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
            <DialogDescription>
              Add a new DOT code to {openAddDot.row?.productName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
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
                  {availableVariants.map((variant) => (
                    <SelectItem key={variant.variantId} value={variant.variantId}>
                      {variant.specification}
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
                  placeholder="Leave empty for no promo"
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
            <DialogDescription>
              Update promotional pricing for DOT {openPromo.dot?.dotCode}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              DOT: <span className="font-mono">{openPromo.dot?.dotCode}</span> • Spec:{' '}
              {openPromo.dot?.spec}
            </div>
            <div>
              <Label className="text-xs">Promo price (leave empty to remove promo)</Label>
              <Input
                type="number"
                min={0}
                className="mt-1"
                value={promoForm.promoPrice}
                onChange={(e) => setPromoForm({ promoPrice: e.target.value })}
                placeholder="e.g. 2500"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Current base price: {openPromo.dot ? formatTHB(openPromo.dot.basePrice) : '—'}
              </div>
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
            <DialogDescription>
              This action cannot be undone. This will permanently delete the DOT from your inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div>
              Are you sure you want to delete DOT{' '}
              <span className="font-mono font-semibold">{openDelete.dot?.dotCode}</span> (
              {openDelete.dot?.spec})?
            </div>
            <div className="text-muted-foreground text-xs">
              Current quantity: {openDelete.dot?.qty || 0} units
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
              {deleteDotMutation.isPending ? 'Deleting…' : 'Delete DOT'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product dialog */}
      <Dialog open={openAddProduct} onOpenChange={setOpenAddProduct}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>Create brand/model + first variant and DOT.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Brand *</Label>
                <Input
                  className="mt-1"
                  value={addProductForm.brandName}
                  onChange={(e) => setAddProductForm((f) => ({ ...f, brandName: e.target.value }))}
                  placeholder="e.g. Bridgestone"
                />
              </div>
              <div>
                <Label className="text-xs">Model *</Label>
                <Input
                  className="mt-1"
                  value={addProductForm.modelName}
                  onChange={(e) => setAddProductForm((f) => ({ ...f, modelName: e.target.value }))}
                  placeholder="e.g. Turanza T005A"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Size *</Label>
                <Input
                  className="mt-1"
                  value={addProductForm.size}
                  onChange={(e) => setAddProductForm((f) => ({ ...f, size: e.target.value }))}
                  placeholder="e.g. 215/55R17"
                />
              </div>
              <div>
                <Label className="text-xs">Load/Index</Label>
                <Input
                  className="mt-1"
                  value={addProductForm.loadIndex}
                  onChange={(e) =>
                    setAddProductForm((f) => ({ ...f, loadIndex: e.target.value }))
                  }
                  placeholder="e.g. 94V"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Base price</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  value={addProductForm.basePrice}
                  onChange={(e) =>
                    setAddProductForm((f) => ({ ...f, basePrice: e.target.value }))
                  }
                  placeholder="e.g. 3200"
                />
              </div>
              <div>
                <Label className="text-xs">DOT code *</Label>
                <Input
                  className="mt-1 font-mono"
                  value={addProductForm.dotCode}
                  onChange={(e) => setAddProductForm((f) => ({ ...f, dotCode: e.target.value }))}
                  placeholder="e.g. 2325"
                />
              </div>
              <div>
                <Label className="text-xs">Quantity *</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  value={addProductForm.qty}
                  onChange={(e) =>
                    setAddProductForm((f) => ({ ...f, qty: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Promo price (optional)</Label>
              <Input
                type="number"
                min={0}
                className="mt-1"
                value={addProductForm.promoPrice}
                onChange={(e) =>
                  setAddProductForm((f) => ({ ...f, promoPrice: e.target.value }))
                }
                placeholder="Leave empty for none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAddProduct(false)}>
              Cancel
            </Button>
            <Button onClick={() => addProductMutation.mutate()} disabled={addProductMutation.isPending}>
              {addProductMutation.isPending ? 'Saving…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product dialog */}
      <Dialog
        open={openEditProduct.open}
        onOpenChange={(o) => setOpenEditProduct({ open: o, row: o ? openEditProduct.row : null })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Change display names + add a new variant.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Display names */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Brand name</Label>
                <Input
                  className="mt-1"
                  value={editProductForm.brandName}
                  onChange={(e) =>
                    setEditProductForm((f) => ({ ...f, brandName: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Model name</Label>
                <Input
                  className="mt-1"
                  value={editProductForm.modelName}
                  onChange={(e) =>
                    setEditProductForm((f) => ({ ...f, modelName: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Quick add variant */}
            <div className="rounded-md border p-3 space-y-3">
              <div className="text-xs font-medium text-muted-foreground">Add Variant</div>
              <div className="grid grid-cols-6 gap-3">
                <div className="col-span-3">
                  <Label className="text-xs">Size</Label>
                  <Input
                    className="mt-1"
                    value={editProductForm.newSize}
                    onChange={(e) =>
                      setEditProductForm((f) => ({ ...f, newSize: e.target.value }))
                    }
                    placeholder="e.g. 215/60R16"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Load/Index</Label>
                  <Input
                    className="mt-1"
                    value={editProductForm.newLoadIndex}
                    onChange={(e) =>
                      setEditProductForm((f) => ({ ...f, newLoadIndex: e.target.value }))
                    }
                    placeholder="e.g. 95H"
                  />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">Base</Label>
                  <Input
                    type="number"
                    min={0}
                    className="mt-1"
                    value={editProductForm.newBasePrice}
                    onChange={(e) =>
                      setEditProductForm((f) => ({ ...f, newBasePrice: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    const r = openEditProduct.row!;
                    const info = InventoryService.parseProductInfo(r.grouped, myBranchId, '', '');
                    const variantId = `${editProductForm.newSize.replace(/\s+/g, '').toLowerCase()}${
                      editProductForm.newLoadIndex
                        ? `-${editProductForm.newLoadIndex.replace(/\s+/g, '').toLowerCase()}`
                        : ''
                    }`;

                    ensureVariantMutation.mutate({
                      storeId: info.storeId,
                      brandId: info.brandId,
                      modelId: info.modelId,
                      variantId,
                      init: {
                        size: editProductForm.newSize.trim() || undefined,
                        loadIndex: editProductForm.newLoadIndex.trim() || undefined,
                        basePrice: editProductForm.newBasePrice?.trim()
                          ? Number(editProductForm.newBasePrice)
                          : undefined,
                      },
                    });
                  }}
                  disabled={!editProductForm.newSize.trim() && !editProductForm.newLoadIndex.trim()}
                >
                  Add Variant
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEditProduct({ open: false, row: null })}>
              Close
            </Button>
            <Button
              onClick={() => {
                const r = openEditProduct.row!;
                const info = InventoryService.parseProductInfo(r.grouped, myBranchId, '', '');
                updateProductMetaMutation.mutate({
                  storeId: info.storeId,
                  brandId: info.brandId,
                  modelId: info.modelId,
                  brandName: editProductForm.brandName.trim() || undefined,
                  modelName: editProductForm.modelName.trim() || undefined,
                });
              }}
              disabled={updateProductMetaMutation.isPending}
            >
              {updateProductMetaMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
