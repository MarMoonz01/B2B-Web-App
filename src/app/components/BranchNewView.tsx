// src/app/components/BranchNewView.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  StoreService,
  type StoreDoc,
} from '@/lib/services/InventoryService';

import { toast } from 'sonner';
import {
  Building2,
  CheckCircle2,
  CircleSlash,
  Loader2,
  MapPin,
  XCircle,
  ExternalLink,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

/* ---------- local helpers ---------- */
function slugifyId(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

type Avail = 'idle' | 'checking' | 'ok' | 'taken';

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/* ---------- component ---------- */
export default function BranchNewView() {
  const router = useRouter();

  // Basic
  const [branchName, setBranchName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [lockId, setLockId] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Contact
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [lineId, setLineId] = useState('');

  // Address
  const [line1, setLine1] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Thailand');

  // Location
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');

  // Extra
  const [services, setServices] = useState(''); // comma separated
  const [notes, setNotes] = useState('');

  // Hours
  const [hours, setHours] = useState<
    Record<string, { open: string; close: string; closed: boolean }>
  >({
    mon: { open: '08:30', close: '18:00', closed: false },
    tue: { open: '08:30', close: '18:00', closed: false },
    wed: { open: '08:30', close: '18:00', closed: false },
    thu: { open: '08:30', close: '18:00', closed: false },
    fri: { open: '08:30', close: '18:00', closed: false },
    sat: { open: '09:00', close: '17:00', closed: false },
    sun: { open: '00:00', close: '00:00', closed: true },
  });
  const days: Array<[keyof typeof hours, string]> = [
    ['mon', 'Mon'],
    ['tue', 'Tue'],
    ['wed', 'Wed'],
    ['thu', 'Thu'],
    ['fri', 'Fri'],
    ['sat', 'Sat'],
    ['sun', 'Sun'],
  ];

  // State
  const [checking, setChecking] = useState<Avail>('idle');
  const [submitting, setSubmitting] = useState(false);

  // auto-slug id จากชื่อ (ถ้า user ยังไม่แก้เอง)
  useEffect(() => {
    if (!lockId) setBranchId(slugifyId(branchName));
  }, [branchName, lockId]);

  const debouncedId = useDebounced(branchId.trim(), 300);

  // เช็คซ้ำ Branch ID
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!debouncedId) {
        setChecking('idle');
        return;
      }
      setChecking('checking');
      try {
        const ok = await StoreService.isStoreIdAvailable(debouncedId);
        if (!cancelled) setChecking(ok ? 'ok' : 'taken');
      } catch {
        if (!cancelled) setChecking('idle');
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedId]);

  // กันออกจากหน้าโดยยังไม่เซฟ
  useEffect(() => {
    const dirty = !!(
      branchName ||
      phone ||
      email ||
      line1 ||
      services ||
      notes ||
      lat ||
      lng
    );
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [branchName, phone, email, line1, services, notes, lat, lng]);

  const canSubmit = useMemo(() => {
    if (!branchName.trim()) return false;
    if (!branchId.trim()) return false;
    if (checking === 'taken' || checking === 'checking') return false;
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return false;
    if (lat && isNaN(Number(lat))) return false;
    if (lng && isNaN(Number(lng))) return false;
    return true;
  }, [branchName, branchId, checking, email, lat, lng]);

  function copyWeekdayToWeekend() {
    const wd = hours.fri;
    setHours((h) => ({
      ...h,
      sat: { ...wd },
      sun: { ...wd, closed: true },
    }));
  }

  async function useMyLocation() {
    if (!(navigator as any)?.geolocation) {
      toast.error('เบราว์เซอร์นี้ไม่รองรับ Geolocation');
      return;
    }
    (navigator as any).geolocation.getCurrentPosition(
      (pos: any) => {
        setLat(String(pos.coords.latitude.toFixed(6)));
        setLng(String(pos.coords.longitude.toFixed(6)));
      },
      (err: any) =>
        toast.error('อ่านพิกัดไม่สำเร็จ', { description: err.message }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function openInGoogleMaps() {
    if (!lat || !lng) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${lat},${lng}`
    )}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function submit(redirectTo?: string) {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: StoreDoc = {
        branchName: branchName.trim(),
        isActive,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        lineId: lineId.trim() || undefined,
        address: {
          line1: line1.trim() || undefined,
          district: district.trim() || undefined,
          province: province.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          country: country.trim() || undefined,
        },
        location:
          lat || lng
            ? { lat: Number(lat) || undefined, lng: Number(lng) || undefined }
            : undefined,
        services: services
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        notes: notes.trim() || undefined,
        hours,
      };

      await StoreService.createStore(branchId, payload);
      toast.success('สร้างสาขาเรียบร้อย', {
        description: `${branchName} (${branchId})`,
      });

      router.push(redirectTo ?? '/branches');
    } catch (e: any) {
      console.error(e);
      toast.error('สร้างสาขาไม่สำเร็จ', {
        description: e?.message || String(e),
      });
    } finally {
      setSubmitting(false);
    }
  }

  function clearForm() {
    setBranchName('');
    setBranchId('');
    setLockId(false);
    setIsActive(true);
    setPhone('');
    setEmail('');
    setLineId('');
    setLine1('');
    setDistrict('');
    setProvince('');
    setPostalCode('');
    setCountry('Thailand');
    setLat('');
    setLng('');
    setServices('');
    setNotes('');
    setChecking('idle');
    setHours({
      mon: { open: '08:30', close: '18:00', closed: false },
      tue: { open: '08:30', close: '18:00', closed: false },
      wed: { open: '08:30', close: '18:00', closed: false },
      thu: { open: '08:30', close: '18:00', closed: false },
      fri: { open: '08:30', close: '18:00', closed: false },
      sat: { open: '09:00', close: '17:00', closed: false },
      sun: { open: '00:00', close: '00:00', closed: true },
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
          <Building2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-tight">Create New Branch</h1>
          <p className="text-sm text-muted-foreground">
            เพิ่มสาขาใหม่ให้กับเครือข่าย
          </p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Branch Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="branchName">Branch Name</Label>
              <Input
                id="branchName"
                placeholder="เช่น Bangkok HQ"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="branchId">Branch ID</Label>
                <Input
                  id="branchId"
                  placeholder="เช่น bangkok-hq"
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);
                    setLockId(true);
                  }}
                />
              </div>
              <div className="flex items-center pb-2">
                {checking === 'checking' && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking
                  </Badge>
                )}
                {checking === 'ok' && (
                  <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    OK
                  </Badge>
                )}
                {checking === 'taken' && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3.5 w-3.5" />
                    Taken
                  </Badge>
                )}
                {checking === 'idle' && (
                  <Badge variant="outline" className="gap-1">
                    <CircleSlash className="h-3.5 w-3.5" />
                    Idle
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(Boolean(v))}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          <Separator />

          {/* Contact */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="02-xxx-xxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lineId">Line ID</Label>
              <Input
                id="lineId"
                placeholder="line id"
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
              />
            </div>
          </div>

          {/* Address */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="line1">Address</Label>
              <Input
                id="line1"
                placeholder="บ้านเลขที่/ถนน/อาคาร…"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="province">Province</Label>
              <Input
                id="province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="postal">Postal Code</Label>
              <Input
                id="postal"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="lat">Latitude</Label>
                <Input
                  id="lat"
                  placeholder="13.7xxxx"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="lng">Longitude</Label>
                <Input
                  id="lng"
                  placeholder="100.5xxxx"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={useMyLocation}
                  className="flex-1"
                >
                  <MapPin className="mr-2 h-4 w-4" /> Use my location
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={openInGoogleMaps}
                  disabled={!lat || !lng}
                  title="Open in Google Maps"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* ไม่ฝังแผนที่ แต่ออกลิงก์ไป Google Maps ได้ตามต้องการ */}
          </div>

          {/* Operating Hours */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Operating Hours</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyWeekdayToWeekend}
              >
                Copy weekdays → weekend
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {days.map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  <div className="w-10 shrink-0 text-sm font-medium">
                    {label}
                  </div>
                  <Switch
                    checked={!hours[key].closed}
                    onCheckedChange={(v) =>
                      setHours((h) => ({
                        ...h,
                        [key]: { ...h[key], closed: !v },
                      }))
                    }
                  />
                  {hours[key].closed ? (
                    <Badge variant="outline" className="ml-2">
                      Closed
                    </Badge>
                  ) : (
                    <div className="ml-2 flex items-center gap-2">
                      <Input
                        className="w-24"
                        type="time"
                        value={hours[key].open}
                        onChange={(e) =>
                          setHours((h) => ({
                            ...h,
                            [key]: { ...h[key], open: e.target.value },
                          }))
                        }
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        className="w-24"
                        type="time"
                        value={hours[key].close}
                        onChange={(e) =>
                          setHours((h) => ({
                            ...h,
                            [key]: { ...h[key], close: e.target.value },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Services / Notes */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="services">Services (comma separated)</Label>
              <Input
                id="services"
                placeholder="เช่น change tyre, alignment"
                value={services}
                onChange={(e) => setServices(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={clearForm}>
              Clear
            </Button>

            <Button onClick={() => submit()} disabled={!canSubmit || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                'Create Branch'
              )}
            </Button>

            <Button
              onClick={() => submit(`/inventory?branch=${encodeURIComponent(branchId)}`)}
              disabled={!canSubmit || submitting || !branchId}
              title="สร้างแล้วไปหน้าจัดการสต็อกสาขานี้"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                'Create & Manage Inventory'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
