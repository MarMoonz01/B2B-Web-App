'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Check,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

import { StoreService, type StoreDoc } from '@/lib/services/InventoryService';

// ---------- helpers ----------
const toId = (s: string) =>
  String(s || '')
    .trim()
    .toUpperCase()
    .replace(/[\/\s]+/g, '-');

const TH_PROVINCES = [
  'Bangkok', 'Nonthaburi', 'Pathum Thani', 'Samut Prakan', 'Samut Sakhon',
  'Samut Songkhram', 'Nakhon Pathom', 'Chonburi', 'Rayong', 'Phuket', 'Chiang Mai',
  'Chiang Rai', 'Ayutthaya', 'Nakhon Ratchasima',
];

const dayKeys = ['mon','tue','wed','thu','fri','sat','sun'] as const;
type DayKey = typeof dayKeys[number];
type DayHours = { open: string; close: string; closed: boolean };
type Hours = Record<DayKey, DayHours>;

const DayHoursSchema = z.object({
  open: z.string(),
  close: z.string(),
  closed: z.boolean(),
});
const HoursSchema = z.object({
  mon: DayHoursSchema, tue: DayHoursSchema, wed: DayHoursSchema,
  thu: DayHoursSchema, fri: DayHoursSchema, sat: DayHoursSchema, sun: DayHoursSchema,
});

const defaultHours: Hours = {
  mon: { open: '09:00', close: '18:00', closed: false },
  tue: { open: '09:00', close: '18:00', closed: false },
  wed: { open: '09:00', close: '18:00', closed: false },
  thu: { open: '09:00', close: '18:00', closed: false },
  fri: { open: '09:00', close: '18:00', closed: false },
  sat: { open: '09:00', close: '17:00', closed: false },
  sun: { open: '09:00', close: '17:00', closed: true },
};

// ---------- schema ----------
const schema = z.object({
  branchName: z.string().min(2, 'Branch name is required'),
  branchId: z.string().min(2, 'Branch ID is required').regex(/^[A-Z0-9\-_.]+$/, 'Only A-Z, 0-9, - _ .'),
  isActive: z.boolean().default(true),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  lineId: z.string().optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    district: z.string().optional(),
    province: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().default('TH').optional(),
  }),
  location: z.object({ lat: z.coerce.number().optional(), lng: z.coerce.number().optional() }).optional(),
  services: z.array(z.string()).optional(),
  notes: z.string().optional(),
  hours: HoursSchema,
});
type FormValues = z.infer<typeof schema>;

