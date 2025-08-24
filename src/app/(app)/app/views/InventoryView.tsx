// src/app/app/views/InventoryView.tsx
"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function InventoryView({
  canWrite,
  selectedBranchId,
}: { canWrite: boolean; selectedBranchId: string|null }) {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm opacity-70">Branch: {selectedBranchId ?? "-"}</p>
        </div>
        <div className="flex gap-2">
          {/* ลิงก์ไป view อื่นภายใน /app */}
          <Button asChild><Link href="/app?view=transfer">ไปหน้า Transfer</Link></Button>
          <Button asChild variant="secondary"><Link href="/app?view=transfer-requests">คำขอโอนสินค้า</Link></Button>
        </div>
      </div>

      <div className="border rounded p-4">
        <div className="mb-3 text-sm opacity-70">สิทธิ์เขียน: {canWrite ? "ได้" : "ไม่ได้"}</div>
        {/* ตาราง/คอมโพเนนต์หลัก */}
      </div>
    </div>
  );
}
