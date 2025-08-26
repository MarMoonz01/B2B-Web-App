'use client';

import * as React from 'react';
import { useForm, Controller, useFieldArray, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';

// ---------- types ----------
export type Variant = {
  id?: string;
  size: string;
  loadIndex?: string;
  base?: number;
  price?: number;
  sku?: string;
  barcode?: string;
  stock?: number;
  lowStockThreshold?: number;
};

export type Product = {
  id: string;
  brand: string;
  model: string;
  category?: string;
  tags?: string[];
  onSale?: boolean;
  promoPrice?: number | null;
  notes?: string;
  images?: string[];
  variants: Variant[];
};

// ---------- schema ----------
const variantSchema = z.object({
  id: z.string().optional(),
  size: z.string().min(1, 'กรอก Size'),
  loadIndex: z.string().optional(),
  base: z.coerce.number().min(0).optional(),
  price: z.coerce.number().min(0).optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  stock: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
});

const productSchema = z.object({
  brand: z.string().min(1, 'กรอกแบรนด์'),
  model: z.string().min(1, 'กรอกรุ่น'),
  category: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  onSale: z.boolean().optional().default(false),
  promoPrice: z
    .union([z.coerce.number().min(0), z.null()])
    .optional()
    .transform((v) => (v === undefined ? null : v)),
  notes: z.string().optional(),
  variants: z.array(variantSchema).min(1, 'ต้องมีอย่างน้อย 1 variant'),
});

type FormValues = z.infer<typeof productSchema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product;
  branchId?: string;
  onSaved?: (updated: Product) => void;
};

// ---------- data layer ----------
import { db } from '@/lib/firebase';
import { doc, updateDoc, getFirestore } from "firebase/firestore";

