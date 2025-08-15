// src/components/AppSidebar.tsx - Fixed Navigation
'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Boxes,
  ArrowLeftRight,
  ClipboardList,
  LineChart,
  Factory,
  LayoutGrid,
  Plus,
  Building2,
} from 'lucide-react';

import BranchSelect from '@/src/app/components/BranchSelect';
import { useBranch } from '@/contexts/BranchContext';

// ใช้ type เดียวกับ /types/nav.ts
import type { ViewKey } from '@/types/nav';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';

type AppSidebarProps = {
  currentView?: ViewKey;
  onNavigate?: (k: ViewKey) => void;
};

const NAV: Array<{
  key: ViewKey | 'new_branch'; // เพิ่ม new_branch ที่ไม่อยู่ใน types/nav.ts
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  route?: string;
}> = [
  { key: 'inventory',         label: 'My Inventory',      icon: Boxes },
  { key: 'transfer_platform', label: 'Transfer Platform', icon: ArrowLeftRight },
  { key: 'transfer_requests', label: 'Transfer Requests', icon: ClipboardList },
  { key: 'analytics',         label: 'Analytics',         icon: LineChart },
  { key: 'network',           label: 'Branches',          icon: Factory },
  { key: 'new_branch',        label: 'Add Branch',        icon: Plus, route: '/branches/new' },
];

function isViewKey(v: string | null): v is ViewKey | 'new_branch' {
  return !!v && ['inventory','transfer_platform','transfer_requests','analytics','network','debug','new_branch'].includes(v);
}

export default function AppSidebar({ currentView, onNavigate }: AppSidebarProps) {
  const router = useRouter();
  const search = useSearchParams();
  const pathname = usePathname();
  const { selectedBranchId } = useBranch();

  // ตรวจสอบ active state จาก path และ query
  const getActiveKey = (): ViewKey | 'new_branch' => {
    // ถ้าอยู่หน้า branches/new
    if (pathname === '/branches/new') {
      return 'new_branch';
    }
    
    // ถ้ามี view ใน query parameter
    const viewFromQuery = search?.get('view');
    if (isViewKey(viewFromQuery)) {
      return viewFromQuery as ViewKey | 'new_branch';
    }
    
    // default
    return 'inventory';
  };

  const active = currentView ?? getActiveKey();

  const go = React.useCallback(
    (k: ViewKey | 'new_branch', route?: string) => {
      console.log('🚀 Navigation clicked:', k, route);
      
      // หากมี route กำหนดไว้ (เช่น /branches/new)
      if (route) {
        router.push(route);
        return;
      }

      // หากมี onNavigate callback และเป็น ViewKey ที่ valid
      if (onNavigate && k !== 'new_branch') {
        onNavigate(k as ViewKey);
        return;
      }

      // สำหรับ main navigation - ไปหน้าหลักพร้อม view parameter
      if (k !== 'new_branch') {
        router.push(`/?view=${k}`);
      }
    },
    [onNavigate, router]
  );

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarRail />

      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <LayoutGrid className="h-5 w-5 shrink-0" />
            <div className="font-semibold truncate">Tire Network</div>
          </div>
          <SidebarTrigger className="ml-auto" />
        </div>

        <div className="px-3 pb-2">
          <BranchSelect />
          {selectedBranchId && (
            <div className="mt-1 text-[10px] text-muted-foreground truncate">
              Active: <span className="font-medium">{selectedBranchId}</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 py-2 text-xs">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => go(item.key, item.route)}
                      tooltip={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      className="px-3 py-2"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate text-sm">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1">Tips</div>
          <div className="space-y-1 text-[10px]">
            <div>• Switch branches above</div>
            <div>• Use filters to narrow results</div>
          </div>
          
          {/* Debug info - ลบออกหลังจากแก้เสร็จ */}
          <div className="mt-2 pt-2 border-t text-[9px] opacity-60">
            <div>Path: {pathname}</div>
            <div>Active: {active}</div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}