// src/app/layout.tsx
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import QueryProvider from "@/src/app/components/QueryProvider";
import { BranchProvider } from "@/contexts/BranchContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/src/app/components/AppSidebar";

export const metadata = {
  title: "Tire Network",
  description: "B2B Tire stock & transfer platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <BranchProvider>
              <SidebarProvider>
                <div className="flex min-h-screen">
                  <AppSidebar />
                  <main className="flex-1">
                    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                      {children}
                    </div>
                  </main>
                </div>
              </SidebarProvider>
            </BranchProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
