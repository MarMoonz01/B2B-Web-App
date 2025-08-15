'use client';

import { useRouter } from 'next/navigation';
import MyInventory from '@/src/app/components/MyInventory';

export default function InventoryPage() {
  const router = useRouter();

  // ถ้า MyInventory เรียก onNavigate('transfer_platform') ก็พาไปหน้า /transfer
  return (
    <MyInventory
          onNavigate={(k) => {
              if (k === 'transfer_platform') router.push('/transfer');
          } } myBranchId={''} myBranchName={''}    />
  );
}
