// src/app/(app)/app/profile/page.tsx
'use client';

import { useRouter } from 'next/navigation';
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
import { Building2, Mail, MapPin, Shield, Bell, Cog } from 'lucide-react';
import { getClientAuth } from "@/src/lib/firebaseClient";
import { signOut as fbSignOut } from "firebase/auth";

async function handleSignOut(router: ReturnType<typeof useRouter>) {
  try {
    await fetch("/api/auth/sessionLogout", { method: "POST" });
    const auth = await getClientAuth();
    await fbSignOut(auth);
  } catch (_) {
  } finally {
    router.replace("/login");
  }
}
export default function ProfilePage() {
  const router = useRouter();
  const signOut = () => {
    // ลบ session/localStorage เพิ่มได้ถ้าใช้จริง
    router.replace('/'); // กลับหน้า Landing
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personal account settings, security preferences, and profile information
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Edit Profile</Button>
          <Button variant="destructive" onClick={() => handleSignOut(router)}>Sign out</Button>
        </div>
      </div>

      {/* Profile summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback>JS</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">John Smith</h2>
                <Badge variant="secondary" className="capitalize">manager</Badge>
              </div>

              <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>Downtown Tire Center</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>john.smith@tirestore.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Toronto, ON</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">Edit Profile</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="security"><Shield className="mr-1 h-4 w-4" />Security</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1 h-4 w-4" />Notifications</TabsTrigger>
          <TabsTrigger value="preferences"><Cog className="mr-1 h-4 w-4" />Preferences</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Personal */}
        <TabsContent value="personal" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details and contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Full Name</Label>
                  <Input defaultValue="John Smith" />
                </div>
                <div className="grid gap-2">
                  <Label>Email Address</Label>
                  <Input type="email" defaultValue="john.smith@tirestore.com" />
                </div>
                <div className="grid gap-2">
                  <Label>Phone Number</Label>
                  <Input defaultValue="+1 (555) 123-4567" />
                </div>
                <div className="grid gap-2">
                  <Label>Location</Label>
                  <Input defaultValue="Toronto, ON" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Professional Information</CardTitle>
                <CardDescription>Your role and store association details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Store Association</Label>
                  <Input defaultValue="Downtown Tire Center" />
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Input defaultValue="manager" />
                </div>
                <div className="grid gap-2">
                  <Label>Bio</Label>
                  <Textarea
                    defaultValue="Experienced store manager with 8+ years in the tire industry. Passionate about inventory optimization and customer service excellence."
                    rows={6}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Password & 2FA</CardTitle>
              <CardDescription>Keep your account secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Current Password</Label>
                  <Input type="password" placeholder="••••••••" />
                </div>
                <div className="grid gap-2">
                  <Label>New Password</Label>
                  <Input type="password" placeholder="New strong password" />
                </div>
                <div className="grid gap-2">
                  <Label>Confirm Password</Label>
                  <Input type="password" placeholder="Re-type new password" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button>Update Password</Button>
                <Button variant="outline">Setup 2FA</Button>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="font-medium">Active Sessions</div>
                <p className="text-sm text-muted-foreground">You are currently signed in on this device.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Choose what to receive and how</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="font-medium">Stock Alerts</div>
                  <p className="text-sm text-muted-foreground">Low stock and out-of-stock alerts</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">Email</Button>
                  <Button variant="outline" size="sm">In-app</Button>
                </div>
              </div>
              <Separator />
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="font-medium">Transfer Requests</div>
                  <p className="text-sm text-muted-foreground">Request updates and approvals</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">Email</Button>
                  <Button variant="outline" size="sm">In-app</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences */}
        <TabsContent value="preferences" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Interface, language and data export</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Language</Label>
                  <Input defaultValue="English (US)" />
                </div>
                <div className="grid gap-2">
                  <Label>Timezone</Label>
                  <Input defaultValue="America/Toronto (GMT-5)" />
                </div>
              </div>
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline">Export Data (CSV)</Button>
                <Button variant="outline">Export Activity Log</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest actions in your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>• Approved transfer request #TR-1042 — 2 hours ago</div>
              <div>• Updated product MICHELIN E-PRIMACY price — yesterday</div>
              <div>• Changed notification settings — 3 days ago</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
