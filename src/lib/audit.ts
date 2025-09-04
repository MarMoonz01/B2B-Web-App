// File: src/lib/audit.ts
// ฟังก์ชันกลางสำหรับบันทึกเหตุการณ์ (History/Audit) ลง Firestore (client SDK)

import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** ประเภทเหตุการณ์มาตรฐานที่หน้า History/Analytics จะรองรับ */
export type AuditEventType =
  | 'stock.received'
  | 'stock.issued'
  | 'stock.adjustment'
  | 'stock.transfer.in'
  | 'stock.transfer.out'
  | 'order.requested'
  | 'order.approved'
  | 'order.rejected'
  | 'order.shipped'
  | 'order.received'
  | 'order.cancelled';

export type AuditEvent = {
  /** สาขาที่เกิดเหตุการณ์ (จำเป็น) */
  branchId: string;

  /** ประเภทเหตุการณ์ (จำเป็น) */
  eventType: AuditEventType;

  /** อ้างอิงเอนทิตี (เลือกใส่ได้) */
  entityType?: 'stock' | 'order';
  entityId?: string;        // เช่น orderId หรือ product/variant id
  orderId?: string;         // ชัดเจนว่าอ้างกับคำสั่งไหน

  /** รายละเอียดสินค้า/สต็อก (เลือกใส่ได้) */
  brand?: string;
  model?: string;
  variantId?: string;
  dotCode?: string;

  /** ปริมาณ/มูลค่า (เลือกใส่ได้) */
  qtyChange?: number;       // +in / -out
  unitPrice?: number | null;
  totalValue?: number | null;

  /** meta อื่น ๆ (เลือกใส่ได้) */
  reasonCode?: string | null;                    // เช่น 'manual.adjust', 'to XXX', 'from YYY'
  source?: { kind: 'order' | 'manual' | 'system'; id?: string }; // แหล่งที่มา
  actor?: { uid?: string; email?: string | null };               // ผู้กระทำ (ถ้ามี)

  /** เวลาเกิดเหตุการณ์จริง; ถ้าไม่ระบุจะใช้ createdAt */
  occurredAt?: Timestamp;
};

/**
 * บันทึกเหตุการณ์ลงคอลเลกชัน global: `stockMovements`
 * เหตุผลที่เลือก global: คิวรีรวมหลายสาขา/ทำ analytics ง่าย และ index เดียวพอ
 */
export async function logEvent(ev: AuditEvent) {
  const payload = {
    ...ev,
    occurredAt: ev.occurredAt ?? serverTimestamp(),
    createdAt: serverTimestamp(),
  };
  await addDoc(collection(db, 'stockMovements'), payload);
}
