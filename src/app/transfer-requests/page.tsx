'use client';

import TransferRequestsView from '@/src/app/components/TransferRequestsView';
import { useBranch } from '@/contexts/BranchContext';

export default function TransferRequestsPage() {
  const { selectedBranchId } = useBranch();
  return <TransferRequestsView myBranchId={selectedBranchId ?? ''} />;
}
