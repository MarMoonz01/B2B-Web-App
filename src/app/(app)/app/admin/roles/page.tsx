'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Copy, Loader2, Search, ShieldMinus, ShieldPlus, ListFilter } from 'lucide-react';

type Role = 'SALES' | 'ADMIN';
type RoleRow = { uid: string; branchId: string; role: Role; docId: string };

// ========= helpers =========
async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const d = await r.json();
  return d as T;
}

// ========= page =========
export default function AdminRolesPage() {
  // form state
  const [uid, setUid] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [branchId, setBranchId] = React.useState('');
  const [role, setRole] = React.useState<Role>('SALES');

  // data state
  const [branches, setBranches] = React.useState<string[]>([]);
  const [rowsAll, setRowsAll] = React.useState<RoleRow[]>([]);
  const [rowsUser, setRowsUser] = React.useState<RoleRow[]>([]);

  // ui state
  const [busy, setBusy] = React.useState(false);
  const [loadingAll, setLoadingAll] = React.useState(true);
  const [loadingUser, setLoadingUser] = React.useState(false);
  const [info, setInfo] = React.useState<string>('');
  const [mode, setMode] = React.useState<'all' | 'user'>('all'); // NEW

  // table filters
  const [q, setQ] = React.useState('');
  const [fBranch, setFBranch] = React.useState<'all' | string>('all');
  const [fRole, setFRole] = React.useState<'all' | Role>('all');

  React.useEffect(() => {
    // branches
    (async () => {
      try {
        const d = await fetchJSON<{ ok: boolean; branches: string[] }>('/api/admin/branches');
        if (d.ok && Array.isArray(d.branches)) {
          setBranches(d.branches);
          if (!branchId && d.branches[0]) setBranchId(d.branches[0]);
        }
      } catch (e) {
        console.error(e);
      }
    })();

    // load all assignments initially
    refreshAllRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- loaders ----------
  async function resolveUidIfNeeded(): Promise<string> {
    if (uid.trim()) return uid.trim();
    if (!email.trim()) throw new Error('กรอก UID หรือ Email อย่างใดอย่างหนึ่ง');
    const d = await fetchJSON<{ ok: boolean; uid?: string; error?: string }>('/api/admin/users/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    if (!d.ok || !d.uid) throw new Error(d.error || 'หา UID จากอีเมลไม่พบ');
    return String(d.uid);
  }

  async function refreshUserRoles(targetUid?: string) {
    const effUid = targetUid ?? (await resolveUidIfNeeded());
    setLoadingUser(true);
    try {
      const d = await fetchJSON<{ ok: boolean; roles?: RoleRow[]; error?: string }>(
        `/api/admin/roles/list?uid=${encodeURIComponent(effUid)}`
      );
      if (d.ok) setRowsUser(d.roles || []);
      else toast.error(d.error || 'โหลดสิทธิ์ผู้ใช้ล้มเหลว');
    } finally {
      setLoadingUser(false);
    }
  }

  // พยายามหลาย endpoint เพื่อดึงรายการทั้งหมด (เผื่อ backend ใช้ชื่อไม่เหมือนกัน)
  async function refreshAllRoles() {
    setLoadingAll(true);
    try {
      const candidates = [
        '/api/admin/roles/list-all',
        '/api/admin/roles/listAll',
        '/api/admin/roles/list?all=1',
      ];
      let ok = false;
      for (const url of candidates) {
        try {
          const d = await fetchJSON<{ ok: boolean; roles?: RoleRow[] }>(url);
          if (d?.ok) {
            setRowsAll(d.roles || []);
            ok = true;
            break;
          }
        } catch { /* try next */ }
      }
      if (!ok) {
        // สุดท้าย: ถ้าไม่มี endpoint รวม ให้ fallback = ว่าง (ไม่พังหน้า)
        setRowsAll([]);
      }
    } finally {
      setLoadingAll(false);
    }
  }

  // ---------- actions ----------
  async function assignRole(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInfo('');
    try {
      const effUid = await resolveUidIfNeeded();
      const res = await fetch('/api/admin/roles/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: effUid, branchId, role }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || 'Assign role failed');
      setInfo(`✅ Granted ${role} → ${branchId}`);
      toast.success(`Granted ${role}`, { description: `${effUid} @ ${branchId}` });
      await Promise.all([refreshUserRoles(effUid), refreshAllRoles()]);
      setMode('user');
    } catch (e: any) {
      const msg = String(e?.message || e);
      setInfo(`❌ ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function revokeRoleAction(target?: RoleRow) {
    setBusy(true);
    setInfo('');
    try {
      const effUid = target?.uid ?? (await resolveUidIfNeeded());
      const effBranch = target?.branchId ?? branchId;
      const effRole = target?.role ?? role;

      const r = await fetch('/api/admin/roles/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: effUid, branchId: effBranch, role: effRole }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Revoke role failed');
      setInfo(`✅ Revoked ${effRole} ← ${effBranch}`);
      toast('Revoked role', { description: `${effUid} @ ${effBranch}` });
      await Promise.all([refreshUserRoles(effUid), refreshAllRoles()]);
    } catch (e: any) {
      const msg = String(e?.message || e);
      setInfo(`❌ ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onLoadRoles(e: React.FormEvent) {
    e.preventDefault();
    setInfo('');
    try {
      const effUid = await resolveUidIfNeeded();
      await refreshUserRoles(effUid);
      setMode('user');
    } catch (e: any) {
      const msg = String(e?.message || e);
      setInfo(`❌ ${msg}`);
      toast.error(msg);
    }
  }

  // ---------- table computed ----------
  const dataset = mode === 'all' ? rowsAll : rowsUser;
  const loading = mode === 'all' ? loadingAll : loadingUser;

  const filteredRows = React.useMemo(() => {
    const kw = q.trim().toLowerCase();
    return dataset.filter((r) => {
      if (fBranch !== 'all' && r.branchId !== fBranch) return false;
      if (fRole !== 'all' && r.role !== fRole) return false;
      if (!kw) return true;
      return (
        r.uid.toLowerCase().includes(kw) ||
        r.branchId.toLowerCase().includes(kw) ||
        r.role.toLowerCase().includes(kw)
      );
    });
  }, [dataset, q, fBranch, fRole]);

  function roleBadge(r: Role) {
    return r === 'ADMIN'
      ? <Badge className="bg-emerald-600 hover:bg-emerald-700">ADMIN</Badge>
      : <Badge className="bg-blue-600 hover:bg-blue-700">SALES</Badge>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      <h1 className="text-2xl font-bold tracking-tight">Admin — จัดการสิทธิ์ผู้ใช้ (RBAC)</h1>

      {/* Grant/Revoke */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldPlus className="h-5 w-5" /> มอบสิทธิ์ / ถอนสิทธิ์
          </CardTitle>
          <CardDescription>Moderator เท่านั้นที่เข้าหน้านี้ได้</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={assignRole} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>UID (ถ้ารู้)</Label>
                <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="เช่น AbC123..." />
              </div>
              <div>
                <Label>Email (ถ้าไม่ทราบ UID)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
                <p className="text-[11px] text-muted-foreground mt-1">* กรอกอย่างใดอย่างหนึ่งก็ได้ (UID หรือ Email)</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger><SelectValue placeholder="เลือกสาขา" /></SelectTrigger>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SALES">SALES</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldPlus className="h-4 w-4" />}
                Grant
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={busy} className="gap-2">
                    <ShieldMinus className="h-4 w-4" /> Revoke
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ยืนยันการถอนสิทธิ์</AlertDialogTitle>
                    <AlertDialogDescription>
                      จะถอนสิทธิ์ {role} จากผู้ใช้นี้ ในสาขา {branchId}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => revokeRoleAction()}>
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button type="button" variant="outline" onClick={onLoadRoles}>
                โหลดสิทธิ์ของผู้ใช้
              </Button>
            </div>

            {info && <p className="text-sm text-muted-foreground">{info}</p>}
          </form>

          <Separator className="my-4" />

          {/* Header: View Mode + Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="inline-flex rounded-lg border bg-white p-1">
              <Button
                size="sm"
                variant={mode === 'all' ? 'default' : 'ghost'}
                onClick={() => setMode('all')}
                className="gap-1"
              >
                <ListFilter className="h-4 w-4" /> ดูทั้งหมด
              </Button>
              <Button
                size="sm"
                variant={mode === 'user' ? 'default' : 'ghost'}
                onClick={() => setMode('user')}
                className="gap-1"
              >
                ผู้ใช้รายบุคคล
              </Button>
            </div>

            <div className="w-64">
              <Label className="text-xs">ค้นหา</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา UID / Branch / Role" className="pl-8" />
              </div>
            </div>
            <div className="w-56">
              <Label className="text-xs">Branch</Label>
              <Select value={fBranch} onValueChange={(v) => setFBranch(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs">Role</Label>
              <Select value={fRole} onValueChange={(v) => setFRole(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="SALES">SALES</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === 'all' && (
              <Button variant="outline" onClick={refreshAllRoles}>รีเฟรชทั้งหมด</Button>
            )}
          </div>

          {/* Roles table */}
          <div className="rounded-xl border overflow-hidden mt-3">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-3 py-2">UID</th>
                  <th className="px-3 py-2">Branch</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                      {mode === 'all' ? 'Loading all roles…' : 'Loading user roles…'}
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      {mode === 'all' ? 'ยังไม่มีข้อมูลสิทธิ์ในระบบ' : 'ยังไม่มีข้อมูลสิทธิ์สำหรับผู้ใช้นี้'}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.docId} className="border-t">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <code className="text-xs">{r.uid}</code>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => navigator.clipboard.writeText(r.uid).then(() => toast('Copied UID'))}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-3 py-2">{r.branchId}</td>
                      <td className="px-3 py-2">
                        {r.role === 'ADMIN'
                          ? <Badge className="bg-emerald-600 hover:bg-emerald-700">ADMIN</Badge>
                          : <Badge className="bg-blue-600 hover:bg-blue-700">SALES</Badge>}
                      </td>
                      <td className="px-3 py-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">Revoke</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>ลบสิทธิ์ผู้ใช้?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {r.uid} @ {r.branchId} — {r.role}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => revokeRoleAction(r)}
                              >
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
