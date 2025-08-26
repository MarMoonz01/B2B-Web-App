'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut as fbSignOut } from "firebase/auth";
import { toast } from 'sonner';

import { useBranch } from '@/contexts/BranchContext';
import { getClientAuth } from "@/src/lib/firebaseClient";
import type { Me } from '@/src/lib/session';

import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Mail, MapPin, Shield, Bell, Cog } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { selectedBranch } = useBranch();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      setLoading(true);
      try {
        const res = await fetch('/api/debug/session');
        if (res.ok) {
          const sessionData = await res.json();
          setMe(sessionData);
        } else {
          router.replace("/login");
        }
      } catch (error) {
        console.error('Failed to fetch user session:', error);
        toast.error("Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/sessionLogout", { method: "POST" });
      const auth = await getClientAuth();
      await fbSignOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      router.replace("/login");
    }
  };

  const userRole = me?.moderator ? 'Admin' : me?.branches?.find(b => b.id === me.selectedBranchId)?.roles?.[0] ?? 'User';
  const initials = me?.email?.substring(0, 2).toUpperCase() ?? 'U';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Account Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personal account settings and profile information.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleSignOut}>Sign out</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{me?.email}</h2>
                <Badge variant="secondary" className="capitalize">{userRole}</Badge>
              </div>
              <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>{selectedBranch?.branchName ?? 'No branch selected'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{me?.email}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="security"><Shield className="mr-1 h-4 w-4" />Security</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1 h-4 w-4" />Notifications</TabsTrigger>
          <TabsTrigger value="preferences"><Cog className="mr-1 h-4 w-4" />Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>These details are managed by your administrator.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Email Address</Label>
                <Input type="email" value={me?.email ?? ''} disabled />
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <Input value={userRole} disabled className="capitalize" />
              </div>
              <div className="grid gap-2">
                <Label>Current Branch</Label>
                <Input value={selectedBranch?.branchName ?? ''} disabled />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Functionality not yet implemented.</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Functionality not yet implemented.</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
        <TabsContent value="preferences" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Functionality not yet implemented.</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
