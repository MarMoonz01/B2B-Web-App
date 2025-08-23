// src/app/components/AppSidebar.tsx
'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';
import { spring } from 'motion';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Boxes, ArrowLeftRight, ClipboardList, LineChart, Factory,
  LayoutGrid, UserRound, Moon, Settings, LogOut,
} from 'lucide-react';

import BranchSelect from '@/src/app/components/BranchSelect';
import { useBranch } from '@/contexts/BranchContext';
import NotificationBell from './NotificationBell';
import type { ViewKey } from '@/types/nav';

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarRail, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar';

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

type AppSidebarProps = { currentView?: ViewKey; onNavigate?: (k: ViewKey) => void; };

const NAV: Array<{ key: ViewKey; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; route?: string; }> = [
  { key: 'inventory',         label: 'My Inventory',      icon: Boxes },
  { key: 'transfer_platform', label: 'Transfer Platform', icon: ArrowLeftRight },
  { key: 'transfer_requests', label: 'Transfer Requests', icon: ClipboardList },
  { key: 'analytics',         label: 'Analytics',         icon: LineChart },
  { key: 'network',           label: 'Branches',          icon: Factory },
];

function isViewKey(v: string | null): v is ViewKey {
  return !!v && ['inventory','transfer_platform','transfer_requests','analytics','network','debug'].includes(v);
}

/* ========== animations ========== */
const navItemVariants: Variants = {
  expanded: { opacity: 1, x: 0, transition: { type: spring, stiffness: 400, damping: 25, mass: 0.6 } },
  collapsed:{ opacity: 0, x: -8, transition: { duration: 0.15 } },
};

