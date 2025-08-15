import './globals.css';
import type { Metadata } from 'next';
import Providers from './providers';
import AppSidebar from '@/src/app/components/AppSidebar';

export const metadata: Metadata = {
  title: 'App',
  description: '...',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* ทุกอย่างต้องอยู่ใต้ <Providers> เพื่อให้มี BranchProvider ครอบ AppSidebar ด้วย */}
        <Providers>
          <div className="flex min-h-screen">
            <AppSidebar /> {/* <-- ใช้ useBranch ได้ เพราะอยู่ใต้ BranchProvider แล้ว */}
            <main className="flex-1">
              <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
