'use client';
import React, { useState, useEffect } from 'react';
import { ShieldAlert, Info } from 'lucide-react';

import TransferPlatformView from '@/src/app/components/TransferPlatformView';
import EmptyState from '@/src/app/components/EmptyState';
import { useBranch } from '@/contexts/BranchContext';
import { canDo, type Role } from '@/src/lib/perm';
import type { Me } from '@/src/lib/session';

export default function TransferView() {
  const { selectedBranchId, selectedBranch } = useBranch();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        setLoading(true);
        const res = await fetch('/api/debug/session');
        if (res.ok) {
          const sessionData = await res.json();
          setMe(sessionData);
        }
      } catch (error) {
        console.error('Failed to fetch user session:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  const hasPermission = me ? canDo({
    moderator: me.moderator,
    roleInBranch: me.branches.find(b => b.id === selectedBranchId)?.roles?.[0] as Role,
    perm: 'transfer:access',
  }) : false;

  if (!hasPermission) {
    return (
      // 👇 [แก้ไข] เรียกใช้ EmptyState ด้วย props ที่ถูกต้อง
      <EmptyState
        title="Permission Denied"
        description="You do not have the required permissions to access this feature."
      >
        <ShieldAlert className="h-12 w-12 text-destructive" />
      </EmptyState>
    );
  }

  if (!selectedBranch) {
    return (
      // 👇 [แก้ไข] เรียกใช้ EmptyState ด้วย props ที่ถูกต้อง
      <EmptyState
        title="No Branch Selected"
        description="Please select a branch from the sidebar to view the transfer platform."
      >
        <Info className="h-12 w-12 text-muted-foreground" />
      </EmptyState>
    );
  }

  return <TransferPlatformView myBranchId={selectedBranch.id} myBranchName={selectedBranch.branchName} />;
}