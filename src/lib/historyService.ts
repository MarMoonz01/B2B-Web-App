// File: src/lib/historyService.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  collection,
  query,
  where,
  orderBy,
  limit as qLimit,
  getDocs,
  onSnapshot,
  QueryDocumentSnapshot,
  startAfter,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* =========================================================================================
 * Minimal shared types (ไม่ผูกกับไฟล์อื่นเพื่อเลี่ยง circular import)
 * =======================================================================================*/

export type OrderStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "shipped"
  | "received"
  | "cancelled"
  | "confirmed"
  | "delivered";

export type OrderItem = {
  productId: string;
  productName: string;
  specification: string;
  dotCode: string;
  quantity: number;
  variantId: string;
};

export type Order = {
  id?: string;
  orderNumber?: string;
  buyerBranchId: string;
  buyerBranchName: string;
  sellerBranchId: string;
  sellerBranchName: string;
  status: OrderStatus;
  items: OrderItem[];
  itemCount: number;
  notes?: string;
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
  cancelReason?: string | null;
};

export type StockMovementType =
  | "adjust"
  | "in"
  | "out"
  | "transfer_in"
  | "transfer_out";

export type StockMovement = {
  id?: string;
  branchId: string;
  orderId?: string;
  brand: string;
  model: string;
  variantId: string;
  dotCode: string;
  qtyChange: number; // +in, -out
  type: StockMovementType;
  reason?: string;
  createdAt: any; // Firestore Timestamp
};

export type HistoryKind = "order" | "movement";

/** รูปแบบมาตรฐานให้หน้า History แสดงผลได้ง่าย */
export type HistoryEvent = {
  id: string;
  kind: HistoryKind;
  createdAt: Date;
  title: string;      // สรุป
  subtitle?: string;  // รายละเอียดสั้น
  tags?: string[];    // เช่น ["transfer_out", "approved"]
  ref?: {             // อ้างอิงเอกสาร
    orderId?: string;
    movementId?: string;
  };
  raw?: any;          // raw doc (ถ้าหน้าต้องใช้ข้อมูลเพิ่ม)
};

/* =========================================================================================
 * Utils
 * =======================================================================================*/

function toDate(ts: any | undefined | null): Date {
  if (!ts) return new Date(0);
  // Firestore Timestamp มี seconds/nanoseconds และมี toDate()
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  return new Date(ts);
}

function fmtQty(q: number) {
  return new Intl.NumberFormat("th-TH").format(q);
}

/* =========================================================================================
 * Query: Stock Movements
 * =======================================================================================*/

export type MovementsQueryOptions = {
  /** ต้องการกรองประเภทหรือไม่ */
  type?: StockMovementType | "all";
  /** จำนวนต่อหน้า (default 50) */
  limit?: number;
  /** ใช้สำหรับ pagination (doc สุดท้ายของหน้าเดิม) */
  cursor?: QueryDocumentSnapshot | null;
};

export async function getStockMovementsByBranch(
  branchId: string,
  opts: MovementsQueryOptions = {}
): Promise<{
  items: StockMovement[];
  lastDoc: QueryDocumentSnapshot | null;
}> {
  if (!branchId) return { items: [], lastDoc: null };

  const col = collection(db, "stockMovements");
  const wh = [where("branchId", "==", branchId)];
  if (opts.type && opts.type !== "all") {
    wh.push(where("type", "==", opts.type));
  }

  const clauses: any[] = [ ...wh, orderBy("createdAt", "desc") ];
  if (opts.cursor) clauses.push(startAfter(opts.cursor));

  const q = query(col, ...clauses, qLimit(opts.limit ?? 50));
  const snap = await getDocs(q);

  const items: StockMovement[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  })) as any;

  return { items, lastDoc: snap.docs[snap.docs.length - 1] ?? null };
}

/** realtime (ยกเลิกได้ด้วย unsubscribe) */
export function onStockMovementsByBranch(
  branchId: string,
  callback: (rows: StockMovement[]) => void,
  opts: Omit<MovementsQueryOptions, "cursor"> = {}
): Unsubscribe {
  const col = collection(db, "stockMovements");
  const wh = [where("branchId", "==", branchId)];
  if (opts.type && opts.type !== "all") {
    wh.push(where("type", "==", opts.type));
  }
  const q = query(col, ...wh, orderBy("createdAt", "desc"), qLimit(opts.limit ?? 100));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as StockMovement[];
    callback(rows);
  });
}

/* =========================================================================================
 * Query: Orders
 * =======================================================================================*/

export type OrdersQueryOptions = {
  role?: "buyer" | "seller" | "both";
  statusIn?: OrderStatus[]; // กรองสถานะ (ถ้าไม่ส่ง จะดึงทุกสถานะ)
  limit?: number;
  cursor?: QueryDocumentSnapshot | null;
};

