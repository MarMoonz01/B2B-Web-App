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
import {
  MovementType,
  EventTypeString,
  mapStockTypeToEvent,
} from '@/types/events';

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
  variantId: string;
  unitPrice?: number;
  totalPrice?: number;
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
  totalAmount?: number;
  itemCount: number;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  cancelReason?: string;
};

export type OrderStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'shipped'
  | 'received'
  | 'cancelled'
  | 'confirmed'
  | 'delivered';

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

export type Notification = {
  id?: string;
  branchId: string;
  title: string;
  message: string;
  link: string;
  orderId: string;
  isRead: boolean;
  createdAt: Timestamp;
};

// Simplified Branch type
export type Branch = {
  id: string;
  branchName: string;
};

/** เอกสารจริงในคอลเลกชัน stockMovements (ใช้กับ HistoryView) */
export type StockMovementDoc = {
  branchId: string;
  type: StockMovementType;
  eventType: EventTypeString;
  qtyChange: number;
  brand?: string | null;
  model?: string | null;
  variantId?: string | null;
  dotCode?: string | null;
  orderId?: string | null;
  reason?: string | null;
  createdAt: any; // Firestore Timestamp
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
  return size && li ? `${size} (${li})` : size || li || '';
}

async function resolveBrandId(storeId: string, brandIdOrName: string): Promise<string> {
  const trimmedBrand = brandIdOrName.trim();
  const candidates = [
    trimmedBrand,
    trimmedBrand.toUpperCase(),
    slugifyId(trimmedBrand),
    trimmedBrand.toLowerCase(),
  ];
  for (const b of candidates) {
    if (!b) continue;
    const snap = await getDoc(doc(db, 'stores', storeId, 'inventory', b));
    if (snap.exists()) return b;
  }
  return trimmedBrand.toUpperCase();
}

async function resolveModelId(
  storeId: string,
  brandIdResolved: string,
  modelIdOrName: string
): Promise<string> {
  const trimmedModel = modelIdOrName.trim();
  const base = doc(db, 'stores', storeId, 'inventory', brandIdResolved);
  const candidates = [
    trimmedModel,
    slugifyId(trimmedModel),
    trimmedModel.toUpperCase(),
    trimmedModel.toLowerCase(),
  ];
  for (const m of candidates) {
    if (!m) continue;
    const snap = await getDoc(doc(base, 'models', m));
    if (snap.exists()) return m;
  }
  return slugifyId(trimmedModel);
}

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
 * Audit helper (ใช้ type กลาง)
 * =======================*/

async function logMovement(payload: {
  branchId: string;
  type: StockMovementType;
  qtyChange?: number;
  brand?: string;
  model?: string;
  variantId?: string;
  dotCode?: string;
  orderId?: string;
  reason?: string | null;
}) {
  const docData: StockMovementDoc = {
    branchId: payload.branchId,
    type: payload.type,
    eventType: mapStockTypeToEvent(payload.type),
    qtyChange: typeof payload.qtyChange === 'number' ? payload.qtyChange : 0,
    brand: payload.brand ?? null,
    model: payload.model ?? null,
    variantId: payload.variantId ?? null,
    dotCode: payload.dotCode ?? null,
    orderId: payload.orderId ?? null,
    reason: payload.reason ?? null,
    createdAt: serverTimestamp(),
  };
  await addDoc(collection(db, 'stockMovements'), docData as any);
}

async function logOrderEvent(payload: {
  branchId: string;
  orderId: string;
  eventType: Extract<
    EventTypeString,
    | 'order.requested'
    | 'order.approved'
    | 'order.rejected'
    | 'order.shipped'
    | 'order.received'
    | 'order.cancelled'
  >;
  reason?: string | null;
}) {
  const docData: StockMovementDoc = {
    branchId: payload.branchId,
    orderId: payload.orderId,
    eventType: payload.eventType,
    type: 'adjust', // เก็บกลาง ๆ; History ใช้ eventType เป็นหลัก
    qtyChange: 0,
    createdAt: serverTimestamp(),
    reason: payload.reason ?? null,
    brand: null,
    model: null,
    variantId: null,
    dotCode: null,
  };
  await addDoc(collection(db, 'stockMovements'), docData as any);
}

/* =========================
 * Store Service
 * =======================*/
