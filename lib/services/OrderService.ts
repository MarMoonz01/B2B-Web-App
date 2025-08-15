// src/lib/services/OrderService.ts
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ---------- Types ----------
export type OrderItem = {
  productId: string;
  productName: string;
  specification: string;   // ขนาด/สเปค
  dotCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantId: string;       // อ้างอิง variant ของสเปค
};

export type OrderStatus = 'requested' | 'confirmed' | 'cancelled' | 'fulfilled';

export type Order = {
  id: string;
  orderNumber?: string;
  buyerBranchId: string;
  buyerBranchName: string;
  sellerBranchId: string;
  sellerBranchName: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  notes?: string;
  createdAt?: Timestamp;   // Firestore Timestamp
};

// ---------- Service ----------
export const OrderService = {
  /**
   * สร้างคำขอโอนย้าย (order) ลงคอลเลกชัน 'orders'
   * คืนค่า id ของเอกสารที่สร้าง
   */
  async createOrder(payload: {
    buyerBranchId: string;
    buyerBranchName: string;
    sellerBranchId: string;
    sellerBranchName: string;
    items: OrderItem[];
    totalAmount: number;
    status: OrderStatus;
    notes?: string;
    orderNumber?: string;
  }): Promise<string> {
    const ref = await addDoc(collection(db, 'orders'), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  /**
   * ดึงรายการคำขอโอนย้ายของสาขาใดสาขาหนึ่ง
   * role = 'buyer' จะ where ที่ buyerBranchId
   * role = 'seller' จะ where ที่ sellerBranchId
   */
  async getOrdersByBranch(
    branchId: string,
    role: 'buyer' | 'seller' = 'buyer'
  ): Promise<Order[]> {
    const field = role === 'buyer' ? 'buyerBranchId' : 'sellerBranchId';
    const q = query(
      collection(db, 'orders'),
      where(field, '==', branchId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[];
  },

  /**
   * subscribe แบบ realtime
   * ใช้คืนค่า unsubscribe function
   */
  onOrdersByBranch(
    branchId: string,
    role: 'buyer' | 'seller',
    cb: (orders: Order[]) => void
  ) {
    const field = role === 'buyer' ? 'buyerBranchId' : 'sellerBranchId';
    const q = query(
      collection(db, 'orders'),
      where(field, '==', branchId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[];
      cb(list);
    });
  },
};
