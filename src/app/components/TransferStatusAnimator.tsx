// src/app/components/TransferStatusAnimator.tsx
'use client';

import Lottie from 'lottie-react';
import type { OrderStatus } from '@/lib/services/InventoryService';

// --- หมายเหตุ ---
// คุณต้องไปดาวน์โหลดไฟล์ Lottie ที่ต้องการ (เป็น .json)
// แล้วนำมาไว้ที่ public/animations/
// ตัวอย่าง:
import truckAnimation from '@/animations/truck-shipping.json';
import receivedAnimation from '@/animations/order-received.json';

interface TransferStatusAnimatorProps {
  status: OrderStatus;
}

/**
 * Component สำหรับแสดง Lottie Animation ตามสถานะของ Order
 */
export function TransferStatusAnimator({ status }: TransferStatusAnimatorProps) {
  // ถ้าสถานะเป็น "กำลังจัดส่ง" ให้แสดงแอนิเมชันรถวิ่ง
  if (status === 'shipped') {
    return (
      <div className="w-14 h-14 -ml-2 -mt-2 -mb-2">
        <Lottie animationData={truckAnimation} loop={true} />
      </div>
    );
  }

  // ถ้าสถานะเป็น "ได้รับแล้ว" ให้แสดงแอนิเมชันรับของ (เล่นครั้งเดียว)
  if (status === 'received' || status === 'delivered') {
    return (
      <div className="w-10 h-10">
        <Lottie animationData={receivedAnimation} loop={false} />
      </div>
    );
  }

  // ถ้าเป็นสถานะอื่นๆ ไม่ต้องแสดงแอนิเมชัน
  return null;
}