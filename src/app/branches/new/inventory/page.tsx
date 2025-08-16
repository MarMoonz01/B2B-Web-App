'use client';

import React, { useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';

import { InventoryService, slugifyId } from '@/lib/services/InventoryService';

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = ['Branch details', 'Inventory', 'Done'];
  return (
    <ol className="mb-6 grid grid-cols-3 gap-2">
      {items.map((t, i) => {
        const idx = (i + 1) as 1 | 2 | 3;
        const active = idx <= step;
        return (
          <li key={t} className={`rounded-lg border p-3 text-center text-sm ${active ? 'bg-primary/5 border-primary/30' : 'bg-muted/40'}`}>
            <div className={`font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>{idx}. {t}</div>
          </li>
        );
      })}
    </ol>
  );
}

// CSV parser ธรรมดา (ไม่มี quote ซับซ้อน)
function parseCsvSimple(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ''));
    return obj;
  });
}

type Row = {
  brand: string;
  model: string;
  specification: string;
  dotCode: string;
  qty: number;
  basePrice?: number;
  promoPrice?: number;
};

export default function BranchInventoryImportPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const branchId = sp.get('branch') || '';
  const branchName = sp.get('name') || branchId;

  const [rows, setRows] = useState<Row[]>([]);
  const [manual, setManual] = useState<Row>({
    brand: '', model: '', specification: '', dotCode: '', qty: 0,
    basePrice: undefined, promoPrice: undefined,
  });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const template = 'brand,model,specification,dotCode,qty,basePrice,promoPrice\nMichelin,Primacy 4,205/55R16 (91V),2323,4,3200,2990';

  const validRows = useMemo(
    () => rows.filter(r => r.brand && r.model && r.specification && r.dotCode && Number(r.qty) > 0),
    [rows]
  );

  function downloadTemplate() {
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const arr = parseCsvSimple(text).map((r) => ({
          brand: r.brand || '',
          model: r.model || '',
          specification: r.specification || '',
          dotCode: r.dotCode || '',
          qty: Number(r.qty || 0),
          basePrice: r.basePrice ? Number(r.basePrice) : undefined,
          promoPrice: r.promoPrice ? Number(r.promoPrice) : undefined,
        })) as Row[];
        setRows(arr);
        toast.success(`Loaded ${arr.length} rows`);
      } catch {
        toast.error('Failed to parse CSV');
      }
    };
    reader.readAsText(f, 'utf-8');
  }

  function addManual() {
    if (!manual.brand || !manual.model || !manual.specification || !manual.dotCode || manual.qty <= 0) {
      return toast.error('Please fill all required fields');
    }
    setRows(r => [...r, manual]);
    setManual({ brand: '', model: '', specification: '', dotCode: '', qty: 0 });
  }

  function removeRow(idx: number) {
    setRows(r => r.filter((_, i) => i !== idx));
  }

  async function handleImport() {
    if (!branchId) return toast.error('Missing branch');
    if (!validRows.length) return toast.error('No valid rows to import');

    setBusy(true);
    let ok = 0;

    for (const r of validRows) {
      try {
        const brandId = slugifyId(r.brand);
        const modelId = slugifyId(r.model);
        const variantId = slugifyId(r.specification);

        await InventoryService.ensureVariantPath(
          branchId, brandId, modelId, variantId, r.specification, r.basePrice
        );
        await InventoryService.ensureDotDoc(branchId, brandId, modelId, variantId, r.dotCode);
        await InventoryService.upsertDot(branchId, {
          brand: r.brand, model: r.model, variantId, dotCode: r.dotCode, qty: r.qty, promoPrice: r.promoPrice,
        });
        ok++;
      } catch (e) {
        console.error('Row import failed:', r, e);
      }
    }

    setBusy(false);
    toast.success(`Imported ${ok}/${validRows.length} items`);

    // ✅ ไป Step 3
    router.push(`/branches/new/done?branch=${encodeURIComponent(branchId)}`);
  }

  if (!branchId) {
    return (
      <div className="max-w-3xl">
        <Stepper step={2} />
        <Card><CardHeader><CardTitle>Missing branch</CardTitle></CardHeader>
          <CardContent className="p-6 text-sm text-muted-foreground">
            URL ไม่มี <code>?branch=</code> กรุณากลับไปสร้าง/เลือกสาขาก่อน
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <Stepper step={2} />

      <Card>
        <CardHeader>
          <CardTitle>Import inventory for <span className="text-primary">{branchName}</span></CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload CSV */}
          <div className="space-y-2">
            <Label>Upload CSV</Label>
            <Input type="file" accept=".csv,text/csv" onChange={onFile} />
            <div className="text-[11px] text-muted-foreground">
              Columns: <code>brand, model, specification, dotCode, qty, basePrice, promoPrice</code>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>Download template</Button>
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(template).then(() => toast.success('Template copied'))}>Copy template</Button>
            </div>
          </div>

          <Separator />

          {/* Manual add */}
          <div className="space-y-2">
            <div className="font-medium">Add single row</div>
            <div className="grid md:grid-cols-6 gap-2">
              <Input placeholder="Brand" value={manual.brand} onChange={(e) => setManual({ ...manual, brand: e.target.value })} />
              <Input placeholder="Model" value={manual.model} onChange={(e) => setManual({ ...manual, model: e.target.value })} />
              <Input placeholder="Specification e.g. 205/55R16 (91V)" value={manual.specification} onChange={(e) => setManual({ ...manual, specification: e.target.value })} />
              <Input placeholder="DOT" value={manual.dotCode} onChange={(e) => setManual({ ...manual, dotCode: e.target.value })} />
              <Input placeholder="Qty" type="number" value={manual.qty} onChange={(e) => setManual({ ...manual, qty: Number(e.target.value || 0) })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Base" type="number" value={manual.basePrice ?? ''} onChange={(e) => setManual({ ...manual, basePrice: e.target.value ? Number(e.target.value) : undefined })} />
                <Input placeholder="Promo" type="number" value={manual.promoPrice ?? ''} onChange={(e) => setManual({ ...manual, promoPrice: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={addManual}>Add</Button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any remarks for this import…" />
          </div>

          {/* Preview */}
          <Separator />
          <div>
            <div className="mb-2 text-sm text-muted-foreground">{rows.length} rows loaded</div>
            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Specification</TableHead>
                    <TableHead>DOT</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Promo</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={`${r.dotCode}-${i}`}>
                      <TableCell>{r.brand}</TableCell>
                      <TableCell>{r.model}</TableCell>
                      <TableCell>{r.specification}</TableCell>
                      <TableCell className="font-mono">{r.dotCode}</TableCell>
                      <TableCell className="text-right">{r.qty}</TableCell>
                      <TableCell className="text-right">{r.basePrice ?? '-'}</TableCell>
                      <TableCell className="text-right">{r.promoPrice ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => removeRow(i)}>Remove</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No data yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="ghost" onClick={() => router.push('/branches/new')}>Back</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push(`/branches/new/done?branch=${encodeURIComponent(branchId)}`)}>Skip for now</Button>
              <Button onClick={handleImport} disabled={busy || !validRows.length}>
                {busy ? 'Importing…' : `Import ${validRows.length} items`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
