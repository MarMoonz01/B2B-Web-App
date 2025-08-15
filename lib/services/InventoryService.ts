// lib/services/InventoryService.ts
import {
  collection,
  getDocs,
  doc,
  runTransaction,
  query,
  where,
  serverTimestamp,
  addDoc,
  orderBy,
  writeBatch,
  getDoc,
  deleteDoc,
  deleteField,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  GroupedProduct,
  StockMovement,
  Order,
  OrderItem,
  SizeDetail,
  DotDetail,
} from '@/types/inventory';

// ---------- UTILS ----------
const toId = (s: string) =>
  String(s || '')
    .trim()
    .toUpperCase()
    .replace(/[\/\s]+/g, '-');

async function resolveVariantId(params: {
  sellerBranchId: string;
  brand: string;
  model: string;
  specification: string;
}): Promise<string> {
  const { sellerBranchId, brand, model, specification } = params;
  const brandId = toId(brand);
  const modelId = toId(model);
  const wantSpecId = toId(specification);

  const variantsRef = collection(
    db,
    'stores',
    sellerBranchId,
    'inventory',
    brandId,
    'models',
    modelId,
    'variants'
  );
  const snap = await getDocs(variantsRef);
  for (const d of snap.docs) {
    if (d.id === wantSpecId) return d.id;
  }
  throw new Error(`Cannot resolve variantId for ${brand} ${model} (${specification})`);
}

// ---------- TYPES FOR STORE DOC ----------
export type StoreDoc = {
  branchName: string;
  isActive: boolean;
  phone?: string;
  email?: string;
  lineId?: string;
  address?: {
    line1?: string;
    line2?: string;
    district?: string;
    province?: string;
    postalCode?: string;
    country?: string; // default TH
  };
  location?: { lat?: number; lng?: number };
  services?: string[];
  hours?: Record<string, { open: string; close: string; closed: boolean }>;
  createdAt?: any;
  updatedAt?: any;
};

// ---------- SERVICES ----------
export class StoreService {
  static async getAllStores(): Promise<Record<string, string>> {
    const storesCollection = await getDocs(collection(db, 'stores'));
    const storeMap: Record<string, string> = {};
    storesCollection.docs.forEach((d) => {
      const data = d.data() as any;
      storeMap[d.id] = data.branchName || d.id;
    });
    return storeMap;
  }

  // NEW: check if storeId is available
  static async isStoreIdAvailable(storeId: string): Promise<boolean> {
    const snap = await getDoc(doc(db, 'stores', storeId));
    return !snap.exists();
  }