// ---------- component ----------
export default function BranchNewView({ onCreated }: { onCreated?: (storeId: string) => void }) {
  const [checking, setChecking] = useState<'idle'|'checking'|'ok'|'exist'>('idle');

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      branchName: '',
      branchId: '',
      isActive: true,
      phone: '',
      email: '',
      lineId: '',
      address: { line1: '', line2: '', district: '', province: '', postalCode: '', country: 'TH' },
      location: { lat: undefined, lng: undefined },
      services: [],
      notes: '',
      hours: defaultHours,
    },
    mode: 'onChange',
  });

  const branchName = form.watch('branchName');
  const branchId = form.watch('branchId');

  // Auto-generate branchId from name (one-time if empty)
  useEffect(() => {
    if (!branchId && branchName) {
      form.setValue('branchId', toId(branchName));
      setChecking('idle');
    }
  }, [branchName]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkId = async (id: string) => {
    if (!id) return;
    setChecking('checking');
    try {
      const available = await StoreService.isStoreIdAvailable(id);
      setChecking(available ? 'ok' : 'exist');
    } catch {
      setChecking('idle');
    }
  };

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    try {
      const storeId = values.branchId.toUpperCase();
      const payload: StoreDoc = {
        branchName: values.branchName.trim(),
        isActive: values.isActive,
        phone: values.phone?.trim() || undefined,
        email: values.email?.trim() || undefined,
        lineId: values.lineId?.trim() || undefined,
        address: values.address,
        location: values.location,
        services: values.services,
        hours: values.hours,
      };
      await StoreService.createStore(storeId, payload);
      toast.success(`Created branch ${values.branchName}`);
      onCreated?.(storeId);
      form.reset({
        branchName: '',
        branchId: '',
        isActive: true,
        phone: '',
        email: '',
        lineId: '',
        address: { line1: '', line2: '', district: '', province: '', postalCode: '', country: 'TH' },
        location: { lat: undefined, lng: undefined },
        services: [],
        notes: '',
        hours: defaultHours,
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create branch');
    }
  };

  const idStatus = useMemo(() => {
    if (!branchId) return null;
    if (checking === 'checking') return <Badge variant="secondary" className="ml-2">Checking…</Badge>;
    if (checking === 'ok') return <Badge className="ml-2"><Check className="h-3 w-3 mr-1" />Available</Badge>;
    if (checking === 'exist') return <Badge variant="destructive" className="ml-2"><AlertCircle className="h-3 w-3 mr-1" />Already used</Badge>;
    return null;
  }, [checking, branchId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Add New Branch</h1>
          <p className="text-sm text-muted-foreground">
            Create a new branch and store its metadata in Firestore. You can import inventory later.
          </p>
        </div>
        <Button variant="outline" onClick={() => form.reset()}>Reset</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: form */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Branch Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* name + id + active */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Branch Name</Label>
                <div className="relative mt-1">
                  <Input placeholder="Tyreplus สาขา Central Rama 2" {...form.register('branchName')} />
                  <Building2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                {form.formState.errors.branchName && (
                  <p className="text-xs text-destructive mt-1">{form.formState.errors.branchName.message}</p>
                )}
              </div>

              <div>
                <Label>Branch ID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    placeholder="TYREPLUS-RAMA-2"
                    {...form.register('branchId')}
                    onBlur={(e) => checkId(e.target.value.toUpperCase())}
                  />
                  {idStatus}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Auto-generated from name (A–Z, 0–9, - _ .). Must be unique.
                </p>
              </div>

              <div className="flex items-end">
                <div className="w-full rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      <Label className="m-0">Active</Label>
                    </div>
                    <Switch
                      checked={form.watch('isActive')}
                      onCheckedChange={(v) => form.setValue('isActive', Boolean(v))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Contact */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Phone</Label>
                <div className="relative mt-1">
                  <Input placeholder="02-xxx-xxxx" {...form.register('phone')} />
                  <Phone className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <div className="relative mt-1">
                  <Input placeholder="branch@example.com" {...form.register('email')} />
                  <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div>
                <Label>LINE ID</Label>
                <Input className="mt-1" placeholder="@tyreplus-branch" {...form.register('lineId')} />
              </div>
            </div>

            <Separator />

            {/* Address */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Address
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Address line 1</Label>
                  <Input className="mt-1" {...form.register('address.line1')} placeholder="123/4 Moo 5, Ratchaphruek Rd." />
                </div>
                <div>
                  <Label>Address line 2</Label>
                  <Input className="mt-1" {...form.register('address.line2')} placeholder="(optional)" />
                </div>
                <div>
                  <Label>District / Sub-district</Label>
                  <Input className="mt-1" {...form.register('address.district')} placeholder="Bang Phlat" />
                </div>
                <div>
                  <Label>Province</Label>
                  <Select
                    value={form.watch('address.province') || ''}
                    onValueChange={(v) => form.setValue('address.province', v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                    <SelectContent>
                      {TH_PROVINCES.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Postal Code</Label>
                  <Input className="mt-1" {...form.register('address.postalCode')} />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input className="mt-1" {...form.register('address.country')} defaultValue="TH" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Latitude</Label>
                  <Input className="mt-1" type="number" step="any" {...form.register('location.lat')} />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input className="mt-1" type="number" step="any" {...form.register('location.lng')} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Services */}
            <div>
              <Label>Services Offered</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {['Tyres','Alignment','Wheel Balancing','Oil Change','Battery','Brakes','Suspension','A/C Service'].map((svc) => {
                  const selected = form.watch('services')?.includes(svc) ?? false;
                  return (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => {
                        const curr = new Set(form.watch('services') || []);
                        if (curr.has(svc)) curr.delete(svc); else curr.add(svc);
                        form.setValue('services', Array.from(curr));
                      }}
                      className={`text-left rounded-md border px-3 py-2 text-sm transition-colors ${selected ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}`}
                    >
                      {svc}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Hours */}
            <div className="space-y-3">
              <Label>Operating Hours</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dayKeys.map((day) => {
                  const v = form.watch(`hours.${day}` as const) as DayHours;
                  const labelMap: Record<DayKey,string> = {mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun'};
                  return (
                    <div key={day} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{labelMap[day]}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span>Closed</span>
                          <Switch
                            checked={v?.closed ?? false}
                            onCheckedChange={(closed) =>
                              form.setValue(`hours.${day}.closed` as const, Boolean(closed))
                            }
                          />
                        </div>
                      </div>
                      {!v?.closed && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Open</Label>
                            <Input
                              className="mt-1"
                              placeholder="09:00"
                              value={v?.open ?? ''}
                              onChange={(e) => form.setValue(`hours.${day}.open` as const, e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Close</Label>
                            <Input
                              className="mt-1"
                              placeholder="18:00"
                              value={v?.close ?? ''}
                              onChange={(e) => form.setValue(`hours.${day}.close` as const, e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div>
              <Label>Notes (optional)</Label>
              <Textarea className="mt-1" rows={3} placeholder="Any internal notes for this branch (not public)" {...form.register('notes')} />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => form.reset()}>Discard</Button>
              <Button onClick={form.handleSubmit(onSubmit)}>Create Branch</Button>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: preview */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <div className="font-medium">{form.watch('branchName') || '—'}</div>
              <div className="text-xs text-muted-foreground">{form.watch('branchId') || '—'}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-muted-foreground text-xs">Phone</div>
                  <div>{form.watch('phone') || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Email</div>
                  <div>{form.watch('email') || '—'}</div>
                </div>
              </div>
              <div className="mt-2">
                <div className="text-muted-foreground text-xs">Province</div>
                <div>{form.watch('address.province') || '—'}</div>
              </div>
              <div className="mt-2">
                <div className="text-muted-foreground text-xs">Services</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(form.watch('services') || []).length
                    ? (form.watch('services') || []).map((s) => <Badge key={s} variant="secondary">{s}</Badge>)
                    : <span>—</span>}
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="font-medium mb-1">Tips</div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>ตั้ง Branch ID ให้จำง่ายและสอดคล้องกับบริษัท (A–Z, 0–9, - _ .)</li>
                <li>คุณสามารถ import สต็อกเข้าที่หลัง (CSV / migration script)</li>
                <li>เปิด-ปิดสาขาได้ที่สวิตช์ “Active”</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
