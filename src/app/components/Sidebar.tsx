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
    <aside className={`fixed left-0 top-0 h-full w-64 glass border-r z-50 p-6 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">D</span>
            </div>
            <div>
                <h1 className="text-xl font-bold text-foreground">DealerNet</h1>
                <p className="text-xs text-muted-foreground">Inventory System</p>
            </div>
        </div>
        <Card className="mb-6 hover-lift">
            <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-semibold mb-3 uppercase tracking-wider">Your Branch</p>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-full h-10 focus-ring"><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                        {branches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.branchName}</SelectItem>))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
        <div className="flex-1 overflow-y-auto">
            <nav className="space-y-2">
                <p className="text-xs text-muted-foreground font-semibold mb-4 px-3 uppercase tracking-wider">Main Menu</p>
                {menuItems.map((item) => (
                    <Button
                        key={item.id}
                        variant={currentView === item.id ? 'default' : 'ghost'}
                        className={`w-full justify-start text-sm h-11 px-3 focus-ring ${
                            currentView === item.id 
                                ? 'gradient-primary text-primary-foreground shadow-md' 
                                : 'hover:bg-accent/50'
                        }`}
                        onClick={() => handleLinkClick(item.id)}
                    >
                        <item.icon className="h-4 w-4 mr-3" />
                        {item.label}
                        {item.new && (
                            <Badge variant="secondary" className="ml-auto text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                                New
                            </Badge>
                        )}
                    </Button>
                ))}
            </nav>
        </div>
        <div className="mt-auto pt-6 border-t border-border/50">
            <Button variant="ghost" className="w-full justify-start text-sm h-11 px-3 focus-ring hover:bg-accent/50 mb-4">
                <Settings className="h-4 w-4 mr-3" /> Settings
            </Button>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover-lift">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center font-bold text-primary-foreground">JS</div>
                <div>
                    <p className="font-semibold text-sm text-foreground">John Smith</p>
                    <a href="#" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                        <LogOut className="w-3 h-3" /> Sign out
                    </a>
                </div>
            </div>
        </div>
    </aside>
  );
}