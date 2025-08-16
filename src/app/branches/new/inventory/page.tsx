// src/app/branches/new/inventory/page.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { InventoryService } from '@/lib/services/InventoryService';

export default function BranchInventoryStep() {
  const router = useRouter();
  const params = useSearchParams();
  const storeId = params.get('storeId') || ''; // รับมาจากสเต็ปก่อนหน้า

  // ฟอร์มสร้างสินค้าแรก (brand/model/variant/DOT)
  const [brandName, setBrandName] = useState('');
  const [modelName, setModelName] = useState('');
  const [size, setSize] = useState('');           // e.g. 215/55R17
  const [loadIndex, setLoadIndex] = useState(''); // e.g. 94V (ถ้าไม่มีเว้นได้)
  const [basePriceStr, setBasePriceStr] = useState(''); // string ก่อน ค่อย parse ตอนบันทึก
  const [dotCode, setDotCode] = useState('');
  const [qtyStr, setQtyStr] = useState('1');
  const [promoPriceStr, setPromoPriceStr] = useState('');

  const onCreate = async () => {
    try {
      if (!storeId) throw new Error('Missing storeId');
      if (!brandName.trim() || !modelName.trim() || !size.trim() || !dotCode.trim()) {
        throw new Error('กรอกข้อมูลที่จำเป็นให้ครบ (Brand, Model, Size, DOT)');
      }

      const basePrice = basePriceStr.trim() ? Number(basePriceStr) : undefined;
      const qty = qtyStr.trim() ? Number(qtyStr) : 0;
      const promoPrice = promoPriceStr.trim() ? Number(promoPriceStr) : undefined;

      // 1) ensure brand
      const { brandId } = await InventoryService.ensureBrandDoc(storeId, brandName.trim());

      // 2) ensure model
      const { modelId } = await InventoryService.ensureModelDoc(storeId, brandId, modelName.trim());

      // 3) ensure variant (อาร์กิวเมนต์ตัวที่ 5 เป็น object!)
      const variantId = `${size.replace(/\s+/g, '').toLowerCase()}${
        loadIndex ? `-${loadIndex.replace(/\s+/g, '').toLowerCase()}` : ''
      }`;
      await InventoryService.ensureVariantPath(
        storeId,
        brandId,
        modelId,
        variantId,
        {
          size: size.trim(),
          loadIndex: loadIndex.trim() || undefined,
          basePrice, // number | undefined
        }
      );

      // 4) add first DOT (ซิกเนเจอร์ใหม่: อาร์กิวเมนต์สุดท้ายเป็น object)
      await InventoryService.addNewDot(
        storeId,
        brandId,
        modelId,
        variantId,
        {
          dotCode: dotCode.trim(),
          qty,
          promoPrice,
        }
      );

      toast.success('Inventory seed สำเร็จ');
      router.push('/?view=inventory'); // กลับหน้า My Inventory หรือจะไปสเต็ปถัดไปก็ได้
    } catch (e: any) {
      toast.error(e?.message ?? 'สร้างสินค้าไม่สำเร็จ');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Step 2 – Add first inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Brand *</Label>
              <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Bridgestone" />
            </div>
            <div>
              <Label>Model *</Label>
              <Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="Turanza T005A" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Size *</Label>
              <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="215/55R17" />
            </div>
            <div>
              <Label>Load/Index</Label>
              <Input value={loadIndex} onChange={(e) => setLoadIndex(e.target.value)} placeholder="94V" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Base price</Label>
              <Input
                type="number"
                min={0}
                value={basePriceStr}
                onChange={(e) => setBasePriceStr(e.target.value)}
                placeholder="3200"
              />
            </div>
            <div>
              <Label>DOT code *</Label>
              <Input value={dotCode} onChange={(e) => setDotCode(e.target.value)} placeholder="2325" />
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input
                type="number"
                min={0}
                value={qtyStr}
                onChange={(e) => setQtyStr(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Promo price (optional)</Label>
            <Input
              type="number"
              min={0}
              value={promoPriceStr}
              onChange={(e) => setPromoPriceStr(e.target.value)}
              placeholder="Leave empty for none"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={onCreate}>Create & Continue</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
