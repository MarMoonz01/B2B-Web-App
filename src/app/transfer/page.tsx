'use client';

import React from 'react';
// เลือก path ให้ตรงกับโปรเจกต์คุณ:
// ถ้าไฟล์อยู่ที่ src/app/components/TransferPlatformView.tsx
import TransferPlatformView from '@/src/app/components/TransferPlatformView';
// ถ้าไฟล์ชื่อ/พาธต่าง เช่น transferplatformview.tsx ให้แก้ import ให้ตรง
// import TransferPlatformView from '@/src/app/components/transferplatformview';

import { useBranch } from '@/contexts/BranchContext';
import { Card, CardContent } from '@/components/ui/card';

export default function TransferPlatformPage() {
  const { selectedBranchId, selectedBranch, loading } = useBranch();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading branches…
        </CardContent>
      </Card>
    );
  }

  if (!selectedBranchId) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Please add or select your active branch from the sidebar.
        </CardContent>
      </Card>
    );
  }

  return (
    <TransferPlatformView
      myBranchId={String(selectedBranchId)}
      myBranchName={String(selectedBranch?.branchName ?? selectedBranchId)}
    />
  );
}
