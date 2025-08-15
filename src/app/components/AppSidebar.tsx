"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Home,
  Boxes,
  CableCar as TransferIcon, // ใช้เป็น icon ตัวแทน transfer; เปลี่ยนได้
  Inbox,
  Building2,
  PlusSquare,
} from "lucide-react";

// ปรับ path/href ให้ตรงกับ route ที่คุณใช้จริงในโปรเจกต์
const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Inventory", href: "/inventory", icon: Boxes },
  { name: "Transfer Platform", href: "/transfer", icon: TransferIcon },
  { name: "Transfer Requests", href: "/transfer-requests", icon: Inbox },
];

const BRANCH_ITEMS = [
  { name: "Branches", href: "/branches", icon: Building2 },
  { name: "Add Branch", href: "/branches/new", icon: PlusSquare },
];

export default function AppSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-3">
          <div className="text-sm font-semibold">Tyre Network</div>
          <div className="text-xs text-muted-foreground">Operations Console</div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>General</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href}>
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Branches</SidebarGroupLabel>
          <SidebarMenu>
            {BRANCH_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href}>
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-3 text-xs text-muted-foreground">
          v1.0 • Tyreplus Ops
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
