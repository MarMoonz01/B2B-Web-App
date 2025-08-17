// src/components/AppSidebar.tsx — Collapsible width + label hiding (final)
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
  SidebarTrigger,
} from '@/components/ui/sidebar';

type AppSidebarProps = {
  currentView?: ViewKey;
  onNavigate?: (k: ViewKey) => void;
};

const NAV: Array<{
  key: ViewKey | 'new_branch';
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

  // ตรวจ active
  const getActiveKey = (): ViewKey | 'new_branch' => {
    if (pathname === '/branches/new') return 'new_branch';
    const v = search?.get('view');
    if (isViewKey(v)) return v;
    return 'inventory';
  };
  const active = currentView ?? getActiveKey();

  const go = React.useCallback(
    (k: ViewKey | 'new_branch', route?: string) => {
      if (route) { router.push(route); return; }
      if (onNavigate && k !== 'new_branch') { onNavigate(k as ViewKey); return; }
      if (k !== 'new_branch') router.push(`/?view=${k}`);
    },
    [onNavigate, router]
  );

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      /* คุมความกว้างชัดเจนตาม state + เปิดให้ลูกอ่าน state ผ่าน group */
      className="
        group/sidebar
        transition-[width] duration-300 ease-in-out
        data-[state=expanded]:w-72
        data-[state=collapsed]:w-14
        overflow-hidden
      "
    >
      {/* รางคลิกหุบ/ขยาย */}
      <SidebarRail />

      <SidebarHeader className="
        border-b
        /* ลด padding ตอนหุบ + จัดกึ่งกลาง */
        group-data-[state=collapsed]/sidebar:px-0
        group-data-[state=collapsed]/sidebar:py-2
      ">
        <div className="
          flex items-center justify-between px-3 py-2
          group-data-[state=collapsed]/sidebar:px-0
        ">
          <div className="flex items-center gap-2 min-w-0 w-full justify-start group-data-[state=collapsed]/sidebar:justify-center">
            <LayoutGrid className="h-5 w-5 shrink-0" />
            {/* ซ่อนชื่อแอปตอนหุบ */}
            <div className="font-semibold truncate sidebar-label group-data-[state=collapsed]/sidebar:hidden">
              Tire Network
            </div>
          </div>
          {/* ปุ่มทริกเกอร์ยังอยู่ แต่ซ่อนไว้ตอนหุบเพื่อไม่ให้ดันความกว้าง */}
          <SidebarTrigger className="ml-auto group-data-[state=collapsed]/sidebar:hidden" />
        </div>

        {/* BranchSelect + active id — ซ่อนตอนหุบ */}
        <div className="px-3 pb-2 sidebar-label group-data-[state=collapsed]/sidebar:hidden">
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
          <SidebarGroupLabel className="px-2 py-2 text-xs sidebar-label group-data-[state=collapsed]/sidebar:hidden">
            Navigation
          </SidebarGroupLabel>

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
                      className="
                        px-3 py-2
                        /* ชิดกลางตอนหุบ */
                        group-data-[state=collapsed]/sidebar:justify-center
                      "
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {/* ซ่อน label ตอนหุบ เหลือไอคอน + ใช้ tooltip จาก prop */}
                      <span className="truncate text-sm sidebar-label group-data-[state=collapsed]/sidebar:hidden">
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="
        border-t
        sidebar-label group-data-[state=collapsed]/sidebar:hidden
      ">
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1">Tips</div>
          <div className="space-y-1 text-[10px]">
            <div>• Switch branches above</div>
            <div>• Use filters to narrow results</div>
          </div>

          {/* Debug info */}
          <div className="mt-2 pt-2 border-t text-[9px] opacity-60">
            <div>Path: {usePathname()}</div>
            <div>Active: {active}</div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
