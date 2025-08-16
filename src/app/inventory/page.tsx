'use client';

import MyInventory from '@/src/app/components/MyInventory';
import { useBranch } from '@/contexts/BranchContext';

export default function InventoryPage() {
  const { selectedBranchId, branches } = useBranch();
  const myBranchId = selectedBranchId ?? '';
  const myBranchName = myBranchId ? (branches.find(b => b.id === myBranchId)?.branchName ?? '') : '';

  return (
    <MyInventory
  myBranchId={myBranchId}
  myBranchName={myBranchName}
  onNavigate={(k) => {
    if (k === 'transfer_platform') location.assign('/transfer-platform'); // ✅
  }}
/>
  );
}
