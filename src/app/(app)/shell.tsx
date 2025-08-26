// File: src/app/(app)/shell.tsx

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, User, Shield } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// --- 1. แก้ไขการ Import ---
import BranchSwitcher from '../components/BranchSwitcher';
// -------------------------
import NotificationBell from '../components/NotificationBell';
import { useBranch } from '@/contexts/BranchContext';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { me } = useBranch();

  const handleLogout = async () => {
    await fetch('/api/auth/sessionLogout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
        <Link href="/app" className="text-lg font-bold">
          TireStock B2B
        </Link>
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <div className="ml-auto flex-1 sm:flex-initial">
            <BranchSwitcher />
          </div>
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="cursor-pointer">
                <AvatarImage src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${me?.uid}`} alt="User Avatar" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{me?.email ?? 'My Account'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/app/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              
              {/* --- 2. แก้ไขการตรวจสอบ moderator --- */}
              {me?.moderator && (
                <DropdownMenuItem onClick={() => router.push('/app/admin/roles')}>
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Admin Panel</span>
                </DropdownMenuItem>
              )}
              {/* ------------------------------------ */}

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-muted/40">
        {children}
      </main>
    </div>
  );
}