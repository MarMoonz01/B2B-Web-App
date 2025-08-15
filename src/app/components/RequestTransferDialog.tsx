'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { GroupedProduct } from '@/types/inventory';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type AddToCartPayload = {
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
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  product: GroupedProduct | null;
  fromBranchId: string;
  fromBranchName: string;

  myBranchId: string;
  myBranchName: string;

  /** เรียกตอนกด Add to Cart สำเร็จ */
  onAddToCart: (item: AddToCartPayload) => void;
};

const formatTHB = (n: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

export default function RequestTransferDialog({
  open,
  onOpenChange,
  product,
  fromBranchId,
  fromBranchName,
  myBranchId,
  myBranchName,
  onAddToCart,
}: Props) {
  const isOwnBranch = fromBranchId && myBranchId && String(fromBranchId) === String(myBranchId);

  const fromStoreInfo = useMemo(() => {
    if (!product) return null;
    return (product.branches || []).find((b) => String(b.branchId) === String(fromBranchId)) || null;
  }, [product, fromBranchId]);

  const sizes = useMemo(() => {
    if (!fromStoreInfo) return [];
    return (fromStoreInfo.sizes || []).filter((s: any) =>
      (s?.dots || []).some((d: any) => Number(d?.qty || 0) > 0)
    );
  }, [fromStoreInfo]);

  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const selectedSizeObj = useMemo(
    () => sizes.find((s: any) => String(s.variantId) === String(selectedVariantId)),
    [sizes, selectedVariantId]
  );

  const dotsForSize = useMemo(() => {
    const ds = (selectedSizeObj?.dots || [])
      .filter((d: any) => Number(d?.qty || 0) > 0)
      .map((d: any) => ({
        dotCode: String(d.dotCode || ''),
        qty: Number(d.qty || 0),
        unitPrice: Number(d.promoPrice ?? d.basePrice ?? 0),
        hasPromo: d.promoPrice != null,
      }));
    ds.sort((a, b) => b.qty - a.qty || a.unitPrice - b.unitPrice);
    return ds;
  }, [selectedSizeObj]);

  const [selectedDotCode, setSelectedDotCode] = useState<string>('');
  const selectedDot = useMemo(
    () => dotsForSize.find((d) => d.dotCode === selectedDotCode),
    [dotsForSize, selectedDotCode]
  );

  const maxQty = selectedDot?.qty ?? 0;
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>(''); // เก็บไว้ถ้าจะส่งแนบเข้า order ตอน submit cart (optional)
  const unitPrice = selectedDot?.unitPrice ?? 0;
  const total = unitPrice * (Number(quantity) || 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const firstSize = sizes[0];
    const vId = firstSize ? String(firstSize.variantId) : '';
    setSelectedVariantId(vId);

    const firstDot = firstSize?.dots?.find((d: any) => Number(d?.qty || 0) > 0);
    setSelectedDotCode(firstDot ? String(firstDot.dotCode) : '');

    setQuantity(1);
    setNotes('');
  }, [open, product, sizes]);

  const canAdd =
    !!product &&
    !!fromStoreInfo &&
    !!selectedSizeObj &&
    !!selectedDot &&
    quantity >= 1 &&
    quantity <= (selectedDot?.qty ?? 0) &&
    !isOwnBranch;

  const handleAddToCart = () => {
    if (!canAdd || !product || !selectedSizeObj || !selectedDot) {
      toast.error('กรุณาเลือก Size / DOT และจำนวนให้ถูกต้อง');
      return;
    }
    setBusy(true);
    try {
      onAddToCart({
        branchId: fromBranchId,
        branchName: fromBranchName,
        productId: product.id,
        productName: product.name,
        specification: String(selectedSizeObj.specification || ''),
        dotCode: selectedDot.dotCode,
        quantity: Number(quantity),
        unitPrice,
        totalPrice: total,
        variantId: String(selectedSizeObj.variantId || ''),
      });
      toast.success('Added to cart');
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to Transfer Cart</DialogTitle>
          <DialogDescription>
            Select size and DOT to add this product to your cart.
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="border rounded-lg p-4 space-y-1">
          <div className="font-semibold">{product?.name || '—'}</div>
          <div className="text-xs text-muted-foreground">
            From: <span className="font-medium">{fromBranchName || '—'}</span> · To:{' '}
            <span className="font-medium">{myBranchName || '—'}</span>
          </div>
        </div>

        {/* Selections */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">From Store</Label>
            <Input value={fromBranchName} readOnly className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">To Store</Label>
            <Input value={myBranchName} readOnly className="mt-1" />
          </div>

          <div>
            <Label className="text-xs">Size / Spec</Label>
            <Select
              value={selectedVariantId}
              onValueChange={(v) => {
                setSelectedVariantId(v);
                const size = sizes.find((s: any) => String(s.variantId) === String(v));
                const firstDot = size?.dots?.find((d: any) => Number(d?.qty || 0) > 0);
                setSelectedDotCode(firstDot ? String(firstDot.dotCode) : '');
                setQuantity(1);
              }}
              disabled={!sizes.length}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={sizes.length ? 'Select size' : 'No stock'} />
              </SelectTrigger>
              <SelectContent>
                {sizes.map((s: any) => {
                  const qtyAll = (s.dots || []).reduce((sum: number, d: any) => sum + Number(d?.qty || 0), 0);
                  return (
                    <SelectItem key={String(s.variantId)} value={String(s.variantId)}>
                      {s.specification} {qtyAll > 0 ? `· ${qtyAll} units` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">DOT</Label>
            <Select
              value={selectedDotCode}
              onValueChange={(v) => {
                setSelectedDotCode(v);
                setQuantity(1);
              }}
              disabled={!dotsForSize.length}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={dotsForSize.length ? 'Select DOT' : 'No DOT available'} />
              </SelectTrigger>
              <SelectContent>
                {dotsForSize.map((d) => (
                  <SelectItem key={d.dotCode} value={d.dotCode}>
                    <span className="font-mono">{d.dotCode}</span> · {d.qty} pcs · {formatTHB(d.unitPrice)}
                    {d.hasPromo && <Badge className="ml-2" variant="secondary">Promo</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Quantity</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={maxQty || 1}
              value={quantity}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                const next = Math.max(1, Math.min(maxQty || 1, v));
                setQuantity(next);
              }}
              className="mt-1"
              disabled={!selectedDot}
            />
            <div className="text-[10px] text-muted-foreground mt-1">
              {selectedDot ? `Available: ${maxQty} · Unit: ${formatTHB(unitPrice)}` : 'Select a DOT'}
            </div>
          </div>

          <div>
            <Label className="text-xs">Total</Label>
            <Input readOnly value={selectedDot ? formatTHB(total) : '—'} className="mt-1 font-semibold" />
          </div>
        </div>

        {/* Notes (เก็บไว้ใช้งานตอน submit cart หากต้องการแนบ) */}
        <div>
          <Label className="text-xs">Note (Optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any additional information..." className="mt-1" />
        </div>

        {isOwnBranch && (
          <div className="text-xs text-amber-600">ไม่สามารถขอจากสาขาตัวเองได้</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleAddToCart} disabled={!canAdd || busy}>
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
