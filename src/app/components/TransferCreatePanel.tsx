'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  StoreService, InventoryService, OrderService,
  type GroupedProduct, type SizeVariant, type OrderItem,
} from '@/lib/services/InventoryService';
import { getAuth } from 'firebase/auth';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';

import { Boxes, ChevronRight, Plus, Search, Trash2 } from 'lucide-react';
import useDebounce from '@/hooks/useDebounce';
import { toast } from 'sonner'; // <-- ใช้ sonner แทน useToast

function priceOf(dot: { promoPrice?: number | null; basePrice?: number }) {
  return (dot.promoPrice ?? undefined) !== undefined && dot.promoPrice !== null ? dot.promoPrice! : (dot.basePrice ?? 0);
}

type StoresMap = Record<string, string>;
type DraftLine = { product: GroupedProduct; variant: SizeVariant; dotCode: string; availQty: number; qty: number; unitPrice: number; };

type Props = {
  defaultSellerId?: string;
  defaultBuyerId?: string;
  lockSellerToActive?: boolean;
};

export default function TransferCreatePanel({
  defaultSellerId,
  defaultBuyerId,
  lockSellerToActive,
}: Props) {
  const authUid = useMemo(() => getAuth().currentUser?.uid ?? 'system', []);

  const [stores, setStores] = useState<StoresMap>({});
  const [sellerId, setSellerId] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [inventory, setInventory] = useState<GroupedProduct[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 180);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const totalAmount = useMemo(() => draft.reduce((s, l) => s + l.unitPrice * l.qty, 0), [draft]);

  useEffect(() => {
    (async () => {
      const m = await StoreService.getAllStores();
      setStores(m);
      const ids = Object.keys(m);
      setSellerId(prev =>
        (defaultSellerId && m[defaultSellerId]) ? defaultSellerId :
        prev || ids[0] || ''
      );
      setBuyerId(prev =>
        (defaultBuyerId && m[defaultBuyerId]) ? defaultBuyerId :
        prev || (ids[1] || ids[0] || '')
      );
    })();
  }, [defaultSellerId, defaultBuyerId]);

  useEffect(() => {
    (async () => {
      if (!sellerId) return;
      setLoading(true);
      const list = await InventoryService.fetchStoreInventory(sellerId, stores[sellerId]);
      setInventory(list);
      setExpandedId(null);
      setLoading(false);
    })();
  }, [sellerId, stores]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return inventory;
    const q = debouncedSearch.toLowerCase();
    return inventory.filter(p => `${p.name} ${p.brand} ${p.model}`.toLowerCase().includes(q));
  }, [inventory, debouncedSearch]);

  function addLine(p: GroupedProduct, v: SizeVariant, dotCode: string, availQty: number) {
    const dot = v.dots.find(d => d.dotCode === dotCode)!;
    const unitPrice = priceOf(dot);
    setDraft(prev => {
      const idx = prev.findIndex(l => l.product.id === p.id && l.variant.variantId === v.variantId && l.dotCode === dotCode);
      if (idx >= 0) { const next = [...prev]; next[idx] = { ...next[idx], qty: Math.min(next[idx].qty + 1, availQty) }; return next; }
      return [...prev, { product: p, variant: v, dotCode, availQty, qty: 1, unitPrice }];
    });
  }
  const removeLine = (i: number) => setDraft(d => d.filter((_, idx) => idx !== i));
  const setQty = (i: number, val: number) => setDraft(d => d.map((l, idx) => idx === i ? { ...l, qty: Math.max(1, Math.min(val || 1, l.availQty)) } : l));

  async function submit() {
    try {
      if (!sellerId || !buyerId) throw new Error('กรุณาเลือกสาขาให้ครบ');
      if (sellerId === buyerId) throw new Error('สาขาต้นทางและปลายทางต้องต่างกัน');
      if (draft.length === 0) throw new Error('ยังไม่ได้เลือกสินค้า');
      const items: OrderItem[] = draft.map(l => ({
        productId: l.product.id, productName: l.product.name, specification: l.variant.specification,
        dotCode: l.dotCode, quantity: l.qty, unitPrice: l.unitPrice, totalPrice: l.unitPrice * l.qty, variantId: l.variant.variantId,
      }));
      const id = await OrderService.createOrder({
        buyerBranchId: buyerId, buyerBranchName: stores[buyerId] || buyerId,
        sellerBranchId: sellerId, sellerBranchName: stores[sellerId] || sellerId,
        items, totalAmount, status: 'requested', notes: note || undefined,
      });
      toast.success('Created', { description: `Order #${id.slice(0, 8)} was created.` });
      setDraft([]); setNote('');
    } catch (e: any) {
      toast.error('Create failed', { description: e?.message || String(e) });
      console.error(e);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Transfer Request</h1>
        <p className="text-sm text-muted-foreground">เลือกสาขาต้นทาง/ปลายทาง แล้วหยิบสินค้าจากสต็อกต้นทาง</p>
      </div>

      {/* branches */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-base">Branches</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Seller (ต้นทาง)</div>
            <Select value={sellerId} onValueChange={setSellerId} disabled={!!lockSellerToActive}>
              <SelectTrigger className="w-full"><SelectValue placeholder="เลือกสาขาต้นทาง" /></SelectTrigger>
              <SelectContent><SelectGroup><SelectLabel>Stores</SelectLabel>
                {Object.entries(stores).map(([id, name]) => <SelectItem key={id} value={id}>{name} <span className="text-xs text-muted-foreground">({id})</span></SelectItem>)}
              </SelectGroup></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Buyer (ปลายทาง)</div>
            <Select value={buyerId} onValueChange={setBuyerId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="เลือกสาขาปลายทาง" /></SelectTrigger>
              <SelectContent><SelectGroup><SelectLabel>Stores</SelectLabel>
                {Object.entries(stores).map(([id, name]) => <SelectItem key={id} value={id}>{name} <span className="text-xs text-muted-foreground">({id})</span></SelectItem>)}
              </SelectGroup></SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* inventory + cart */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* left */}
        <Card className="shadow-sm lg:col-span-7">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Seller Inventory</CardTitle>
              <Badge variant="outline" className="font-normal">{inventory.length} products</Badge>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search brand/model" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-3">{[...Array(3)].map((_,i)=> <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/50" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">ไม่พบสินค้าในสต็อกของสาขานี้</div>
            ) : filtered.map(p => (
              <div key={p.id} className="rounded-lg border">
                <button className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50" onClick={() => setExpandedId(v => v === p.id ? null : p.id)}>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-muted/70 flex items-center justify-center"><Boxes className="h-4 w-4" /></div>
                    <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.branches?.[0]?.branchName}</div></div>
                  </div>
                  <ChevronRight className={`h-4 w-4 transition-transform ${expandedId === p.id ? 'rotate-90' : ''}`} />
                </button>
                {expandedId === p.id && (
                  <div className="divide-y">
                    {p.branches?.[0]?.sizes.map(v => (
                      <div key={v.variantId} className="px-4 py-3">
                        <div className="mb-2 text-sm font-medium">{v.specification}</div>
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {v.dots.map(d => (
                            <div key={d.dotCode} className="flex items-center justify-between rounded-md border p-2">
                              <div>
                                <div className="text-sm font-medium">DOT {d.dotCode}</div>
                                <div className="text-xs text-muted-foreground">In stock: {d.qty}</div>
                                <div className="text-xs text-muted-foreground">Price: {Intl.NumberFormat().format(priceOf(d))}</div>
                              </div>
                              <Button size="sm" disabled={d.qty <= 0} onClick={() => addLine(p, v, d.dotCode, d.qty)}>
                                <Plus className="mr-2 h-4 w-4" /> Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* right */}
        <Card className="shadow-sm lg:col-span-5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Transfer Cart</CardTitle>
              <Badge variant="outline" className="font-normal">{draft.length} lines</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {draft.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">ยังไม่มีสินค้าในคำขอ — เลือกจากฝั่งซ้ายแล้วกด Add</div>
            ) : (
              <>
                <div className="rounded-lg border">
                  <div className="hidden grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground md:grid">
                    <div className="col-span-5">Product</div><div className="col-span-2">DOT</div>
                    <div className="col-span-2">Qty (avail)</div><div className="col-span-2">Unit</div><div className="col-span-1"></div>
                  </div>
                  <div className="divide-y">
                    {draft.map((l, i) => (
                      <div key={`${l.product.id}-${l.variant.variantId}-${l.dotCode}`} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-12 md:items-center">
                        <div className="md:col-span-5"><div className="font-medium">{l.product.name}</div><div className="text-xs text-muted-foreground">{l.variant.specification}</div></div>
                        <div className="text-sm md:col-span-2">DOT {l.dotCode}</div>
                        <div className="md:col-span-2 flex items-center gap-2">
                          <Input type="number" min={1} max={l.availQty} value={l.qty} onChange={(e) => setQty(i, Number(e.target.value))} className="h-8 w-24" />
                          <span className="text-xs text-muted-foreground">/ {l.availQty}</span>
                        </div>
                        <div className="md:col-span-2">{Intl.NumberFormat().format(l.unitPrice)}</div>
                        <div className="md:col-span-1 flex justify-end"><Button size="icon" variant="ghost" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4" /></Button></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Notes (optional)</div>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="คำอธิบายเพิ่มเติม…" />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Total amount</div>
                  <div className="text-xl font-semibold">{Intl.NumberFormat().format(totalAmount)}</div>
                </div>

                <div className="flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" disabled={!sellerId || !buyerId || sellerId === buyerId || draft.length === 0}>Submit Request</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Submit transfer request?</AlertDialogTitle>
                        <AlertDialogDescription>
                          ส่งคำขอจาก <b>{stores[sellerId] || sellerId}</b> ไปยัง <b>{stores[buyerId] || buyerId}</b>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={submit}>Confirm</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
