// lib/services/inventoryService.ts
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* =====================  UTIL  ===================== */

function normalizeSpec(s: string) {
  // แปลง spec ให้เทียบง่าย เช่น "215/70R15 109/107Q" -> "215 70r15 109 107q"
  return (s || '').replaceAll('/', ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** หา variantId จาก specification ถ้าไม่รู้ variantId */
async function resolveVariantId(params: {
  sellerBranchId: string;
  brand: string;
  model: string;
  specification: string;
}): Promise<string> {
  const { sellerBranchId, brand, model, specification } = params;

  const variantsRef = collection(
    db,
    'stores',
    sellerBranchId,
    'inventory',
    brand,
    'models',
    model,
    'variants',
  );
  const snap = await getDocs(variantsRef);

  const want = normalizeSpec(specification);
  for (const d of snap.docs) {
    const v = d.data() as any;
    const spec = `${v.size ?? ''} ${v.loadIndex ?? ''}`.trim();
    if (normalizeSpec(spec) === want) {
      return d.id; // doc id ปลอดภัย (ไม่มี '/')
    }
  }
  throw new Error(`Cannot resolve variantId for ${brand} ${model} (${specification})`);
}

/* =====================  TYPE DEFINITIONS  ===================== */

export interface DotDetail {
  dotCode: string;
  qty: number;
  basePrice: number;
  promoPrice?: number;
}

export interface SizeDetail {
  variantId: string;          // << เก็บ id เอกสารใน 'variants'
  specification: string;      // ใช้แสดงผล
  dots: DotDetail[];
}

export interface BranchDetail {
  branchName: string;
  branchId: string;
  sizes: SizeDetail[];
}

export interface GroupedProduct {
  id: string;
  name: string;               // "Brand Model"
  brand: string;
  model: string;
  totalAvailable: number;
  branches: BranchDetail[];
}

export interface StoreInfo {
  id: string;
  branchName: string;
  location?: string;
  isActive: boolean;
}

/* =====================  STORE SERVICE  ===================== */

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

  static async getStoreInfo(storeId: string): Promise<StoreInfo | null> {
    const storeDoc = await getDoc(doc(db, 'stores', storeId));
    if (!storeDoc.exists()) return null;

    const data = storeDoc.data() as any;
    return {
      id: storeDoc.id,
      branchName: data.branchName,
      location: data.location,
      isActive: data.isActive !== false,
    };
  }
}

/* =====================  INVENTORY SERVICE  ===================== */

export class InventoryService {
  /** ดึง Inventory หลายสาขาแล้วรวมเป็นสินค้าเดียวกัน */
  static async fetchInventory(storeIds?: string[]): Promise<GroupedProduct[]> {
    try {
      const storeMap = await StoreService.getAllStores();
      const targetStoreIds = storeIds || Object.keys(storeMap);

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
      console.error('Error fetching inventory:', error);
      return [];
    }
  }

  /** ดึง Inventory ของสาขาเดียว */
  static async fetchStoreInventory(
    storeId: string,
    branchName: string,
  ): Promise<GroupedProduct[]> {
    const products: GroupedProduct[] = [];

    const brandsRef = collection(db, 'stores', storeId, 'inventory');
    const brandSnapshots = await getDocs(brandsRef);

    for (const brandDoc of brandSnapshots.docs) {
      const brandName = brandDoc.id;

      const modelsRef = collection(brandDoc.ref, 'models');
      const modelSnapshots = await getDocs(modelsRef);

      for (const modelDoc of modelSnapshots.docs) {
        const modelData = modelDoc.data() as any;
        const modelName = modelData.modelName;
        const productId = `${brandName} ${modelName}`;

        const product: GroupedProduct = {
          id: productId,
          name: productId,
          brand: brandName,
          model: modelName,
          totalAvailable: 0,
          branches: [
            {
              branchName,
              branchId: storeId,
              sizes: [],
            },
          ],
        };

        const variantsRef = collection(modelDoc.ref, 'variants');
        const variantSnapshots = await getDocs(variantsRef);

        for (const variantDoc of variantSnapshots.docs) {
          const variantData = variantDoc.data() as any;
          const specification = `${variantData.size} ${variantData.loadIndex || ''}`.trim();

          const sizeDetail: SizeDetail = {
            variantId: variantDoc.id,        // << สำคัญ ใช้ตอนอ้าง path
            specification,
            dots: [],
          };

          const dotsRef = collection(variantDoc.ref, 'dots');
          const dotSnapshots = await getDocs(dotsRef);

          dotSnapshots.forEach((dotDoc) => {
            const dotData = dotDoc.data() as any;
            const dot: DotDetail = {
              dotCode: dotDoc.id,
              qty: dotData.qty || 0,
              basePrice: variantData.basePrice || 0,
              promoPrice: dotData.promoPrice,
            };
            sizeDetail.dots.push(dot);
            product.totalAvailable += dot.qty;
          });

          if (sizeDetail.dots.length > 0) {
            product.branches[0].sizes.push(sizeDetail);
          }
        }

        if (product.totalAvailable > 0) {
          products.push(product);
        }
      }
    }

    return products;
  }

  /** ตรวจสอบสต็อกโดยใช้ variantId (แนะนำให้ใช้วิธีนี้) */
  static async checkAvailabilityByVariant(
    storeId: string,
    brandName: string,
    modelName: string,
    variantId: string,
    dotCode: string,
    requestedQty: number,
  ): Promise<{ available: boolean; currentQty: number }> {
    try {
      const dotRef = doc(
        db,
        'stores',
        storeId,
        'inventory',
        brandName,
        'models',
        modelName,
        'variants',
        variantId,
        'dots',
        dotCode,
      );
      const snap = await getDoc(dotRef);
      if (!snap.exists()) return { available: false, currentQty: 0 };
      const currentQty = (snap.data() as any).qty || 0;
      return { available: currentQty >= requestedQty, currentQty };
    } catch (e) {
      console.error('checkAvailabilityByVariant error:', e);
      return { available: false, currentQty: 0 };
    }
  }

  /** (เข้ากันได้ย้อนหลัง) ตรวจสอบสต็อกจากสเปค -> จะหาว่า variantId ใด */
  static async checkAvailability(
    storeId: string,
    brandName: string,
    modelName: string,
    specification: string,
    dotCode: string,
    requestedQty: number,
  ): Promise<{ available: boolean; currentQty: number }> {
    try {
      const vId = await resolveVariantId({
        sellerBranchId: storeId,
        brand: brandName,
        model: modelName,
        specification,
      });
      return this.checkAvailabilityByVariant(
        storeId,
        brandName,
        modelName,
        vId,
        dotCode,
        requestedQty,
      );
    } catch (e) {
      console.error('checkAvailability (spec) error:', e);
      return { available: false, currentQty: 0 };
    }
  }

  /** อัปเดตจำนวนโดยใช้ variantId (แนะนำให้ใช้วิธีนี้) */
  static async updateInventoryQuantityByVariant(
    storeId: string,
    brandName: string,
    modelName: string,
    variantId: string,
    dotCode: string,
    newQty: number,
  ): Promise<boolean> {
    try {
      const dotRef = doc(
        db,
        'stores',
        storeId,
        'inventory',
        brandName,
        'models',
        modelName,
        'variants',
        variantId,
        'dots',
        dotCode,
      );
      await updateDoc(dotRef, { qty: newQty, lastUpdated: serverTimestamp() });
      return true;
    } catch (error) {
      console.error('updateInventoryQuantityByVariant error:', error);
      return false;
    }
  }

  /** (เข้ากันได้ย้อนหลัง) อัปเดตจำนวนจากสเปค */
  static async updateInventoryQuantity(
    storeId: string,
    brandName: string,
    modelName: string,
    specification: string,
    dotCode: string,
    newQty: number,
  ): Promise<boolean> {
    try {
      const vId = await resolveVariantId({
        sellerBranchId: storeId,
        brand: brandName,
        model: modelName,
        specification,
      });
      return this.updateInventoryQuantityByVariant(
        storeId,
        brandName,
        modelName,
        vId,
        dotCode,
        newQty,
      );
    } catch (e) {
      console.error('updateInventoryQuantity (spec) error:', e);
      return false;
    }
  }

  /** ค้นหา */
  static async searchProducts(searchTerm: string): Promise<GroupedProduct[]> {
    const all = await this.fetchInventory();
    const q = searchTerm.toLowerCase();
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        p.branches.some((b) =>
          b.sizes.some((s) => s.specification.toLowerCase().includes(q)),
        ),
    );
  }

  /** เฉพาะที่มีโปรโมชัน */
  static async getPromotionalProducts(): Promise<GroupedProduct[]> {
    const all = await this.fetchInventory();
    return all.filter((p) =>
      p.branches.some((b) =>
        b.sizes.some((s) => s.dots.some((d) => d.promoPrice && d.promoPrice > 0)),
      ),
    );
  }
}

