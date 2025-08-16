'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
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
import { Plus, Trash2, Save, RefreshCw, Pencil, RotateCcw } from 'lucide-react';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

type DotRow = { dotCode: string; qty: number; promoPrice: number | null };
type VariantRow = {
  id: string;
  size: string;
  loadIndex?: string;
  basePrice?: number;
  dots: DotRow[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** branchId */
  storeId: string;
  /** id ของ brand & model (อย่าลืมใช้ slug เดียวกับเอกสารจริง) */
  brandId: string;
  modelId: string;
  /** สำหรับขึ้นหัวข้อ (optional) */
  brandName?: string;
  modelName?: string;
  onSaved?: () => void;
};

export default function EditProductDialog({
  open,
  onOpenChange,
  storeId,
  brandId,
  modelId,
  brandName: brandNameProp,
  modelName: modelNameProp,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [saving, setSaving] = useState(false);

  const [brandName, setBrandName] = useState(brandNameProp ?? '');
  const [modelName, setModelName] = useState(modelNameProp ?? '');

  const [variants, setVariants] = useState<VariantRow[]>([]);

  // โหลดข้อมูล brand/model (name) และ variants+dots
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoading(true);

        const brandRef = doc(db, 'stores', storeId, 'inventory', brandId);
        const brandSnap = await getDoc(brandRef);
        const brandData = brandSnap.exists() ? (brandSnap.data() as any) : null;

        const modelRef = doc(brandRef, 'models', modelId);
        const modelSnap = await getDoc(modelRef);
        const modelData = modelSnap.exists() ? (modelSnap.data() as any) : null;

        setBrandName(brandNameProp ?? brandData?.brandName ?? brandId);
        setModelName(modelNameProp ?? modelData?.modelName ?? modelId);

        const variantsCol = collection(modelRef, 'variants');
        const vSnap = await getDocs(query(variantsCol));
        const vList: VariantRow[] = [];

        for (const v of vSnap.docs) {
          const vData = v.data() as any;
          const dotsCol = collection(v.ref, 'dots');
          const dSnap = await getDocs(query(dotsCol));
          const dots: DotRow[] = dSnap.docs.map((d) => {
            const dd = d.data() as any;
            return {
              dotCode: d.id,
              qty: Number(dd.qty ?? 0),
              promoPrice:
                dd.promoPrice == null || dd.promoPrice === ''
                  ? null
                  : Number(dd.promoPrice),
            };
          });

          vList.push({
            id: v.id,
            size: String(vData.size ?? ''),
            loadIndex: String(vData.loadIndex ?? ''),
            basePrice:
              vData.basePrice == null || vData.basePrice === ''
                ? undefined
                : Number(vData.basePrice),
            dots,
          });
        }

        setVariants(vList);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message ?? 'Load failed');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, storeId, brandId, modelId]);

  async function saveMeta() {
    setSavingMeta(true);
    try {
      const brandRef = doc(db, 'stores', storeId, 'inventory', brandId);
      const modelRef = doc(brandRef, 'models', modelId);

      await updateDoc(brandRef, {
        brandName: brandName.trim(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(modelRef, {
        modelName: modelName.trim(),
        updatedAt: serverTimestamp(),
      });

      toast.success('Names updated');
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Save failed');
    } finally {
      setSavingMeta(false);
    }
  }

  async function addVariant() {
    setSaving(true);
    try {
      const brandRef = doc(db, 'stores', storeId, 'inventory', brandId);
      const modelRef = doc(brandRef, 'models', modelId);
      const variantsCol = collection(modelRef, 'variants');
      const docRef = await addDoc(variantsCol, {
        size: '205/55R16',
        loadIndex: '',
        basePrice: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setVariants((prev) => [
        ...prev,
        { id: docRef.id, size: '205/55R16', loadIndex: '', basePrice: 0, dots: [] },
      ]);
      toast.success('Variant created');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Create variant failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveVariant(v: VariantRow) {
    setSaving(true);
    try {
      const ref = doc(
        db,
        'stores',
        storeId,
        'inventory',
        brandId,
        'models',
        modelId,
        'variants',
        v.id
      );
      await updateDoc(ref, {
        size: v.size.trim(),
        loadIndex: (v.loadIndex ?? '').trim(),
        basePrice: v.basePrice ?? 0,
        updatedAt: serverTimestamp(),
      });
      toast.success('Variant saved');
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteVariant(vId: string) {
    setSaving(true);
    try {
      const vRef = doc(
        db,
        'stores',
        storeId,
        'inventory',
        brandId,
        'models',
        modelId,
        'variants',
        vId
      );
      // ลบ subcollection dots ทั้งหมดก่อน
      const dotsCol = collection(vRef, 'dots');
      const dSnap = await getDocs(query(dotsCol));
      for (const d of dSnap.docs) await deleteDoc(d.ref);
      await deleteDoc(vRef);

      setVariants((prev) => prev.filter((x) => x.id !== vId));
      toast.success('Variant deleted');
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  async function addDot(v: VariantRow) {
    setSaving(true);
    try {
      const dotCode = prompt('DOT code (e.g. 2325)?', '');
      if (!dotCode) {
        setSaving(false);
        return;
      }
      const qtyStr = prompt('Quantity?', '1') ?? '1';
      const promoStr = prompt('Promo price (optional)?', '') ?? '';

      const dotRef = doc(
        db,
        'stores',
        storeId,
        'inventory',
        brandId,
        'models',
        modelId,
        'variants',
        v.id,
        'dots',
        dotCode.trim()
      );
      const data: any = {
        qty: Number(qtyStr) || 0,
        updatedAt: serverTimestamp(),
      };
      if (promoStr.trim() !== '') data.promoPrice = Number(promoStr);

      await setDoc(dotRef, { ...data, createdAt: serverTimestamp() }, { merge: true });

      setVariants((prev) =>
        prev.map((row) =>
          row.id === v.id
            ? {
                ...row,
                dots: [
                  ...row.dots.filter((d) => d.dotCode !== dotCode.trim()),
                  {
                    dotCode: dotCode.trim(),
                    qty: Number(qtyStr) || 0,
                    promoPrice: promoStr.trim() ? Number(promoStr) : null,
                  },
                ],
              }
            : row
        )
      );

      toast.success('DOT added');
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Add DOT failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveDot(vId: string, dot: DotRow) {
    setSaving(true);
    try {
      const ref = doc(
        db,
        'stores',
        storeId,
        'inventory',
        brandId,
        'models',
        modelId,
        'variants',
        vId,
        'dots',
        dot.dotCode
      );
      const payload: any = {
        qty: Number(dot.qty) || 0,
        updatedAt: serverTimestamp(),
      };
      if (dot.promoPrice == null || dot.promoPrice === ('' as any)) {
        payload.promoPrice = null;
      } else {
        payload.promoPrice = Number(dot.promoPrice);
      }
      await setDoc(ref, payload, { merge: true });
      toast.success('DOT saved');
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function renameDot(vId: string, oldCode: string) {
    setSaving(true);
    try {
      const newCode = prompt(`Rename DOT "${oldCode}" to:`, oldCode);
      if (!newCode || newCode.trim() === oldCode) {
        setSaving(false);
        return;
      }
      const vRef = doc(
        db,
        'stores',
        storeId,
        'inventory',
        brandId,
        'models',
        modelId,
        'variants',
        vId
      );
      const oldRef = doc(vRef, 'dots', oldCode);
      const oldSnap = await getDoc(oldRef);
      if (!oldSnap.exists()) throw new Error('Old DOT not found');

      const data = oldSnap.data();
      const newRef = doc(vRef, 'dots', newCode.trim());
      await setDoc(newRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
      await deleteDoc(oldRef);

      setVariants((prev) =>
        prev.map((row) =>
          row.id !== vId
            ? row
            : {
                ...row,
                dots: row.dots
                  .filter((d) => d.dotCode !== oldCode)
                  .concat({
                    dotCode: newCode.trim(),
                    qty: Number((data as any).qty ?? 0),
                    promoPrice:
                      (data as any).promoPrice == null
                        ? null
                        : Number((data as any).promoPrice),
                  }),
              }
        )
      );

      toast.success('DOT renamed');
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Rename failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDot(vId: string, dotCode: string) {
    setSaving(true);
    try {
      const ref = doc(
        db,
        'stores',
        storeId,
        'inventory',
        brandId,
        'models',
        modelId,
        'variants',
        vId,
        'dots',
        dotCode
      );
      await deleteDoc(ref);

      setVariants((prev) =>
        prev.map((row) =>
          row.id !== vId ? row : { ...row, dots: row.dots.filter((d) => d.dotCode !== dotCode) }
        )
      );

      toast.success('DOT deleted');
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  const title = useMemo(() => {
    const bn = brandName || brandId;
    const mn = modelName || modelId;
    return `${bn} ${mn}`.trim();
  }, [brandName, brandId, modelName, modelId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>แก้ไขชื่อ Brand/Model • Variant • DOT codes</DialogDescription>
        </DialogHeader>

        {/* Meta (brand/model names) */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Brand name</Label>
                <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                <div className="text-[10px] text-muted-foreground mt-1">
                  ID: <code className="font-mono">{brandId}</code>
                </div>
              </div>
              <div>
                <Label>Model name</Label>
                <Input value={modelName} onChange={(e) => setModelName(e.target.value)} />
                <div className="text-[10px] text-muted-foreground mt-1">
                  ID: <code className="font-mono">{modelId}</code>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveMeta} disabled={savingMeta}>
                {savingMeta ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save names
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Variants & Dots */}
        <div className="flex items-center justify-between mt-2">
          <div className="font-medium">Variants & DOTs</div>
          <Button size="sm" variant="outline" onClick={addVariant} disabled={saving || loading}>
            <Plus className="h-4 w-4 mr-1" />
            Add Variant
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : variants.length === 0 ? (
          <div className="text-sm text-muted-foreground">No variants yet.</div>
        ) : (
          <div className="space-y-4">
            {variants.map((v) => (
              <Card key={v.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Variant: {v.size}</div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => addDot(v)} disabled={saving}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add DOT
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteVariant(v.id)}
                        disabled={saving}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete Variant
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Size</Label>
                      <Input
                        value={v.size}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((x) => (x.id === v.id ? { ...x, size: e.target.value } : x))
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Load index</Label>
                      <Input
                        value={v.loadIndex ?? ''}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((x) =>
                              x.id === v.id ? { ...x, loadIndex: e.target.value } : x
                            )
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Base price</Label>
                      <Input
                        type="number"
                        min={0}
                        value={v.basePrice ?? 0}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((x) =>
                              x.id === v.id ? { ...x, basePrice: Number(e.target.value) } : x
                            )
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => saveVariant(v)} disabled={saving}>
                      {saving ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save variant
                        </>
                      )}
                    </Button>
                  </div>

                  <Separator />

                  <div className="text-xs text-muted-foreground">DOT codes</div>
                  {v.dots.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No DOTs</div>
                  ) : (
                    <div className="space-y-2">
                      {v.dots.map((d) => (
                        <div key={d.dotCode} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-4">
                            <Label>DOT code</Label>
                            <div className="flex items-center gap-2">
                              <Input value={d.dotCode} disabled className="font-mono" />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                title="Rename DOT code"
                                onClick={() => renameDot(v.id, d.dotCode)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="col-span-3">
                            <Label>Qty</Label>
                            <Input
                              type="number"
                              min={0}
                              value={d.qty}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setVariants((prev) =>
                                  prev.map((row) =>
                                    row.id !== v.id
                                      ? row
                                      : {
                                          ...row,
                                          dots: row.dots.map((x) =>
                                            x.dotCode === d.dotCode ? { ...x, qty: val } : x
                                          ),
                                        }
                                  )
                                );
                              }}
                            />
                          </div>
                          <div className="col-span-3">
                            <Label>Promo price (optional)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={d.promoPrice ?? ''}
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                setVariants((prev) =>
                                  prev.map((row) =>
                                    row.id !== v.id
                                      ? row
                                      : {
                                          ...row,
                                          dots: row.dots.map((x) =>
                                            x.dotCode === d.dotCode
                                              ? {
                                                  ...x,
                                                  promoPrice: val === '' ? null : Number(val),
                                                }
                                              : x
                                          ),
                                        }
                                  )
                                );
                              }}
                            />
                          </div>
                          <div className="col-span-2 flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveDot(v.id, d)}
                              disabled={saving}
                            >
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteDot(v.id, d.dotCode)}
                              disabled={saving}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              // refresh data quick
              onOpenChange(false);
              setTimeout(() => onOpenChange(true), 0);
            }}
            title="Reload"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