export const StoreService = {
  async getAllStores(): Promise<Record<string, string>> {
    const r = await fetch('/api/branches/visible', { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok || !d?.ok) throw new Error(d?.error || 'failed to load branches');
    const out: Record<string, string> = {};
    (d.branches as any[]).forEach((b) => {
      out[b.id] = b.branchName ?? b.id;
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
      branchName: payload.branchName.trim(),
      phone: payload.phone?.trim() ?? null,
      email: payload.email?.trim().toLowerCase() ?? null,
      lineId: payload.lineId?.trim() ?? null,
      address: payload.address ?? {},
      location: payload.location ?? {},
      services: payload.services ?? [],
      notes: payload.notes?.trim() ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  async updateStore(storeId: string, patch: Partial<StoreDoc>): Promise<void> {
    const ref = doc(db, 'stores', storeId);
    const normalizedPatch: Partial<StoreDoc> = { ...patch };
    if (patch.branchName) normalizedPatch.branchName = patch.branchName.trim();
    if (patch.phone) normalizedPatch.phone = patch.phone.trim();
    if (patch.email) normalizedPatch.email = patch.email.trim().toLowerCase();
    if (patch.lineId) normalizedPatch.lineId = patch.lineId.trim();
    if (patch.notes) normalizedPatch.notes = patch.notes.trim();

    await updateDoc(ref, {
      ...normalizedPatch,
      updatedAt: serverTimestamp(),
    });
  },

  async getStore(storeId: string): Promise<StoreDoc | null> {
    const ref = doc(db, 'stores', storeId);
    const ds = await getDoc(ref);
    if (!ds.exists()) return null;
    return { ...(ds.data() as any) } as StoreDoc;
  },

  async getStoreNamesByIds(ids: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    await Promise.all(
      (ids ?? []).map(async (id) => {
        const ds = await getDoc(doc(db, 'stores', id));
        if (ds.exists()) {
          const data = ds.data() as any;
          out[id] = data.branchName ?? id;
        }
      })
    );
    return out;
  },
};

/* =========================
 * Inventory Service
 * =======================*/
export const InventoryService = {
  /* ---------- Ensure helpers (canonical) ---------- */

  async ensureBrandDoc(storeId: string, brandName: string): Promise<{ brandId: string }> {
    const normalizedBrandName = brandName.trim();
    if (!normalizedBrandName) throw new Error('Brand name cannot be empty.');
    
    const brandId = await resolveBrandId(storeId, normalizedBrandName);
    const brandRef = doc(db, 'stores', storeId, 'inventory', brandId);
    const snap = await getDoc(brandRef);
    
    if (!snap.exists()) {
      await setDoc(brandRef, {
        brandName: normalizedBrandName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const cur = (snap.data() as any)?.brandName;
      if (cur !== normalizedBrandName) {
        await updateDoc(brandRef, { brandName: normalizedBrandName, updatedAt: serverTimestamp() });
      }
    }
    return { brandId };
  },

  async ensureModelDoc(
    storeId: string,
    brandIdOrName: string,
    modelName: string
  ): Promise<{ brandId: string; modelId: string }> {
    const normalizedModelName = modelName.trim();
    if (!normalizedModelName) throw new Error('Model name cannot be empty.');
    
    const { brandId } = await this.ensureBrandDoc(storeId, brandIdOrName);

    const modelId = await resolveModelId(storeId, brandId, normalizedModelName);
    const modelRef = doc(db, 'stores', storeId, 'inventory', brandId, 'models', modelId);
    const m = await getDoc(modelRef);
    
    if (!m.exists()) {
      await setDoc(modelRef, {
        modelName: normalizedModelName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const cur = (m.data() as any)?.modelName;
      if (cur !== normalizedModelName) {
        await updateDoc(modelRef, { modelName: normalizedModelName, updatedAt: serverTimestamp() });
      }
    }
    return { brandId, modelId };
  },

  async ensureVariantPath(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    init?: { size?: string; loadIndex?: string; basePrice?: number }
  ): Promise<{ brandId: string; modelId: string; variantId: string }> {
    const bId = await resolveBrandId(storeId, brandId);
    const mId = await resolveModelId(storeId, bId, modelId);

    const vRef = doc(db, 'stores', storeId, 'inventory', bId, 'models', mId, 'variants', variantId);
    const v = await getDoc(vRef);
    
    const normalizedSize = init?.size?.trim() ?? null;
    const normalizedLoadIndex = init?.loadIndex?.trim() ?? null;

    if (!v.exists()) {
      await setDoc(vRef, {
        size: normalizedSize,
        loadIndex: normalizedLoadIndex,
        basePrice: init?.basePrice ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (init) {
        const updatePayload: any = { updatedAt: serverTimestamp() };
        if (init.size !== undefined) updatePayload.size = normalizedSize;
        if (init.loadIndex !== undefined) updatePayload.loadIndex = normalizedLoadIndex;
        if (init.basePrice !== undefined) updatePayload.basePrice = init.basePrice;
        
        if (Object.keys(updatePayload).length > 1) {
            await updateDoc(vRef, updatePayload);
        }
    }
    return { brandId: bId, modelId: mId, variantId };
  },

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

    const dRef = doc(db, 'stores', storeId, 'inventory', bId, 'models', mId, 'variants', variantId, 'dots', dotCode);
    const d = await getDoc(dRef);
    if (!d.exists()) {
      const qtyInit = Math.max(0, init?.qty ?? 0);
      await setDoc(dRef, {
        qty: qtyInit,
        promoPrice: init?.promoPrice ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (qtyInit > 0) {
        await logMovement({
          branchId: storeId,
          type: 'in',
          qtyChange: qtyInit,
          brand: bId,
          model: mId,
          variantId,
          dotCode,
          reason: 'dot.create',
        });
      }
    } else if (init) {
      const updatePayload: any = { updatedAt: serverTimestamp() };
      if (init.qty !== undefined) {
        const curQty = Number((d.data() as any)?.qty || 0);
        const newQty = Math.max(0, init.qty);
        const delta = newQty - curQty;
        updatePayload.qty = newQty;
        if (delta !== 0) {
          await logMovement({
            branchId: storeId,
            type: 'adjust',
            qtyChange: delta,
            brand: bId,
            model: mId,
            variantId,
            dotCode,
            reason: 'dot.ensure.set',
          });
        }
      }
      if (init.promoPrice !== undefined) {
        updatePayload.promoPrice = init.promoPrice;
      }
      if (Object.keys(updatePayload).length > 1) {
        await updateDoc(dRef, updatePayload);
      }
    }
  },

  /* ---------- Read: inventory ---------- */

  async fetchStoreInventory(
    storeId: string,
    storeName?: string,
    options?: { includeZeroAndEmpty?: boolean }
  ): Promise<GroupedProduct[]> {
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
            .filter((d) => (options?.includeZeroAndEmpty ? true : d.qty > 0));

          if (dots.length > 0 || options?.includeZeroAndEmpty) {
            sizes.push({
              variantId,
              specification,
              basePrice,
              dots,
            });
          }
        }

        if (sizes.length > 0 || options?.includeZeroAndEmpty) {
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

  async fetchInventory(): Promise<GroupedProduct[]> {
    throw new Error('InventoryService.fetchInventory() has been deprecated. Use fetchInventoryFor(allowedBranchIds) instead.');
  },

  async fetchInventoryFor(branchIds: string[]): Promise<GroupedProduct[]> {
    if (!branchIds?.length) return [];

    const productMap = new Map<string, GroupedProduct>();

    for (const sId of branchIds) {
      let storeName = sId;
      try {
        const s = await StoreService.getStore(sId);
        if (s?.branchName) storeName = s.branchName;
      } catch {
        /* ignore */
      }

      try {
        const storeProducts = await this.fetchStoreInventory(sId, storeName);
        for (const p of storeProducts) {
          if (productMap.has(p.id)) {
            productMap.get(p.id)!.branches.push(...p.branches);
          } else {
            productMap.set(p.id, { ...p });
          }
        }
      } catch {
        // Could not read this branch, skip.
      }
    }

    return Array.from(productMap.values());
  },

  async getNetworkInventory(currentBranchId: string, allBranches: Branch[]): Promise<GroupedProduct[]> {
    if (!currentBranchId || !allBranches || allBranches.length === 0) {
      return [];
    }

    const otherBranchIds = allBranches.map((b) => b.id).filter((id) => id !== currentBranchId);
    if (otherBranchIds.length === 0) return [];

    return this.fetchInventoryFor(otherBranchIds);
  },

  parseProductInfo(product: GroupedProduct, branchId: string, variantId: string, dotCode: string) {
    const parts = (product.id || '').split('-');
    const brandId = parts[0] || product.brand || '';
    const modelId = parts.slice(1).join('-') || product.model || 'unknown';
    return { storeId: branchId, brandId, modelId, variantId, dotCode };
  },

  async getVariantsForProduct(
    storeId: string,
    brandId: string,
    modelId: string
  ): Promise<Array<{ variantId: string; specification: string; basePrice?: number }>> {
    const bId = await resolveBrandId(storeId, brandId);
    const mId = await resolveModelId(storeId, bId, modelId);

    const vRef = collection(db, 'stores', storeId, 'inventory', bId, 'models', mId, 'variants');
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

  /* ---------- Write: qty / price / dot (canonical) + LOG ---------- */

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

    const dotRef = doc(db, 'stores', storeId, 'inventory', bId, 'models', mId, 'variants', variantId, 'dots', dotCode);
    const snap = await getDoc(dotRef);
    if (!snap.exists()) throw new Error(`DOT ${dotCode} not found`);

    await updateDoc(dotRef, {
      qty: increment(qtyChange),
      updatedAt: serverTimestamp(),
    });

    await logMovement({
      branchId: storeId,
      type: qtyChange >= 0 ? 'in' : 'out',
      qtyChange,
      brand: bId,
      model: mId,
      variantId,
      dotCode,
      reason: 'manual.adjust',
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

    const vRef = doc(db, 'stores', storeId, 'inventory', bId, 'models', mId, 'variants', variantId);
    const vSnap = await getDoc(vRef);
    if (!vSnap.exists()) throw new Error(`Variant ${variantId} not found`);

    const dRef = doc(vRef, 'dots', payload.dotCode);
    const dSnap = await getDoc(dRef);
    if (dSnap.exists()) throw new Error(`DOT ${payload.dotCode} already exists`);

    const qtyInit = Math.max(0, Number(payload.qty) || 0);
    await setDoc(dRef, {
      qty: qtyInit,
      promoPrice: payload.promoPrice ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (qtyInit > 0) {
      await logMovement({
        branchId: storeId,
        type: 'in',
        qtyChange: qtyInit,
        brand: bId,
        model: mId,
        variantId,
        dotCode: payload.dotCode,
        reason: 'dot.create',
      });
    }
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

    const dRef = doc(db, 'stores', storeId, 'inventory', bId, 'models', mId, 'variants', variantId, 'dots', dotCode);
    const d = await getDoc(dRef);
    if (!d.exists()) throw new Error(`DOT ${dotCode} not found`);
    await updateDoc(dRef, {
      promoPrice: promoPrice ?? null,
      updatedAt: serverTimestamp(),
    });

    await logMovement({
      branchId: storeId,
      type: 'adjust',
      qtyChange: 0,
      brand: bId,
      model: mId,
      variantId,
      dotCode,
      reason: 'price.promo.set',
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

    const dRef = doc(db, 'stores', storeId, 'inventory', bId, 'models', mId, 'variants', variantId, 'dots', dotCode);
    const d = await getDoc(dRef);
    if (!d.exists()) throw new Error(`DOT ${dotCode} not found`);

    const curQty = Number((d.data() as any)?.qty || 0);
    if (curQty !== 0) {
      await logMovement({
        branchId: storeId,
        type: 'adjust',
        qtyChange: -curQty,
        brand: bId,
        model: mId,
        variantId,
        dotCode,
        reason: 'dot.delete',
      });
    }

    await deleteDoc(dRef);
  },

  async updateProductMeta(
    storeId: string,
    brandId: string,
    modelId: string,
    updates: { brandName?: string; modelName?: string }
  ): Promise<void> {
    const bId = await resolveBrandId(storeId, brandId);
    const mId = await resolveModelId(storeId, bId, modelId);

    if (updates.brandName) {
      const normalizedBrandName = updates.brandName.trim();
      if(normalizedBrandName) {
        const bRef = doc(db, 'stores', storeId, 'inventory', bId);
        await updateDoc(bRef, {
          brandName: normalizedBrandName,
          updatedAt: serverTimestamp(),
        });
      }
    }
    if (updates.modelName) {
        const normalizedModelName = updates.modelName.trim();
        if(normalizedModelName) {
            const mRef = doc(db, 'stores', storeId, 'inventory', bId, 'models', mId);
            await updateDoc(mRef, {
                modelName: normalizedModelName,
                updatedAt: serverTimestamp(),
            });
        }
    }
  },

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

    const vCol = collection(db, 'stores', storeId, 'inventory', bId, 'models', mId, 'variants');
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
 * Order Service — canonical IDs + LOG
 * =======================*/
export const OrderService = {
  async createOrder(payload: {
    buyerBranchId: string;
    buyerBranchName: string;
    sellerBranchId: string;
    sellerBranchName: string;
    items: OrderItem[];
    notes?: string;
  }): Promise<string> {
    const itemCount = payload.items.reduce((sum, item) => sum + item.quantity, 0);

    const orderData = {
      ...payload,
      items: payload.items.map(({ unitPrice, totalPrice, ...item }) => item),
      totalAmount: 0,
      itemCount,
      status: 'requested' as OrderStatus,
      orderNumber: `TR-${Date.now().toString().slice(-6)}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'orders'), orderData);

    await logOrderEvent({
      branchId: payload.sellerBranchId,
      orderId: ref.id,
      eventType: 'order.requested',
    });
    await logOrderEvent({
      branchId: payload.buyerBranchId,
      orderId: ref.id,
      eventType: 'order.requested',
    });

    await NotificationService.createNotification({
      branchId: payload.sellerBranchId,
      title: 'New Transfer Request',
      message: `Request from ${payload.buyerBranchName} for ${itemCount} items.`,
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

  onOrdersByBranch(branchId: string, role: 'buyer' | 'seller', callback: (orders: Order[]) => void) {
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

  /* ---------- Status transitions + LOG ---------- */
  async approveTransfer(orderId: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Order not found');

    const order = snap.data() as Order;
    if (order.status !== 'requested' && order.status !== 'confirmed') {
      throw new Error('Can only approve requested orders');
    }
    await updateDoc(ref, { status: 'approved', updatedAt: serverTimestamp() });

    await logOrderEvent({ branchId: order.sellerBranchId, orderId, eventType: 'order.approved' });
    await logOrderEvent({ branchId: order.buyerBranchId, orderId, eventType: 'order.approved' });

    await NotificationService.createNotification({
      branchId: order.buyerBranchId,
      title: 'Request Approved',
      message: `Your request #${orderId.slice(0, 6)} has been approved by ${order.sellerBranchName}.`,
      orderId,
      link: `/?view=transfer_requests`,
    });
  },

  async rejectTransfer(orderId: string, reason?: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Order not found');

    const order = snap.data() as Order;
    if (order.status !== 'requested' && order.status !== 'approved' && order.status !== 'confirmed') {
      throw new Error('Can only reject requested/approved orders');
    }

    await updateDoc(ref, { status: 'rejected', cancelReason: reason ?? null, updatedAt: serverTimestamp() });

    await logOrderEvent({ branchId: order.sellerBranchId, orderId, eventType: 'order.rejected', reason });
    await logOrderEvent({ branchId: order.buyerBranchId, orderId, eventType: 'order.rejected', reason });

    await NotificationService.createNotification({
      branchId: order.buyerBranchId,
      title: 'Request Rejected',
      message: `Your request #${orderId.slice(0, 6)} was rejected by ${order.sellerBranchName}.`,
      orderId,
      link: `/?view=transfer_requests`,
    });
  },

  async shipTransfer(orderId: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(ref);
    if (!orderSnap.exists()) throw new Error('Order not found');

    const order = orderSnap.data() as Order;

    if (order.status !== 'approved' && order.status !== 'confirmed') {
      if (order.status === 'shipped' || order.status === 'delivered') return;
      throw new Error('Can only ship approved orders');
    }

    for (const item of order.items) {
      const parsed = InventoryService.parseProductInfo(
        { id: item.productId } as any,
        order.sellerBranchId,
        item.variantId,
        item.dotCode
      );

      const { brandId: bId, modelId: mId } = await resolveCanonicalIds(order.sellerBranchId, parsed.brandId, parsed.modelId);

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
        tx.update(dotRef, { qty: increment(-item.quantity), updatedAt: serverTimestamp() });
      });

      await logMovement({
        branchId: order.sellerBranchId,
        type: 'transfer_out',
        qtyChange: -item.quantity,
        brand: bId,
        model: mId,
        variantId: item.variantId,
        dotCode: item.dotCode,
        orderId,
        reason: `Transfer to ${order.buyerBranchName}`,
      });
    }

    await updateDoc(ref, { status: 'shipped', updatedAt: serverTimestamp() });

    await logOrderEvent({ branchId: order.sellerBranchId, orderId, eventType: 'order.shipped' });
    await logOrderEvent({ branchId: order.buyerBranchId, orderId, eventType: 'order.shipped' });

    await NotificationService.createNotification({
      branchId: order.buyerBranchId,
      title: 'Order Shipped',
      message: `Order #${orderId.slice(0, 6)} from ${order.sellerBranchName} is on its way.`,
      orderId,
      link: `/?view=transfer_requests`,
    });
  },

  async receiveTransfer(orderId: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(ref);
    if (!orderSnap.exists()) throw new Error('Order not found');

    const order = orderSnap.data() as Order;

    if (order.status !== 'shipped' && order.status !== 'delivered') {
      if (order.status === 'received') return;
      throw new Error('Can only receive shipped orders');
    }

    for (const item of order.items) {
      const nameParts = item.productName.split(' ');
      const brandName = nameParts[0] || 'Unknown';
      const modelName = nameParts.slice(1).join(' ') || 'Unknown';

      const specMatch = item.specification.match(/^(.*?)\s*\((.*?)\)$/);
      let size = item.specification.trim();
      let loadIndex = '';
      if (specMatch) {
        size = specMatch[1].trim();
        loadIndex = specMatch[2].trim();
      }

      const { brandId, modelId } = await InventoryService.ensureModelDoc(order.buyerBranchId, brandName, modelName);

      await InventoryService.ensureVariantPath(order.buyerBranchId, brandId, modelId, item.variantId, {
        size,
        loadIndex,
        basePrice: 0,
      });

      await InventoryService.ensureDotDoc(order.buyerBranchId, brandId, modelId, item.variantId, item.dotCode);

      await InventoryService.adjustDotQuantity(
        order.buyerBranchId,
        brandId,
        modelId,
        item.variantId,
        item.dotCode,
        item.quantity
      );

      await logMovement({
        branchId: order.buyerBranchId,
        type: 'transfer_in',
        qtyChange: item.quantity,
        brand: brandId,
        model: modelId,
        variantId: item.variantId,
        dotCode: item.dotCode,
        orderId,
        reason: `Transfer from ${order.sellerBranchName}`,
      });
    }

    await updateDoc(ref, { status: 'received', updatedAt: serverTimestamp() });

    await logOrderEvent({ branchId: order.buyerBranchId, orderId, eventType: 'order.received' });
    await logOrderEvent({ branchId: order.sellerBranchId, orderId, eventType: 'order.received' });

    await NotificationService.createNotification({
      branchId: order.sellerBranchId,
      title: 'Order Received',
      message: `${order.buyerBranchName} has confirmed receiving order #${orderId.slice(0, 6)}.`,
      orderId,
      link: `/?view=transfer_requests`,
    });
  },

  async deliverTransfer(orderId: string): Promise<void> {
    return this.shipTransfer(orderId);
  },

  async cancelTransfer(orderId: string, reason?: string): Promise<void> {
    const ref = doc(db, 'orders', orderId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Order not found');

    const order = snap.data() as Order;
    if (order.status !== 'requested' && order.status !== 'approved' && order.status !== 'confirmed') {
      throw new Error('Can only cancel orders that are not shipped yet');
    }
    await updateDoc(ref, { status: 'cancelled', cancelReason: reason ?? null, updatedAt: serverTimestamp() });

    await logOrderEvent({ branchId: order.buyerBranchId, orderId, eventType: 'order.cancelled', reason: reason ?? null });
    await logOrderEvent({ branchId: order.sellerBranchId, orderId, eventType: 'order.cancelled', reason: reason ?? null });

    await NotificationService.createNotification({
      branchId: order.sellerBranchId,
      title: 'Request Cancelled',
      message: `Request #${orderId.slice(0, 6)} from ${order.buyerBranchName} has been cancelled.`,
      orderId,
      link: `/?view=transfer_requests`,
    });
  },
};

/* =========================
 * Export default
 * =======================*/
export default {
  StoreService,
  InventoryService,
  OrderService,
  NotificationService,
  // utils
  slugifyId,
  ensureArray,
};
