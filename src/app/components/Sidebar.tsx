'use client';

import { Dispatch, SetStateAction } from 'react';
import { Home, Package, Users, BarChart3, Settings, LogOut, ArrowRightLeft, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ✅  ปรับปรุง ViewKey
type ViewKey =
  | 'inventory'
  | 'transfer_platform' //  <-- หน้าสร้างคำขอโอนย้าย
  | 'transfer_requests' //  <-- หน้ารายการคำขอ
  | 'dashboard'
  | 'network'
  | 'analytics';

interface SidebarProps {
  currentView: ViewKey;
  setCurrentView: Dispatch<SetStateAction<ViewKey>>;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: Dispatch<SetStateAction<boolean>>;
  branches: Array<{ id: string; branchName: string }>;
  selectedBranch: string;
  setSelectedBranch: (id: string) => void;
}

export default function Sidebar({
  currentView,
  setCurrentView,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  branches,
  selectedBranch,
  setSelectedBranch,
}: SidebarProps) {
  // ✅  ปรับปรุง menuItems
  const menuItems: Array<{ id: ViewKey; label: string; icon: any; new?: boolean }> = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'transfer_platform', label: 'Transfer Platform', icon: LayoutGrid, new: true },
    { id: 'transfer_requests', label: 'Transfers', icon: ArrowRightLeft },
    { id: 'inventory', label: 'My Inventory', icon: Package },
    { id: 'network', label: 'Dealer Network', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const handleLinkClick = (view: ViewKey) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  return (
    <aside className={`fixed left-0 top-0 h-full w-64 bg-white border-r z-50 p-4 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-2 mb-6">
            <h1 className="text-xl font-bold text-slate-800">Dealer<span className="text-blue-600">Net</span></h1>
        </div>
        <Card className="mb-4">
            <CardContent className="p-3">
                <p className="text-xs text-slate-500 font-semibold mb-2">YOUR BRANCH</p>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-full h-8"><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                        {branches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.branchName}</SelectItem>))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
        <div className="flex-1 overflow-y-auto pr-2">
            <nav className="space-y-1">
                <p className="text-xs text-slate-500 font-semibold mb-2 px-2">MAIN MENU</p>
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
                    </Button>
                ))}
            </nav>
        </div>
        <div className="mt-auto pt-4 border-t">
            <Button variant="ghost" className="w-full justify-start text-sm"><Settings className="h-4 w-4 mr-2" /> Settings</Button>
            <div className="flex items-center gap-3 mt-2">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">JS</div>
                <div>
                    <p className="font-semibold text-sm">John Smith</p>
                    <a href="#" className="text-xs text-slate-500 hover:underline flex items-center gap-1"><LogOut className="w-3 h-3" /> Sign out</a>
                </div>
            </div>
        </div>
    </aside>
  );
}