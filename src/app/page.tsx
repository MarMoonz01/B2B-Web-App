'use client';

import { useState } from 'react';
import Sidebar from '@/src/app/components/Sidebar';
import MyInventory from '@/src/app/components/MyInventory';
import MarketplaceView from '@/src/app/components/MarketplaceView';
import Orders from '@/src/app/components/Orders';
import { CartProvider } from '@/contexts/CartContext';
import { BranchProvider, useBranch } from '@/contexts/BranchContext';
import { Menu, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ViewKey =
  | 'inventory'
  | 'marketplace'
  | 'orders'
  | 'dashboard'
  | 'network'
  | 'analytics'
  | 'orderHistory'
  | 'dealerDirectory';

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewKey>('inventory');   // ✅ ใส่ generic
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const { branches, selectedBranchId, selectedBranch, setSelectedBranchId } = useBranch();

  const renderContent = () => {
    switch (currentView) {
      case 'inventory':
        return <MyInventory />;
      case 'marketplace':
        return (
          <MarketplaceView
            myBranchId={selectedBranchId ?? ''}
            myBranchName={selectedBranch?.branchName ?? 'My Branch'}
            setCurrentView={setCurrentView}                    // ✅ type ตรง
          />
        );
      case 'orders':
        return <Orders myBranchId={selectedBranchId ?? ''} />;
      default:
        return <MyInventory />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}                      // ✅ ส่ง setter ตรง ๆ ได้เลย
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}            // ✅ ส่ง setter ตรง ๆ ได้เลย
          branches={branches}
          orders={[]}
          selectedBranch={selectedBranchId ?? ''}
          setSelectedBranch={setSelectedBranchId}
        />
        {/* ... ส่วนอื่นเหมือนเดิม ... */}
        <main className="flex-1 lg:ml-64 transition-all duration-300 ease-in-out">
          {/* header & content */}
          <div className="container mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <BranchProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </BranchProvider>
  );
}
