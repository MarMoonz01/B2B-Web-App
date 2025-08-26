'use client';

import React, { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';

// icons
import {
  Building2,
  CheckCircle2,
  Clock,
  UploadCloud,
  FileDown,
  FileSpreadsheet,
  Info,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

// shadcn/ui
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

// services & context (ปรับ path ให้ตรงโปรเจกต์ของคุณ ถ้าแตกต่าง)
import { useBranch } from '@/contexts/BranchContext';
import { InventoryService, StoreService, slugifyId } from '@/lib/services/InventoryService';
import { db } from '@/lib/firebase';
import { doc, getDoc, getFirestore } from "firebase/firestore";

// -----------------------------------------------------------------------------
// AddBranchWizard: Onboarding + CSV Import (Franchise-style)
// -----------------------------------------------------------------------------
export default function AddBranchWizard({ onDone }: { onDone?: () => void }) {
  const { setActiveBranch } = useBranch();

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const next = () => setStep((s) => (s < 3 ? ((s + 1) as any) : s));
  const prev = () => setStep((s) => (s > 0 ? ((s - 1) as any) : s));

  // -------------------- Step 0: Business info --------------------
  type BusinessForm = {
    businessName: string;
    businessType: 'Retail' | 'Wholesale' | 'Service' | 'Other' | '';
    location: string;
    establishedYear: string;
    revenueRange: '<3M' | '3-10M' | '10-50M' | '>50M' | '';
    inventoryValue: '<500K' | '500K-2M' | '2-10M' | '>10M' | '';
    challenges: string;
    goals: string;
    contactName: string;
    email: string;
    phone: string;
    referral: string;
    agree: boolean;
  };

  const [biz, setBiz] = useState<BusinessForm>({
    businessName: '',
    businessType: '',
    location: '',
    establishedYear: '',
    revenueRange: '',
    inventoryValue: '',
    challenges: '',
    goals: '',
    contactName: '',
    email: '',
    phone: '',
    referral: '',
    agree: false,
  });

  const bizValid = useMemo(() => {
    return (
      biz.businessName.trim() !== '' &&
      !!biz.businessType &&
      biz.location.trim() !== '' &&
      biz.contactName.trim() !== '' &&
      /.+@.+\..+/.test(biz.email) &&
      biz.agree
    );
  }, [biz]);

  // -------------------- Step 1: CSV mapping & preview --------------------
  type ImportRow = {
    sku?: string;
    brand: string;
    model: string;
    size: string;
    loadIndex?: string;
    dotCode: string;
    qty: number;
    basePrice?: number;
    promoPrice?: number | null;
  };

  const REQUIRED_FIELDS = ['brand', 'model', 'size', 'dotCode', 'qty'] as const;
  const OPTIONAL_FIELDS = ['sku', 'loadIndex', 'basePrice', 'promoPrice'] as const;
  type FieldKey = (typeof REQUIRED_FIELDS)[number] | (typeof OPTIONAL_FIELDS)[number];

  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string | ''>>({
    sku: '',
    brand: '',
    model: '',
    size: '',
    loadIndex: '',
    dotCode: '',
    qty: '',
    basePrice: '',
    promoPrice: '',
  });
  const [autoCreate, setAutoCreate] = useState(true);
  const [treatEmptyPromoAsNull, setTreatEmptyPromoAsNull] = useState(true);
  const [allowEmptyDot, setAllowEmptyDot] = useState(true);

  const csvInputRef = useRef<HTMLInputElement>(null);

  function handleChooseFile() {
    csvInputRef.current?.click();
  }

  function guessMapping(hs: string[]) {
    const m: Record<FieldKey, string | ''> = {
      sku: '',
      brand: '',
      model: '',
      size: '',
      loadIndex: '',
      dotCode: '',
      qty: '',
      basePrice: '',
      promoPrice: '',
    };
    const lower = hs.map((h) => h.toLowerCase().trim());
    const at = (name: string) => hs[lower.indexOf(name)] ?? '';
    const find = (cands: string[]) => {
      const set = new Set(cands.map((c) => c.toLowerCase()));
      return hs.find((h) => set.has(h.toLowerCase().trim())) || '';
    };

    m.brand = find(['brand']);
    m.model = find(['model']);
    m.size = find(['size', 'spec', 'specification']);
    m.loadIndex = find(['load', 'loadindex', 'li', 'index']);
    m.dotCode = find(['dot', 'dotcode']);
    m.qty = find(['qty', 'quantity', 'stock']);
    m.basePrice = find(['base', 'price', 'baseprice']);
    m.promoPrice = find(['promo', 'promoprice', 'sale']);
    // fallback exact
    if (!m.brand) m.brand = at('brand');
    if (!m.model) m.model = at('model');
    return m;
  }

  // ---------- Existence helpers (used when autoCreate = false) ----------
  async function pickExistingBrandId(storeId: string, brandName: string): Promise<string | null> {
    const candidates = [brandName, brandName.toUpperCase(), slugifyId(brandName), brandName.toLowerCase()];
    for (const b of candidates) {
      const snap = await getDoc(doc(db, 'stores', storeId, 'inventory', b));
      if (snap.exists()) return b;
    }
    return null;
  }

  async function pickExistingModelId(storeId: string, brandId: string, modelName: string): Promise<string | null> {
    const candidates = [modelName, slugifyId(modelName), modelName.toUpperCase(), modelName.toLowerCase()];
    for (const m of candidates) {
      const snap = await getDoc(doc(db, 'stores', storeId, 'inventory', brandId, 'models', m));
      if (snap.exists()) return m;
    }
    return null;
  }

  async function variantExists(storeId: string, brandId: string, modelId: string, variantId: string): Promise<boolean> {
    const v = await getDoc(doc(db, 'stores', storeId, 'inventory', brandId, 'models', modelId, 'variants', variantId));
    return v.exists();
  }

  async function dotExists(storeId: string, brandId: string, modelId: string, variantId: string, dotCode: string): Promise<boolean> {
    const d = await getDoc(doc(db, 'stores', storeId, 'inventory', brandId, 'models', modelId, 'variants', variantId, 'dots', dotCode));
    return d.exists();
  }

  function parseCSV(file: File) {
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = (res.meta.fields || []).map(String);
        setHeaders(hs);
        setRows(res.data as any[]);
        setMapping(guessMapping(hs));
        toast.success(`Loaded ${res.data.length} rows`);
      },
      error: (err) => toast.error(err.message),
    });
  }

  const mappedRows: ImportRow[] = useMemo(() => {
    if (!rows.length) return [];
    const hasPromoMapped = Boolean(mapping.promoPrice);
    return rows.map((r) => {
      const get = (k: FieldKey) => (mapping[k] ? r[mapping[k] as string] : undefined);
      const num = (v: any) => (v === undefined || v === null || v === '' ? undefined : Number(v));
      const promo = get('promoPrice');
      let promoVal: number | null | undefined = num(promo);
      if (hasPromoMapped && (promo === '' || promo === undefined) && treatEmptyPromoAsNull) promoVal = null;
      return {
        sku: typeof get('sku') === 'string' ? String(get('sku')) : undefined,
        brand: String(get('brand') ?? '').trim(),
        model: String(get('model') ?? '').trim(),
        size: String(get('size') ?? '').trim(),
        loadIndex: String(get('loadIndex') ?? '').trim() || undefined,
        dotCode: String(get('dotCode') ?? '').trim(),
        qty: Number(get('qty') || 0),
        basePrice: num(get('basePrice')),
        promoPrice: promoVal,
      };
    });
  }, [rows, mapping, treatEmptyPromoAsNull]);

  const mappingValid = useMemo(() => {
    if (!headers.length) return false;
    const required: FieldKey[] = ['brand', 'model', 'size', 'qty'];
    const hasDotMapped = !!(mapping['dotCode'] && headers.includes(mapping['dotCode'] as string));
    const baseOk = required.every((k) => mapping[k] && headers.includes(mapping[k] as string));
    return allowEmptyDot ? baseOk : baseOk && hasDotMapped;
  }, [headers, mapping, allowEmptyDot]);

  function downloadTemplate() {
    const cols = [
      'brand,model,size,loadIndex,dotCode,qty,basePrice,promoPrice,sku',
      'MICHELIN,e-PRIMACY,215/60R16,95H,2325,4,3200,2990,TY-MI-EPRI-2160-95H',
      'MICHELIN,e-PRIMACY,215/60R16,95H,2324,8,3200,,TY-MI-EPRI-2160-95H',
      'BRIDGESTONE,TURANZA T005A,225/45R17,,2319,2,3700,,-',
    ].join('\n');
    const blob = new Blob(['\uFEFF' + cols], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // -------------------- ACTION: Import (create store + ensure inventory tree) --------------------
  type ImportResult = { cDot: number; cVar: number; skipped: number; skippedNotes: string[] };

  async function importToInventory() {
    if (!mappingValid) return toast.error('Please map all required fields');
    const valid = mappedRows.filter((r) => r.brand && r.model && r.size && (r.dotCode ? true : allowEmptyDot));
    if (!valid.length) return toast.error('No valid rows to import');

    const branchName = (biz.businessName || '').trim();
    if (!branchName) return toast.error('Please enter business/branch name');
    const storeId = slugifyId(branchName);

    const job: Promise<ImportResult> = (async () => {
      // 1) ensure/create store
      const available = await StoreService.isStoreIdAvailable(storeId);
      if (available) {
        await StoreService.createStore(storeId, {
          branchName,
          phone: biz.phone || null,
          email: biz.email || null,
          address: { line1: biz.location || '' },
          notes:
            [
              biz.businessType && `Type: ${biz.businessType}`,
              biz.establishedYear && `Established: ${biz.establishedYear}`,
              biz.revenueRange && `Revenue: ${biz.revenueRange}`,
              biz.inventoryValue && `Inventory Value: ${biz.inventoryValue}`,
              biz.challenges && `Challenges: ${biz.challenges}`,
              biz.goals && `Goals: ${biz.goals}`,
              biz.referral && `Referral: ${biz.referral}`,
            ]
              .filter(Boolean)
              .join(' | ') || null,
          isActive: true,
        });
      }

      // 2) import inventory to this store
      let cDot = 0, cVar = 0; // counters
      let skipped = 0; const skippedNotes: string[] = [];
      const withDot = valid.filter((r) => !!r.dotCode);
      const withoutDot = valid.filter((r) => !r.dotCode);

      if (autoCreate) {
        // ---------- Auto-create ON: original behavior ----------
        for (const r of withDot) {
          const brandName = String(r.brand).trim().toUpperCase();
          const modelName = String(r.model).trim();
          const size = String(r.size).trim();
          const loadIndex = String(r.loadIndex || '').trim();
          const dotCode = String(r.dotCode).trim().toUpperCase();
          const qty = Number(r.qty) || 0;

          const basePrice = r.basePrice != null && r.basePrice !== ('' as any) ? Number(r.basePrice) : undefined;
          const promoPrice = r.promoPrice === null || (r.promoPrice as any) === '' ? null : r.promoPrice !== undefined ? Number(r.promoPrice) : undefined;

          const { brandId } = await InventoryService.ensureBrandDoc(storeId, brandName);
          const { modelId } = await InventoryService.ensureModelDoc(storeId, brandId, modelName);

          const variantId = slugifyId(size + (loadIndex ? `-${loadIndex}` : ''));
          await InventoryService.ensureVariantPath(storeId, brandId, modelId, variantId, {
            size,
            ...(loadIndex ? { loadIndex } : {}),
            ...(basePrice !== undefined ? { basePrice } : {}),
          });

          await InventoryService.ensureDotDoc(storeId, brandId, modelId, variantId, dotCode, {
            qty,
            promoPrice: promoPrice as any,
          });
          cDot++;
        }

        for (const r of withoutDot) {
          const brandName = String(r.brand).trim().toUpperCase();
          const modelName = String(r.model).trim();
          const size = String(r.size).trim();
          const loadIndex = String(r.loadIndex || '').trim();
          const basePrice = r.basePrice != null && r.basePrice !== ('' as any) ? Number(r.basePrice) : undefined;

          const { brandId } = await InventoryService.ensureBrandDoc(storeId, brandName);
          const { modelId } = await InventoryService.ensureModelDoc(storeId, brandId, modelName);

          const variantId = slugifyId(size + (loadIndex ? `-${loadIndex}` : ''));
          await InventoryService.ensureVariantPath(storeId, brandId, modelId, variantId, {
            size,
            ...(loadIndex ? { loadIndex } : {}),
            ...(basePrice !== undefined ? { basePrice } : {}),
          });
          cVar++;
        }
      } else {
        // ---------- Auto-create OFF: Only touch existing Brand/Model/Variant/DOT ----------
        for (const r of withDot) {
          const brandRaw = String(r.brand).trim();
          const modelRaw = String(r.model).trim();
          const size = String(r.size).trim();
          const loadIndex = String(r.loadIndex || '').trim();
          const dotCode = String(r.dotCode).trim().toUpperCase();
          const qty = Number(r.qty) || 0;
          const basePrice = r.basePrice != null && r.basePrice !== ('' as any) ? Number(r.basePrice) : undefined;
          const promo = r.promoPrice;

          const bId = await pickExistingBrandId(storeId, brandRaw);
          if (!bId) { skipped++; skippedNotes.push(`brand not found: ${brandRaw}`); continue; }
          const mId = await pickExistingModelId(storeId, bId, modelRaw);
          if (!mId) { skipped++; skippedNotes.push(`model not found: ${brandRaw} / ${modelRaw}`); continue; }

          const variantId = slugifyId(size + (loadIndex ? `-${loadIndex}` : ''));
          const hasVariant = await variantExists(storeId, bId, mId, variantId);
          if (!hasVariant) { skipped++; skippedNotes.push(`variant not found: ${brandRaw} / ${modelRaw} / ${size}${loadIndex ? ` (${loadIndex})` : ''}`); continue; }

          // If basePrice provided, update variant meta (safe: ensureVariantPath only updates when exists)
          if (typeof basePrice === 'number') {
            await InventoryService.ensureVariantPath(storeId, bId, mId, variantId, { basePrice });
          }

          const hasDot = await dotExists(storeId, bId, mId, variantId, dotCode);
          if (!hasDot) { skipped++; skippedNotes.push(`dot not found: ${brandRaw} / ${modelRaw} / ${size}${loadIndex ? ` (${loadIndex})` : ''} · DOT ${dotCode}`); continue; }

          if (qty) {
            await InventoryService.adjustDotQuantity(storeId, bId, mId, variantId, dotCode, qty);
          }
          if (promo !== undefined) {
            // promo could be null (clear) or number
            await InventoryService.setPromoPrice(storeId, bId, mId, variantId, dotCode, promo as any);
          }
          cDot++;
        }

        for (const r of withoutDot) {
          const brandRaw = String(r.brand).trim();
          const modelRaw = String(r.model).trim();
          const size = String(r.size).trim();
          const loadIndex = String(r.loadIndex || '').trim();
          const basePrice = r.basePrice != null && r.basePrice !== ('' as any) ? Number(r.basePrice) : undefined;

          const bId = await pickExistingBrandId(storeId, brandRaw);
          if (!bId) { skipped++; skippedNotes.push(`brand not found: ${brandRaw}`); continue; }
          const mId = await pickExistingModelId(storeId, bId, modelRaw);
          if (!mId) { skipped++; skippedNotes.push(`model not found: ${brandRaw} / ${modelRaw}`); continue; }

          const variantId = slugifyId(size + (loadIndex ? `-${loadIndex}` : ''));
          const hasVariant = await variantExists(storeId, bId, mId, variantId);
          if (!hasVariant) { skipped++; skippedNotes.push(`variant not found: ${brandRaw} / ${modelRaw} / ${size}${loadIndex ? ` (${loadIndex})` : ''}`); continue; }

          if (typeof basePrice === 'number') {
            await InventoryService.ensureVariantPath(storeId, bId, mId, variantId, { basePrice });
          }
          // no dot → nothing else to do
          cVar++;
        }
      }

      setActiveBranch(storeId, branchName);
      return { cDot, cVar, skipped, skippedNotes };
    })();

    toast.promise(job, { loading: 'Importing inventory...', success: 'Import complete', error: 'Import failed' });

    const res = await job;

    if (res) {
      toast.message(`Imported: ${res.cDot} dots, ${res.cVar} variants (no DOT)`);
      if (res.skipped) {
        const top = res.skippedNotes.slice(0, 5).join('\n• ');
        toast.warning(`Skipped ${res.skipped} row(s) due to missing existing nodes${top ? `:\n• ${top}` : ''}`);
      }
    }

    next();
  }

  // -------------------- ACTION: Submit (สามารถข้าม import ได้) --------------------
  async function submitApplication() {
    const branchName = (biz.businessName || '').trim();
    if (!branchName) return toast.error('Please enter business/branch name');
    const storeId = slugifyId(branchName);

    await toast.promise(
      (async () => {
        const available = await StoreService.isStoreIdAvailable(storeId);
        if (available) {
          await StoreService.createStore(storeId, {
            branchName,
            phone: biz.phone || null,
            email: biz.email || null,
            address: { line1: biz.location || '' },
            notes:
              [
                biz.businessType && `Type: ${biz.businessType}`,
                biz.establishedYear && `Established: ${biz.establishedYear}`,
                biz.revenueRange && `Revenue: ${biz.revenueRange}`,
                biz.inventoryValue && `Inventory Value: ${biz.inventoryValue}`,
                biz.challenges && `Challenges: ${biz.challenges}`,
                biz.goals && `Goals: ${biz.goals}`,
                biz.referral && `Referral: ${biz.referral}`,
              ]
                .filter(Boolean)
                .join(' | ') || null,
            isActive: true,
          });
        }
        setActiveBranch(storeId, branchName);
      })(),
      { loading: 'Submitting application...', success: 'Application submitted', error: 'Failed to submit' }
    );

    setStep(3);
  }

  // -------------------- UI blocks --------------------
  function Stepper() {
    const steps = [
      { key: 0, label: 'Business Information', status: step > 0 ? 'Complete' : 'In Progress' },
      { key: 1, label: 'Inventory Import', status: step > 1 ? 'Complete' : step === 1 ? 'In Progress' : 'Pending' },
      { key: 2, label: 'Review & Submit', status: step === 2 ? 'In Progress' : step > 2 ? 'Complete' : 'Pending' },
    ];
    return (
      <Card className="border rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Application Progress</CardTitle>
          <CardDescription>Provide basic details and upload your stock.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border p-3 bg-white">
              <div className="flex items-center gap-2">
                {s.status === 'Complete' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : s.status === 'In Progress' ? (
                  <Clock className="h-4 w-4 text-amber-600" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                )}
                <div className="text-sm font-medium">{s.label}</div>
              </div>
              <div className="text-xs text-muted-foreground">{s.status}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  function StepBusinessInfo() {
    return (
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />Business Information
          </CardTitle>
          <CardDescription>Tell us about your business and inventory needs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Business Name *</Label>
              <Input className="mt-1" value={biz.businessName} onChange={(e) => setBiz({ ...biz, businessName: e.target.value })} placeholder="Enter business name" />
            </div>
            <div>
              <Label className="text-xs">Business Type *</Label>
              <Select value={biz.businessType} onValueChange={(v: any) => setBiz({ ...biz, businessType: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Wholesale">Wholesale</SelectItem>
                  <SelectItem value="Service">Service</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Primary Location *</Label>
              <Input className="mt-1" value={biz.location} onChange={(e) => setBiz({ ...biz, location: e.target.value })} placeholder="City, State, Country" />
            </div>
            <div>
              <Label className="text-xs">Established Year</Label>
              <Input className="mt-1" inputMode="numeric" value={biz.establishedYear} onChange={(e) => setBiz({ ...biz, establishedYear: e.target.value })} placeholder="YYYY" />
            </div>
            <div>
              <Label className="text-xs">Annual Revenue Range</Label>
              <Select value={biz.revenueRange} onValueChange={(v: any) => setBiz({ ...biz, revenueRange: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select revenue range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="<3M">Below 3M</SelectItem>
                  <SelectItem value="3-10M">3–10M</SelectItem>
                  <SelectItem value="10-50M">10–50M</SelectItem>
                  <SelectItem value=">50M">Over 50M</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Current Inventory Value</Label>
              <Select value={biz.inventoryValue} onValueChange={(v: any) => setBiz({ ...biz, inventoryValue: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select inventory value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="<500K">Below 500K</SelectItem>
                  <SelectItem value="500K-2M">500K–2M</SelectItem>
                  <SelectItem value="2-10M">2–10M</SelectItem>
                  <SelectItem value=">10M">Over 10M</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Current Inventory Challenges</Label>
              <Textarea className="mt-1" rows={4} value={biz.challenges} onChange={(e) => setBiz({ ...biz, challenges: e.target.value })} placeholder="Describe challenges e.g., overstock, stockouts, slow-moving items" />
            </div>
            <div>
              <Label className="text-xs">Network Goals</Label>
              <Textarea className="mt-1" rows={4} value={biz.goals} onChange={(e) => setBiz({ ...biz, goals: e.target.value })} placeholder="What do you hope to achieve through the network?" />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Contact Name *</Label>
              <Input className="mt-1" value={biz.contactName} onChange={(e) => setBiz({ ...biz, contactName: e.target.value })} placeholder="Primary contact" />
            </div>
            <div>
              <Label className="text-xs">Email Address *</Label>
              <Input className="mt-1" type="email" value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} placeholder="business@example.com" />
            </div>
            <div>
              <Label className="text-xs">Phone Number</Label>
              <Input className="mt-1" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} placeholder="+66 ..." />
            </div>
            <div>
              <Label className="text-xs">How did you hear about us?</Label>
              <Input className="mt-1" value={biz.referral} onChange={(e) => setBiz({ ...biz, referral: e.target.value })} placeholder="Referral source" />
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
            <Switch checked={biz.agree} onCheckedChange={(v) => setBiz({ ...biz, agree: !!v })} />
            <div>All information provided will be kept confidential and used only for network verification purposes.</div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3.5 w-3.5" /> You can import inventory in the next step.
            </div>
            <Button onClick={next} disabled={!bizValid}>Continue</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function StepImport() {
    return (
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />Import Inventory (CSV)
          </CardTitle>
          <CardDescription>Upload your stock list and map columns. You can skip and import later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) parseCSV(f);
            }} />
            <Button variant="outline" onClick={handleChooseFile} className="gap-2">
              <UploadCloud className="h-4 w-4" />Choose CSV
            </Button>
            <Button variant="ghost" onClick={downloadTemplate} className="gap-2">
              <FileDown className="h-4 w-4" />Download template
            </Button>
            {fileName && <span className="text-xs text-muted-foreground">Selected: {fileName}</span>}
          </div>

          {headers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((f) => (
                <div key={f}>
                  <Label className="text-xs">
                    {f}
                    {((f !== 'dotCode' || !allowEmptyDot) && (REQUIRED_FIELDS as readonly string[]).includes(f as string)) && ' *'}
                  </Label>
                  <Select value={(mapping as any)[f] || ''} onValueChange={(v: any) => setMapping((m) => ({ ...m, [f]: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select CSV column" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={autoCreate} onCheckedChange={(v) => setAutoCreate(!!v)} />
              <span className="text-sm">Auto-create unknown Brands/Models/Variants</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={treatEmptyPromoAsNull} onCheckedChange={(v) => setTreatEmptyPromoAsNull(!!v)} />
              <span className="text-sm">Empty promo = clear promo</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={allowEmptyDot} onCheckedChange={(v)=>setAllowEmptyDot(!!v)} />
              <span className="text-sm">Allow empty DOT (create variants only)</span>
            </div>
          </div>

          {mappedRows.length > 0 && (
            <div className="rounded-md border overflow-hidden">
              <div className="px-3 py-2 text-xs bg-slate-50 flex items-center justify-between">
                <div>
                  Preview ({Math.min(10, mappedRows.length)} of {mappedRows.length} rows)
                </div>
                <div className="text-muted-foreground">
                  <>{mappingValid ? 'Mapping complete' : 'Please map required fields'}{allowEmptyDot ? ` · ${mappedRows.filter((r)=>!r.dotCode).length} without DOT` : ''}</>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {['sku', 'brand', 'model', 'size', 'loadIndex', 'dotCode', 'qty', 'basePrice', 'promoPrice'].map((k) => (
                        <th key={k} className="px-3 py-2 text-left font-medium text-slate-600 border-b">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2">{r.sku || ''}</td>
                        <td className="px-3 py-2">{r.brand}</td>
                        <td className="px-3 py-2">{r.model}</td>
                        <td className="px-3 py-2">{r.size}</td>
                        <td className="px-3 py-2">{r.loadIndex || ''}</td>
                        <td className="px-3 py-2 font-mono">{r.dotCode}</td>
                        <td className="px-3 py-2">{r.qty}</td>
                        <td className="px-3 py-2">{r.basePrice ?? ''}</td>
                        <td className="px-3 py-2">{r.promoPrice ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" className="gap-1" onClick={prev}>
              <ArrowLeft className="h-4 w-4" />Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={next}>
                Skip for now
              </Button>
              <Button onClick={importToInventory} disabled={!mappingValid || mappedRows.length === 0} className="gap-2">
                <UploadCloud className="h-4 w-4" /> Import {mappedRows.length ? `${mappedRows.length} rows` : ''}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function StepReview() {
    return (
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg">Review & Submit</CardTitle>
          <CardDescription>Confirm your details before submitting your application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border">
            <div className="px-3 py-2 text-xs bg-slate-50 font-medium">Business Information</div>
            <div className="p-3 text-sm grid grid-cols-1 md:grid-cols-2 gap-y-1">
              <div>
                <span className="text-slate-500">Name:</span> {biz.businessName || '-'}
              </div>
              <div>
                <span className="text-slate-500">Type:</span> {biz.businessType || '-'}
              </div>
              <div>
                <span className="text-slate-500">Location:</span> {biz.location || '-'}
              </div>
              <div>
                <span className="text-slate-500">Established:</span> {biz.establishedYear || '-'}
              </div>
              <div>
                <span className="text-slate-500">Revenue:</span> {biz.revenueRange || '-'}
              </div>
              <div>
                <span className="text-slate-500">Inventory Value:</span> {biz.inventoryValue || '-'}
              </div>
              <div className="md:col-span-2">
                <span className="text-slate-500">Challenges:</span> {biz.challenges || '-'}
              </div>
              <div className="md:col-span-2">
                <span className="text-slate-500">Goals:</span> {biz.goals || '-'}
              </div>
              <div>
                <span className="text-slate-500">Contact:</span> {biz.contactName || '-'}
              </div>
              <div>
                <span className="text-slate-500">Email:</span> {biz.email || '-'}
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <div className="px-3 py-2 text-xs bg-slate-50 font-medium">Inventory Import</div>
            <div className="p-3 text-sm flex items-center justify-between">
              <div className="text-muted-foreground">
                {mappedRows.length ? `${mappedRows.length} row(s) prepared` : 'No CSV imported (you can import later).'}
              </div>
              <Button variant="ghost" className="gap-1" onClick={() => setStep(1)}>
                <FileSpreadsheet className="h-4 w-4" />Edit
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" className="gap-1" onClick={prev}>
              <ArrowLeft className="h-4 w-4" />Back
            </Button>
            <Button onClick={submitApplication} className="gap-2">
              <ArrowRight className="h-4 w-4" />Submit Application
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function StepDone() {
    return (
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />Application Submitted
          </CardTitle>
          <CardDescription>We will verify your business and activate the branch shortly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You can track your application status on this page. Once approved, you'll be able to transfer and receive stock through the network.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => onDone?.()}>Go to Dashboard</Button>
            <Button variant="outline" onClick={() => setStep(1)}>
              Import more stock
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // -------------------- Render --------------------
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      {/* Top hero / summary */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Join TransferNet</h1>
        <p className="text-muted-foreground">Connect with the world's largest inventory transfer network.</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded-full border bg-white">Discover</span>
          <span className="px-2 py-1 rounded-full border bg-white font-medium">Apply</span>
          <span className="px-2 py-1 rounded-full border bg-white">Status</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <Stepper />
        </div>
        <div className="md:col-span-2 space-y-4">
          {step === 0 && <StepBusinessInfo />}
          {step === 1 && <StepImport />}
          {step === 2 && <StepReview />}
          {step === 3 && <StepDone />}
        </div>
      </div>
    </div>
  );
}
