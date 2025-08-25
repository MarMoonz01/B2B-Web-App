// src/app/(app)/layout.tsx
'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import AppSidebar from '@/src/app/components/AppSidebar'; // ⇦ ตรวจ path ให้ตรง
import { SidebarProvider } from '@/components/ui/sidebar';

// **เพิ่ม** BranchProvider ก่อน NotificationProvider
import { BranchProvider } from '@/contexts/BranchContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 5 * 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BranchProvider>
        <SidebarProvider>
          <NotificationProvider>
            {/* app-shell = เต็มจอแนวนอน+แนวตั้ง */}
            <div className="app-shell flex min-h-dvh w-dvw overflow-x-hidden">
              <AppSidebar />
              {/* app-main = กินพื้นที่ทั้งหมด + padding สม่ำเสมอ */}
              <main className="flex-1 min-h-dvh w-full overflow-x-auto">
                <div className="app-main h-full w-full p-4 md:p-6 lg:p-8">
                  {children}
                </div>
              </main>
            </div>
          </NotificationProvider>
        </SidebarProvider>
      </BranchProvider>

      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
