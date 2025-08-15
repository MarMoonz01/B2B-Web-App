// src/lib/services/InventoryService.ts
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// =========================
// Types (ให้เพียงพอต่อการใช้งานหน้า UI)
// =========================
export type Dot = {
  dotCode: string;
  qty: number;
  basePrice: number;
  promoPrice?: number | null;
};

export type SizeVariant = {
  variantId: string;
  specification: string;
  dots: Dot[];
};

export type BranchInventory = {
  branchId: string;
  branchName: string;
  sizes: SizeVariant[];
};

export type GroupedProduct = {
  id: string;            // productId
  name: string;          // product name
  brand: string;
  model?: string;
  branches: BranchInventory[];
};

export type StockMovementType = 'adjust' | 'in' | 'out' | 'transfer_in' | 'transfer_out';

export type StockMovement = {
  branchId: string;
  brand: string;
  model: string;
  variantId: string;
  dotCode: string;
  qtyChange: number; // +in, -out
  type: StockMovementType;
  reason?: string;
  createdAt: Timestamp;
};

export type OrderItem = {
  productId: string;
  productName: string;
  specification: string;
  dotCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantId: string;
};

export type OrderStatus = 'requested' | 'confirmed' | 'delivered' | 'cancelled';

export type Order = {
  id?: string;
  orderNumber?: string;
  buyerBranchId: string;
  buyerBranchName: string;
  sellerBranchId: string;
  sellerBranchName: string;
  status: OrderStatus;
  totalAmount: number;
  notes?: string;
  items: OrderItem[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// =========================
// Firestore collections (แก้ชื่อให้ตรงโปรเจกต์ของคุณถ้าจำเป็น)
// โครงสร้างสมมติ:
// products/{productId} => { name, brand, model }
// products/{productId}/branchInventory/{branchId} => { branchName, sizes: SizeVariant[] }
//
// orders/{orderId} => Order
// stores/{storeId} => { branchName, ... }
//
// stockMovements/{autoId} => StockMovement (optional logging)
// หรือเก็บใต้ stores/{branchId}/movements/{autoId} ก็ได้ (ตัวอย่างนี้ใช้คอลเลกชันรวม)
// =========================
const COLLECTIONS = {
  products: 'products',
  orders: 'orders',
  stores: 'stores',
  stockMovements: 'stockMovements',
};

// =========================
// Helper functions
// =========================
function slugifyId(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 120);
}

// หา productId จาก brand+model ถ้าไม่ unique ให้ปรับ logic นี้ให้ตรงกับข้อมูลจริง
async function findProductIdByBrandModel(brand: string, model?: string): Promise<string | null> {
  const q = query(
    collection(db, COLLECTIONS.products),
    where('brand', '==', brand),
    where('model', '==', model ?? '')
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].id;
}

function ensureArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// =========================
// Store Service
// =========================
export const StoreService = {
  async getAllStores(): Promise<Record<string, string>> {
    const snap = await getDocs(collection(db, COLLECTIONS.stores));
    const out: Record<string, string> = {};
    snap.forEach((d) => {
      const data = d.data() as any;
      out[d.id] = data.branchName ?? d.id;
    });
    return out;
  },

  async isStoreIdAvailable(storeId: string): Promise<boolean> {
    const ref = doc(db, COLLECTIONS.stores, storeId);
    const ds = await getDoc(ref);
    return !ds.exists();
  },

  async createStore(
    storeId: string,
    payload: {
      branchName: string;
      isActive?: boolean;
      address?: Record<string, any>;
      phone?: string;
      email?: string;
      orgId?: string;
      hours?: Record<string, { open: string; close: string; closed: boolean }>;
      location?: string;
      notes?: string;
    }
  ): Promise<void> {
    const ref = doc(db, COLLECTIONS.stores, storeId);
    await setDoc(ref, {
      branchName: payload.branchName,
      isActive: payload.isActive ?? true,
      address: payload.address ?? {},
      phone: payload.phone ?? '',
      email: payload.email ?? '',
      orgId: payload.orgId ?? '',
      hours: payload.hours ?? {},
      location: payload.location ?? '',
      notes: payload.notes ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async updateStore(
    storeId: string,
    patch: Partial<{
      branchName: string;
      isActive: boolean;
      address: Record<string, any>;
      phone: string;
      email: string;
      orgId: string;
      hours: Record<string, { open: string; close: string; closed: boolean }>;
      location: string;
      notes: string;
    }>
  ): Promise<void> {
    const ref = doc(db, COLLECTIONS.stores, storeId);
    await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
  },
};

// =========================
// Inventory Service
// =========================
export const InventoryService = {
  // ดึง inventory ของทุก product ทุกสาขา (สำหรับ Transfer Platform)
  async fetchInventory(): Promise<GroupedProduct[]> {
    const prodSnap = await getDocs(collection(db, COLLECTIONS.products));
    const out: GroupedProduct[] = [];

    // ดึง subcollection branchInventory ของแต่ละสินค้า
    for (const pdoc of prodSnap.docs) {
      const p = pdoc.data() as any;
      const branches: BranchInventory[] = [];
      const bSnap = await getDocs(collection(db, COLLECTIONS.products, pdoc.id, 'branchInventory'));
      bSnap.forEach((bdoc) => {
        const bdata = bdoc.data() as any;
        branches.push({
          branchId: bdoc.id,
          branchName: bdata.branchName ?? bdoc.id,
          sizes: ensureArray<SizeVariant>(bdata.sizes ?? []),
        });
      });
      out.push({
        id: pdoc.id,
        name: p.name ?? `${p.brand ?? ''} ${p.model ?? ''}`.trim(),
        brand: p.brand ?? '',
        model: p.model ?? '',
        branches,
      });
    }
    return out;
  },

  // ดึง inventory เฉพาะสาขาหนึ่ง (สำหรับ MyInventory)
  async fetchStoreInventory(branchId: string, branchName?: string): Promise<GroupedProduct[]> {
    const prodSnap = await getDocs(collection(db, COLLECTIONS.products));
    const out: GroupedProduct[] = [];

    for (const pdoc of prodSnap.docs) {
      const p = pdoc.data() as any;
      const bRef = doc(db, COLLECTIONS.products, pdoc.id, 'branchInventory', branchId);
      const bDoc = await getDoc(bRef);
      if (!bDoc.exists()) continue;

      const bdata = bDoc.data() as any;
      const sizes = ensureArray<SizeVariant>(bdata.sizes ?? []);
      out.push({
        id: pdoc.id,
        name: p.name ?? `${p.brand ?? ''} ${p.model ?? ''}`.trim(),
        brand: p.brand ?? '',
        model: p.model ?? '',
        branches: [
          {
            branchId,
            branchName: branchName ?? bdata.branchName ?? branchId,
            sizes,
          },
        ],
      });
    }
    return out;
  },

  // สร้าง/ปรับปรุง DOT (ใช้ใน Add DOT dialog)
  async upsertDot(
    branchId: string,
    payload: {
      brand: string;
      model?: string;
      variantId: string;
      dotCode: string;
      qty: number;
      promoPrice?: number;
    }
  ): Promise<void> {
    // หา product
    const productId =
      (await findProductIdByBrandModel(payload.brand, payload.model)) ??
      // ถ้าไม่พบ ให้สร้าง product ใหม่ (เลือกได้ตาม requirement)
      (await InventoryService._ensureProduct(payload.brand, payload.model ?? ''));

    const invRef = doc(db, COLLECTIONS.products, productId, 'branchInventory', branchId);
    const invDs = await getDoc(invRef);

    let branchName = branchId;
    const storeDs = await getDoc(doc(db, COLLECTIONS.stores, branchId));
    if (storeDs.exists()) {
      const s = storeDs.data() as any;
      branchName = s.branchName ?? branchId;
    }

    const sizes: SizeVariant[] = invDs.exists() ? ensureArray<SizeVariant>((invDs.data() as any).sizes) : [];

    // หา variant
    const idx = sizes.findIndex((s) => String(s.variantId) === String(payload.variantId));
    if (idx === -1) {
      sizes.push({
        variantId: String(payload.variantId),
        specification: '', // ให้ UI ตั้งได้; หรือไปอ่านจาก products/variants ถ้ามี
        dots: [
          {
            dotCode: payload.dotCode,
            qty: payload.qty,
            basePrice: 0,
            promoPrice: payload.promoPrice ?? undefined,
          },
        ],
      });
    } else {
      const dots = sizes[idx].dots ?? [];
      const didx = dots.findIndex((d) => d.dotCode === payload.dotCode);
      if (didx === -1) {
        dots.push({
          dotCode: payload.dotCode,
          qty: payload.qty,
          basePrice: 0,
          promoPrice: payload.promoPrice ?? undefined,
        });
      } else {
        dots[didx].qty = payload.qty;
        if (payload.promoPrice !== undefined) {
          dots[didx].promoPrice = payload.promoPrice;
        }
      }
      sizes[idx].dots = dots;
    }

    await setDoc(invRef, { branchName, sizes }, { merge: true });
  },

  // ตั้ง/ลบราคาโปร
  async setPromoPrice(
    branchId: string,
    payload: { brand: string; model?: string; variantId: string; dotCode: string; promoPrice: number | null }
  ): Promise<void> {
    const productId = await findProductIdByBrandModel(payload.brand, payload.model);
    if (!productId) throw new Error('Product not found');

    const invRef = doc(db, COLLECTIONS.products, productId, 'branchInventory', branchId);
    const invDs = await getDoc(invRef);
    if (!invDs.exists()) throw new Error('Branch inventory not found');

    const data = invDs.data() as any;
    const sizes: SizeVariant[] = ensureArray<SizeVariant>(data.sizes ?? []);
    const sidx = sizes.findIndex((s) => String(s.variantId) === String(payload.variantId));
    if (sidx === -1) throw new Error('Variant not found');

    const dots = sizes[sidx].dots ?? [];
    const didx = dots.findIndex((d) => d.dotCode === payload.dotCode);
    if (didx === -1) throw new Error('DOT not found');

    dots[didx].promoPrice = payload.promoPrice ?? undefined;
    sizes[sidx].dots = dots;

    await updateDoc(invRef, { sizes });
  },

  // ลบ DOT
  async deleteDot(
    branchId: string,
    payload: { brand: string; model?: string; variantId: string; dotCode: string }
  ): Promise<void> {
    const productId = await findProductIdByBrandModel(payload.brand, payload.model);
    if (!productId) throw new Error('Product not found');

    const invRef = doc(db, COLLECTIONS.products, productId, 'branchInventory', branchId);
    const invDs = await getDoc(invRef);
    if (!invDs.exists()) throw new Error('Branch inventory not found');

    const data = invDs.data() as any;
    const sizes: SizeVariant[] = ensureArray<SizeVariant>(data.sizes ?? []);
    const sidx = sizes.findIndex((s) => String(s.variantId) === String(payload.variantId));
    if (sidx === -1) throw new Error('Variant not found');

    sizes[sidx].dots = (sizes[sidx].dots ?? []).filter((d) => d.dotCode !== payload.dotCode);
    await updateDoc(invRef, { sizes });
  },

  // บันทึก movement และปรับ qty (ใช้ในปุ่ม + / -)
  async createStockMovement(
    branchId: string,
    target: { brand: string; model?: string; variantId: string; dotCode: string },
    type: StockMovementType,
    qtyChange: number,
    meta?: { reason?: string }
  ): Promise<void> {
    const productId = await findProductIdByBrandModel(target.brand, target.model);
    if (!productId) throw new Error('Product not found');

    const invRef = doc(db, COLLECTIONS.products, productId, 'branchInventory', branchId);
    const invDs = await getDoc(invRef);
    if (!invDs.exists()) throw new Error('Branch inventory not found');

    const data = invDs.data() as any;
    const sizes: SizeVariant[] = ensureArray<SizeVariant>(data.sizes ?? []);
    const sidx = sizes.findIndex((s) => String(s.variantId) === String(target.variantId));
    if (sidx === -1) throw new Error('Variant not found');

    const dots = sizes[sidx].dots ?? [];
    const didx = dots.findIndex((d) => d.dotCode === target.dotCode);
    if (didx === -1) throw new Error('DOT not found');

    const newQty = Math.max(0, Number(dots[didx].qty ?? 0) + Number(qtyChange));
    dots[didx].qty = newQty;
    sizes[sidx].dots = dots;

    const batch = writeBatch(db);
    batch.update(invRef, { sizes });

    const mvRef = doc(collection(db, COLLECTIONS.stockMovements));
    const movement: StockMovement = {
      branchId,
      brand: target.brand,
      model: target.model ?? '',
      variantId: target.variantId,
      dotCode: target.dotCode,
      qtyChange,
      type,
      reason: meta?.reason,
      createdAt: serverTimestamp() as any,
    };
    batch.set(mvRef, movement);

    await batch.commit();
  },

  // ถ้าไม่พบ product ให้สร้าง (ใช้งานภายใน)
  async _ensureProduct(brand: string, model: string): Promise<string> {
    const name = `${brand} ${model}`.trim();
    const newId = slugifyId(`${brand}-${model}`) || crypto.randomUUID();
    const ref = doc(db, COLLECTIONS.products, newId);
    const ds = await getDoc(ref);
    if (!ds.exists()) {
      await setDoc(ref, {
        name,
        brand,
        model,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return newId;
  },
};

// =========================
// Order Service
// =========================
export const OrderService = {
  async createOrder(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber'>): Promise<string> {
    const ref = await addDoc(collection(db, COLLECTIONS.orders), {
      ...order,
      orderNumber: `TR-${Date.now().toString().slice(-6)}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  // role = 'buyer' | 'seller'
  async getOrdersByBranch(branchId: string, role: 'buyer' | 'seller'): Promise<Order[]> {
    const field = role === 'buyer' ? 'buyerBranchId' : 'sellerBranchId';
    const qy = query(collection(db, COLLECTIONS.orders), where(field, '==', branchId));
    const snap = await getDocs(qy);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[];
  },

  async approveTransfer(orderId: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.orders, orderId);
    await updateDoc(ref, { status: 'confirmed', updatedAt: serverTimestamp() });
  },
};
