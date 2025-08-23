// src/app/(app)/layout.tsx
'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// ⚠️ ปรับ path ให้ตรงโปรเจกต์คุณถ้า alias ไม่ตรง
import AppSidebar from '@/src/app/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { NotificationProvider } from '@/contexts/NotificationContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
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

      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
