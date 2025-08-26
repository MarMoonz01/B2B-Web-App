// File: src/app/(app)/app/admin/users/UsersManagementClient.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { PlusCircle, Loader2 } from 'lucide-react';
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

type User = {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
  creationTime: string;
};

export default function UsersManagementClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateUserOpen, setCreateUserOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users/list');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      // --- แก้ไข Error Handling ---
      const description = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error('Error fetching users.', { description });
      // ------------------------
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const onCreateUser = async (data: any) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create user');
      }
      toast.success('User created successfully!');
      reset();
      setCreateUserOpen(false);
      fetchUsers(); // Refresh the user list
    } catch (error) {
      // --- แก้ไข Error Handling ---
      const description = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error('Failed to create user.', { description });
      // ------------------------
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>All Users</CardTitle>
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
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center p-10">Loading users...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Display Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>UID</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell className="font-medium">{user.displayName || 'N/A'}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="text-muted-foreground">{user.uid}</TableCell>
                  <TableCell>{new Date(user.creationTime).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}