// src/app/page.tsx
'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useBranch } from '@/contexts/BranchContext';

// views
import MyInventory from '@/src/app/components/MyInventory';
import TransferPlatformView from '@/src/app/components/TransferPlatformView';
import TransferRequestsView from '@/src/app/components/TransferRequestsView';

// UI helpers (optional)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ViewKey =
  | 'inventory'
  | 'transfer_platform'
  | 'transfer_requests'
  | 'dashboard'
  | 'network'
  | 'analytics';

function isViewKey(v: string | null): v is ViewKey {
  return !!v && ['inventory','transfer_platform','transfer_requests','dashboard','network','analytics'].includes(v);
}

export default function Page() {
  const search = useSearchParams();
  const { selectedBranch, selectedBranchId } = useBranch();

  const view: ViewKey = isViewKey(search?.get('view')) ? (search!.get('view') as ViewKey) : 'inventory';
  const myBranchId = selectedBranchId || '';
  const myBranchName = selectedBranch?.branchName || selectedBranchId || 'My Branch';

  // ป้องกัน edge case ที่ยังไม่มีสาขา
  if (!myBranchId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select a branch to get started</CardTitle>
        </CardHeader>
        <CardContent>
          เลือกสาขาจากเมนูด้านซ้ายบน (BranchSelect) แล้วหน้านี้จะโหลดข้อมูลให้โดยอัตโนมัติ
        </CardContent>
      </Card>
    );
  }

  switch (view) {
    case 'inventory':
      return <MyInventory myBranchId={myBranchId} myBranchName={myBranchName} />;
    case 'transfer_platform':
      return <TransferPlatformView myBranchId={myBranchId} myBranchName={myBranchName} />;
    case 'transfer_requests':
      return <TransferRequestsView myBranchId={myBranchId} />;
    case 'dashboard':
      return (
        <Card>
          <CardHeader>
            <CardTitle>Dashboard (placeholder)</CardTitle>
          </CardHeader>
          <CardContent>ใส่กราฟหรือ KPI รวมที่ต้องการในภายหลังได้ที่นี่</CardContent>
        </Card>
      );
    case 'network':
      return (
        <Card>
          <CardHeader>
            <CardTitle>Branches (placeholder)</CardTitle>
          </CardHeader>
          <CardContent>หน้านี้สำหรับจัดการ/ดูรายการสาขา</CardContent>
        </Card>
      );
    case 'analytics':
      return (
        <Card>
          <CardHeader>
            <CardTitle>Analytics (placeholder)</CardTitle>
          </CardHeader>
          <CardContent>รายงานเชิงลึกจะมาอยู่ที่นี่</CardContent>
        </Card>
      );
    default:
      return <MyInventory myBranchId={myBranchId} myBranchName={myBranchName} />;
  }
}
