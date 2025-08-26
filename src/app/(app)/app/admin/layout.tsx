// File: src/app/(app)/app/admin/layout.tsx

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Users, type LucideIcon } from 'lucide-react'; // <-- Import Users & LucideIcon
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

// --- เพิ่ม Type Definitions สำหรับ Props ---
type SidebarLinkProps = {
  href: string;
  children: React.ReactNode;
  icon: LucideIcon;
};

function SidebarLink({ href, children, icon: Icon }: SidebarLinkProps) {
// ------------------------------------
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
        isActive && 'bg-muted text-primary'
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/app" className="flex items-center gap-2 font-semibold">
              <Shield className="h-6 w-6" />
              <span className="">Admin Panel</span>
            </Link>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <SidebarLink href="/app/admin/roles" icon={Shield}>
                Roles
              </SidebarLink>
              <SidebarLink href="/app/admin/users" icon={Users}>
                Users
              </SidebarLink>
            </nav>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <div className="w-full flex-1">
            <h1 className="text-lg font-semibold">Admin</h1>
          </div>
        </header>
        <main className="flex-1 p-4 sm:px-6 sm:py-0 md:gap-8">
          <div className="p-4">{children}</div>
        </main>
      </div>
    </div>
  );
}