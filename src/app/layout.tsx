import { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TyreChain - B2B Tire Inventory',
  description: 'Real-time tire inventory management system',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}