// lib/services/InventoryService.ts
// === Firestore Services for Stores, Inventory, and Orders ===

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  addDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* =========================
 * Types
 * ========================= */

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
  size: string;
  loadIndex?: string;
  basePrice?: number;
  dots: Dot[];
  updatedAt?: any;
};

export type Model = {
  modelId: string;
  modelName: string;
  variants: Variant[];
  updatedAt?: any;
};

export type Brand = {
  brandId: string;
  brandName: string;
  models: Model[];
  updatedAt?: any;
};

export type StoreInventory = {
  storeId: string;
  storeName: string;
  brands: Brand[];
};

export type SizeVariant = {
  variantId: string;
  specification: string; // size + loadIndex
  dots: {
    dotCode: string;
    qty: number;
    basePrice: number;
    promoPrice?: number | null;
  }[];
};

export type BranchInventory = {
  branchId: string;
  branchName: string;
  sizes: SizeVariant[];
};

export type GroupedProduct = {
  id: string; // brand-model (slug)
  name: string; // brandName + modelName
  brand: string;
  model?: string;
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
  productId: string;            // "<brandId>-<modelId>"
  productName: string;
  specification: string;
  dotCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantId: string;            // variantId from source branch
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
 * Helpers
 * ========================= */

export function slugifyId(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 120);
}

