'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import MyInventory from '@/src/app/components/MyInventory';
import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/button';

export default function InventoryPage() {
  const router = useRouter();
  const { selectedBranchId, branches } = useBranch();
  const myBranchId = selectedBranchId ?? '';
  const myBranchName =
    myBranchId ? (branches.find((b) => b.id === myBranchId)?.branchName ?? '') : '';

  const goImport = () => {
    if (!myBranchId) return;
    router.push(
      `/branches/new/inventory?branch=${encodeURIComponent(myBranchId)}&name=${encodeURIComponent(
        myBranchName || myBranchId
      )}`
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={goImport} disabled={!myBranchId}>
          Import CSV / Add Items
        </Button>
      </div>

      <MyInventory
        myBranchId={myBranchId}
        myBranchName={myBranchName}
        // ✅ แก้ path ไป Transfer Platform ให้ถูก
        onNavigate={(k) => {
          if (k === 'transfer_platform') location.assign('/transfer-platform');
        }}
      />
    </div>
  );
}
