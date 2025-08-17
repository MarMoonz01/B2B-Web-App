/* eslint-disable react/no-unescaped-entities */
'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function DonePage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold mb-4">เสร็จสิ้นการตั้งค่า Inventory</h1>
        <p className="text-muted-foreground mb-6">
          คุณได้สร้างคลังสินค้าสำหรับสาขาใหม่เรียบร้อยแล้ว สามารถเริ่มใช้งานได้ทันที
        </p>

        <div className="flex gap-3">
          <Button onClick={() => router.push('/inventory')}>ไปหน้า Inventory</Button>
          <Button variant="secondary" onClick={() => location.assign('/transfer')}>
            ไปที่หน้า Transfer
          </Button>
          <Link href="/branches" className="underline text-sm self-center">
            กลับไปหน้ารายการสาขา
          </Link>
        </div>

        <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          หากต้องการตั้งค่าเพิ่มเติม เช่น ผู้ใช้ สิทธิ์การเข้าถึง หรือรูปแบบการบันทึกข้อมูล
          สามารถแก้ไขได้ภายหลังในเมนู Settings
        </div>
      </div>
    </div>
  );
}
