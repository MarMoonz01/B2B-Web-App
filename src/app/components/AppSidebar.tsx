// src/components/AppSidebar.tsx
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Boxes,
  ArrowLeftRight,
  ClipboardList,
  LineChart,
  Factory,
  LayoutGrid,
} from 'lucide-react';

import BranchSelect from '@/src/app/components/BranchSelect';
import { useBranch } from '@/contexts/BranchContext';

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

export type ViewKey =
  | 'inventory'
  | 'transfer_platform'
  | 'transfer_requests'
  | 'dashboard'
  | 'network';

type AppSidebarProps = {
  currentView?: ViewKey;
  onNavigate?: (k: ViewKey) => void;
};

const NAV: Array<{
  key: ViewKey;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  { key: 'inventory',         label: 'My Inventory',      icon: Boxes },
  { key: 'transfer_platform', label: 'Transfer Platform', icon: ArrowLeftRight },
  { key: 'transfer_requests', label: 'Transfer Requests', icon: ClipboardList },
  { key: 'dashboard',         label: 'Analytics',         icon: LineChart },
  { key: 'network',           label: 'Branches',          icon: Factory },
];

function isViewKey(v: string | null): v is ViewKey {
  return !!v && ['inventory','transfer_platform','transfer_requests','dashboard','network'].includes(v);
}

export default function AppSidebar({ currentView, onNavigate }: AppSidebarProps) {
  const router = useRouter();
  const search = useSearchParams();
  const { selectedBranchId } = useBranch();

  const activeFromQuery = isViewKey(search?.get('view')) ? (search!.get('view') as ViewKey) : 'inventory';
  const active = currentView ?? activeFromQuery;

  const go = React.useCallback(
    (k: ViewKey) => {
      if (onNavigate) {
        onNavigate(k);
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set('view', k);
      router.push(`${url.pathname}?${url.searchParams.toString()}`);
    },
    [onNavigate, router]
  );

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarRail />

      <SidebarHeader>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            <div className="font-semibold">Tire Network</div>
          </div>
          <SidebarTrigger />
        </div>

        <div className="px-2">
          <BranchSelect />
          {selectedBranchId ? (
            <div className="mt-1 text-[11px] text-muted-foreground">
              Active branch: <span className="font-medium">{selectedBranchId}</span>
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => go(item.key)}
                      tooltip={item.label}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Shortcuts</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => go('inventory')} tooltip="Go to Inventory">
                  <Boxes className="h-4 w-4" />
                  <span>Inventory</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => go('transfer_platform')} tooltip="Go to Transfer Platform">
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>Transfer Platform</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-md border px-2 py-1.5 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Tips</div>
          <div>• เลือกสาขาด้านบนเพื่อสลับข้อมูล</div>
          <div>• ใช้ฟิลเตอร์ในแต่ละหน้าเพื่อลดรายการ</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
