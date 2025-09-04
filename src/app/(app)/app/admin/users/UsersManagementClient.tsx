"use client";

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { UserPlus, Edit, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { Permission } from '@/types/permissions';
import type { User } from './page';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export default function UsersManagementClient({ users: initialUsers }: { users: User[] }) {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditRolesOpen, setIsEditRolesOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleDialogClose = (updated: boolean) => {
    setIsAddUserOpen(false);
    setIsEditRolesOpen(false);
    setSelectedUser(null);
    if (updated) window.location.reload();
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Users Management</h1>
          <p className="text-muted-foreground">Add new users and manage their branch roles.</p>
        </div>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" /> Add New User</Button></DialogTrigger>
          <DialogContent><AddUserForm onFinished={() => handleDialogClose(true)} /></DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-4 text-left font-semibold">User (Email / UID)</th>
                  <th className="p-4 text-left font-semibold">Branch Roles</th>
                  <th className="p-4 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {initialUsers.map(user => (
                  <tr key={user.uid} className="border-b last:border-b-0">
                    <td className="p-4 font-medium">
                      <div>{user.email || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground font-mono">{user.uid}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5">
                        {(user.branches && user.branches.length > 0) ? user.branches.map(b => (
                          <div key={b.id} className="text-xs">
                            <Badge variant="secondary" className="mr-2">{b.id}</Badge>
                            <span className="font-semibold">{b.roles.join(', ')}</span>
                          </div>
                        )) : <span className="text-xs text-muted-foreground">No branch roles assigned</span>}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {!user.moderator && (
                        <Button variant="outline" size="sm" onClick={() => { setSelectedUser(user); setIsEditRolesOpen(true); }}>
                          <Edit className="h-4 w-4 mr-2" /> Manage Roles
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditRolesOpen} onOpenChange={setIsEditRolesOpen}>
        <DialogContent>
          {selectedUser && <EditRolesForm user={selectedUser} onFinished={() => handleDialogClose(true)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddUserForm({ onFinished }: { onFinished: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success('User created successfully!');
        onFinished();
      } else {
        toast.error(data.error || 'Failed to create user.');
      }
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <DialogHeader>
        <DialogTitle>Create New User</DialogTitle>
        <DialogDescription>
          This will create an account in Firebase Authentication and a user document in Firestore.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create User'}</Button>
    </form>
  );
}

function EditRolesForm({ user, onFinished }: { user: User, onFinished: () => void }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<{id: string, branchName: string}[]>([]);
  const [newAssignment, setNewAssignment] = useState<{ branchId: string; roleId: string }>({ branchId: '', roleId: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const rolesRes = await fetch('/api/admin/roles');
      const rolesData = await rolesRes.json();
      if (rolesData.ok) setRoles(rolesData.roles);

      const branchesRes = await fetch('/api/admin/branches');
      const branchesData = await branchesRes.json();
      if (branchesData.ok) {
        const list = branchesData.branches.map((b: any) =>
          typeof b === 'string' ? { id: b, branchName: b } : { id: b.id, branchName: b.branchName ?? b.id }
        );
        setBranches(list);
      }
    }
    fetchData();
  }, []);

  const unassignedBranches = branches.filter(b => !(user.branches || []).some(ub => ub.id === b.id));

  const handleAddAssignment = async () => {
    if (!newAssignment.branchId || !newAssignment.roleId) {
      toast.error("Please select both a branch and a role.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.uid}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: newAssignment.branchId, roleId: newAssignment.roleId }),
      });
      if (!res.ok) throw new Error("Failed to save assignment");
      toast.success('Role assigned!');
      onFinished();
    } catch {
      toast.error("An error occurred while saving.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Manage Roles for</DialogTitle>
        <DialogDescription>{user.email}</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <p className="text-sm font-medium">Current Assignments</p>
        <div className="space-y-2 p-3 border rounded-lg max-h-24 overflow-y-auto">
          {(user.branches && user.branches.length > 0) ? user.branches.map(b => (
            <div key={b.id} className="text-sm flex justify-between items-center">
              <span><Badge variant="secondary">{b.id}</Badge></span>
              <span className="font-semibold">{b.roles.join(', ')}</span>
            </div>
          )) : <p className="text-xs text-muted-foreground">No current assignments.</p>}
        </div>
      </div>

      <div className="space-y-2 pt-4 border-t">
        <p className="text-sm font-medium">Add New Assignment</p>
        <div className="flex items-center gap-2">
          <Select value={newAssignment.branchId} onValueChange={val => setNewAssignment(p => ({...p, branchId: val, roleId: ''}))}>
            <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
            <SelectContent>
              {unassignedBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.branchName}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={newAssignment.roleId} onValueChange={val => setNewAssignment(p => ({...p, roleId: val}))} disabled={!newAssignment.branchId}>
            <SelectTrigger><SelectValue placeholder="Select Role" /></SelectTrigger>
            <SelectContent>
              {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button size="icon" onClick={handleAddAssignment} disabled={isSubmitting}>
            <PlusCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
