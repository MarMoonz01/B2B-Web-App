'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { PlusCircle, Loader2, RefreshCw, Search, Copy, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

type User = {
  uid: string;
  email: string;
  displayName?: string;
  disabled?: boolean;
  creationTime?: string;
};

type CreateForm = {
  displayName: string;
  email: string;
  password: string;
};

export default function UsersManagementClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateUserOpen, setCreateUserOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // toolbar state
  const [q, setQ] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [sortBy, setSortBy] = useState<'created' | 'name' | 'email'>('created');

  // react-hook-form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>();

  // ------------- data -------------
  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/users/list');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      // รองรับได้ทั้ง { ok, users } หรือ array กลาย ๆ
      const arr: User[] = Array.isArray(data) ? data : data?.users ?? [];
      setUsers(arr);
    } catch (error) {
      const description = error instanceof Error ? error.message : 'An unknown error occurred';
      setErrorMsg(description);
      toast.error('Error fetching users.', { description });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ------------- computed -------------
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let list = [...users];

    if (showOnlyActive) list = list.filter(u => !u.disabled);

    if (kw) {
      list = list.filter(
        u =>
          (u.displayName || '').toLowerCase().includes(kw) ||
          (u.email || '').toLowerCase().includes(kw) ||
          (u.uid || '').toLowerCase().includes(kw)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'email') return (a.email || '').localeCompare(b.email || '');
      if (sortBy === 'name') return (a.displayName || '').localeCompare(b.displayName || '');
      // created
      const ta = a.creationTime ? new Date(a.creationTime).getTime() : 0;
      const tb = b.creationTime ? new Date(b.creationTime).getTime() : 0;
      return tb - ta; // ใหม่ก่อน
    });

    return list;
  }, [users, q, showOnlyActive, sortBy]);

  // ------------- actions -------------
  const onCreateUser = async (data: CreateForm) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to create user');
      }
      toast.success('User created successfully!');
      reset();
      setCreateUserOpen(false);
      fetchUsers(); // refresh
    } catch (error) {
      const description = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error('Failed to create user.', { description });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ------------- UI -------------
  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg">All Users</CardTitle>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name / email / UID"
              className="pl-8 w-64"
            />
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white">
            <span className="text-xs text-slate-600">Active only</span>
            <Switch checked={showOnlyActive} onCheckedChange={(v) => setShowOnlyActive(Boolean(v))} />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600">Sort</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 rounded-md border bg-white px-2 text-sm"
            >
              <option value="created">Newest</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={fetchUsers} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>

          <Dialog open={isCreateUserOpen} onOpenChange={setCreateUserOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-rap">Create User</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit(onCreateUser)}>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Enter the details for the new user. They will be created without any roles.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input id="displayName" {...register('displayName', { required: true })} />
                    {errors.displayName && <p className="text-red-500 text-xs">Display name is required.</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register('email', { required: true })} />
                    {errors.email && <p className="text-red-500 text-xs">Email is required.</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" {...register('password', { required: true, minLength: 6 })} />
                    {errors.password && <p className="text-red-500 text-xs">Password must be at least 6 characters.</p>}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create User
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {/* error banner */}
        {errorMsg && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            {errorMsg}
          </div>
        )}

        <Separator className="mb-3" />

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading users...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No users found.
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Display Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>UID</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.uid} className="border-t">
                    <TableCell className="font-medium">{user.displayName || 'N/A'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs">{user.uid}</code>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => navigator.clipboard.writeText(user.uid).then(() => toast('Copied UID'))}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.creationTime ? new Date(user.creationTime).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      {user.disabled ? (
                        <Badge variant="secondary" className="bg-slate-200 text-slate-700">Disabled</Badge>
                      ) : (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* footer info */}
        <div className="mt-3 text-xs text-muted-foreground">
          Showing {filtered.length} of {users.length} user{users.length !== 1 ? 's' : ''}.
        </div>
      </CardContent>
    </Card>
  );
}
