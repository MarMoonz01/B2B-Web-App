'use client';

import { useState } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import { BranchProvider } from '@/contexts/BranchContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

export default function Providers({ children }: { children: React.ReactNode }) {
  // ใส่ useState เพื่อสร้าง QueryClient เพียงครั้งเดียวในฝั่ง client
  const [qc] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={qc}>
        {/* BranchProvider ต้องครอบ AppSidebar และเพจทุกหน้า */}
        <BranchProvider>
          {/* SidebarProvider ครอบเพื่อให้ AppSidebar ใช้งาน context ได้ */}
          <SidebarProvider>
            {children}
          </SidebarProvider>

          {/* toaster ใช้แจ้งเตือนทั่วแอป */}
          <Toaster richColors />
        </BranchProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
