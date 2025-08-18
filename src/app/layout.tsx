// src/app/layout.tsx — Grid shell, full-bleed content
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import QueryProvider from "@/src/app/components/QueryProvider";
import { BranchProvider } from "@/contexts/BranchContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/src/app/components/AppSidebar";
import { Toaster } from "sonner";
import { NotificationProvider } from "@/contexts/NotificationContext"; // 导入 NotificationProvider

export const metadata = {
  title: "Tire Network",
  description: "B2B Tire stock & transfer platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        id="app-root"
        className="w-full min-h-dvh overflow-x-hidden bg-background text-foreground antialiased"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <BranchProvider>
              <NotificationProvider> {/* <== 添加 NotificationProvider */}
                <SidebarProvider>
                  {/* App shell: grid -> sidebar + content(minmax(0,1fr)) */}
                  <div
                    id="app-shell"
                    className="grid w-full min-h-dvh grid-cols-[auto_minmax(0,1fr)]"
                  >
                    {/* Sidebar: 不会不成比例地缩小 */}
                    <aside id="app-sidebar" className="shrink-0">
                      <AppSidebar />
                    </aside>

                    {/* Content: 填充剩余空间 */}
                    <main
                      id="app-content"
                      className="w-full min-w-0 overflow-x-hidden"
                    >
                      {children}
                    </main>
                  </div>
                </SidebarProvider>
              </NotificationProvider> {/* <== 关闭 NotificationProvider */}
            </BranchProvider>
          </QueryProvider>

          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}