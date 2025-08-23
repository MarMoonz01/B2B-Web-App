import type { Metadata } from 'next';
import './globals.css'; // ใช้ path แบบนี้ถ้าไฟล์อยู่ src/app/globals.css

import { BranchProvider } from '@/contexts/BranchContext'; // ถ้ามี

export const metadata: Metadata = {
  title: 'Tire Network',
  description: 'Next-Generation Inventory Network',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body>
        <BranchProvider>
          {children}
        </BranchProvider>
      </body>
    </html>
  );
}
