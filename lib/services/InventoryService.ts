// lib/services/InventoryService.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* =========================
 * Types
 * =======================*/

export type Dot = {
  dotCode: string;
  qty: number;
  promoPrice?: number | null;
  basePrice?: number;
  createdAt?: any;
  updatedAt?: any;
};

export type Variant = {
  variantId: string;
  size?: string;
  loadIndex?: string;
  basePrice?: number;
  updatedAt?: any;
  // convenience (บางหน้าอยากได้สตริงรวม)
  specification?: string;
};

export type Model = {
  modelId: string;
  modelName: string;
  variants?: Variant[];
  updatedAt?: any;
};

export type Brand = {
  brandId: string;
  brandName: string;
  models?: Model[];
  updatedAt?: any;
};

export type SizeVariant = {
  variantId: string;
  specification: string; // size + loadIndex
  basePrice?: number;
  dots: {
    dotCode: string;
    qty: number;
    basePrice?: number;
    promoPrice?: number | null;
  }[];
};

export type BranchInventory = {
  branchId: string;
  branchName: string;
  sizes: SizeVariant[];
};

export type GroupedProduct = {
  id: string; // brandId-modelId
  name: string; // `${brandName} ${modelName}`
  brand: string; // brandName
  model?: string; // modelName
  branches: BranchInventory[];
};

export type StockMovementType =
  | 'adjust'
  | 'in'
  | 'out'
  | 'transfer_in'
  | 'transfer_out';

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

// Current + legacy (confirmed, delivered) for compatibility
export type OrderStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'shipped'
  | 'received'
  | 'cancelled'
  | 'confirmed' // legacy -> treat as approved
  | 'delivered'; // legacy -> treat as shipped/received in old UIs

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
  cancelReason?: string;
};

export type StoreDoc = {
  branchName: string;
  isActive?: boolean;
  phone?: string;
  email?: string;
  lineId?: string;
  address?: {
    line1?: string;
    line2?: string;
    district?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  location?: {
    lat?: number;
    lng?: number;
  };
  services?: string[];
  hours?: Record<string, { open: string; close: string; closed: boolean }>;
  notes?: string;
  orgId?: string;
  createdAt?: any;
  updatedAt?: any;
};

/* =========================
 * Utils
 * =======================*/
export function slugifyId(s: string): string {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 120);
}

function ensureArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function specFromVariant(v: { size?: string; loadIndex?: string } | null | undefined) {
  const size = (v?.size || '').trim();
  const li = (v?.loadIndex || '').trim();
  return size && li ? `${size} (${li})` : (size || li || '');
}

/* =========================
 * Store Service
 * =======================*/
