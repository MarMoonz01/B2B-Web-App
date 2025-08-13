'use client';

import { useState } from 'react';
import Sidebar from '@/src/app/components/Sidebar';
import MyInventory from '@/src/app/components/MyInventory';
import TransferRequestsView from '@/src/app/components/TransferRequestsView'; // <-- เปลี่ยนชื่อ
import TransferPlatformView from '@/src/app/components/TransferPlatformView'; // <-- หน้าใหม่
import { BranchProvider, useBranch } from '@/contexts/BranchContext';

// ✅  ปรับปรุง ViewKey
type ViewKey =
  | 'inventory'
  | 'transfer_platform'
  | 'transfer_requests'
  | 'dashboard'
  | 'network'
  | 'analytics';

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewKey>('transfer_platform'); // <-- ตั้งค่าเริ่มต้นเป็นหน้า Platform
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { branches, selectedBranchId, selectedBranch, setSelectedBranchId } = useBranch();

  const renderContent = () => {
    switch (currentView) {
      case 'inventory':
        return <MyInventory />;
      case 'transfer_platform': // <-- หน้าสร้างคำขอ
        return (
          <TransferPlatformView
            myBranchId={selectedBranchId ?? ''}
            myBranchName={selectedBranch?.branchName ?? 'My Branch'}
          />
        );
      case 'transfer_requests': // <-- หน้ารายการ
        return <TransferRequestsView myBranchId={selectedBranchId ?? ''} />;
      case 'dashboard':
        return <div>Dashboard Content</div>; // Placeholder
      default:
        return <TransferPlatformView myBranchId={selectedBranchId ?? ''} myBranchName={selectedBranch?.branchName ?? 'My Branch'} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          branches={branches}
          selectedBranch={selectedBranchId ?? ''}
          setSelectedBranch={setSelectedBranchId}
        />
        <main className="flex-1 lg:ml-64 transition-all duration-300 ease-in-out">
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
      <AppContent />
    </BranchProvider>
  );
}