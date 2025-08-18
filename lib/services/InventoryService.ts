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
  runTransaction,
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
  phone?: string | null;
  email?: string | null;
  lineId?: string | null;
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
  notes?: string | null;
  orgId?: string;
  createdAt?: any;
  updatedAt?: any;
};

// Type for Notification
export type Notification = {
    id?: string;
    branchId: string; // ID of the branch to be notified
    title: string;
    message: string;
    link: string;
    orderId: string;
    isRead: boolean;
    createdAt: Timestamp;
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

/**
 * Canonical rules:
 * - Brand IDs: UPPERCASE (เช่น MICHELIN)
 * - Model IDs: slug (lowercase-with-dash)
 * ฟังก์ชัน resolve* จะพยายามหา doc ที่มีอยู่จริงก่อน (ทั้ง exact/upper/slug/lower)
 * ถ้าไม่เจอ จะคืนค่าตามกติกาข้างบน
 */
async function resolveBrandId(storeId: string, brandIdOrName: string): Promise<string> {
  const candidates = [
    brandIdOrName,
    brandIdOrName.toUpperCase(),
    slugifyId(brandIdOrName),
    brandIdOrName.toLowerCase(),
  ];
  for (const b of candidates) {
    const snap = await getDoc(doc(db, 'stores', storeId, 'inventory', b));
    if (snap.exists()) return b;
  }
  return brandIdOrName.toUpperCase();
}

async function resolveModelId(
  storeId: string,
  brandIdResolved: string,
  modelIdOrName: string
): Promise<string> {
  const base = doc(db, 'stores', storeId, 'inventory', brandIdResolved);
  const candidates = [
    modelIdOrName,
    slugifyId(modelIdOrName),
    modelIdOrName.toUpperCase(),
    modelIdOrName.toLowerCase(),
  ];
  for (const m of candidates) {
    const snap = await getDoc(doc(base, 'models', m));
    if (snap.exists()) return m;
  }
  return slugifyId(modelIdOrName);
}

/** รวม brand+model canonicalization สำหรับ OrderService */
async function resolveCanonicalIds(
  storeId: string,
  brandIdRaw: string,
  modelIdRaw: string
): Promise<{ brandId: string; modelId: string }> {
  const brandId = await resolveBrandId(storeId, brandIdRaw);
  const modelId = await resolveModelId(storeId, brandId, modelIdRaw);
  return { brandId, modelId };
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
 * =======================*/
export const InventoryService = {
  /* ---------- Ensure helpers (ใช้ canonical id) ---------- */

  async ensureBrandDoc(storeId: string, brandName: string): Promise<{ brandId: string }> {
    const brandId = await resolveBrandId(storeId, brandName);
    const brandRef = doc(db, 'stores', storeId, 'inventory', brandId);
    const snap = await getDoc(brandRef);
    if (!snap.exists()) {
      await setDoc(brandRef, {
        brandName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const cur = (snap.data() as any)?.brandName;
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
    const brandId = await resolveBrandId(storeId, brandIdOrName);
    const brandRef = doc(db, 'stores', storeId, 'inventory', brandId);
    if (!(await getDoc(brandRef)).exists()) {
      await setDoc(brandRef, {
        brandName: brandIdOrName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const modelId = await resolveModelId(storeId, brandId, modelName);
    const modelRef = doc(brandRef, 'models', modelId);
    const m = await getDoc(modelRef);
    if (!m.exists()) {
      await setDoc(modelRef, {
        modelName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const cur = (m.data() as any)?.modelName;
      if (cur !== modelName && modelName) {
        await updateDoc(modelRef, { modelName, updatedAt: serverTimestamp() });
      }
    }
    return { brandId, modelId };
  },

  /** สร้าง variant ถ้ายังไม่มี (canonical path) */
  async ensureVariantPath(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    init?: { size?: string; loadIndex?: string; basePrice?: number }
  ): Promise<{ brandId: string; modelId: string; variantId: string }> {
    const bId = await resolveBrandId(storeId, brandId);
    const mId = await resolveModelId(storeId, bId, modelId);

    const vRef = doc(
      db,
      'stores',
      storeId,
      'inventory',
      bId,
      'models',
      mId,
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
    return { brandId: bId, modelId: mId, variantId };
  },

  /** สร้าง dot ถ้ายังไม่มี (canonical path) */
  async ensureDotDoc(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string,
    init?: { qty?: number; promoPrice?: number | null }
  ): Promise<void> {
    const bId = await resolveBrandId(storeId, brandId);
    const mId = await resolveModelId(storeId, bId, modelId);

    const dRef = doc(
      db,
      'stores',
      storeId,
      'inventory',
      bId,
      'models',
      mId,
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
      const brandId = brandDoc.id; // ใช้ id ที่มีอยู่จริงใน DB
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

  /** แปลง GroupedProduct → path ids (คืนค่า raw; ไป resolve ตอนใช้งานจริง) */
  parseProductInfo(
    product: GroupedProduct,
    branchId: string,
    variantId: string,
    dotCode: string
  ) {
    const parts = (product.id || '').split('-');
    const brandId = parts[0] || product.brand || '';
    const modelId = parts.slice(1).join('-') || (product.model || 'unknown');
    return { storeId: branchId, brandId, modelId, variantId, dotCode };
  },

  /** รายการ variants (canonical) */
  async getVariantsForProduct(
    storeId: string,
    brandId: string,
    modelId: string
  ): Promise<Array<{ variantId: string; specification: string; basePrice?: number }>> {
    const bId = await resolveBrandId(storeId, brandId);
    const mId = await resolveModelId(storeId, bId, modelId);

    const vRef = collection(
      db,
      'stores',
      storeId,
      'inventory',
      bId,
      'models',
      mId,
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

  /* ---------- Write: qty / price / dot (canonical) ---------- */

  async adjustDotQuantity(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string,
    qtyChange: number
  ): Promise<void> {
    const bId = await resolveBrandId(storeId, brandId);
    const mId = await resolveModelId(storeId, bId, modelId);

    const dotRef = doc(
      db,
      'stores',
      storeId,
      'inventory',
      bId,
      'models',
      mId,
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

  async addNewDot(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    payload: { dotCode: string; qty: number; promoPrice?: number }
  ): Promise<void> {
    const bId = await resolveBrandId(storeId, brandId);
    const mId = await resolveModelId(storeId, bId, modelId);

    const vRef = doc(
      db,
      'stores',
      storeId,
      'inventory',
      bId,
      'models',
      mId,
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
    const bId = await resolveBrandId(storeId, brandId);
    const mId = await resolveModelId(storeId, bId, modelId);

    const dRef = doc(
      db,
      'stores',
      storeId,
      'inventory',
      bId,
      'models',
      mId,
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
    const bId = await resolveBrandId(storeId, brandId);
    const mId = await resolveModelId(storeId, bId, modelId);

    const dRef = doc(
      db,
      'stores',
      storeId,
      'inventory',
      bId,
      'models',
      mId,
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
    const bId = await resolveBrandId(storeId, brandId);
    const mId = await resolveModelId(storeId, bId, modelId);

    if (updates.brandName) {
      const bRef = doc(db, 'stores', storeId, 'inventory', bId);
      await updateDoc(bRef, {
        brandName: updates.brandName,
        updatedAt: serverTimestamp(),
      });
    }
    if (updates.modelName) {
      const mRef = doc(db, 'stores', storeId, 'inventory', bId, 'models', mId);
      await updateDoc(mRef, {
        modelName: updates.modelName,
        updatedAt: serverTimestamp(),
      });
    }
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
    const bId = await resolveBrandId(storeId, brandId);
    const mId = await resolveModelId(storeId, bId, modelId);

    const vCol = collection(
      db,
      'stores',
      storeId,
      'inventory',
      bId,
      'models',
      mId,
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
 * Notification Service
 * =======================*/
export const NotificationService = {
  async createNotification(payload: {
    branchId: string;
    title: string;
    message: string;
    link: string;
    orderId: string;
  }) {
    try {
      // Do not create a notification for the branch that initiated the action
      if (!payload.branchId) return;

      await addDoc(collection(db, 'notifications'), {
        ...payload,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  },
};

/* =========================
 * Order Service (Best-practice transfer flow) — canonical IDs
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

    // >> [ADD] Create notification for the seller
    await NotificationService.createNotification({
      branchId: payload.sellerBranchId,
      title: 'New Transfer Request',
      message: `Request from ${payload.buyerBranchName} for order #${ref.id.slice(0, 6)}`,
      orderId: ref.id,
      link: `/?view=transfer_requests`,
    });

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

  /* ---------- Status transitions ---------- */
  async approveTransfer(orderId: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Order not found');

    const order = snap.data() as Order;
    if (order.status !== 'requested' && order.status !== 'confirmed') {
      throw new Error('Can only approve requested orders');
    }
    await updateDoc(ref, { status: 'approved', updatedAt: serverTimestamp() });

    // >> [ADD] Notify buyer that the request was approved
    await NotificationService.createNotification({
      branchId: order.buyerBranchId,
      title: 'Request Approved',
      message: `Your request #${orderId.slice(0,6)} has been approved by ${order.sellerBranchName}.`,
      orderId: orderId,
      link: `/?view=transfer_requests`,
    });
  },

  async rejectTransfer(orderId: string, reason?: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Order not found');

    const order = snap.data() as Order;
    if (
      order.status !== 'requested' &&
      order.status !== 'approved' &&
      order.status !== 'confirmed'
    ) {
      throw new Error('Can only reject requested/approved orders');
    }

    await updateDoc(ref, {
      status: 'rejected',
      cancelReason: reason ?? null,
      updatedAt: serverTimestamp(),
    });

    // >> [ADD] Notify buyer that the request was rejected
    await NotificationService.createNotification({
      branchId: order.buyerBranchId,
      title: 'Request Rejected',
      message: `Your request #${orderId.slice(0,6)} was rejected by ${order.sellerBranchName}.`,
      orderId: orderId,
      link: `/?view=transfer_requests`,
    });
  },

  /** 🚚 Ship: ตัดสต็อกจากสาขาผู้ส่ง (กันสต็อกติดลบด้วย transaction) + log transfer_out */
  async shipTransfer(orderId: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(ref);
    if (!orderSnap.exists()) throw new Error('Order not found');

    const order = orderSnap.data() as Order;

    // อนุญาตเฉพาะ approved (หรือ legacy confirmed)
    if (order.status !== 'approved' && order.status !== 'confirmed') {
      // ถ้าเคย shipped ไปแล้ว ให้ไม่ทำซ้ำ
      if (order.status === 'shipped' || order.status === 'delivered') return;
      throw new Error('Can only ship approved orders');
    }

    // ตัดสต็อกทีละรายการด้วย runTransaction เพื่อเช็คคงเหลือ
    for (const item of order.items) {
      const parsed = InventoryService.parseProductInfo(
        { id: item.productId } as any,
        order.sellerBranchId,
        item.variantId,
        item.dotCode
      );

      // ใช้ id ที่ canonical ใน "สาขาผู้ขาย"
      const { brandId: bId, modelId: mId } = await resolveCanonicalIds(
        order.sellerBranchId,
        parsed.brandId,
        parsed.modelId
      );

      await runTransaction(db, async (tx) => {
        const dotRef = doc(
          db,
          'stores',
          order.sellerBranchId,
          'inventory',
          bId,
          'models',
          mId,
          'variants',
          item.variantId,
          'dots',
          item.dotCode
        );
        const ds = await tx.get(dotRef);
        if (!ds.exists()) throw new Error(`DOT ${item.dotCode} not found at seller branch`);
        const curQty = Number((ds.data() as any).qty || 0);
        if (curQty < item.quantity) {
          throw new Error(
            `Insufficient stock for ${item.productName} ${item.specification} DOT ${item.dotCode} at ${order.sellerBranchName} (have ${curQty}, need ${item.quantity})`
          );
        }
        tx.update(dotRef, {
          qty: increment(-item.quantity),
          updatedAt: serverTimestamp(),
        });
      });

      // log transfer_out (นอก transaction)
      await addDoc(collection(db, 'stockMovements'), {
        branchId: order.sellerBranchId,
        orderId,
        brand: bId,
        model: mId,
        variantId: item.variantId,
        dotCode: item.dotCode,
        qtyChange: -item.quantity,
        type: 'transfer_out',
        reason: `Transfer to ${order.buyerBranchName}`,
        createdAt: serverTimestamp(),
      });
    }

    // อัปเดตสถานะ → shipped
    await updateDoc(ref, { status: 'shipped', updatedAt: serverTimestamp() });

    // >> [ADD] Notify buyer that the order has been shipped
    await NotificationService.createNotification({
      branchId: order.buyerBranchId,
      title: 'Order Shipped',
      message: `Order #${orderId.slice(0,6)} from ${order.sellerBranchName} is on its way.`,
      orderId: orderId,
      link: `/?view=transfer_requests`,
    });
  },

  /** 📦 Receive: เพิ่มสต็อกให้สาขาผู้รับ (สร้าง path/dot ถ้ายังไม่มี) + log transfer_in */
  async receiveTransfer(orderId: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(ref);
    if (!orderSnap.exists()) throw new Error('Order not found');

    const order = orderSnap.data() as Order;

    // อนุญาตเฉพาะจาก shipped (หรือ legacy delivered) -> received
    if (order.status !== 'shipped' && order.status !== 'delivered') {
      // ถ้าเคยรับไปแล้ว ไม่ต้องทำซ้ำ
      if (order.status === 'received') return;
      throw new Error('Can only receive shipped orders');
    }

    for (const item of order.items) {
      const infoSellerSide = InventoryService.parseProductInfo(
        { id: item.productId } as any,
        order.sellerBranchId,
        item.variantId,
        item.dotCode
      );

      // ใช้ canonical ของฝั่งผู้ขายเป็นต้นแบบให้ผู้รับ (ล็อกให้เป็น MICHELIN เดียวกัน)
      const { brandId: bId, modelId: mId } = await resolveCanonicalIds(
        order.sellerBranchId,
        infoSellerSide.brandId,
        infoSellerSide.modelId
      );

      // สร้างเส้นทาง variant/dot ในสาขาผู้รับถ้ายังไม่มี
      await InventoryService.ensureVariantPath(
        order.buyerBranchId,
        bId,
        mId,
        item.variantId
      );
      await InventoryService.ensureDotDoc(
        order.buyerBranchId,
        bId,
        mId,
        item.variantId,
        item.dotCode,
        { qty: 0 }
      );

      // เพิ่มสต็อกให้ผู้รับ
      await InventoryService.adjustDotQuantity(
        order.buyerBranchId,
        bId,
        mId,
        item.variantId,
        item.dotCode,
        item.quantity
      );

      // log transfer_in
      await addDoc(collection(db, 'stockMovements'), {
        branchId: order.buyerBranchId,
        orderId,
        brand: bId,
        model: mId,
        variantId: item.variantId,
        dotCode: item.dotCode,
        qtyChange: item.quantity,
        type: 'transfer_in',
        reason: `Transfer from ${order.sellerBranchName}`,
        createdAt: serverTimestamp(),
      });
    }

    // อัปเดตสถานะ → received
    await updateDoc(ref, { status: 'received', updatedAt: serverTimestamp() });
    
    // >> [ADD] Notify seller that the order has been received
    await NotificationService.createNotification({
      branchId: order.sellerBranchId,
      title: 'Order Received',
      message: `${order.buyerBranchName} has confirmed receiving order #${orderId.slice(0,6)}.`,
      orderId: orderId,
      link: `/?view=transfer_requests`,
    });
  },

  /** alias เดิม: deliverTransfer = shipped (legacy) */
  async deliverTransfer(orderId: string): Promise<void> {
    // เพื่อความเข้ากันได้เก่า ให้ map ไปที่ ship
    return this.shipTransfer(orderId);
  },

  /** ❌ Cancel (ยกเลิกได้เฉพาะก่อน ship) */
  async cancelTransfer(orderId: string, reason?: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Order not found');

    const order = snap.data() as Order;
    if (order.status !== 'requested' && order.status !== 'approved' && order.status !== 'confirmed') {
      throw new Error('Can only cancel orders that are not shipped yet');
    }
    await updateDoc(ref, {
      status: 'cancelled',
      cancelReason: reason ?? null,
      updatedAt: serverTimestamp(),
    });
    
    // >> [ADD] Notify seller that the request was cancelled
    await NotificationService.createNotification({
      branchId: order.sellerBranchId,
      title: 'Request Cancelled',
      message: `Request #${orderId.slice(0,6)} from ${order.buyerBranchName} has been cancelled.`,
      orderId: orderId,
      link: `/?view=transfer_requests`,
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
  NotificationService, // Add NotificationService to default export
  // utils
  slugifyId,
  ensureArray,
};