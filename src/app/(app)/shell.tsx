// File: src/app/(app)/shell.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, User, Shield, Boxes, ArrowLeftRight, History, Users, BarChart3 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Components inside (app)
import BranchSwitcher from '../components/BranchSwitcher';
import NotificationBell from '../components/NotificationBell';

/* ---------- Types ---------- */
export type View = 'inventory' | 'transfer' | 'transfer-requests' | 'analytics' | 'branches';

type Me = {
  id?: string;
  uid?: string;
  name?: string | null;
  email?: string | null;
  selectedBranchId?: string | null;
  avatarUrl?: string | null;
  moderator?: boolean;
};

type AppShellProps = {
  me: Me;
  allowedViews: View[];
  currentView: View;
  children: React.ReactNode;
};

/* ---------- Nav mapping (label + icon + href) ---------- */
const NAV_DEF: Record<View, { label: string; href: string; icon: React.ElementType }> = {
  inventory:          { label: 'Inventory',          href: '/app?view=inventory',          icon: Boxes },
  transfer:           { label: 'Transfer',           href: '/app?view=transfer',           icon: ArrowLeftRight },
  'transfer-requests':{ label: 'Transfer Requests',  href: '/app?view=transfer-requests',  icon: History },
  branches:           { label: 'Branch Users',       href: '/app?view=branches',           icon: Users },
  analytics:          { label: 'Analytics',          href: '/app?view=analytics',          icon: BarChart3 },
};

export default function AppShell({ me, allowedViews, currentView, children }: AppShellProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/sessionLogout', { method: 'POST' });
    router.push('/login');
  };

  const displayName = me?.name ?? me?.email ?? 'User';
  const avatarSeed = me?.avatarUrl ?? `https://api.dicebear.com/7.x/pixel-art/svg?seed=${me?.uid ?? me?.id ?? 'you'}`;
  const avatarFallback = (displayName || 'U').slice(0, 1).toUpperCase();

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        {/* Brand */}
        <Link href="/app" className="text-lg font-bold">
          TireStock B2B
        </Link>

        {/* Primary nav (based on allowedViews) */}
        <nav className="hidden md:flex items-center gap-1">
          {allowedViews.map((v) => {
            const { label, href, icon: Icon } = NAV_DEF[v];
            const active = v === currentView;
            return (
              <Link
                key={v}
                href={href}
                className={[
                  'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:block min-w-[240px]">
            <BranchSwitcher />
          </div>

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="cursor-pointer">
                <AvatarImage src={avatarSeed} alt="User Avatar" />
                <AvatarFallback>{avatarFallback}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/app/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>

              {me?.moderator && (
                <DropdownMenuItem onClick={() => router.push('/app/admin/roles')}>
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Admin Panel</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-8">
        {children}
      </main>
    </div>
  );
}