  // NEW: create store document
  static async createStore(storeId: string, payload: StoreDoc): Promise<void> {
    const storeRef = doc(db, 'stores', storeId);
    const now = serverTimestamp();
    await runTransaction(db, async (trx) => {
      const exists = await trx.get(storeRef);
      if (exists.exists()) throw new Error(`Store ID '${storeId}' already exists`);
      trx.set(storeRef, {
        ...payload,
        branchName: payload.branchName?.trim(),
        isActive: Boolean(payload.isActive),
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  // NEW: update store
  static async updateStore(storeId: string, partial: Partial<StoreDoc>): Promise<void> {
    const storeRef = doc(db, 'stores', storeId);
    await runTransaction(db, async (trx) => {
      const snap = await trx.get(storeRef);
      if (!snap.exists()) throw new Error('Store not found');
      trx.set(storeRef, { ...partial, updatedAt: serverTimestamp() }, { merge: true });
    });
  }
}

export class InventoryService {
  static async fetchInventory(): Promise<GroupedProduct[]> {
    try {
      const storeMap = await StoreService.getAllStores();
      const targetStoreIds = Object.keys(storeMap);
      const productGroups = new Map<string, GroupedProduct>();

      for (const storeId of targetStoreIds) {
        const branchName = storeMap[storeId] || storeId;
        const inventoryData = await this.fetchStoreInventory(storeId, branchName);

        inventoryData.forEach((product) => {
          const existing = productGroups.get(product.id);
          if (existing) {
            existing.branches.push(...product.branches);
            existing.totalAvailable += product.totalAvailable;
          } else {
            productGroups.set(product.id, product);
          }
        });
      }
      return Array.from(productGroups.values());
    } catch (error) {
      console.error('Error fetching all inventory:', error);
      return [];
    }
  }

  static async fetchStoreInventory(storeId: string, branchName: string): Promise<GroupedProduct[]> {
    const products: GroupedProduct[] = [];
    const brandsRef = collection(db, 'stores', storeId, 'inventory');
    const brandSnapshots = await getDocs(brandsRef);

    for (const brandDoc of brandSnapshots.docs) {
      const modelsRef = collection(brandDoc.ref, 'models');
      const modelSnapshots = await getDocs(modelsRef);

      for (const modelDoc of modelSnapshots.docs) {
        const modelData = modelDoc.data() as any;
        const brandData = brandDoc.data() as any;
        const productId = `${brandData.brandName} ${modelData.modelName}`;

        const product: GroupedProduct = {
          id: productId,
          name: productId,
          brand: brandData.brandName,
          model: modelData.modelName,
          totalAvailable: 0,
          branches: [{ branchName, branchId: storeId, sizes: [] }],
        };

        const variantsRef = collection(modelDoc.ref, 'variants');
        const variantSnapshots = await getDocs(variantsRef);

        for (const variantDoc of variantSnapshots.docs) {
          const variantData = variantDoc.data() as any;
          const specification = `${variantData.size} ${variantData.loadIndex || ''}`.trim();
          const sizeDetail: SizeDetail = { variantId: variantDoc.id, specification, dots: [] };
          let sizeTotalQty = 0;

          const dotsRef = collection(variantDoc.ref, 'dots');
          const dotSnapshots = await getDocs(dotsRef);

          dotSnapshots.forEach((dotDoc) => {
            const dotData = dotDoc.data() as any;
            if ((dotData.qty ?? 0) > 0) {
              const dot: DotDetail = {
                dotCode: dotDoc.id,
                qty: dotData.qty || 0,
                basePrice: variantData.basePrice || 0,
                promoPrice: dotData.promoPrice,
              };
              sizeDetail.dots.push(dot);
              sizeTotalQty += dot.qty;
            }
          });

          if (sizeDetail.dots.length > 0) {
            product.branches[0].sizes.push(sizeDetail);
            product.totalAvailable += sizeTotalQty;
          }
        }
        if (product.totalAvailable > 0) products.push(product);
      }
    }
    return products;
  }

  static async createStockMovement(
    storeId: string,
    productInfo: { brand: string; model: string; variantId: string; dotCode: string },
    type: StockMovement['type'],
    qtyChange: number,
    details: { price?: number; reason?: string } = {}
  ) {
    const { brand, model, variantId, dotCode } = productInfo;
    const brandId = toId(brand);
    const modelId = toId(model);
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
    const movementsRef = collection(db, 'stores', storeId, 'stock_movements');

    try {
      await runTransaction(db, async (transaction) => {
        const dotSnap = await transaction.get(dotRef);
        if (!dotSnap.exists()) throw new Error(`DOT not found at: ${dotRef.path}`);
        const currentQty = dotSnap.data().qty ?? 0;
        const newQty = currentQty + qtyChange;
        if (newQty < 0) {
          throw new Error(
            `Insufficient stock for ${dotCode}. Available: ${currentQty}, Required: ${Math.abs(qtyChange)}`
          );
        }
        transaction.set(dotRef, { qty: newQty, updatedAt: serverTimestamp() }, { merge: true });

        const movementLog: Partial<StockMovement> = {
          productId: `${brand} ${model}`,
          variantId,
          dotCode,
          type,
          qtyChange,
          newQty,
          createdAt: serverTimestamp(),
        };
        if (details.price !== undefined) movementLog.price = details.price;
        if (details.reason) movementLog.reason = details.reason;

        const newMovementRef = doc(movementsRef);
        transaction.set(newMovementRef, movementLog);
      });
    } catch (error) {
      console.error('Transaction failed: ', error);
      throw error;
    }
  }

  static async getStockMovements(storeId: string, { productId }: { productId: string }): Promise<StockMovement[]> {
    const movementsRef = collection(db, 'stores', storeId, 'stock_movements');
    const q = query(movementsRef, where('productId', '==', productId), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StockMovement));
  }
  static async upsertDot(
    storeId: string,
    args: {
      brand: string;
      model: string;
      variantId: string;
      dotCode: string;
      qty: number;
      basePrice?: number;     // ถ้าส่งมาจะอัปเดต basePrice ของ variant ด้วย
      promoPrice?: number | null; // โปรโมชัน (null = เคลียร์ทิ้ง)
      mergeQty?: 'increment' | 'set';
    }
  ): Promise<void> {
    const { brand, model, variantId, dotCode, qty, basePrice, promoPrice, mergeQty = 'set' } = args;
    const brandId = toId(brand);
    const modelId = toId(model);

    const variantRef = doc(db, 'stores', storeId, 'inventory', brandId, 'models', modelId, 'variants', variantId);
    const dotRef     = doc(variantRef, 'dots', dotCode);

    await runTransaction(db, async (trx) => {
      // อัปเดตฐานราคา (ถ้าส่งมา)
      if (typeof basePrice === 'number') {
        trx.set(variantRef, { basePrice, updatedAt: serverTimestamp() }, { merge: true });
      }

      const snap = await trx.get(dotRef);
      const currQty = snap.exists() ? Number((snap.data() as any)?.qty ?? 0) : 0;
      const newQty  = mergeQty === 'increment' ? currQty + qty : qty;

      const dotData: any = { qty: newQty, updatedAt: serverTimestamp() };
      if (promoPrice === null) {
        // เคลียร์โปร
        dotData.promoPrice = deleteField();
      } else if (typeof promoPrice === 'number') {
        dotData.promoPrice = promoPrice;
      }

      trx.set(dotRef, dotData, { merge: true });
    });
  }

  /**
   * ตั้ง/ลบราคาโปรโมชันของ DOT
   * - ส่ง promoPrice เป็น number เพื่อ "ตั้งค่า"
   * - ส่ง promoPrice เป็น null เพื่อ "ลบ/เคลียร์"
   */
  static async setPromoPrice(
    storeId: string,
    args: { brand: string; model: string; variantId: string; dotCode: string; promoPrice: number | null }
  ): Promise<void> {
    const { brand, model, variantId, dotCode, promoPrice } = args;
    const brandId = toId(brand);
    const modelId = toId(model);

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

    if (promoPrice === null) {
      await runTransaction(db, async (trx) => {
        trx.set(dotRef, { promoPrice: deleteField(), updatedAt: serverTimestamp() }, { merge: true });
      });
    } else {
      await runTransaction(db, async (trx) => {
        trx.set(dotRef, { promoPrice, updatedAt: serverTimestamp() }, { merge: true });
      });
    }
  }

  /**
   * ลบ DOT ทั้งเอกสาร (เช่น เลิกใช้ DOT นั้นแล้ว)
   */
  static async deleteDot(
    storeId: string,
    args: { brand: string; model: string; variantId: string; dotCode: string }
  ): Promise<void> {
    const { brand, model, variantId, dotCode } = args;
    const brandId = toId(brand);
    const modelId = toId(model);

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
    await deleteDoc(dotRef);
  }
}

export class OrderService {
  static async createOrder(order: Omit<Order, 'id' | 'orderNumber' | 'createdAt'>): Promise<string> {
    const { notes, ...rest } = order;
    const orderNumber = `TRF-${new Date().getFullYear()}-${Date.now()}`;
    const payload: any = {
      ...rest,
      orderNumber,
      status: order.status || 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (typeof notes === 'string' && notes.trim() !== '') payload.notes = notes.trim();
    const ref = await addDoc(collection(db, 'orders'), payload);
    return ref.id;
  }

  static async getOrdersByBranch(branchId: string, type: 'buyer' | 'seller'): Promise<Order[]> {
    const field = type === 'buyer' ? 'buyerBranchId' : 'sellerBranchId';
    const qy = query(collection(db, 'orders'), where(field, '==', branchId));
    const snapshot = await getDocs(qy);
    return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Order));
  }

  static async approveTransfer(orderId: string): Promise<void> {
    const oRef = doc(db, 'orders', orderId);
    const snap = await getDoc(oRef);
    if (!snap.exists()) throw new Error('Order not found');

    const order = snap.data() as Order;
    const batch = writeBatch(db);

    for (const item of order.items) {
      const [brand, ...m] = item.productName.split(' ');
      const model = m.join(' ');
      const variantId =
        item.variantId ||
        (await resolveVariantId({
          sellerBranchId: order.sellerBranchId,
          brand,
          model,
          specification: item.specification,
        }));

      const dotRef = doc(
        db,
        'stores',
        order.sellerBranchId,
        'inventory',
        toId(brand),
        'models',
        toId(model),
        'variants',
        variantId,
        'dots',
        item.dotCode
      );
      const dotSnap = await getDoc(dotRef);
      const currentQty = (dotSnap.data() as any)?.qty ?? 0;
      if (currentQty < item.quantity) throw new Error(`Insufficient stock for ${item.productName}`);
      batch.update(dotRef, { qty: currentQty - item.quantity, lastUpdated: serverTimestamp() });
    }

    batch.update(oRef, { status: 'confirmed', updatedAt: serverTimestamp() });
    await batch.commit();
  }
}
