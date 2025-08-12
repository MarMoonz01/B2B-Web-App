'use client';

import { Home, Package, ShoppingCart, Users, BarChart3, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// Interface สำหรับ Props ที่ Sidebar จะรับเข้ามา
interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  // Dummy props for now
  branches: any[];
  orders: any[];
  selectedBranch: string;
  setSelectedBranch: (id: string) => void;
}

export default function Sidebar({ currentView, setCurrentView, isMobileMenuOpen, setIsMobileMenuOpen }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingCart, new: true },
    { id: 'orders', label: 'Orders', icon: Package, count: 1 },
    { id: 'inventory', label: 'My Inventory', icon: Package, count: 1058 },
    { id: 'network', label: 'Dealer Network', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const quickActions = [
    { id: 'orderHistory', label: 'Order History' },
    { id: 'dealerDirectory', label: 'Dealer Directory' },
  ];

  const handleLinkClick = (view: string) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false); // ปิดเมนูเมื่อคลิกบนมือถือ
  };

  return (
    <aside className={`fixed left-0 top-0 h-full w-64 bg-white border-r z-50 p-4 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center gap-2 mb-6">
         <h1 className="text-xl font-bold text-slate-800">Dealer<span className="text-blue-600">Net</span></h1>
      </div>

      <Card className='mb-4'>
        <CardContent className='p-3'>
            <p className='text-xs text-slate-500 font-semibold mb-2'>YOUR BRANCH</p>
            <div className='flex justify-between items-center'>
                <p className='font-semibold text-sm'>Central Bangkok</p>
                <Badge variant="outline" className='bg-green-100 text-green-700 border-green-200 text-xs'>active</Badge>
            </div>
            <p className='text-xs text-slate-500'>Rating: 4.8/5.0</p>
        </CardContent>
      </Card>

      <div className="flex-1 overflow-y-auto pr-2">
        <nav className="space-y-1">
           <p className='text-xs text-slate-500 font-semibold mb-2 px-2'>MAIN MENU</p>
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={currentView === item.id ? 'secondary' : 'ghost'}
              className="w-full justify-start text-sm"
              onClick={() => handleLinkClick(item.id)}
            >
              <item.icon className="h-4 w-4 mr-2" />
              {item.label}
              {item.new && <Badge variant="default" className="ml-auto text-xs">New</Badge>}
              {item.count && <Badge variant="outline" className="ml-auto">{item.count}</Badge>}
            </Button>
          ))}
        </nav>

        <nav className="space-y-1 mt-4">
           <p className='text-xs text-slate-500 font-semibold mb-2 px-2'>QUICK ACTIONS</p>
          {quickActions.map((item) => (
            <Button key={item.id} variant="ghost" className="w-full justify-start text-sm" onClick={() => handleLinkClick(item.id)}>
              {item.label}
            </Button>
          ))}
        </nav>
      </div>

      <div className="mt-auto pt-4 border-t">
         <Button variant="ghost" className="w-full justify-start text-sm"><Settings className="h-4 w-4 mr-2"/> Settings</Button>
        <div className="flex items-center gap-3 mt-2">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">JS</div>
          <div>
            <p className="font-semibold text-sm">John Smith</p>
            <a href="#" className="text-xs text-slate-500 hover:underline flex items-center gap-1"><LogOut className='w-3 h-3'/> Sign out</a>
          </div>
        </div>
      </div>
    </aside>
  );
}