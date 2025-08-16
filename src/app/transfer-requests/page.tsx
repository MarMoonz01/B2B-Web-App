'use client';

import React from 'react';
import TransferRequestsView from '@/src/app/components/TransferRequestsView';
import { useBranch } from '@/contexts/BranchContext';
import { Card, CardContent } from '@/components/ui/card';

export default function TransferRequestsPage() {
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
    <TransferRequestsView
      myBranchId={String(selectedBranchId)}
      myBranchName={String(selectedBranch?.branchName ?? selectedBranchId)}
    />
  );
}
