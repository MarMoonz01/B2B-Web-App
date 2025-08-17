'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function InventoryPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="flex gap-2">
          <Button onClick={() => location.assign('/transfer')}>ไปหน้า Transfer</Button>
          <Link href="/transfer-requests">
            <Button variant="secondary">คำขอโอนสินค้า</Button>
          </Link>
        </div>
      </div>

      <div className="mt-6">
        {/* ตาราง/คอมโพเนนต์ Inventory หลัก */}
        {/* ... */}
      </div>
    </div>
  );
}