export async function getOrdersForHistory(
  branchId: string,
  opts: OrdersQueryOptions = {}
): Promise<{ items: Order[]; lastDoc: QueryDocumentSnapshot | null }> {
  if (!branchId) return { items: [], lastDoc: null };

  const role = opts.role ?? "both";
  const result: Order[] = [];
  let lastDoc: QueryDocumentSnapshot | null = null;

  async function fetchFor(field: "buyerBranchId" | "sellerBranchId") {
    const col = collection(db, "orders");
    const wh: any[] = [where(field, "==", branchId)];
    // หมายเหตุ: Firestore ไม่รองรับ array-contains สำหรับเทียบ status หลายค่าแบบ IN + orderBy พร้อมกัน
    // ถ้าต้องใช้จริง แนะนำแตกยิงหลายครั้งแล้วรวมผล หรือทำ composite index ให้ตรง
    const clauses: any[] = [...wh, orderBy("createdAt", "desc")];
    if (opts.cursor) clauses.push(startAfter(opts.cursor));
    const q = query(col, ...clauses, qLimit(opts.limit ?? 50));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[];
    result.push(...items);
    if (snap.docs.length) lastDoc = snap.docs[snap.docs.length - 1];
  }

  if (role === "buyer" || role === "both") {
    await fetchFor("buyerBranchId");
  }
  if (role === "seller" || role === "both") {
    await fetchFor("sellerBranchId");
  }

  // รวมแล้วเรียงเวลาด้วยตัวเอง (เพราะ buyer+seller รวมกัน)
  result.sort(
    (a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()
  );

  // กรอง status ถ้าส่งมา
  const filtered =
    opts.statusIn && opts.statusIn.length
      ? result.filter((o) => opts.statusIn!.includes(o.status))
      : result;

  // ตัดให้เหลือ limit (ในกรณีรวม 2 คิวรี)
  const limited = filtered.slice(0, opts.limit ?? 50);

  return { items: limited, lastDoc };
}

export function onOrdersForHistory(
  branchId: string,
  role: "buyer" | "seller" | "both",
  callback: (rows: Order[]) => void,
  limitCount = 100
): Unsubscribe {
  // หมายเหตุ: realtime ทั้งสองบทบาทพร้อมกัน เราจะสมัคร 2 channel แล้ว merge ฝั่ง client
  const unsubscribers: Unsubscribe[] = [];

  function sub(field: "buyerBranchId" | "sellerBranchId") {
    const col = collection(db, "orders");
    const qy = query(
      col,
      where(field, "==", branchId),
      orderBy("createdAt", "desc"),
      qLimit(limitCount)
    );
    return onSnapshot(qy, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[];
      callback(rows);
    });
  }

  if (role === "buyer" || role === "both") unsubscribers.push(sub("buyerBranchId"));
  if (role === "seller" || role === "both") unsubscribers.push(sub("sellerBranchId"));

  return () => unsubscribers.forEach((u) => u());
}

/* =========================================================================================
 * Compose: รวมเป็น Timeline เดียว
 * =======================================================================================*/

export type TimelineOptions = {
  role?: "buyer" | "seller" | "both";
  movementType?: StockMovementType | "all";
  limit?: number; // จำนวนสูงสุดหลังรวม
};

export async function getBranchHistoryTimeline(
  branchId: string,
  opts: TimelineOptions = {}
): Promise<HistoryEvent[]> {
  const [mov, ord] = await Promise.all([
    getStockMovementsByBranch(branchId, {
      type: opts.movementType ?? "all",
      limit: opts.limit ?? 100,
    }),
    getOrdersForHistory(branchId, {
      role: opts.role ?? "both",
      limit: opts.limit ?? 100,
    }),
  ]);

  const movementEvents: HistoryEvent[] = (mov.items ?? []).map((m) => ({
    id: `mov_${m.id}`,
    kind: "movement",
    createdAt: toDate(m.createdAt),
    title:
      m.type === "transfer_out"
        ? `Transfer OUT - ${m.brand} ${m.model} • DOT ${m.dotCode} (${fmtQty(m.qtyChange)})`
        : m.type === "transfer_in"
        ? `Transfer IN - ${m.brand} ${m.model} • DOT ${m.dotCode} (+${fmtQty(m.qtyChange)})`
        : m.qtyChange >= 0
        ? `Stock IN - ${m.brand} ${m.model} • DOT ${m.dotCode} (+${fmtQty(m.qtyChange)})`
        : `Stock OUT - ${m.brand} ${m.model} • DOT ${m.dotCode} (${fmtQty(m.qtyChange)})`,
    subtitle: m.reason || "",
    tags: [m.type],
    ref: { movementId: m.id, orderId: m.orderId },
    raw: m,
  }));

  const orderEvents: HistoryEvent[] = (ord.items ?? []).map((o) => ({
    id: `ord_${o.id}`,
    kind: "order",
    createdAt: toDate(o.createdAt),
    title: `Order ${o.orderNumber ?? o.id?.slice(0, 8)} • ${o.status}`,
    subtitle: `${o.buyerBranchName} ⇄ ${o.sellerBranchName} • ${o.itemCount} item(s)`,
    tags: ["order", o.status],
    ref: { orderId: o.id },
    raw: o,
  }));

  const timeline = [...movementEvents, ...orderEvents].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  // หากกำหนด limit → ตัดหลังรวม (เพื่อความง่าย)
  return timeline.slice(0, opts.limit ?? 100);
}