/* ========== user menus ========== */
function UserDropdown({ name, org, onSignOut }: { name:string; org?:string; onSignOut: () => void }) {
  const router = useRouter();
  const initials = name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || 'U';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full rounded-lg border bg-background/50 px-2.5 py-2 hover:bg-muted transition-colors text-left inline-flex items-center gap-2">
          <Avatar className="h-7 w-7"><AvatarFallback>{initials}</AvatarFallback></Avatar>
          <span className="min-w-0">
            <span className="block text-sm font-medium leading-5 truncate">{name}</span>
            <span className="block text-[11px] text-muted-foreground truncate">{org || '—'}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-64">
        <DropdownMenuLabel className="p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9"><AvatarFallback>{initials}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <div className="font-medium truncate">{name}</div>
              <div className="text-xs text-muted-foreground truncate">{org || ''}</div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/app/profile')}>
            <UserRound className="mr-2 h-4 w-4" /> Profile Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => document.documentElement.classList.toggle('dark')}>
            <Moon className="mr-2 h-4 w-4" /> Dark Mode
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/app/profile')}>
            <Settings className="mr-2 h-4 w-4" /> Preferences
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserCollapsedStack({ name, onSignOut }: { name:string; onSignOut: () => void }) {
  const router = useRouter();
  const initials = name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || 'U';
  return (
    <div className="flex flex-col items-center gap-2">
      {/* bell */}
      <div className="h-9 w-9 inline-flex items-center justify-center rounded-full hover:bg-muted">
        <NotificationBell />
      </div>
      {/* avatar */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-9 w-9 inline-flex items-center justify-center rounded-full hover:bg-muted" aria-label="Open account menu">
            <Avatar className="h-7 w-7"><AvatarFallback>{initials}</AvatarFallback></Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-64">
          <DropdownMenuLabel className="p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9"><AvatarFallback>{initials}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <div className="font-medium truncate">{name}</div>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/app/profile')}>
            <UserRound className="mr-2 h-4 w-4" /> Profile Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => document.documentElement.classList.toggle('dark')}>
            <Moon className="mr-2 h-4 w-4" /> Dark Mode
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSignOut} className="text-red-600 focus:text-red-600">
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ========== main component ========== */
export default function AppSidebar({ currentView, onNavigate }: AppSidebarProps) {
  const router = useRouter();
  const search = useSearchParams();
  const pathname = usePathname();
  const { selectedBranchId, selectedBranch } = useBranch();
  const { state } = useSidebar(); // expanded | collapsed
  const collapsed = state === 'collapsed';

  const viewFromQuery = search?.get('view');
  const active: ViewKey = currentView ?? (isViewKey(viewFromQuery) ? (viewFromQuery as ViewKey) : 'inventory');

  const go = React.useCallback((k: ViewKey, route?: string) => {
    if (route) return router.push(route);
    if (onNavigate) return onNavigate(k);
    router.push(`/app?view=${k}`);
  }, [onNavigate, router]);

  const handleSignOut = React.useCallback(() => { router.replace('/'); }, [router]);

  const userName = 'John Smith';
  const orgName  = selectedBranch?.branchName ?? 'Tyreplus akeolarn';

  return (
    <Sidebar
      id="app-sidebar"
      collapsible="icon"
      variant="sidebar"
      className="
        group/sidebar
        transition-[width] duration-300 ease-in-out
        data-[state=expanded]:w-72
        data-[state=collapsed]:w-14
        overflow-hidden
      "
    >
      <SidebarRail />

      {/* header */}
      <SidebarHeader className="border-b px-2">
        <div className="flex items-center justify-between px-1 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <LayoutGrid className="h-5 w-5 shrink-0" />
            <div className="font-semibold truncate sidebar-label group-data-[state=collapsed]/sidebar:hidden">
              Tire Network
            </div>
          </div>
          {/* ปุ่มหุบ/ขยายอยู่มุมขวาเสมอ */}
          <SidebarTrigger />
        </div>

        {/* BranchSelect เฉพาะตอนขยาย */}
        <div className="px-1 pb-2 sidebar-label group-data-[state=collapsed]/sidebar:hidden">
          <BranchSelect />
          {selectedBranchId && (
            <div className="mt-1 text-[10px] text-muted-foreground truncate">
              Active: <span className="font-medium">{selectedBranchId}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* content */}
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 py-2 text-xs sidebar-label group-data-[state=collapsed]/sidebar:hidden">
            Navigation
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {NAV.map((item, idx) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                return (
                  <SidebarMenuItem key={item.key}>
                    <motion.div
                      initial={{ opacity: 0, x: -4 }}
                      animate={collapsed ? 'collapsed' : 'expanded'}
                      variants={navItemVariants}
                      transition={{ delay: 0.04 + idx * 0.015 }}
                    >
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => go(item.key, item.route)}
                        tooltip={item.label}
                        aria-current={isActive ? 'page' : undefined}
                        className="px-3 py-2 group-data-[state=collapsed]/sidebar:justify-center"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm sidebar-label group-data-[state=collapsed]/sidebar:hidden">
                          {item.label}
                        </span>
                      </SidebarMenuButton>
                    </motion.div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* footer */}
      <SidebarFooter className="border-t px-2">
        {/* 1) โซนผู้ใช้ตอน 'ขยาย' */}
        <div className="group-data-[state=collapsed]/sidebar:hidden space-y-2 py-2">
          <UserDropdown name={userName} org={orgName} onSignOut={handleSignOut} />
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <div>
              <div className="font-medium text-foreground mb-1">Tips</div>
              <div className="space-y-1 text-[10px]">
                <div>• Switch branches above</div>
                <div>• Use filters to narrow results</div>
              </div>
            </div>
            <NotificationBell />
          </div>

          <div className="mt-2 pt-2 border-t text-[9px] opacity-60">
            <div>Path: {usePathname()}</div>
            <div>Active: {active}</div>
          </div>
        </div>

        {/* 2) โซนผู้ใช้ตอน 'หุบ' (วางท้าย ไม่ทับ trigger) */}
        <div className="hidden group-data-[state=collapsed]/sidebar:flex w-full items-center justify-center py-3">
          <UserCollapsedStack name={userName} onSignOut={handleSignOut} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
