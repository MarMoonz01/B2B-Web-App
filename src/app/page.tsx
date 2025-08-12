'use client';

import { useState } from 'react';
import Sidebar from '@/src/app/components/Sidebar';
import MyInventory from '@/src/app/components/MyInventory';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [currentView, setCurrentView] = useState('inventory');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // <--- สร้าง State ที่นี่

  const renderContent = () => {
    switch (currentView) {
      case 'inventory':
        return <MyInventory />;
      // เพิ่ม case อื่นๆ ตามต้องการ
      // case 'dashboard':
      //   return <Dashboard />;
      default:
        return <MyInventory />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar 
            currentView={currentView} 
            setCurrentView={setCurrentView}
            isMobileMenuOpen={isMobileMenuOpen} // <--- ส่ง State ลงไป
            setIsMobileMenuOpen={setIsMobileMenuOpen} // <--- ส่ง Setter function ลงไป
            // Dummy props เพิ่มเติม (ควรแทนที่ด้วยข้อมูลจริงในอนาคต)
            branches={[]}
            orders={[]}
            selectedBranch={''}
            setSelectedBranch={() => {}}
        />

        {/* Main Content Area */}
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
              <h1 className="flex-1 text-md font-semibold">DealerNet</h1>
          </header>

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