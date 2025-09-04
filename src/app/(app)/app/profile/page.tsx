// File: src/app/(app)/app/profile/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Building2, Mail, Shield, Bell, Cog, History } from 'lucide-react';

type AnyMap = Record<string, any>;

function canSeeHistory(me: Me | null, branchId?: string | null) {
  if (!me) return false;
  // Moderator bypass
  if (me.moderator) return true;

  const bId = branchId ?? (me as AnyMap)?.selectedBranchId ?? null;
  const branchPerms: AnyMap | undefined = (me as AnyMap)?.branchPerms;
  const globalPerms: AnyMap | undefined = (me as AnyMap)?.globalPerms;

  // Prefer explicit history:read
  if (globalPerms?.['history:read']) return true;
  if (bId && branchPerms?.[bId]?.['history:read'] === true) return true;

  // Fallback: allow if user has inventory:read (common policy for viewing history)
  if (globalPerms?.['inventory:read']) return true;
  if (bId && branchPerms?.[bId]?.['inventory:read'] === true) return true;

  // As a final fallback, if no perms info in session, let server-side guard decide
  // Returning true keeps UX smooth; set to false if you’d rather hide the button.
  if (!branchPerms && !globalPerms) return true;

  return false;
}

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

  const userRole = me?.moderator
    ? 'Admin'
    : me?.branches?.find((b: any) => b.id === (me as any)?.selectedBranchId)?.roles?.[0] ?? 'User';

  const initials = me?.email?.substring(0, 2).toUpperCase() ?? 'U';

  const historyEnabled = useMemo(
    () => canSeeHistory(me, selectedBranch?.id ?? (me as any)?.selectedBranchId ?? null),
    [me, selectedBranch]
  );

  const goHistory = () => {
    // ส่งผู้ใช้ไปหน้า history (branch จะถูกเลือกใน UI/Context)
    router.push('/app?view=history');
  };

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
          {historyEnabled && (
            <Button variant="outline" onClick={goHistory}>
              <History className="mr-2 h-4 w-4" />
              Open History
            </Button>
          )}
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
            <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>These details are managed by your administrator.</CardDescription>
              </div>
              {historyEnabled && (
                <Button variant="secondary" onClick={goHistory}>
                  <History className="mr-2 h-4 w-4" />
                  Go to History
                </Button>
              )}
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