export const StoreService = {
  async getAllStores(): Promise<Record<string, string>> {
    const snap = await getDocs(collection(db, 'stores'));
    const out: Record<string, string> = {};
    snap.forEach((d) => {
      const data = d.data() as any;
      out[d.id] = data.branchName ?? d.id;
    });
    return out;
  },

  async isStoreIdAvailable(storeId: string): Promise<boolean> {
    const ref = doc(db, 'stores', storeId);
    const ds = await getDoc(ref);
    return !ds.exists();
  },

  async createStore(storeId: string, payload: StoreDoc): Promise<void> {
    const ref = doc(db, 'stores', storeId);
    await setDoc(ref, {
      ...payload,
      // ป้องกัน undefined ใส่เป็น null ดีกว่า
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      lineId: payload.lineId ?? null,
      address: payload.address ?? {},
      location: payload.location ?? {},
      services: payload.services ?? [],
      notes: payload.notes ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async updateStore(storeId: string, patch: Partial<StoreDoc>): Promise<void> {
    const ref = doc(db, 'stores', storeId);
    await updateDoc(ref, {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  },

  async getStore(storeId: string): Promise<StoreDoc | null> {
    const ref = doc(db, 'stores', storeId);
    const ds = await getDoc(ref);
    if (!ds.exists()) return null;
    return { ...(ds.data() as any) } as StoreDoc;
  },
};

/* =========================
 * Inventory Service
 *  - API ที่หน้า UI ใช้จริง + alias บางตัว
 * =======================*/
export const InventoryService = {
  /* ---------- Ensure helpers (เบา ๆ เพื่อใช้ตอนสร้าง/แก้ไข) ---------- */

  async ensureBrandDoc(storeId: string, brandName: string): Promise<{ brandId: string }> {
    const brandId = slugifyId(brandName);
    const brandRef = doc(db, 'stores', storeId, 'inventory', brandId);
    const snap = await getDoc(brandRef);
    if (!snap.exists()) {
      await setDoc(brandRef, {
        brandName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      // sync ชื่อให้ถูก (ถ้า UI แก้ชื่อ)
      const cur = snap.data()?.brandName;
      if (cur !== brandName && brandName) {
        await updateDoc(brandRef, { brandName, updatedAt: serverTimestamp() });
      }
    }
    return { brandId };
  },

  async ensureModelDoc(
    storeId: string,
    brandIdOrName: string,
    modelName: string
  ): Promise<{ brandId: string; modelId: string }> {
    const brandId = slugifyId(brandIdOrName);
    const brandRef = doc(db, 'stores', storeId, 'inventory', brandId);
    const b = await getDoc(brandRef);
    if (!b.exists()) {
      await setDoc(brandRef, {
        brandName: brandIdOrName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const modelId = slugifyId(modelName);
    const modelRef = doc(brandRef, 'models', modelId);
    const m = await getDoc(modelRef);
    if (!m.exists()) {
      await setDoc(modelRef, {
        modelName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const cur = m.data()?.modelName;
      if (cur !== modelName && modelName) {
        await updateDoc(modelRef, { modelName, updatedAt: serverTimestamp() });
      }
    }
    return { brandId, modelId };
  },

  /** สร้าง variant ถ้ายังไม่มี (กรณี dialog สร้างสเปคใหม่) */
  async ensureVariantPath(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    init?: { size?: string; loadIndex?: string; basePrice?: number }
  ): Promise<{ brandId: string; modelId: string; variantId: string }> {
    const vRef = doc(
      db,
      'stores',
      storeId,
      'inventory',
      brandId,
      'models',
      modelId,
      'variants',
      variantId
    );
    const v = await getDoc(vRef);
    if (!v.exists()) {
      await setDoc(vRef, {
        size: init?.size ?? null,
        loadIndex: init?.loadIndex ?? null,
        basePrice: init?.basePrice ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (init && (init.size || init.loadIndex || typeof init.basePrice === 'number')) {
      await updateDoc(vRef, {
        ...(init.size !== undefined ? { size: init.size } : {}),
        ...(init.loadIndex !== undefined ? { loadIndex: init.loadIndex } : {}),
        ...(init.basePrice !== undefined ? { basePrice: init.basePrice } : {}),
        updatedAt: serverTimestamp(),
      });
    }
    return { brandId, modelId, variantId };
  },

  /** สร้าง dot ถ้ายังไม่มี (ใช้เวลาสร้าง/แก้ไขเฉพาะตัว) */
  async ensureDotDoc(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string,
    init?: { qty?: number; promoPrice?: number | null }
  ): Promise<void> {
    const dRef = doc(
      db,
      'stores',
      storeId,
      'inventory',
      brandId,
      'models',
      modelId,
      'variants',
      variantId,
      'dots',
      dotCode
    );
    const d = await getDoc(dRef);
    if (!d.exists()) {
      await setDoc(dRef, {
        qty: Math.max(0, init?.qty ?? 0),
        promoPrice: init?.promoPrice ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (init) {
      await updateDoc(dRef, {
        ...(init.qty !== undefined ? { qty: Math.max(0, init.qty) } : {}),
        ...(init.promoPrice !== undefined ? { promoPrice: init.promoPrice } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  },

  /* ---------- Read: inventory ---------- */

  /** ดึง inventory ของสาขาเดียว */
  async fetchStoreInventory(storeId: string, storeName?: string): Promise<GroupedProduct[]> {
    const storeRef = doc(db, 'stores', storeId);
    const inventoryRef = collection(storeRef, 'inventory');
    const brandsSnap = await getDocs(inventoryRef);

    if (brandsSnap.empty) return [];

    const products: GroupedProduct[] = [];

    for (const brandDoc of brandsSnap.docs) {
      const brandId = brandDoc.id;
      const brandData = brandDoc.data() as any;
      const brandName = brandData.brandName || brandId;

      const modelsRef = collection(brandDoc.ref, 'models');
      const modelsSnap = await getDocs(modelsRef);

      for (const modelDoc of modelsSnap.docs) {
        const modelId = modelDoc.id;
        const modelData = modelDoc.data() as any;
        const modelName = modelData.modelName || modelId;

        const variantsRef = collection(modelDoc.ref, 'variants');
        const variantsSnap = await getDocs(variantsRef);

        const sizes: SizeVariant[] = [];
        for (const variantDoc of variantsSnap.docs) {
          const vData = variantDoc.data() as any;
          const variantId = variantDoc.id;
          const specification = specFromVariant(vData);
          const basePrice = vData.basePrice ?? undefined;

          const dotsRef = collection(variantDoc.ref, 'dots');
          const dotsSnap = await getDocs(dotsRef);

          const dots = dotsSnap.docs
            .map((d) => {
              const dd = d.data() as any;
              return {
                dotCode: d.id,
                qty: Number(dd.qty || 0),
                basePrice,
                promoPrice: dd.promoPrice ?? null,
              };
            })
            .filter((d) => d.qty > 0);

          if (dots.length > 0) {
            sizes.push({
              variantId,
              specification,
              basePrice,
              dots,
            });
          }
        }

        if (sizes.length > 0) {
          products.push({
            id: `${brandId}-${modelId}`,
            name: `${brandName} ${modelName}`.trim(),
            brand: brandName,
            model: modelName,
            branches: [
              {
                branchId: storeId,
                branchName: storeName || storeId,
                sizes,
              },
            ],
          });
        }
      }
    }
    return products;
  },

  /** ดึง inventory ทุกสาขา (รวมเป็น product เดียวกัน) */
  async fetchInventory(): Promise<GroupedProduct[]> {
    const storesSnap = await getDocs(collection(db, 'stores'));
    if (storesSnap.empty) return [];

    const productMap = new Map<string, GroupedProduct>();

    for (const s of storesSnap.docs) {
      const storeId = s.id;
      const storeName = (s.data() as any)?.branchName || s.id;

      try {
        const storeProducts = await this.fetchStoreInventory(storeId, storeName);
        for (const p of storeProducts) {
          if (productMap.has(p.id)) {
            productMap.get(p.id)!.branches.push(...p.branches);
          } else {
            productMap.set(p.id, { ...p });
          }
        }
      } catch {
        // skip store error
      }
    }
    return Array.from(productMap.values());
  },

  /** แปลง GroupedProduct → path ids */
  parseProductInfo(
    product: GroupedProduct,
    branchId: string,
    variantId: string,
    dotCode: string
  ) {
    const parts = (product.id || '').split('-');
    const brandId = parts[0] || slugifyId(product.brand);
    const modelId = parts.slice(1).join('-') || slugifyId(product.model || 'unknown');

    return { storeId: branchId, brandId, modelId, variantId, dotCode };
  },

  /** รายการ variants (สำหรับ dropdown เลือก spec) */
  async getVariantsForProduct(
    storeId: string,
    brandId: string,
    modelId: string
  ): Promise<Array<{ variantId: string; specification: string; basePrice?: number }>> {
    const vRef = collection(
      db,
      'stores',
      storeId,
      'inventory',
      brandId,
      'models',
      modelId,
      'variants'
    );
    const vs = await getDocs(vRef);
    return vs.docs.map((d) => {
      const data = d.data() as any;
      return {
        variantId: d.id,
        specification: specFromVariant(data),
        basePrice: data.basePrice ?? undefined,
      };
    });
  },

  /* ---------- Write: qty / price / dot ---------- */

  async adjustDotQuantity(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string,
    qtyChange: number
  ): Promise<void> {
    const dotRef = doc(
      db,
      'stores',
      storeId,
      'inventory',
      brandId,
      'models',
      modelId,
      'variants',
      variantId,
      'dots',
      dotCode
    );
    const snap = await getDoc(dotRef);
    if (!snap.exists()) throw new Error(`DOT ${dotCode} not found`);
    await updateDoc(dotRef, {
      qty: increment(qtyChange),
      updatedAt: serverTimestamp(),
    });
  },

  /** ✅ เวอร์ชันใหม่: args 5 ตัว + payload object */
  async addNewDot(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    payload: { dotCode: string; qty: number; promoPrice?: number }
  ): Promise<void> {
    const vRef = doc(
      db,
      'stores',
      storeId,
      'inventory',
      brandId,
      'models',
      modelId,
      'variants',
      variantId
    );
    const vSnap = await getDoc(vRef);
    if (!vSnap.exists()) throw new Error(`Variant ${variantId} not found`);

    const dRef = doc(vRef, 'dots', payload.dotCode);
    const dSnap = await getDoc(dRef);
    if (dSnap.exists()) throw new Error(`DOT ${payload.dotCode} already exists`);

    await setDoc(dRef, {
      qty: Math.max(0, Number(payload.qty) || 0),
      promoPrice: payload.promoPrice ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async setPromoPrice(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string,
    promoPrice: number | null
  ): Promise<void> {
    const dRef = doc(
      db,
      'stores',
      storeId,
      'inventory',
      brandId,
      'models',
      modelId,
      'variants',
      variantId,
      'dots',
      dotCode
    );
    const d = await getDoc(dRef);
    if (!d.exists()) throw new Error(`DOT ${dotCode} not found`);
    await updateDoc(dRef, {
      promoPrice: promoPrice ?? null,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteDot(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string
  ): Promise<void> {
    const dRef = doc(
      db,
      'stores',
      storeId,
      'inventory',
      brandId,
      'models',
      modelId,
      'variants',
      variantId,
      'dots',
      dotCode
    );
    const d = await getDoc(dRef);
    if (!d.exists()) throw new Error(`DOT ${dotCode} not found`);
    await deleteDoc(dRef);
  },

  /** เปลี่ยนชื่อที่แสดง (ไม่เปลี่ยน id) */
  async updateProductMeta(
    storeId: string,
    brandId: string,
    modelId: string,
    updates: { brandName?: string; modelName?: string }
  ): Promise<void> {
    if (updates.brandName) {
      const bRef = doc(db, 'stores', storeId, 'inventory', brandId);
      await updateDoc(bRef, {
        brandName: updates.brandName,
        updatedAt: serverTimestamp(),
      });
    }
    if (updates.modelName) {
      const mRef = doc(db, 'stores', storeId, 'inventory', brandId, 'models', modelId);
      await updateDoc(mRef, {
        modelName: updates.modelName,
        updatedAt: serverTimestamp(),
      });
    }
  },

  /* ---------- (Optional) Aliases / helper สำหรับโค้ดเก่า ---------- */

  /** alias ของ getVariantsForProduct เพื่อเคสคอมโพเนนต์เก่าที่ยังเรียกชื่อนี้ */
  async listVariantsFull(
    storeId: string,
    brandId: string,
    modelId: string
  ): Promise<Array<{ variantId: string; specification: string; basePrice?: number }>> {
    return this.getVariantsForProduct(storeId, brandId, modelId);
  },

  /** list DOTs (ทั้งหมดของ model หรือเจาะ variantId ถ้าส่งมา) */
  async listDots(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId?: string
  ): Promise<
    Array<{
      variantId: string;
      dotCode: string;
      qty: number;
      promoPrice?: number | null;
      basePrice?: number;
      specification: string;
    }>
  > {
    const vCol = collection(
      db,
      'stores',
      storeId,
      'inventory',
      brandId,
      'models',
      modelId,
      'variants'
    );
    const vSnap = variantId ? { docs: [await getDoc(doc(vCol, variantId))] } : await getDocs(vCol);

    const out: Array<{
      variantId: string;
      dotCode: string;
      qty: number;
      promoPrice?: number | null;
      basePrice?: number;
      specification: string;
    }> = [];

    for (const vDoc of vSnap.docs) {
      if (!vDoc || !vDoc.exists()) continue;
      const vData = vDoc.data() as any;
      const spec = specFromVariant(vData);
      const basePrice = vData.basePrice ?? undefined;

      const dCol = collection(vDoc.ref, 'dots');
      const dSnap = await getDocs(dCol);
      for (const d of dSnap.docs) {
        const dd = d.data() as any;
        out.push({
          variantId: vDoc.id,
          dotCode: d.id,
          qty: Number(dd.qty || 0),
          promoPrice: dd.promoPrice ?? null,
          basePrice,
          specification: spec,
        });
      }
    }
    return out;
  },
};

/* =========================
 * Order Service
 * =======================*/
export const OrderService = {
  async createOrder(payload: {
    buyerBranchId: string;
    buyerBranchName: string;
    sellerBranchId: string;
    sellerBranchName: string;
    items: OrderItem[];
    totalAmount: number;
    status: OrderStatus; // usually 'requested'
    notes?: string;
  }): Promise<string> {
    const orderData = {
      ...payload,
      orderNumber: `TR-${Date.now().toString().slice(-6)}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'orders'), orderData);
    return ref.id;
  },

  async getOrdersByBranch(branchId: string, role: 'buyer' | 'seller'): Promise<Order[]> {
    const field = role === 'buyer' ? 'buyerBranchId' : 'sellerBranchId';
    try {
      const q = query(collection(db, 'orders'), where(field, '==', branchId));
      const snap = await getDocs(q);
      const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[];
      orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return orders;
    } catch {
      const all = await getDocs(collection(db, 'orders'));
      const orders = all.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as Order))
        .filter((o) => (o as any)[field] === branchId);
      orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return orders;
    }
  },

  onOrdersByBranch(
    branchId: string,
    role: 'buyer' | 'seller',
    callback: (orders: Order[]) => void
  ) {
    const field = role === 'buyer' ? 'buyerBranchId' : 'sellerBranchId';
    const q = query(collection(db, 'orders'), where(field, '==', branchId));
    return onSnapshot(
      q,
      (snap) => {
        const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[];
        orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        callback(orders);
      },
      async () => {
        const fallback = await OrderService.getOrdersByBranch(branchId, role);
        callback(fallback);
      }
    );
  },

  // Actions
  async approveTransfer(orderId: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    await updateDoc(ref, { status: 'approved', updatedAt: serverTimestamp() });
  },

  async rejectTransfer(orderId: string, reason?: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    await updateDoc(ref, {
      status: 'rejected',
      cancelReason: reason ?? null,
      updatedAt: serverTimestamp(),
    });
  },

  async shipTransfer(orderId: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    await updateDoc(ref, { status: 'shipped', updatedAt: serverTimestamp() });
  },

  /** alias เดิมบางที่เรียก deliverTransfer -> เทียบเท่า shipped/received */
  async deliverTransfer(orderId: string): Promise<void> {
    // เลือก mark เป็น 'shipped' (หรือจะเปลี่ยนเป็น 'received' ก็ได้ตาม flow)
    return this.shipTransfer(orderId);
  },

  async receiveTransfer(orderId: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    await updateDoc(ref, { status: 'received', updatedAt: serverTimestamp() });
  },

  async cancelTransfer(orderId: string, reason?: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    await updateDoc(ref, {
      status: 'cancelled',
      cancelReason: reason ?? null,
      updatedAt: serverTimestamp(),
    });
  },
};

/* =========================
 * Export default (สะดวก import เดียว)
 * =======================*/
export default {
  StoreService,
  InventoryService,
  OrderService,
  // utils
  slugifyId,
  ensureArray,
};
