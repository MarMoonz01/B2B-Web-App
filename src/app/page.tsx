'use client';

import { useState } from 'react';
import Sidebar from '@/src/app/components/Sidebar';
import MyInventory from '@/src/app/components/MyInventory';
import MarketplaceView from '@/src/app/components/MarketplaceView';
import Orders from '@/src/app/components/Orders'; // Uncomment เมื่อมี Orders component
// import Dashboard from '@/src/app/components/Dashboard'; // Uncomment เมื่อมี Dashboard component
import { CartProvider } from '@/contexts/CartContext';
import { Menu, ShoppingCart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/contexts/CartContext';

// Cart Button Component
function CartButton() {
  const { getTotalItems } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const totalItems = getTotalItems();

  return (
    <>
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative h-9 w-9"
        onClick={() => setIsCartOpen(true)}
      >
        <ShoppingCart className="h-5 w-5" />
        {totalItems > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 hover:bg-red-600">
            {totalItems}
          </Badge>
        )}
      </Button>

      {isCartOpen && <CartSidebar onClose={() => setIsCartOpen(false)} />}
    </>
  );
}

// Cart Sidebar Component
function CartSidebar({ onClose }: { onClose: () => void }) {
  const { items, removeFromCart, updateQuantity, getTotalPrice, clearCart, getItemsByBranch } = useCart();
  const itemsByBranch = getItemsByBranch();

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black bg-opacity-50" onClick={onClose} />
      
      {/* Cart Panel */}
      <div className="w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Shopping Cart</h2>
            <p className="text-sm text-muted-foreground">{items.length} items</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">Your cart is empty</p>
              <p className="text-sm text-gray-400 mt-1">Add items from the marketplace</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(itemsByBranch.entries()).map(([branch, branchItems]) => (
                <div key={branch} className="border rounded-lg">
                  <div className="bg-gray-50 px-3 py-2 border-b">
                    <p className="text-sm font-medium text-gray-700">From: {branch}</p>
                  </div>
                  <div className="p-3 space-y-3">
                    {branchItems.map(item => (
                      <div key={item.id} className="flex gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-500">
                            {item.specification} • DOT: {item.dotCode}
                          </p>
                          <p className="text-sm font-semibold mt-1">
                            ฿{item.unitPrice.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-red-600"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <span className="text-xs">−</span>
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={item.quantity >= item.maxQuantity}
                            >
                              <span className="text-xs">+</span>
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500">
                            Subtotal: ฿{(item.unitPrice * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Amount</span>
              <span className="text-xl font-bold">฿{getTotalPrice().toLocaleString()}</span>
            </div>
            <Button className="w-full" size="sm">
              Proceed to Checkout ({items.length} items)
            </Button>
            <Button variant="outline" className="w-full" size="sm" onClick={clearCart}>
              Clear Cart
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Main App Content (ต้องอยู่ใน CartProvider)
function AppContent() {
  const [currentView, setCurrentView] = useState('inventory');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const myBranchId = 'tyreplus_ratchapruek'; // ID สาขาของเรา

  const renderContent = () => {
    switch (currentView) {
      case 'inventory':
        return <MyInventory />;
      case 'marketplace':
        return <MarketplaceView />;
      case 'orders':
        return <Orders />;
      // case 'dashboard':
      //   return <Dashboard />;
      default:
        return <MyInventory />;
    }
  };

  const getPageTitle = () => {
    switch (currentView) {
      case 'inventory':
        return 'My Inventory';
      case 'marketplace':
        return 'B2B Marketplace';
      case 'orders':
        return 'Orders Management';
      case 'dashboard':
        return 'Dashboard';
      default:
        return 'DealerNet';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* Sidebar */}
        <Sidebar 
          currentView={currentView} 
          setCurrentView={setCurrentView}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          branches={[]}
          orders={[]}
          selectedBranch={myBranchId}
          setSelectedBranch={() => {}}
        />

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 transition-all duration-300 ease-in-out">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-white/80 backdrop-blur-sm px-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open Sidebar</span>
            </Button>
            <h1 className="flex-1 text-md font-semibold">{getPageTitle()}</h1>
            {currentView === 'marketplace' && <CartButton />}
          </header>

          {/* Desktop Header */}
          <header className="hidden lg:flex sticky top-0 z-30 h-14 items-center justify-between border-b bg-white/80 backdrop-blur-sm px-6">
            <div>
              <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
              <p className="text-xs text-muted-foreground">
                {currentView === 'inventory' && 'Manage your branch inventory and stock levels'}
                {currentView === 'marketplace' && 'Order products from other dealers in your network'}
                {currentView === 'orders' && 'Track and manage all your orders'}
                {currentView === 'dashboard' && 'Overview of your business performance'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {currentView === 'marketplace' && <CartButton />}
            </div>
          </header>

          {/* Page Content */}
          <div className="container mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            {renderContent()}
          </div>
        </main>
        
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// Main Export - Wrap with CartProvider
export default function Home() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}