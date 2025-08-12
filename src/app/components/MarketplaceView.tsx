'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  InventoryService,
  type GroupedProduct,
  OrderService,
} from '@/lib/services/InventoryService'
import { useCart } from '@/contexts/CartContext';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

import {
  Search,
  Store,
  Package,
  ShoppingCart,
  MapPin,
  Star,
  RefreshCw,
  X,
  Plus,
  Minus,
  Tag,
} from 'lucide-react';

const thb = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});

type Props = {
  myBranchId: string;
  myBranchName: string;
  setCurrentView: (v: 'inventory' | 'marketplace' | 'orders' | 'dashboard') => void;
};

type MarketItem = {
  productId: string;
  productName: string; // "Brand Model"
  brand: string;
  branchId: string;
  branchName: string;
  units: number;
  minPrice: number | null;
  skuLike: string;
};

export default function MarketplaceView({
  myBranchId,
  myBranchName,
  setCurrentView,
}: Props) {
  const [inventory, setInventory] = useState<GroupedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('All Locations');
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [sortBy, setSortBy] = useState<'price' | 'stock'>('price');

  // Review-cart dialog
  const [reviewOpen, setReviewOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');

  // Add-to-cart dialog (เลือก DOT)
  const [addOpen, setAddOpen] = useState(false);
  const [target, setTarget] = useState<{ productId: string; branchId: string } | null>(
    null,
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<string>('');
  const [selectedDotCode, setSelectedDotCode] = useState<string | null>(null);
  const [selectedUnitPrice, setSelectedUnitPrice] = useState<number>(0);
  const [maxQty, setMaxQty] = useState<number>(0);
  const [qty, setQty] = useState<number>(1);

  const { addToCart, items: cartItems, updateQuantity, removeFromCart, clearCart } =
    useCart();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await InventoryService.fetchInventory();
      setInventory(data);
      setLoading(false);
    })();
  }, []);

  const branchOptions = useMemo(() => {
    const s = new Set<string>();
    inventory.forEach((p) => p.branches.forEach((b) => s.add(b.branchName)));
    return ['All Locations', ...Array.from(s).sort()];
  }, [inventory]);

  const brandOptions = useMemo(() => {
    const s = new Set<string>(inventory.map((p) => p.brand));
    return ['All Brands', ...Array.from(s).sort()];
  }, [inventory]);

  const marketItems = useMemo<MarketItem[]>(() => {
    const out: MarketItem[] = [];
    for (const p of inventory) {
      for (const br of p.branches) {
        const units = br.sizes.reduce(
          (sum, s) => sum + s.dots.reduce((ds, d) => ds + d.qty, 0),
          0,
        );
        if (units <= 0) continue;

        let minPrice: number | null = null;
        br.sizes.forEach((s) =>
          s.dots.forEach((d) => {
            const price =
              d.promoPrice && d.promoPrice > 0 ? d.promoPrice : d.basePrice;
            if (minPrice === null || price < minPrice) minPrice = price;
          }),
        );

        const firstSpec = br.sizes[0]?.specification ?? '';
        out.push({
          productId: p.id,
          productName: p.name,
          brand: p.brand,
          branchId: br.branchId,
          branchName: br.branchName,
          units,
          minPrice,
          skuLike: firstSpec,
        });
      }
    }
    return out;
  }, [inventory]);

  const filtered = useMemo(() => {
    let res = [...marketItems];
    if (selectedBranch !== 'All Locations')
      res = res.filter((i) => i.branchName === selectedBranch);
    if (selectedBrand !== 'All Brands')
      res = res.filter((i) => i.brand === selectedBrand);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      res = res.filter(
        (i) =>
          i.productName.toLowerCase().includes(q) ||
          i.brand.toLowerCase().includes(q) ||
          i.branchName.toLowerCase().includes(q) ||
          i.skuLike.toLowerCase().includes(q),
      );
    }
    res.sort((a, b) => {
      if (sortBy === 'stock') return b.units - a.units;
      const ap = a.minPrice ?? Number.POSITIVE_INFINITY;
      const bp = b.minPrice ?? Number.POSITIVE_INFINITY;
      return ap - bp;
    });
    return res;
  }, [marketItems, selectedBranch, selectedBrand, searchTerm, sortBy]);

  const dealerNetwork = useMemo(
    () => new Set(marketItems.map((i) => i.branchId)).size,
    [marketItems],
  );

  // helpers to find current product/branch/sizes for the Add-to-cart modal
  const currentProduct = useMemo(
    () => inventory.find((p) => p.id === target?.productId),
    [inventory, target],
  );
  const currentBranch = useMemo(
    () => currentProduct?.branches.find((b) => b.branchId === target?.branchId),
    [currentProduct, target],
  );
  const currentSizes = currentBranch?.sizes ?? [];

  // เปิด modal เลือก DOT
  const openAddModal = (item: MarketItem) => {
    setTarget({ productId: item.productId, branchId: item.branchId });
    // set default selection = size แรก, ยังไม่เลือก DOT จนกดเอง
    const firstSize = currentSizes[0];
    const vId = (firstSize as any)?.variantId ?? firstSize?.specification ?? '';
    setSelectedVariantId(vId || null);
    setSelectedSpec(firstSize?.specification ?? '');
    setSelectedDotCode(null);
    setSelectedUnitPrice(0);
    setMaxQty(0);
    setQty(1);
    setAddOpen(true);
  };

  // เมื่อเปลี่ยน Size (Spec)
  const onChangeSize = (variantId: string) => {
    setSelectedVariantId(variantId);
    const sz = currentSizes.find(
      (s) => ((s as any)?.variantId ?? s.specification) === variantId,
    );
    setSelectedSpec(sz?.specification ?? '');
    // reset dot selection
    setSelectedDotCode(null);
    setSelectedUnitPrice(0);
    setMaxQty(0);
    setQty(1);
  };

  // เมื่อเลือก DOT
  const onPickDot = (dotCode: string) => {
    if (!selectedVariantId) return;
    const sz = currentSizes.find(
      (s) => ((s as any)?.variantId ?? s.specification) === selectedVariantId,
    );
    const dot = sz?.dots.find((d) => d.dotCode === dotCode);
    if (!dot) return;
    setSelectedDotCode(dotCode);
    setSelectedUnitPrice(
      dot.promoPrice && dot.promoPrice > 0 ? dot.promoPrice : dot.basePrice,
    );
    setMaxQty(dot.qty);
    setQty(dot.qty > 0 ? 1 : 0);
  };

  // ยืนยันเพิ่มลงตะกร้า
  const confirmAddToCart = () => {
    if (!currentProduct || !currentBranch || !selectedVariantId || !selectedDotCode) return;
    if (qty <= 0) return;

    const id = [
      currentProduct.id,
      currentBranch.branchId,
      selectedVariantId,
      selectedDotCode,
    ].join('__');

    addToCart({
      // @ts-ignore – ให้ทำงานได้แม้ type เดิมยังไม่รู้จัก variantId
      id,
      productId: currentProduct.id,
      productName: currentProduct.name,
      specification: selectedSpec,
      variantId: selectedVariantId,
      dotCode: selectedDotCode,
      quantity: qty,
      unitPrice: selectedUnitPrice,
      sellerBranch: currentBranch.branchName,
      sellerBranchId: currentBranch.branchId,
      maxQuantity: maxQty,
    });

    setAddOpen(false);
  };

  // Group cart by seller
  const groupedCart = useMemo(() => {
    const m = new Map<string, typeof cartItems>();
    cartItems.forEach((i) => {
      const key = (i as any).sellerBranchId;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(i);
    });
    return m;
  }, [cartItems]);

  const cartTotal = useMemo(
    () => cartItems.reduce((s, i) => s + (i as any).quantity * (i as any).unitPrice, 0),
    [cartItems],
  );

  // Place Order (ตามเดิม)
  const placeOrder = async () => {
    if (cartItems.length === 0) return;
    const creations: Promise<any>[] = [];

    Array.from(groupedCart.entries()).forEach(([sellerId, items]) => {
      const totalAmount = items.reduce(
        (s, it) => s + (it as any).quantity * (it as any).unitPrice,
        0,
      );

      const orderPayload = {
        buyerBranchId: myBranchId,
        buyerBranchName: myBranchName,
        items: items.map((it) => {
          const i = it as any;
          return {
            productId: i.productId,
            productName: i.productName,
            specification: i.specification,
            variantId: i.variantId, // ใช้ตัดสต็อกตอน Pay
            dotCode: i.dotCode,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.quantity * i.unitPrice,
            sellerBranchId: i.sellerBranchId,
            sellerBranchName: i.sellerBranch,
          };
        }),
        totalAmount,
        ...(orderNotes.trim() ? { notes: orderNotes.trim() } : {}),
      };

      creations.push(OrderService.createOrder(orderPayload as any));
    });

    await Promise.all(creations);

    clearCart();
    setOrderNotes('');
    setReviewOpen(false);
    setCurrentView('orders');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">B2B Marketplace</h1>
          <p className="text-muted-foreground">
            Order products from other dealers in your network
          </p>
        </div>

        {/* View Cart → Review Dialog */}
        <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
          <DialogTrigger asChild>
            <Button>
              <ShoppingCart className="h-4 w-4 mr-2" />
              View Cart ({cartItems.length})
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Review Your Order</DialogTitle>
              <DialogDescription>
                Review your order details before placing your order with the
                selected dealers.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {cartItems.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Your cart is empty
                </div>
              ) : (
                Array.from(groupedCart.entries()).map(([sellerId, items]) => {
                  const sellerName = (items[0] as any)?.sellerBranch ?? '—';
                  const sellerTotal = items.reduce(
                    (s, i) => s + (i as any).quantity * (i as any).unitPrice,
                    0,
                  );

                  return (
                    <div key={sellerId} className="rounded-lg border">
                      <div className="flex items-center gap-2 px-3 py-2 border-b">
                        <Store className="h-4 w-4" />
                        <span className="font-medium">{sellerName}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {thb.format(sellerTotal)}
                        </Badge>
                      </div>

                      <div className="p-3 space-y-2">
                        {items.map((item) => {
                          const i = item as any;
                          return (
                            <div
                              key={i.id}
                              className="flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="font-medium truncate">
                                  {i.productName}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {i.specification} • DOT: {i.dotCode}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    updateQuantity(
                                      i.id,
                                      Math.max(1, i.quantity - 1),
                                    )
                                  }
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-sm font-medium">
                                  {i.quantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    updateQuantity(
                                      i.id,
                                      Math.min(i.maxQuantity, i.quantity + 1),
                                    )
                                  }
                                  disabled={i.quantity >= i.maxQuantity}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <span className="w-20 text-right text-sm">
                                  {thb.format(i.quantity * i.unitPrice)}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => removeFromCart(i.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Total:</span>
              <span className="font-semibold">{thb.format(cartTotal)}</span>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Order Notes (Optional)</label>
              <Textarea
                placeholder="Add any special instructions or delivery requirements..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={placeOrder}
                disabled={cartItems.length === 0}
              >
                Place Order
              </Button>
              <Button variant="outline" onClick={() => setReviewOpen(false)}>
                Continue Shopping
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Dealer Network</div>
            <div className="mt-1 text-2xl font-bold">{dealerNetwork}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Your Products</div>
            <div className="mt-1 text-2xl font-bold">{inventory.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Pending Orders</div>
            <div className="mt-1 text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Monthly Spent</div>
            <div className="mt-1 text-2xl font-bold">{thb.format(0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4" />
            Marketplace Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search products, brands, dealers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedBranch} onValueChange={(v) => setSelectedBranch(v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                {branchOptions.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedBrand} onValueChange={(v) => setSelectedBrand(v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                {brandOptions.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {filtered.length} products from {dealerNetwork} dealers
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={sortBy}
                onValueChange={(v: 'price' | 'stock') => setSortBy(v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Price: Low to High</SelectItem>
                  <SelectItem value="stock">Most Stock</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  setLoading(true);
                  setInventory(await InventoryService.fetchInventory());
                  setLoading(false);
                }}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="h-5 w-2/3 bg-slate-100 rounded" />
                <div className="h-3 w-1/2 bg-slate-100 rounded" />
                <div className="h-20 bg-slate-100 rounded" />
                <div className="h-10 bg-slate-100 rounded" />
              </CardContent>
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-14 text-center">
              <Package className="h-10 w-10 mx-auto text-slate-400" />
              <p className="mt-2 text-muted-foreground">No products found</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((item) => {
            const inCart = cartItems.some(
              (it: any) =>
                it.productName === item.productName &&
                it.sellerBranchId === item.branchId,
            );

            return (
              <Card
                key={`${item.productId}-${item.branchId}`}
                className="overflow-hidden"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg leading-tight">
                        {item.productName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {item.brand} • {item.skuLike || '—'}
                      </p>
                    </div>
                    <Badge variant="secondary">{item.units} units</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{item.branchName}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>—</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                        <span className="text-sm font-medium">—</span>
                      </div>
                      <div className="text-xs text-muted-foreground">—</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Wholesale Price
                      </span>
                      <span className="text-lg font-semibold text-blue-600">
                        {item.minPrice ? thb.format(item.minPrice) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Min. Order</span>
                      <span>1 unit</span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => openAddModal(item)}
                    variant={inCart ? 'secondary' : 'default'}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to Cart
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add to Cart Dialog (เลือก Size/DOT/จำนวน) */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select DOT & Quantity</DialogTitle>
            <DialogDescription>
              Choose the tyre specification (size) and DOT you want to order.
            </DialogDescription>
          </DialogHeader>

          {!currentProduct || !currentBranch ? (
            <div className="text-center text-muted-foreground py-8">No data</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded border p-3">
                <div className="font-medium">{currentProduct.name}</div>
                <div className="text-xs text-muted-foreground">
                  From: {currentBranch.branchName}
                </div>
              </div>

              {/* Size (Spec) */}
              <div className="space-y-1">
                <div className="text-sm font-medium">Size / Specification</div>
                <Select
                  value={selectedVariantId ?? undefined}
                  onValueChange={onChangeSize}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Size" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentSizes.map((s) => {
                      const vId = (s as any)?.variantId ?? s.specification;
                      return (
                        <SelectItem key={vId} value={vId}>
                          {s.specification}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* DOT list */}
              <div className="space-y-2">
                <div className="text-sm font-medium">DOT</div>
                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    const sz = currentSizes.find(
                      (s) =>
                        ((s as any)?.variantId ?? s.specification) ===
                        selectedVariantId,
                    );
                    if (!sz) return <div className="text-sm text-muted-foreground">Select a size first</div>;
                    if (sz.dots.length === 0)
                      return (
                        <div className="text-sm text-muted-foreground">
                          No DOT available for this size
                        </div>
                      );

                    return sz.dots.map((d) => {
                      const price =
                        d.promoPrice && d.promoPrice > 0 ? d.promoPrice : d.basePrice;
                      const selected = selectedDotCode === d.dotCode;
                      return (
                        <button
                          key={d.dotCode}
                          type="button"
                          onClick={() => onPickDot(d.dotCode)}
                          className={`w-full flex items-center justify-between rounded border p-2 text-left transition
                            ${selected ? 'border-blue-600 ring-2 ring-blue-200' : 'hover:bg-slate-50'}`}
                        >
                          <div>
                            <div className="font-medium">DOT: {d.dotCode}</div>
                            <div className="text-xs text-muted-foreground">
                              Stock: {d.qty.toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right">
                            {d.promoPrice && d.promoPrice > 0 ? (
                              <>
                                <div className="flex items-center gap-1 text-red-600 font-semibold">
                                  <Tag className="h-3 w-3" />
                                  {thb.format(d.promoPrice)}
                                </div>
                                <div className="text-xs line-through text-muted-foreground">
                                  {thb.format(d.basePrice)}
                                </div>
                              </>
                            ) : (
                              <div className="font-semibold">{thb.format(price)}</div>
                            )}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <div className="text-sm font-medium">Quantity</div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={!selectedDotCode || qty <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    className="w-20 text-center"
                    type="number"
                    min={1}
                    max={maxQty || 1}
                    value={qty}
                    onChange={(e) =>
                      setQty(() => {
                        const v = parseInt(e.target.value || '1', 10);
                        if (!selectedDotCode) return 1;
                        return Math.min(Math.max(1, v), maxQty || 1);
                      })
                    }
                    disabled={!selectedDotCode}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setQty((q) => Math.min((maxQty || 1), q + 1))}
                    disabled={!selectedDotCode || qty >= (maxQty || 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <div className="ml-auto text-sm text-muted-foreground">
                    Max: {maxQty.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="flex items-center justify-between border-t pt-3">
                <div className="text-sm">
                  Unit: {selectedDotCode ? thb.format(selectedUnitPrice) : '—'}
                </div>
                <div className="text-base font-semibold">
                  Total:{' '}
                  {selectedDotCode ? thb.format(selectedUnitPrice * qty) : '—'}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={confirmAddToCart}
                  disabled={!selectedDotCode || qty <= 0}
                >
                  Add to Cart
                </Button>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
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