/* =====================  ORDER SERVICE  ===================== */

export interface OrderItem {
  productId: string;
  productName: string;     // "Brand Model"
  specification: string;   // ใช้แสดงผล
  dotCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sellerBranchId: string;
  sellerBranchName: string;
  variantId?: string;      // แนะนำให้มี; ออเดอร์เก่าที่ไม่มีจะหาให้ตอนจ่าย
}

export interface Order {
  id?: string;
  orderNumber: string;
  buyerBranchId: string;
  buyerBranchName: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'paid';
  createdAt: any;
  updatedAt?: any;
  notes?: string;
}

export class OrderService {
  /** สร้าง Order (ยังไม่ตัดสต็อก) */
  static async createOrder(
    order: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'status'> & {
      status?: Order['status'];
    },
  ): Promise<string> {
    const { notes, ...rest } = order;

    const orderNumber = `ORD-${new Date().getFullYear()}-${Date.now()}`;
    const payload: any = {
      ...rest,
      orderNumber,
      status: order.status ?? 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // ใส่ notes เฉพาะตอนมีข้อความจริง (กัน undefined)
    if (typeof notes === 'string' && notes.trim() !== '') {
      payload.notes = notes.trim();
    }

    const ref = await addDoc(collection(db, 'orders'), payload);
    return ref.id;
  }

  /** ดึง Orders ของ branch (buyer/seller) – หมายเหตุ: query seller อาจต้องปรับ schema จริง ๆ */
  static async getOrdersByBranch(branchId: string, type: 'buyer' | 'seller'): Promise<Order[]> {
    const field = type === 'buyer' ? 'buyerBranchId' : 'items.sellerBranchId';
    const qy = query(collection(db, 'orders'), where(field, '==', branchId));
    const snapshot = await getDocs(qy);
    return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Order));
  }

  /** อัปเดทสถานะออเดอร์ */
  static async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      updatedAt: serverTimestamp(),
    });
  }

  /** ชำระเงิน -> ตรวจ + ตัดสต็อก + สถานะ 'paid' (ปลอดภัยเรื่อง '/') */
  static async payOrder(orderId: string): Promise<void> {
    const oRef = doc(db, 'orders', orderId);
    const snap = await getDoc(oRef);
    if (!snap.exists()) throw new Error('Order not found');
    const order = snap.data() as Order;

    // 1) ตรวจสต็อกครบทุกชิ้น
    for (const item of order.items) {
      const [brand, ...m] = item.productName.split(' ');
      const model = m.join(' ');
      const variantId =
        item.variantId && !item.variantId.includes('/')
          ? item.variantId
          : await resolveVariantId({
              sellerBranchId: item.sellerBranchId,
              brand,
              model,
              specification: item.specification,
            });

      const dotRef = doc(
        db,
        'stores',
        item.sellerBranchId,
        'inventory',
        brand,
        'models',
        model,
        'variants',
        variantId,
        'dots',
        item.dotCode,
      );
      const dotSnap = await getDoc(dotRef);
      if (!dotSnap.exists()) {
        throw new Error(
          `Variant/DOT not found for ${item.productName} ${item.specification} (${item.dotCode})`,
        );
      }
      const currentQty = (dotSnap.data() as any).qty ?? 0;
      if (currentQty < item.quantity) {
        throw new Error(
          `Insufficient stock for ${item.productName} ${item.specification} (${item.dotCode}). Current: ${currentQty}`,
        );
      }
    }

    // 2) หักสต็อกแบบ batch
    const batch = writeBatch(db);
    for (const item of order.items) {
      const [brand, ...m] = item.productName.split(' ');
      const model = m.join(' ');

      const variantId =
        item.variantId && !item.variantId.includes('/')
          ? item.variantId
          : await resolveVariantId({
              sellerBranchId: item.sellerBranchId,
              brand,
              model,
              specification: item.specification,
            });

      const dotRef = doc(
        db,
        'stores',
        item.sellerBranchId,
        'inventory',
        brand,
        'models',
        model,
        'variants',
        variantId,
        'dots',
        item.dotCode,
      );
      const dotSnap = await getDoc(dotRef);
      const currentQty = (dotSnap.data() as any).qty ?? 0;

      batch.update(dotRef, {
        qty: currentQty - item.quantity,
        lastUpdated: serverTimestamp(),
      });
    }

    // 3) อัปเดตสถานะออเดอร์
    batch.update(oRef, { status: 'paid', updatedAt: serverTimestamp() });

    await batch.commit();
  }
}
