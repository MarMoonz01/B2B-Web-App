'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Save, RefreshCw } from 'lucide-react';

import { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, serverTimestamp, query, getFirestore } from "firebase/firestore";
import { db } from '@/lib/firebase';

function slugifyId(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 120);
}

type DotInput = { dotCode: string; qty: string; promoPrice: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** branchId ของสาขาที่จะเพิ่มสินค้า */
  storeId: string;
  /** (optional) ค่าเริ่มต้นตอนเปิด dialog */
  defaultBrand?: string;
  defaultModel?: string;
  onCreated?: (p: { brandId: string; modelId: string; variantId: string }) => void;
};

export default function AddProductDialog({
  open,
  onOpenChange,
  storeId,
  defaultBrand = '',
  defaultModel = '',
  onCreated,
}: Props) {
  const [brandName, setBrandName] = useState(defaultBrand);
  const [modelName, setModelName] = useState(defaultModel);
  const [size, setSize] = useState('');
  const [loadIndex, setLoadIndex] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [dots, setDots] = useState<DotInput[]>([{ dotCode: '', qty: '1', promoPrice: '' }]);
  const [saving, setSaving] = useState(false);

  const brandId = useMemo(() => slugifyId(brandName || 'unknown'), [brandName]);
  const modelId = useMemo(() => slugifyId(modelName || 'unknown'), [modelName]);

  const addDotRow = () => setDots((d) => [...d, { dotCode: '', qty: '1', promoPrice: '' }]);
  const removeDotRow = (idx: number) => setDots((d) => d.filter((_, i) => i !== idx));
  const updateDotRow = (idx: number, patch: Partial<DotInput>) =>
    setDots((d) => d.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const canSave =
    !!storeId &&
    brandName.trim() !== '' &&
    modelName.trim() !== '' &&
    size.trim() !== '' &&
    dots.some((r) => r.dotCode.trim() !== '' && Number(r.qty) > 0);

  async function ensureBrandDoc(_storeId: string, _brandId: string, _brandName: string) {
    const ref = doc(db, 'stores', _storeId, 'inventory', _brandId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        brandName: _brandName.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      // ensure display name synced
      const data = snap.data() as any;
      if ((data.brandName ?? '') !== _brandName.trim()) {
        await updateDoc(ref, { brandName: _brandName.trim(), updatedAt: serverTimestamp() });
      }
    }
    return ref;
  }

  async function ensureModelDoc(_storeId: string, _brandId: string, _modelId: string, _modelName: string) {
    const ref = doc(db, 'stores', _storeId, 'inventory', _brandId, 'models', _modelId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        modelName: _modelName.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const data = snap.data() as any;
      if ((data.modelName ?? '') !== _modelName.trim()) {
        await updateDoc(ref, { modelName: _modelName.trim(), updatedAt: serverTimestamp() });
      }
    }
    return ref;
  }

  async function ensureVariant(
    _storeId: string,
    _brandId: string,
    _modelId: string,
    _size: string,
    _loadIndex: string | undefined,
    _basePrice: number | undefined
  ): Promise<string> {
    const col = collection(db, 'stores', _storeId, 'inventory', _brandId, 'models', _modelId, 'variants');
    // หา variant ที่ตรง size + loadIndex (ทำในฝั่ง client เพื่อเลี่ยง composite index)
    const snap = await getDocs(query(col));
    for (const d of snap.docs) {
      const v = d.data() as any;
      const sameSize = String(v.size ?? '').trim().toLowerCase() === _size.trim().toLowerCase();
      const sameLoad =
        String(v.loadIndex ?? '').trim().toLowerCase() === String(_loadIndex ?? '').trim().toLowerCase();
      if (sameSize && sameLoad) {
        // อัปเดต basePrice ถ้ามีการกรอก
        if (_basePrice != null && !Number.isNaN(_basePrice)) {
          await updateDoc(d.ref, { basePrice: _basePrice, updatedAt: serverTimestamp() });
        }
        return d.id;
      }
    }
    // ไม่เจอ -> สร้างใหม่
    const docRef = await addDoc(col, {
      size: _size.trim(),
      loadIndex: _loadIndex?.trim() || '',
      basePrice: _basePrice ?? 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const _brandId = brandId;
      const _modelId = modelId;
      const _base = basePrice.trim() ? Number(basePrice) : undefined;

      // 1) ensure brand & model
      const brandRef = await ensureBrandDoc(storeId, _brandId, brandName);
      await ensureModelDoc(storeId, _brandId, _modelId, modelName);

      // 2) ensure variant
      const variantId = await ensureVariant(storeId, _brandId, _modelId, size, loadIndex || undefined, _base);

      // 3) create dots
      for (const row of dots) {
        const code = row.dotCode.trim();
        const q = Number(row.qty);
        if (!code || q <= 0) continue;

        const dotRef = doc(
          brandRef,
          'models',
          _modelId,
          'variants',
          variantId,
          'dots',
          code
        );
        const toSet: any = {
          qty: q,
          updatedAt: serverTimestamp(),
        };
        if (row.promoPrice.trim() !== '') {
          toSet.promoPrice = Number(row.promoPrice);
        }
        // อย่าบันทึกค่า undefined ลง Firestore
        await setDoc(dotRef, { ...toSet, createdAt: serverTimestamp() }, { merge: true });
      }

      toast.success('Product & DOTs saved');
      onOpenChange(false);
      // callback ให้หน้าหลัก refetch
      onCreated?.({ brandId: _brandId, modelId: _modelId, variantId });
      // reset
      setBrandName('');
      setModelName('');
      setSize('');
      setLoadIndex('');
      setBasePrice('');
      setDots([{ dotCode: '', qty: '1', promoPrice: '' }]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
          <DialogDescription>
            สร้าง Brand • Model • Variant (Size/Load) และเพิ่ม DOT codes ให้สาขานี้
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Brand name</Label>
                  <Input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. Bridgestone"
                  />
                  <div className="text-[10px] text-muted-foreground mt-1">
                    ID: <code className="font-mono">{brandId || '-'}</code>
                  </div>
                </div>
                <div>
                  <Label>Model name</Label>
                  <Input
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g. Ecopia EP300"
                  />
                  <div className="text-[10px] text-muted-foreground mt-1">
                    ID: <code className="font-mono">{modelId || '-'}</code>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <Label>Size</Label>
                  <Input
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="e.g. 195/60R15"
                  />
                </div>
                <div className="col-span-1">
                  <Label>Load index (optional)</Label>
                  <Input
                    value={loadIndex}
                    onChange={(e) => setLoadIndex(e.target.value)}
                    placeholder="e.g. 88H"
                  />
                </div>
                <div className="col-span-1">
                  <Label>Base price (optional)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="e.g. 2500"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">DOT Codes</div>
                <Button size="sm" variant="outline" onClick={addDotRow}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add DOT
                </Button>
              </div>

              <div className="space-y-2">
                {dots.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Label>DOT code</Label>
                      <Input
                        value={row.dotCode}
                        onChange={(e) => updateDotRow(i, { dotCode: e.target.value })}
                        placeholder="e.g. 2325"
                        className="font-mono"
                      />
                    </div>
                    <div className="col-span-3">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min={0}
                        value={row.qty}
                        onChange={(e) => updateDotRow(i, { qty: e.target.value })}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label>Promo price (optional)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={row.promoPrice}
                        onChange={(e) => updateDotRow(i, { promoPrice: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDotRow(i)}
                        title="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave || saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
