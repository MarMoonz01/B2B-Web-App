'use client';

import { useRouter } from 'next/navigation';
import AddBranchWizard from '@/src/app/components/AddBranchWizard';

export default function AddBranchPage() {
  const router = useRouter();
  return (
    <div className="container mx-auto p-6">
      <AddBranchWizard onDone={() => router.push('/branches')} />
    </div>
  );
}
