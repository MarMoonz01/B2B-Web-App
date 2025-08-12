import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DealerNet',
  description: 'B2B Inventory Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* body จะไม่มี class bg-gray-50 แล้ว เพราะจะไปกำหนดใน page หลักแทน */}
      <body> 
        {children}
      </body>
    </html>
  );
}