'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { InventoryService, GroupedProduct } from '@/lib/services/InventoryService';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import {
  Search,
  MapPin,
  CheckCircle2,
  XCircle,
  Package,
  Store,
  Tag,
  ShoppingCart,
  Plus,
  Minus,
  TrendingDown,
  Factory,
  Trash2,
} from 'lucide-react';

type DotPick = {
  sizeSpec: string;
  dotCode: string;
  price: number;
  maxQty: number;
};

type CartItem = {
  id: string; // unique key (productId|fromStoreId|sizeSpec|dotCode)
  productId: string;
  productName: string;
  brand: string;
  model: string;

  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;

  sizeSpec: string; // variant id (e.g. "215/60R16 99H")
  dotCode: string;
  unitPrice: number;
  qty: number;
  maxQty: number;
};

export default function TransferPlatformView({
  myBranchId,
  myBranchName,
}: {
  myBranchId: string;
  myBranchName: string;
}) {
  const [inventory, setInventory] = useState<GroupedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [promoOnly, setPromoOnly] = useState(false);

  // Dialog (Add to Cart)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<GroupedProduct | null>(null);
  const [activeBranch, setActiveBranch] = useState<{ id: string; name: string } | null>(null);
  const [picked, setPicked] = useState<DotPick | null>(null);
  const [qty, setQty] = useState(1);

  // Cart (Sheet)
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Load inventory
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await InventoryService.fetchInventory();
        setInventory(data);
      } catch (e) {
        console.error('Failed to fetch inventory', e);
        toast.error('Failed to load inventory');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Filtered list
  const filteredInventory = useMemo(() => {
    let result = [...inventory];

    // search by name/brand/model/spec
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.model.toLowerCase().includes(q) ||
          p.branches.some((b) => b.sizes.some((s) => s.specification.toLowerCase().includes(q)))
      );
    }

    // per-branch filter (in-stock / promo)
    result = result
      .map((p) => {
        const br = p.branches.filter((b) => {
          const total = b.sizes.reduce(
            (acc, s) => acc + s.dots.reduce((dacc, d) => dacc + d.qty, 0),
            0
          );
          const hasPromo = b.sizes.some((s) => s.dots.some((d) => (d.promoPrice || 0) > 0));
          if (promoOnly && !hasPromo) return false;
          if (inStockOnly) return total > 0;
          return true;
        });
        return { ...p, branches: br };
      })
      .filter((p) => p.branches.length > 0);

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, searchTerm, inStockOnly, promoOnly]);

  // KPI
  const kpi = useMemo(() => {
    const dots: { price: number; promo: boolean }[] = [];
    const branchIds = new Set<string>();

    filteredInventory.forEach((p) =>
      p.branches.forEach((b) => {
        branchIds.add(b.branchId);
        b.sizes.forEach((s) =>
          s.dots.forEach((d) => {
            if (d.qty > 0) dots.push({ price: d.promoPrice || d.basePrice, promo: !!d.promoPrice });
          })
        );
      })
    );

    const avgPrice =
      dots.length > 0
        ? Math.round(
            (dots.reduce((sum, x) => sum + x.price, 0) / dots.length + Number.EPSILON) * 100
          ) / 100
        : 0;
    const promoCount = dots.filter((d) => d.promo).length;

    return {
      avgPrice,
      promoCount,
      activeBranches: branchIds.size,
      products: filteredInventory.length,
    };
  }, [filteredInventory]);

  // Open dialog with a selected product/branch
  const openAddDialog = (product: GroupedProduct, branchId: string, branchName: string) => {
    setActiveProduct(product);
    setActiveBranch({ id: branchId, name: branchName });
    setPicked(null);
    setQty(1);
    setIsDialogOpen(true);
  };

  // Size/DOT options inside dialog
  const sizeOptions = useMemo(() => {
    if (!activeProduct || !activeBranch) return [];
    const branch = activeProduct.branches.find((b) => b.branchId === activeBranch.id);
    if (!branch) return [];
    return branch.sizes
      .map((s) => ({
        spec: s.specification,
        dots: s.dots
          .filter((d) => d.qty > 0)
          .map((d) => ({
            dotCode: d.dotCode,
            price: d.promoPrice || d.basePrice,
            maxQty: d.qty,
            promo: !!d.promoPrice,
            basePrice: d.basePrice,
          })),
      }))
      .filter((s) => s.dots.length > 0);
  }, [activeProduct, activeBranch]);

  // ---- Cart helpers ----
  const cartCount = cart.reduce((n, it) => n + it.qty, 0);
  const cartTotal = cart.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);

  const addToCart = () => {
    if (!activeProduct || !activeBranch || !picked || !picked.dotCode || qty < 1) return;

    const id = `${activeProduct.id}|${activeBranch.id}|${picked.sizeSpec}|${picked.dotCode}`;
    setCart((prev) => {
      const existed = prev.find((x) => x.id === id);
      if (existed) {
        const newQty = Math.min(existed.qty + qty, existed.maxQty);
        return prev.map((x) => (x.id === id ? { ...x, qty: newQty } : x));
      }
      const item: CartItem = {
        id,
        productId: activeProduct.id,
        productName: activeProduct.name,
        brand: activeProduct.brand,
        model: activeProduct.model,
        fromStoreId: activeBranch.id,
        fromStoreName: activeBranch.name,
        toStoreId: myBranchId,
        toStoreName: myBranchName,
        sizeSpec: picked.sizeSpec,
        dotCode: picked.dotCode,
        unitPrice: picked.price,
        qty,
        maxQty: picked.maxQty,
      };
      return [...prev, item];
    });

    toast.success(
      `Added ${qty} · ${activeProduct.name} • ${picked.sizeSpec} (DOT ${picked.dotCode}) from ${activeBranch.name}`
    );
    setIsDialogOpen(false);
    setIsCartOpen(true);
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((x) => (x.id === id ? { ...x, qty: Math.min(Math.max(1, x.qty + delta), x.maxQty) } : x))
        .filter((x) => x.qty > 0)
    );
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((x) => x.id !== id));
  };

  const clearCart = () => setCart([]);

  // Submit grouped requests (one doc per fromStoreId)
  const submitAllRequests = async () => {
    if (cart.length === 0) return;

    const groups = cart.reduce<Record<string, CartItem[]>>((acc, it) => {
      acc[it.fromStoreId] = acc[it.fromStoreId] || [];
      acc[it.fromStoreId].push(it);
      return acc;
    }, {});

    setSubmitting(true);
    try {
      const promises = Object.entries(groups).map(async ([fromStoreId, items]) => {
        const payload = {
          orgId: 'default',
          fromStoreId,
          fromStoreName: items[0].fromStoreName,
          toStoreId: myBranchId,
          toStoreName: myBranchName,
          // รวมสินค้าแต่ละร้าน
          items: items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            brand: it.brand,
            model: it.model,
            sizeSpec: it.sizeSpec,
            dotCode: it.dotCode,
            qty: it.qty,
            unitPrice: it.unitPrice,
          })),
          status: 'requested',
          createdAt: serverTimestamp(),
          // createdBy: uid || 'anonymous'
        };
        await addDoc(collection(db, 'transfers'), payload);
      });

      await Promise.all(promises);
      toast.success(`Submitted ${Object.keys(groups).length} transfer request(s).`);
      clearCart();
      setIsCartOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to submit requests');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + KPIs */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-primary/3 to-background p-6 md:p-8 border-0 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Inter-Branch Transfer</h1>
            <p className="text-muted-foreground text-lg">Browse and request inventory from partner branches with ease.</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Badge variant="secondary" className="gap-2 px-3 py-2 bg-white/80 border-0 shadow-sm">
              <Store className="h-4 w-4" />
              {kpi.activeBranches} branches
            </Badge>
            <Badge variant="secondary" className="gap-2 px-3 py-2 bg-white/80 border-0 shadow-sm">
              <ShoppingCart className="h-4 w-4" />
              {kpi.products} products
            </Badge>

            {/* Cart Trigger */}
            <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
              <SheetTrigger asChild>
                <Button className="gap-2 gradient-primary shadow-md hover-lift focus-ring">
                  <ShoppingCart className="h-4 w-4" />
                  Transfer Cart ({cartCount}) · ฿{cartTotal.toLocaleString()}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle className="text-xl">Transfer Cart</SheetTitle>
                </SheetHeader>
                <div className="mt-4 flex flex-col h-[90%]">
                  <ScrollArea className="flex-1 pr-2">
                    {cart.length === 0 ? (
                      <div className="text-center text-muted-foreground mt-12">
                        <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No items in cart</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {cart.map((it) => (
                          <Card key={it.id} className="border-0 shadow-sm hover-lift">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{it.productName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {it.brand} • {it.model}
                                  </div>
                                  <div className="text-xs mt-1">
                                    From <span className="font-medium">{it.fromStoreName}</span> → To{' '}
                                    <span className="font-medium">{it.toStoreName}</span>
                                  </div>
                                  <div className="text-xs mt-1">
                                    {it.sizeSpec} · DOT {it.dotCode}
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="focus-ring" onClick={() => removeItem(it.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="mt-2 flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                  Unit: <span className="font-medium">฿{it.unitPrice.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 focus-ring"
                                    onClick={() => updateQty(it.id, -1)}
                                    disabled={it.qty <= 1}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <div className="w-10 text-center text-sm font-medium">{it.qty}</div>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 focus-ring"
                                    onClick={() => updateQty(it.id, 1)}
                                    disabled={it.qty >= it.maxQty}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              <div className="mt-2 flex items-center justify-between text-sm">
                                <div className="text-muted-foreground">Available: {it.maxQty}</div>
                                <div className="font-semibold">Subtotal: ฿{(it.qty * it.unitPrice).toLocaleString()}</div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  <Separator className="my-4" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-muted-foreground">Items</div>
                      <div className="font-medium">{cartCount}</div>
                    </div>
                    <div className="flex items-center justify-between text-lg">
                      <div className="font-semibold">Total</div>
                      <div className="font-semibold">฿{cartTotal.toLocaleString()}</div>
                    </div>
                    <div className="flex gap-3 pt-3">
                      <Button className="flex-1 gradient-primary focus-ring" disabled={submitting || cart.length === 0} onClick={submitAllRequests}>
                        {submitting ? 'Submitting...' : 'Submit Requests'}
                      </Button>
                      <Button variant="outline" className="flex-1 focus-ring" onClick={clearCart} disabled={cart.length === 0}>
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>
                <SheetFooter />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <Card className="border-0 shadow-sm bg-white/60 hover-lift">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                  <TrendingDown className="h-3 w-3 text-blue-600" />
                </div>
                Avg. wholesale
              </div>
              <div className="text-2xl font-bold text-foreground">฿{kpi.avgPrice.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white/60 hover-lift">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Tag className="h-3 w-3 text-emerald-600" />
                </div>
                Promotional items
              </div>
              <div className="text-2xl font-bold text-foreground">{kpi.promoCount}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white/60 hover-lift">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Factory className="h-3 w-3 text-purple-600" />
                </div>
                Active branches
              </div>
              <div className="text-2xl font-bold text-foreground">{kpi.activeBranches}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white/60 hover-lift">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Package className="h-3 w-3 text-amber-600" />
                </div>
                Products available
              </div>
              <div className="text-2xl font-bold text-foreground">{kpi.products}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="border-0 shadow-sm hover-lift">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 md:items-center">
            <div className="relative md:flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products, brands, sizes..."
                className="pl-11 h-11 focus-ring"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="inStockOnly"
                  className="focus-ring"
                  checked={inStockOnly}
                  onCheckedChange={(v) => setInStockOnly(Boolean(v))}
                />
                <Label htmlFor="inStockOnly" className="text-sm font-medium">
                  In stock only
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="promoOnly" className="focus-ring" checked={promoOnly} onCheckedChange={(v) => setPromoOnly(Boolean(v))} />
                <Label htmlFor="promoOnly" className="text-sm font-medium">
                  On promo
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3 mt-2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInventory.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg leading-tight">{product.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {product.brand} • {product.model}
                    </p>
                  </div>
                  <Badge variant="secondary">{product.totalAvailable} units</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <p className="text-sm font-medium">
                  Available from {product.branches.length} branch{product.branches.length > 1 ? 'es' : ''}
                </p>

                <div className="space-y-3">
                  {product.branches.map((branch) => {
                    const totalStock = branch.sizes.reduce(
                      (acc, s) => acc + s.dots.reduce((sum, d) => sum + d.qty, 0),
                      0
                    );
                    const isAvail = totalStock > 0;

                    const bestPrice =
                      branch.sizes.length > 0
                        ? Math.min(
                            ...branch.sizes.flatMap((s) => s.dots.map((d) => d.promoPrice || d.basePrice))
                          )
                        : 0;

                    return (
                      <div
                        key={branch.branchId}
                        className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center rounded-lg border p-3"
                      >
                        <div className="md:col-span-2 flex items-center gap-2">
                          {isAvail ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <div>
                            <div className="font-medium">{branch.branchName}</div>
                            <div className="text-xs text-muted-foreground">{totalStock} units</div>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Location, TH
                        </div>

                        <div className="text-sm">
                          <span className="text-muted-foreground">Best price</span>{' '}
                          <span className="font-medium">฿{bestPrice.toLocaleString()}</span>
                        </div>

                        <div className="justify-self-end">
                          <Button size="sm" onClick={() => openAddDialog(product, branch.branchId, branch.branchName)} disabled={!isAvail}>
                            Add to Cart
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredInventory.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No products found</h3>
                <p className="text-gray-500">Try adjusting your search criteria.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Add to Cart dialog (DOT picker) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add to Transfer Cart</DialogTitle>
          </DialogHeader>

          {!activeProduct || !activeBranch ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium">{activeProduct.name}</div>
                <div className="text-xs text-muted-foreground">
                  {activeProduct.brand} • {activeProduct.model}
                </div>
                <div className="text-xs mt-1">
                  From: <span className="font-medium">{activeBranch.name}</span> → To:{' '}
                  <span className="font-medium">{myBranchName}</span>
                </div>
              </div>

              {/* Size select */}
              <div>
                <Label className="text-sm">Size / Specification</Label>
                <Select
                  value={picked?.sizeSpec || ''}
                  onValueChange={(spec) => {
                    setPicked({ sizeSpec: spec, dotCode: '', price: 0, maxQty: 0 });
                    setQty(1);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select size/specification" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizeOptions.map((s) => (
                      <SelectItem key={s.spec} value={s.spec}>
                        {s.spec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* DOT select */}
              <div>
                <Label className="text-sm">DOT (with price & stock)</Label>
                <Select
                  disabled={!picked?.sizeSpec}
                  value={picked?.dotCode || ''}
                  onValueChange={(dot) => {
                    const size = sizeOptions.find((s) => s.spec === picked?.sizeSpec);
                    const dd = size?.dots.find((d) => d.dotCode === dot);
                    if (!dd || !picked?.sizeSpec) return;
                    setPicked({
                      sizeSpec: picked.sizeSpec,
                      dotCode: dd.dotCode,
                      price: dd.price,
                      maxQty: dd.maxQty,
                    });
                    setQty(Math.min(1, dd.maxQty || 1));
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={picked?.sizeSpec ? 'Select DOT' : 'Select size first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {picked?.sizeSpec &&
                      sizeOptions
                        .find((s) => s.spec === picked.sizeSpec)
                        ?.dots.map((d) => (
                          <SelectItem key={d.dotCode} value={d.dotCode}>
                            {d.dotCode} · ฿{d.price.toLocaleString()} · {d.maxQty} in stock
                            {d.promo && (
                              <Badge className="ml-2 h-4" variant="default">
                                Promo
                              </Badge>
                            )}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Qty stepper */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Unit price:{' '}
                  <span className="font-medium">
                    {picked?.price ? `฿${picked.price.toLocaleString()}` : '-'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={!picked || qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <div className="w-10 text-center text-sm font-medium">{qty}</div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={!picked || qty >= (picked?.maxQty || 1)}
                    onClick={() => setQty((q) => Math.min(picked!.maxQty, q + 1))}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <div className="text-muted-foreground">
                  Available: <span className="font-medium">{picked?.maxQty ?? '-'}</span>
                </div>
                <div className="font-semibold">
                  Total: {picked?.price ? `฿${(picked.price * qty).toLocaleString()}` : '—'}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" disabled={!picked || !picked.dotCode || qty < 1} onClick={addToCart}>
                  Add to Cart
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
