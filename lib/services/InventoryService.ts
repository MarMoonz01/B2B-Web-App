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

// --- TYPE DEFINITIONS ---
export interface DotDetail {
  dotCode: string;
  qty: number;
  basePrice: number;
  promoPrice?: number;
}
export interface SizeDetail {
  variantId: string;
  specification: string;
  dots: DotDetail[];
}
export interface BranchDetail {
  branchName: string;
  branchId: string;
  sizes: SizeDetail[];
}
export interface GroupedProduct {
  id: string;
  name: string;
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
export interface OrderItem {
  productId: string;
  productName: string;
  specification: string;
  dotCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantId?: string;
}
export interface Order {
  id?: string;
  orderNumber: string;
  buyerBranchId: string;
  buyerBranchName: string;
  sellerBranchId: string;
  sellerBranchName: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'requested' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'paid';
  createdAt: any;
  updatedAt?: any;
  notes?: string;
}

// --- UTILS ---
function normalizeSpec(s: string) {
  return (s || '').replaceAll('/', ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

async function resolveVariantId(params: {
  sellerBranchId: string;
  brand: string;
  model: string;
  specification: string;
}): Promise<string> {
  const { sellerBranchId, brand, model, specification } = params;
  const variantsRef = collection(db, 'stores', sellerBranchId, 'inventory', brand, 'models', model, 'variants');
  const snap = await getDocs(variantsRef);
  const want = normalizeSpec(specification);
  for (const d of snap.docs) {
    const v = d.data() as any;
    const spec = `${v.size ?? ''} ${v.loadIndex ?? ''}`.trim();
    if (normalizeSpec(spec) === want) return d.id;
  }
  throw new Error(`Cannot resolve variantId for ${brand} ${model} (${specification})`);
}


// --- SERVICES ---

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
}

export class InventoryService {
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

  static async fetchStoreInventory(storeId: string, branchName: string): Promise<GroupedProduct[]> {
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
        const product: GroupedProduct = { id: productId, name: productId, brand: brandName, model: modelName, totalAvailable: 0, branches: [{ branchName, branchId: storeId, sizes: [] }] };
        const variantsRef = collection(modelDoc.ref, 'variants');
        const variantSnapshots = await getDocs(variantsRef);

        for (const variantDoc of variantSnapshots.docs) {
          const variantData = variantDoc.data() as any;
          const specification = `${variantData.size} ${variantData.loadIndex || ''}`.trim();
          const sizeDetail: SizeDetail = { variantId: variantDoc.id, specification, dots: [] };
          const dotsRef = collection(variantDoc.ref, 'dots');
          const dotSnapshots = await getDocs(dotsRef);

          dotSnapshots.forEach((dotDoc) => {
            const dotData = dotDoc.data() as any;
            const dot: DotDetail = { dotCode: dotDoc.id, qty: dotData.qty || 0, basePrice: variantData.basePrice || 0, promoPrice: dotData.promoPrice };
            sizeDetail.dots.push(dot);
            product.totalAvailable += dot.qty;
          });

          if (sizeDetail.dots.length > 0) product.branches[0].sizes.push(sizeDetail);
        }
        if (product.totalAvailable > 0) products.push(product);
      }
    }
    return products;
  }
}

export class OrderService {
  static async createOrder(order: Omit<Order, 'id' | 'orderNumber' | 'createdAt'>): Promise<string> {
    const { notes, ...rest } = order;
    const orderNumber = `TRF-${new Date().getFullYear()}-${Date.now()}`;
    const payload: any = { ...rest, orderNumber, status: order.status || 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
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
      const variantId = item.variantId || await resolveVariantId({ sellerBranchId: order.sellerBranchId, brand, model, specification: item.specification });
      const dotRef = doc(db, 'stores', order.sellerBranchId, 'inventory', brand, 'models', model, 'variants', variantId, 'dots', item.dotCode);
      const dotSnap = await getDoc(dotRef);
      const currentQty = (dotSnap.data() as any)?.qty ?? 0;
      if (currentQty < item.quantity) throw new Error(`Insufficient stock for ${item.productName}`);
      batch.update(dotRef, { qty: currentQty - item.quantity, lastUpdated: serverTimestamp() });
    }

    batch.update(oRef, { status: 'confirmed', updatedAt: serverTimestamp() });
    await batch.commit();
  }
}