'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function BranchesPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Branches</h1>
        <div className="flex gap-2">
          <Link href="/branches/new">
            <Button>สร้างสาขาใหม่</Button>
          </Link>
          <Link href="/transfer">
            <Button variant="secondary">Transfer</Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {/* รายการสาขา */}
        {/* ... โค้ดแสดงตาราง/การ์ดสาขา ... */}
      </div>
    </div>
  );
}
