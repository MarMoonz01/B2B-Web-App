// ============================
// FILE: src/app/(app)/app/admin/roles/page.tsx (enhanced with List)
// ============================
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type Role = 'SALES' | 'ADMIN';
type RoleRow = { uid: string; branchId: string; role: Role; docId: string };

export default function AdminRolesPage() {
  const router = useRouter();
  const [uid, setUid] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [branchId, setBranchId] = React.useState('');
  const [role, setRole] = React.useState<Role>('SALES');
  const [busy, setBusy] = React.useState(false);
  const [branches, setBranches] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<RoleRow[]>([]);
  const [info, setInfo] = React.useState<string>('');

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/branches');
        const d = await r.json();
        if (d.ok) setBranches(d.branches || []);
      } catch {}
    })();
  }, []);

  async function resolveUidIfNeeded(): Promise<string> {
    if (uid.trim()) return uid.trim();
    if (!email.trim()) throw new Error('กรอก UID หรือ Email อย่างใดอย่างหนึ่ง');
    const r = await fetch('/api/admin/users/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const d = await r.json();
    if (!d.ok || !d.uid) throw new Error(d.error || 'หา UID จากอีเมลไม่พบ');
    return d.uid as string;
  }

  async function refreshRoles(targetUid?: string) {
    const effUid = targetUid ?? (await resolveUidIfNeeded());
    const r = await fetch(`/api/admin/roles/list?uid=${encodeURIComponent(effUid)}`);
    const d = await r.json();
    if (d.ok) setRows(d.roles || []);
  }

  async function assignRole(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInfo('');
    try {
      const effUid = await resolveUidIfNeeded();
      const r = await fetch('/api/admin/roles/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: effUid, branchId, role }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Assign role failed');
      setInfo(`✅ Granted ${role} → ${branchId}`);
      await refreshRoles(effUid);
    } catch (e: any) {
      setInfo(`❌ ${String(e.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function revokeRole(e?: React.FormEvent) {
    e?.preventDefault?.();
    setBusy(true);
    setInfo('');
    try {
      const effUid = await resolveUidIfNeeded();
      const r = await fetch('/api/admin/roles/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: effUid, branchId, role }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Revoke role failed');
      setInfo(`✅ Revoked ${role} ← ${branchId}`);
      await refreshRoles(effUid);
    } catch (e: any) {
      setInfo(`❌ ${String(e.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onLoadRoles(e: React.FormEvent) {
    e.preventDefault();
    try {
      const effUid = await resolveUidIfNeeded();
      await refreshRoles(effUid);
      setInfo('');
    } catch (e: any) {
      setInfo(`❌ ${String(e.message || e)}`);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin — จัดการสิทธิ์ผู้ใช้ (RBAC)</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>มอบสิทธิ์ / ถอนสิทธิ์</CardTitle>
          <CardDescription>Moderator เท่านั้นที่เข้าหน้านี้ได้</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={assignRole} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>UID (ถ้ารู้)</Label>
                <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="เช่น AbC123..." />
              </div>
              <div>
                <Label>Email (ถ้าไม่ทราบ UID)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสาขา" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SALES">SALES</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>Grant</Button>
              <Button type="button" variant="destructive" onClick={revokeRole} disabled={busy}>Revoke</Button>
              <Button type="button" variant="outline" onClick={onLoadRoles}>โหลดสิทธิ์ของผู้ใช้</Button>
            </div>
            {info && <p className="text-sm text-muted-foreground">{info}</p>}
          </form>
          <Separator className="my-4" />

          {/* Roles table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">UID</th>
                  <th className="py-2 pr-4">Branch</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-muted-foreground">ยังไม่มีข้อมูลสิทธิ์สำหรับผู้ใช้นี้</td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.docId} className="border-b">
                    <td className="py-2 pr-4 font-mono">{r.uid}</td>
                    <td className="py-2 pr-4">{r.branchId}</td>
                    <td className="py-2 pr-4">{r.role}</td>
                    <td className="py-2">
                      <Button size="sm" variant="destructive" onClick={async () => {
                        setUid(r.uid); setBranchId(r.branchId); setRole(r.role);
                        await revokeRole();
                      }}>Revoke</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}