export function ensureArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/** ลบ key ที่เป็น undefined ออกจาก object/array ทุกระดับ */
export function stripUndefinedDeep<T>(input: T): T {
  if (input === undefined) return undefined as any;
  if (input === null) return input;
  if (Array.isArray(input)) {
    return input
      .map((v) => stripUndefinedDeep(v))
      .filter((v) => v !== undefined) as any;
  }
  if (typeof input === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(input as any)) {
      const cleaned = stripUndefinedDeep(v as any);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return input;
}

// "205/55R16 (94V)" => {size, loadIndex}
function parseSpec(spec: string): { size: string; loadIndex?: string } {
  const m = spec.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (!m) return { size: spec.trim() };
  return { size: m[1].trim(), loadIndex: m[2].trim() };
}

function splitProductId(productId: string): { brandId: string; modelId: string } {
  const parts = String(productId || '').split('-');
  const brandId = parts[0] || 'unknown';
  const modelId = parts.slice(1).join('-') || 'unknown';
  return { brandId, modelId };
}

/* =========================
 * Store Service
 * ========================= */

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
    try {
      const ref = doc(db, 'stores', storeId);
      const ds = await getDoc(ref);
      return !ds.exists();
    } catch {
      return false;
    }
  },

  async createStore(storeId: string, payload: StoreDoc): Promise<void> {
    const ref = doc(db, 'stores', storeId);
    const data = stripUndefinedDeep({
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(ref, data);
  },

  async updateStore(storeId: string, patch: Partial<StoreDoc>): Promise<void> {
    const ref = doc(db, 'stores', storeId);
    const data = stripUndefinedDeep({
      ...patch,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(ref, data);
  },

  async getStore(storeId: string): Promise<StoreDoc | null> {
    const ref = doc(db, 'stores', storeId);
    const ds = await getDoc(ref);
    return ds.exists() ? ({ ...ds.data() } as StoreDoc) : null;
  },
};

/* =========================
 * Inventory Service
 * ========================= */

export const InventoryService = {
  async fetchStoreInventory(storeId: string, storeName?: string): Promise<GroupedProduct[]> {
    const storeRef = doc(db, 'stores', storeId);
    const inventoryRef = collection(storeRef, 'inventory');

    const brandsSnap = await getDocs(inventoryRef);
    const products: GroupedProduct[] = [];

    for (const brandDoc of brandsSnap.docs) {
      const brandId = brandDoc.id;
      const brandData = brandDoc.data();
      const brandName = brandData.brandName || brandId;

      const modelsRef = collection(brandDoc.ref, 'models');
      const modelsSnap = await getDocs(modelsRef);

      for (const modelDoc of modelsSnap.docs) {
        const modelId = modelDoc.id;
        const modelData = modelDoc.data();
        const modelName = modelData.modelName || modelId;

        const variantsRef = collection(modelDoc.ref, 'variants');
        const variantsSnap = await getDocs(variantsRef);

        const sizes: SizeVariant[] = [];

        for (const variantDoc of variantsSnap.docs) {
          const variantData = variantDoc.data();
          const variantId = variantDoc.id;
          const size = variantData.size || '';
          const loadIndex = variantData.loadIndex || '';
          const basePrice = Number(variantData.basePrice || 0);
          const specification = loadIndex ? `${size} (${loadIndex})` : size;

          const dotsRef = collection(variantDoc.ref, 'dots');
          const dotsSnap = await getDocs(dotsRef);

          const dots = dotsSnap.docs
            .map((dotDoc) => {
              const d = dotDoc.data();
              const qty = Number(d.qty || 0);
              return {
                dotCode: dotDoc.id,
                qty,
                basePrice,
                promoPrice: d.promoPrice ?? null,
              };
            })
            .filter((x) => x.qty > 0);

          if (dots.length > 0) {
            sizes.push({ variantId, specification, dots });
          }
        }

        if (sizes.length > 0) {
          const productId = `${brandId}-${modelId}`;
          const productName = `${brandName} ${modelName}`;
          products.push({
            id: productId,
            name: productName,
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

  async fetchInventory(): Promise<GroupedProduct[]> {
    const storesSnap = await getDocs(collection(db, 'stores'));
    const productMap = new Map<string, GroupedProduct>();

    for (const storeDoc of storesSnap.docs) {
      const storeId = storeDoc.id;
      const storeName = (storeDoc.data() as any).branchName || storeId;

      try {
        const storeProducts = await this.fetchStoreInventory(storeId, storeName);
        for (const product of storeProducts) {
          const key = product.id;
          if (productMap.has(key)) {
            productMap.get(key)!.branches.push(...product.branches);
          } else {
            productMap.set(key, { ...product });
          }
        }
      } catch (e) {
        console.warn(`Failed to fetch inventory for store ${storeId}:`, e);
      }
    }

    return Array.from(productMap.values());
  },

  async updateDotQuantity(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string,
    newQty: number
  ): Promise<void> {
    const dotRef = doc(
      db,
      'stores', storeId,
      'inventory', brandId,
      'models', modelId,
      'variants', variantId,
      'dots', dotCode
    );
    await updateDoc(dotRef, {
      qty: Math.max(0, newQty),
      updatedAt: serverTimestamp(),
    });
  },

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
      'stores', storeId,
      'inventory', brandId,
      'models', modelId,
      'variants', variantId,
      'dots', dotCode
    );

    const exists = await getDoc(dotRef);
    if (!exists.exists()) {
      await setDoc(
        dotRef,
        stripUndefinedDeep({
          qty: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );
    }

    await updateDoc(dotRef, {
      qty: increment(qtyChange),
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
    const dotRef = doc(
      db,
      'stores', storeId,
      'inventory', brandId,
      'models', modelId,
      'variants', variantId,
      'dots', dotCode
    );

    const dotDoc = await getDoc(dotRef);
    if (!dotDoc.exists()) {
      throw new Error(`DOT ${dotCode} not found`);
    }

    const updateData: any = { updatedAt: serverTimestamp() };
    updateData.promoPrice = promoPrice !== null ? promoPrice : null;

    await updateDoc(dotRef, updateData);
  },

  async addNewDot(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string,
    qty: number,
    promoPrice?: number
  ): Promise<void> {
    const variantRef = doc(
      db,
      'stores', storeId,
      'inventory', brandId,
      'models', modelId,
      'variants', variantId
    );

    const variantDoc = await getDoc(variantRef);
    if (!variantDoc.exists()) {
      throw new Error(`Variant ${variantId} not found`);
    }

    const dotRef = doc(variantRef, 'dots', dotCode);
    const existingDot = await getDoc(dotRef);
    if (existingDot.exists()) {
      throw new Error(`DOT ${dotCode} already exists`);
    }

    const dotData: any = {
      qty: Math.max(0, qty),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (promoPrice !== undefined && promoPrice !== null) {
      dotData.promoPrice = promoPrice;
    }

    await setDoc(dotRef, stripUndefinedDeep(dotData));
  },

  async deleteDot(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string
  ): Promise<void> {
    const dotRef = doc(
      db,
      'stores', storeId,
      'inventory', brandId,
      'models', modelId,
      'variants', variantId,
      'dots', dotCode
    );

    const dotDoc = await getDoc(dotRef);
    if (!dotDoc.exists()) {
      throw new Error(`DOT ${dotCode} not found`);
    }
    await deleteDoc(dotRef);
  },

  async getVariantsForProduct(
    storeId: string,
    brandId: string,
    modelId: string
  ): Promise<Array<{ variantId: string; specification: string }>> {
    const variantsRef = collection(
      db,
      'stores', storeId,
      'inventory', brandId,
      'models', modelId,
      'variants'
    );

    const variantsSnap = await getDocs(variantsRef);
    return variantsSnap.docs.map((d) => {
      const data = d.data();
      const size = data.size || '';
      const loadIndex = data.loadIndex || '';
      const specification = loadIndex ? `${size} (${loadIndex})` : size;
      return { variantId: d.id, specification };
    });
  },

  parseProductInfo(product: GroupedProduct, branchId: string, variantId: string, dotCode: string) {
    const parts = product.id.split('-');
    const brandId = parts[0] || slugifyId(product.brand);
    const modelId = parts.slice(1).join('-') || slugifyId(product.model || 'unknown');
    return { storeId: branchId, brandId, modelId, variantId, dotCode };
  },

  async createStockMovement(
    storeId: string,
    target: { brand: string; model?: string; variantId: string; dotCode: string },
    type: StockMovementType,
    qtyChange: number,
    meta?: { reason?: string; brandId?: string; modelId?: string }
  ): Promise<void> {
    const brandId = meta?.brandId ?? slugifyId(target.brand);
    const modelId = meta?.modelId ?? slugifyId(target.model || 'unknown');

    await this.adjustDotQuantity(storeId, brandId, modelId, target.variantId, target.dotCode, qtyChange);

    try {
      const movementData: any = {
        branchId: storeId,
        brand: target.brand,
        model: target.model || '',
        variantId: target.variantId,
        dotCode: target.dotCode,
        qtyChange,
        type,
        reason: meta?.reason,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'stockMovements'), stripUndefinedDeep(movementData));
    } catch (e) {
      console.warn('Failed to log stock movement:', e);
    }
  },

  async findProductByBrandModel(brand: string, model?: string): Promise<string | null> {
    try {
      const brandId = slugifyId(brand);
      const modelId = slugifyId(model || 'unknown');
      return `${brandId}-${modelId}`;
    } catch {
      return null;
    }
  },

  async ensureProduct(brand: string, model: string): Promise<string> {
    const brandId = slugifyId(brand);
    const modelId = slugifyId(model);
    return `${brandId}-${modelId}`;
  },

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
    const brandId = slugifyId(payload.brand);
    const modelId = slugifyId(payload.model || 'unknown');

    try {
      await this.updateDotQuantity(branchId, brandId, modelId, payload.variantId, payload.dotCode, payload.qty);
      if (payload.promoPrice !== undefined) {
        await this.setPromoPrice(branchId, brandId, modelId, payload.variantId, payload.dotCode, payload.promoPrice);
      }
    } catch (error: any) {
      if (String(error?.message || '').includes('not found')) {
        await this.addNewDot(branchId, brandId, modelId, payload.variantId, payload.dotCode, payload.qty, payload.promoPrice);
      } else {
        throw error;
      }
    }
  },

  /** สร้าง/อัปเซิร์ต path ปลายทาง (brand/model/variant) ก่อนรับของ */
  async ensureVariantPath(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    specification?: string,
    basePrice?: number
  ): Promise<void> {
    const brandRef = doc(db, 'stores', storeId, 'inventory', brandId);
    const brandDoc = await getDoc(brandRef);
    if (!brandDoc.exists()) {
      await setDoc(
        brandRef,
        stripUndefinedDeep({
          brandName: brandId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );
    }

    const modelRef = doc(brandRef, 'models', modelId);
    const modelDoc = await getDoc(modelRef);
    if (!modelDoc.exists()) {
      await setDoc(
        modelRef,
        stripUndefinedDeep({
          modelName: modelId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );
    }

    const variantRef = doc(modelRef, 'variants', variantId);
    const varDoc = await getDoc(variantRef);
    if (!varDoc.exists()) {
      const parsed = parseSpec(specification || '');
      await setDoc(
        variantRef,
        stripUndefinedDeep({
          size: parsed.size || specification || '',
          loadIndex: parsed.loadIndex || '',
          basePrice: basePrice ?? 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );
    }
  },

  async ensureDotDoc(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string
  ): Promise<void> {
    const dotRef = doc(
      db,
      'stores', storeId,
      'inventory', brandId,
      'models', modelId,
      'variants', variantId,
      'dots', dotCode
    );
    const dotDoc = await getDoc(dotRef);
    if (!dotDoc.exists()) {
      await setDoc(
        dotRef,
        stripUndefinedDeep({
          qty: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      );
    }
  },
};

/* =========================
 * Order Service
 * ========================= */

export const OrderService = {
  async createOrder(payload: {
    buyerBranchId: string;
    buyerBranchName: string;
    sellerBranchId: string;
    sellerBranchName: string;
    items: OrderItem[];
    totalAmount: number;
    status: OrderStatus;
    notes?: string;
  }): Promise<string> {
    const orderData = stripUndefinedDeep({
      ...payload,
      orderNumber: `TR-${Date.now().toString().slice(-6)}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const docRef = await addDoc(collection(db, 'orders'), orderData);
    return docRef.id;
  },

  /** where + sort ใน JS เพื่อลด requirement composite index */
  async getOrdersByBranch(branchId: string, role: 'buyer' | 'seller'): Promise<Order[]> {
    const field = role === 'buyer' ? 'buyerBranchId' : 'sellerBranchId';
    const q1 = query(collection(db, 'orders'), where(field, '==', branchId));
    const snap = await getDocs(q1);
    const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[];
    orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    return orders;
  },

  async approveTransfer(orderId: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    await updateDoc(ref, { status: 'confirmed', updatedAt: serverTimestamp() });
  },

  async rejectTransfer(orderId: string, reason?: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    await updateDoc(ref, {
      status: 'cancelled',
      cancelReason: reason || null,
      updatedAt: serverTimestamp(),
    });
  },

  /** ผู้รับ (buyer) กดรับของ => โยกสต็อก + ปิดเป็น delivered */
  async receiveTransfer(orderId: string): Promise<void> {
    const orderRef = doc(db, 'orders', orderId);
    const ds = await getDoc(orderRef);
    if (!ds.exists()) throw new Error('Order not found');

    const order = ds.data() as Order;
    if (order.status === 'cancelled') throw new Error('Order already cancelled');
    if (order.status === 'delivered') return;

    for (const item of order.items) {
      const { brandId, modelId } = splitProductId(item.productId);
      const { specification, variantId, dotCode, quantity } = item;

      // ตัดสต็อกจาก seller
      try {
        await InventoryService.adjustDotQuantity(
          order.sellerBranchId,
          brandId,
          modelId,
          variantId,
          dotCode,
          -Math.abs(quantity)
        );
        await InventoryService.createStockMovement(
          order.sellerBranchId,
          { brand: brandId, model: modelId, variantId, dotCode },
          'transfer_out',
          -Math.abs(quantity),
          { brandId, modelId, reason: `To ${order.buyerBranchName}` }
        );
      } catch (e) {
        console.warn('Seller adjust failed:', e);
      }

      // เติมเข้าที่ buyer (ensure path ก่อน)
      try {
        await InventoryService.ensureVariantPath(
          order.buyerBranchId,
          brandId,
          modelId,
          variantId,
          specification,
          item.unitPrice
        );
        await InventoryService.ensureDotDoc(
          order.buyerBranchId,
          brandId,
          modelId,
          variantId,
          dotCode
        );

        await InventoryService.adjustDotQuantity(
          order.buyerBranchId,
          brandId,
          modelId,
          variantId,
          dotCode,
          Math.abs(quantity)
        );
        await InventoryService.createStockMovement(
          order.buyerBranchId,
          { brand: brandId, model: modelId, variantId, dotCode },
          'transfer_in',
          Math.abs(quantity),
          { brandId, modelId, reason: `From ${order.sellerBranchName}` }
        );
      } catch (e) {
        console.warn('Buyer adjust failed:', e);
      }
    }

    await updateDoc(orderRef, {
      status: 'delivered',
      updatedAt: serverTimestamp(),
    });
  },

  onOrdersByBranch(
    branchId: string,
    role: 'buyer' | 'seller',
    callback: (orders: Order[]) => void
  ) {
    const field = role === 'buyer' ? 'buyerBranchId' : 'sellerBranchId';
    const q1 = query(collection(db, 'orders'), where(field, '==', branchId));

    return onSnapshot(
      q1,
      (snap) => {
        const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[];
        orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        callback(orders);
      },
      (error) => {
        console.error('Realtime orders error:', error);
        OrderService.getOrdersByBranch(branchId, role)
          .then(callback)
          .catch(() => callback([]));
      }
    );
  },

  /** Legacy alias เพื่อกันโค้ดเก่าพัง */
  async deliverTransfer(orderId: string) {
    return this.receiveTransfer(orderId);
  },
};

/* =========================
 * Compat shims (เดิมบางไฟล์เรียกตรง)
 * ========================= */
export async function approveOrderTx(orderId: string) {
  return OrderService.approveTransfer(orderId);
}
export async function receiveOrderTx(orderId: string) {
  return OrderService.receiveTransfer(orderId);
}
export async function rejectOrderTx(orderId: string, reason?: string) {
  return OrderService.rejectTransfer(orderId, reason);
}

/* =========================
 * Legacy helper export
 * ========================= */
export async function findProductIdByBrandModel(brand: string, model?: string): Promise<string | null> {
  try {
    const brandId = slugifyId(brand);
    const modelId = slugifyId(model || 'unknown');
    return `${brandId}-${modelId}`;
  } catch {
    return null;
  }
}

/* =========================
 * Test Utilities
 * ========================= */

export const InventoryTestUtils = {
  async testConnection(storeId: string): Promise<boolean> {
    try {
      const testRef = doc(db, 'stores', storeId, 'test', 'connection');
      await setDoc(testRef, {
        message: 'Connection test',
        timestamp: serverTimestamp(),
      });
      const testDoc = await getDoc(testRef);
      const ok = testDoc.exists();
      if (ok) await deleteDoc(testRef);
      return ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  },

  async countInventoryItems(storeId: string): Promise<{
    brands: number;
    models: number;
    variants: number;
    dots: number;
    totalQty: number;
  }> {
    try {
      const inventoryRef = collection(db, 'stores', storeId, 'inventory');
      const brandsSnap = await getDocs(inventoryRef);

      let brands = 0, models = 0, variants = 0, dots = 0, totalQty = 0;

      for (const brandDoc of brandsSnap.docs) {
        brands++;
        const modelsRef = collection(brandDoc.ref, 'models');
        const modelsSnap = await getDocs(modelsRef);
        for (const modelDoc of modelsSnap.docs) {
          models++;
          const variantsRef = collection(modelDoc.ref, 'variants');
          const variantsSnap = await getDocs(variantsRef);
          for (const variantDoc of variantsSnap.docs) {
            variants++;
            const dotsRef = collection(variantDoc.ref, 'dots');
            const dotsSnap = await getDocs(dotsRef);
            for (const dotDoc of dotsSnap.docs) {
              dots++;
              const dotData = dotDoc.data();
              totalQty += Number(dotData.qty || 0);
            }
          }
        }
      }

      return { brands, models, variants, dots, totalQty };
    } catch (error) {
      console.error('Error counting inventory:', error);
      return { brands: 0, models: 0, variants: 0, dots: 0, totalQty: 0 };
    }
  },

  async getInventorySummary(storeId: string): Promise<Array<{
    brand: string;
    model: string;
    variants: number;
    totalQty: number;
    totalDots: number;
  }>> {
    try {
      const summary: Array<{ brand: string; model: string; variants: number; totalQty: number; totalDots: number; }> = [];

      const inventoryRef = collection(db, 'stores', storeId, 'inventory');
      const brandsSnap = await getDocs(inventoryRef);

      for (const brandDoc of brandsSnap.docs) {
        const brandData = brandDoc.data();
        const brandName = brandData.brandName || brandDoc.id;

        const modelsRef = collection(brandDoc.ref, 'models');
        const modelsSnap = await getDocs(modelsRef);

        for (const modelDoc of modelsSnap.docs) {
          const modelData = modelDoc.data();
          const modelName = modelData.modelName || modelDoc.id;

          let variants = 0, totalQty = 0, totalDots = 0;

          const variantsRef = collection(modelDoc.ref, 'variants');
          const variantsSnap = await getDocs(variantsRef);

          for (const variantDoc of variantsSnap.docs) {
            variants++;
            const dotsRef = collection(variantDoc.ref, 'dots');
            const dotsSnap = await getDocs(dotsRef);
            for (const dotDoc of dotsSnap.docs) {
              totalDots++;
              const dotData = dotDoc.data();
              totalQty += Number(dotData.qty || 0);
            }
          }

          if (variants > 0) {
            summary.push({ brand: brandName, model: modelName, variants, totalQty, totalDots });
          }
        }
      }

      return summary.sort((a, b) => b.totalQty - a.totalQty);
    } catch (error) {
      console.error('Error getting inventory summary:', error);
      return [];
    }
  },
};

/* =========================
 * Default aggregate export
 * ========================= */
export default {
  StoreService,
  InventoryService,
  OrderService,
  InventoryTestUtils,
  // Helpers
  slugifyId,
  ensureArray,
  stripUndefinedDeep,
  findProductIdByBrandModel,
  // Compat
  approveOrderTx,
  receiveOrderTx,
  rejectOrderTx,
};