export default function EditProductDialog({
  open,
  onOpenChange,
  product,
  branchId,
  onSaved,
}: Props) {
  const [tagInput, setTagInput] = React.useState('');

  const form = useForm<FormValues>({
    // ✅ ไม่ระบุ Resolver<FormValues> ตรง ๆ เพื่อเลี่ยง TS 2322
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      brand: product.brand ?? '',
      model: product.model ?? '',
      category: product.category ?? '',
      tags: product.tags ?? [],
      onSale: !!product.onSale,
      promoPrice: product.promoPrice ?? null,
      notes: product.notes ?? '',
      variants: product.variants?.length
        ? product.variants
        : [{
            size: '',
            loadIndex: '',
            base: 0,
            price: 0,
            sku: '',
            barcode: '',
            stock: 0,
            lowStockThreshold: 0,
          }],
    },
    mode: 'onChange',
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting, isValid },
  } = form;

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });
  const onSale = watch('onSale');

  // ✅ ใช้ SubmitHandler<FormValues> ให้ตรงชนิด
  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const payload: Partial<Product> = {
      brand: values.brand.trim(),
      model: values.model.trim(),
      category: values.category?.trim() || undefined,
      tags: (values.tags ?? []).map((t) => t.trim()).filter(Boolean),
      onSale: !!values.onSale,
      promoPrice: values.onSale ? Number(values.promoPrice ?? 0) : null,
      notes: values.notes?.trim() || undefined,
      variants: values.variants.map((v) => ({
        ...v,
        size: v.size.trim(),
        loadIndex: v.loadIndex?.trim() || undefined,
        base: v.base !== undefined ? Number(v.base) : undefined,
        price: v.price !== undefined ? Number(v.price) : undefined,
        sku: v.sku?.trim() || undefined,
        barcode: v.barcode?.trim() || undefined,
        stock: v.stock !== undefined ? Number(v.stock) : undefined,
        lowStockThreshold:
          v.lowStockThreshold !== undefined ? Number(v.lowStockThreshold) : undefined,
      })),
    };

    await toast.promise(updateDoc(doc(db, 'inventory', product.id), payload as any), {
      loading: 'Saving...',
      success: 'บันทึกสำเร็จ',
      error: (e: any) => e?.message ?? 'เกิดข้อผิดพลาด',
    });

    onOpenChange(false);
    onSaved?.({ ...product, ...payload } as Product);
  };

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    const current = form.getValues('tags') ?? [];
    if (!current.includes(t)) {
      setValue('tags', [...current, t], { shouldDirty: true, shouldValidate: true });
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    const current = form.getValues('tags') ?? [];
    setValue('tags', current.filter((t) => t !== tag), { shouldDirty: true, shouldValidate: true });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !isSubmitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* General */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="brand">Brand name</Label>
              <Controller
                name="brand"
                control={control}
                render={({ field }) => (
                  <Input id="brand" placeholder="e.g. MICHELIN" {...field} />
                )}
              />
            </div>
            <div>
              <Label htmlFor="model">Model name</Label>
              <Controller
                name="model"
                control={control}
                render={({ field }) => (
                  <Input id="model" placeholder="e.g. e-PRIMACY" {...field} />
                )}
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Input id="category" placeholder="e.g. Passenger / SUV" {...field} />
                )}
              />
            </div>

            {/* Tags */}
            <div>
              <Label>Tags</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="เช่น premium, EV, summer"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button type="button" onClick={addTag} variant="secondary">
                  Add
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(watch('tags') ?? []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing flags */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Controller
                control={control}
                name="onSale"
                render={({ field }) => (
                  <>
                    <Switch id="onSale" checked={field.value} onCheckedChange={field.onChange} />
                    <Label htmlFor="onSale">On sale</Label>
                  </>
                )}
              />
            </div>
            <div className={`${onSale ? '' : 'opacity-50 pointer-events-none'}`}>
              <Label htmlFor="promoPrice">Promo price</Label>
              <Controller
                control={control}
                name="promoPrice"
                render={({ field }) => (
                  <Input
                    id="promoPrice"
                    inputMode="decimal"
                    placeholder="เช่น 3990"
                    value={field.value ?? ''}            // ✅ null -> ''
                    onChange={(e) => {
                      const v = e.target.value;
                      field.onChange(v === '' ? null : Number(v));
                    }}
                  />
                )}
              />
            </div>
          </section>

          {/* Variants */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base">Variants</Label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  append({
                    size: '',
                    loadIndex: '',
                    base: 0,
                    price: 0,
                    sku: '',
                    barcode: '',
                    stock: 0,
                    lowStockThreshold: 0,
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Variant
              </Button>
            </div>

            <ScrollArea className="max-h-[320px] rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Size</TableHead>
                    <TableHead className="min-w-[90px]">Load/Index</TableHead>
                    <TableHead className="min-w-[90px] text-right">Base</TableHead>
                    <TableHead className="min-w-[90px] text-right">Price</TableHead>
                    <TableHead className="min-w-[120px]">SKU</TableHead>
                    <TableHead className="min-w-[120px]">Barcode</TableHead>
                    <TableHead className="min-w-[90px] text-right">Stock</TableHead>
                    <TableHead className="min-w-[120px] text-right">Low stock</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((row, idx) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Controller
                          control={control}
                          name={`variants.${idx}.size`}
                          render={({ field }) => <Input placeholder="215/60R16" {...field} />}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          control={control}
                          name={`variants.${idx}.loadIndex`}
                          render={({ field }) => <Input placeholder="95H" {...field} />}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Controller
                          control={control}
                          name={`variants.${idx}.base`}
                          render={({ field }) => (
                            <Input
                              inputMode="decimal"
                              placeholder="0"
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                field.onChange(v === '' ? undefined : Number(v));
                              }}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Controller
                          control={control}
                          name={`variants.${idx}.price`}
                          render={({ field }) => (
                            <Input
                              inputMode="decimal"
                              placeholder="0"
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                field.onChange(v === '' ? undefined : Number(v));
                              }}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          control={control}
                          name={`variants.${idx}.sku`}
                          render={({ field }) => <Input placeholder="SKU" {...field} />}
                        />
                      </TableCell>
                      <TableCell>
                        <Controller
                          control={control}
                          name={`variants.${idx}.barcode`}
                          render={({ field }) => <Input placeholder="Barcode" {...field} />}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Controller
                          control={control}
                          name={`variants.${idx}.stock`}
                          render={({ field }) => (
                            <Input
                              inputMode="numeric"
                              placeholder="0"
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                field.onChange(v === '' ? undefined : Number(v));
                              }}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Controller
                          control={control}
                          name={`variants.${idx}.lowStockThreshold`}
                          render={({ field }) => (
                            <Input
                              inputMode="numeric"
                              placeholder="0"
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                field.onChange(v === '' ? undefined : Number(v));
                              }}
                            />
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </section>

          {/* Notes */}
          <section>
            <Label htmlFor="notes">Notes</Label>
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <Textarea id="notes" placeholder="รายละเอียดเพิ่มเติม (ภายในร้าน)" {...field} />
              )}
            />
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Close
            </Button>
            <Button type="submit" disabled={isSubmitting || !isValid}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
