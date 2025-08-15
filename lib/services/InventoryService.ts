// lib/services/InventoryService.ts - Complete Final Version with Fixed OrderService
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  increment,
  addDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ===== Types for Your Data Structure =====
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

// For compatibility with existing UI components
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
  id: string; // brand-model format
  name: string; // brandName + modelName
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
  cancelReason?: string;
};

// Store document type
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

// ===== Helper Functions =====
function slugifyId(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 120);
}

function ensureArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// ===== Store Service =====
export const StoreService = {
  /**
   * ดึงรายการ stores ทั้งหมด
   */
  async getAllStores(): Promise<Record<string, string>> {
    try {
      const snap = await getDocs(collection(db, 'stores'));
      const out: Record<string, string> = {};
      snap.forEach((d) => {
        const data = d.data() as any;
        out[d.id] = data.branchName ?? d.id;
      });
      return out;
    } catch (error) {
      console.error('❌ Error getting all stores:', error);
      throw error;
    }
  },

  /**
   * ตรวจสอบว่า store ID ใช้ได้ไหม
   */
  async isStoreIdAvailable(storeId: string): Promise<boolean> {
    try {
      const ref = doc(db, 'stores', storeId);
      const ds = await getDoc(ref);
      return !ds.exists();
    } catch (error) {
      console.error('❌ Error checking store availability:', error);
      return false;
    }
  },

  /**
   * สร้าง store ใหม่
   */
  async createStore(storeId: string, payload: StoreDoc): Promise<void> {
    try {
      const ref = doc(db, 'stores', storeId);
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`✅ Created store: ${storeId}`);
    } catch (error) {
      console.error(`❌ Error creating store ${storeId}:`, error);
      throw error;
    }
  },

  /**
   * อัปเดต store
   */
  async updateStore(storeId: string, patch: Partial<StoreDoc>): Promise<void> {
    try {
      const ref = doc(db, 'stores', storeId);
      await updateDoc(ref, { 
        ...patch, 
        updatedAt: serverTimestamp() 
      });
      console.log(`✅ Updated store: ${storeId}`);
    } catch (error) {
      console.error(`❌ Error updating store ${storeId}:`, error);
      throw error;
    }
  },

  /**
   * ดึงข้อมูล store เฉพาะ
   */
  async getStore(storeId: string): Promise<StoreDoc | null> {
    try {
      const ref = doc(db, 'stores', storeId);
      const ds = await getDoc(ref);
      if (ds.exists()) {
        return { ...ds.data() } as StoreDoc;
      }
      return null;
    } catch (error) {
      console.error(`❌ Error getting store ${storeId}:`, error);
      throw error;
    }
  },
};

// ===== Main Inventory Service =====
export const InventoryService = {
  /**
   * ดึง inventory ของสาขาเฉพาะ (รองรับโครงสร้างใหม่)
   */
  async fetchStoreInventory(storeId: string, storeName?: string): Promise<GroupedProduct[]> {
    console.log(`🔍 Fetching inventory for store: ${storeId}`);
    
    try {
      const storeRef = doc(db, 'stores', storeId);
      const inventoryRef = collection(storeRef, 'inventory');
      
      // ดึงข้อมูล brands ทั้งหมด
      const brandsSnap = await getDocs(inventoryRef);
      console.log(`📋 Found ${brandsSnap.docs.length} brands in ${storeId}`);
      
      if (brandsSnap.empty) {
        console.log(`⚠️ No inventory data found for store: ${storeId}`);
        return [];
      }
      
      const products: GroupedProduct[] = [];
      
      for (const brandDoc of brandsSnap.docs) {
        const brandId = brandDoc.id;
        const brandData = brandDoc.data();
        const brandName = brandData.brandName || brandId;
        
        console.log(`🏷️ Processing brand: ${brandName}`);
        
        // ดึงข้อมูล models ของ brand นี้
        const modelsRef = collection(brandDoc.ref, 'models');
        const modelsSnap = await getDocs(modelsRef);
        
        for (const modelDoc of modelsSnap.docs) {
          const modelId = modelDoc.id;
          const modelData = modelDoc.data();
          const modelName = modelData.modelName || modelId;
          
          console.log(`🚗 Processing model: ${modelName}`);
          
          // ดึงข้อมูล variants ของ model นี้
          const variantsRef = collection(modelDoc.ref, 'variants');
          const variantsSnap = await getDocs(variantsRef);
          
          const sizes: SizeVariant[] = [];
          
          for (const variantDoc of variantsSnap.docs) {
            const variantData = variantDoc.data();
            const variantId = variantDoc.id;
            const size = variantData.size || '';
            const loadIndex = variantData.loadIndex || '';
            const basePrice = variantData.basePrice || 0;
            
            // สร้าง specification จาก size + loadIndex
            const specification = loadIndex ? `${size} (${loadIndex})` : size;
            
            console.log(`📏 Processing variant: ${specification}`);
            
            // ดึงข้อมูล dots ของ variant นี้
            const dotsRef = collection(variantDoc.ref, 'dots');
            const dotsSnap = await getDocs(dotsRef);
            
            const dots = dotsSnap.docs.map(dotDoc => {
              const dotData = dotDoc.data();
              return {
                dotCode: dotDoc.id,
                qty: dotData.qty || 0,
                basePrice: basePrice,
                promoPrice: dotData.promoPrice || null,
              };
            }).filter(dot => dot.qty > 0); // เฉพาะ dots ที่มีสต็อก
            
            if (dots.length > 0) {
              sizes.push({
                variantId,
                specification,
                dots,
              });
            }
          }
          
          // สร้าง GroupedProduct สำหรับ brand+model นี้
          if (sizes.length > 0) {
            const productId = `${brandId}-${modelId}`;
            const productName = `${brandName} ${modelName}`;
            
            products.push({
              id: productId,
              name: productName,
              brand: brandName,
              model: modelName,
              branches: [{
                branchId: storeId,
                branchName: storeName || storeId,
                sizes,
              }],
            });
          }
        }
      }
      
      console.log(`✅ Processed ${products.length} products for store ${storeId}`);
      return products;
      
    } catch (error) {
      console.error(`❌ Error fetching inventory for store ${storeId}:`, error);
      throw error;
    }
  },

  /**
   * ดึง inventory ของทุกสาขา (สำหรับ Transfer Platform)
   */
  async fetchInventory(): Promise<GroupedProduct[]> {
    console.log('🔍 Fetching inventory from all stores...');
    
    try {
      // ดึงรายการ stores ทั้งหมด
      const storesSnap = await getDocs(collection(db, 'stores'));
      console.log(`📋 Found ${storesSnap.docs.length} stores`);
      
      if (storesSnap.empty) {
        console.log('⚠️ No stores found');
        return [];
      }
      
      const productMap = new Map<string, GroupedProduct>(); // key = brand-model
      
      for (const storeDoc of storesSnap.docs) {
        const storeId = storeDoc.id;
        const storeData = storeDoc.data();
        const storeName = storeData.branchName || storeId;
        
        console.log(`🏪 Processing store: ${storeName}`);
        
        try {
          // ดึง inventory ของ store นี้
          const storeProducts = await this.fetchStoreInventory(storeId, storeName);
          
          // รวม products ที่มี brand+model เดียวกัน
          for (const product of storeProducts) {
            const key = product.id; // brand-model
            
            if (productMap.has(key)) {
              // เพิ่ม branch ใหม่เข้าไปใน product ที่มีอยู่แล้ว
              const existing = productMap.get(key)!;
              existing.branches.push(...product.branches);
            } else {
              // สร้าง product ใหม่
              productMap.set(key, { ...product });
            }
          }
        } catch (storeError) {
          console.warn(`⚠️ Failed to fetch inventory for store ${storeId}:`, storeError);
          // ข้าม store นี้และดำเนินการต่อ
        }
      }
      
      const result = Array.from(productMap.values());
      console.log(`✅ Total unique products: ${result.length}`);
      return result;
      
    } catch (error) {
      console.error('❌ Error fetching all inventory:', error);
      throw error;
    }
  },

  /**
   * อัปเดตจำนวน DOT
   */
  async updateDotQuantity(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string,
    newQty: number
  ): Promise<void> {
    console.log(`🔄 Updating DOT quantity: ${storeId}/${brandId}/${modelId}/${variantId}/${dotCode} = ${newQty}`);
    
    try {
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
      
      console.log(`✅ Updated DOT quantity successfully`);
    } catch (error) {
      console.error('❌ Error updating DOT quantity:', error);
      throw error;
    }
  },

  /**
   * เพิ่ม/ลด จำนวน DOT
   */
  async adjustDotQuantity(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string,
    qtyChange: number
  ): Promise<void> {
    console.log(`📊 Adjusting DOT quantity: ${dotCode} by ${qtyChange}`);
    
    try {
      const dotRef = doc(
        db,
        'stores', storeId,
        'inventory', brandId,
        'models', modelId,
        'variants', variantId,
        'dots', dotCode
      );
      
      // ตรวจสอบว่า DOT นี้มีอยู่ไหม
      const dotDoc = await getDoc(dotRef);
      if (!dotDoc.exists()) {
        throw new Error(`DOT ${dotCode} not found`);
      }
      
      await updateDoc(dotRef, {
        qty: increment(qtyChange),
        updatedAt: serverTimestamp(),
      });
      
      console.log(`✅ Adjusted DOT quantity by ${qtyChange}`);
    } catch (error) {
      console.error('❌ Error adjusting DOT quantity:', error);
      throw error;
    }
  },

  /**
   * ตั้งราคาโปรโมชั่น
   */
  async setPromoPrice(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string,
    promoPrice: number | null
  ): Promise<void> {
    console.log(`💰 Setting promo price: ${dotCode} = ${promoPrice}`);
    
    try {
      const dotRef = doc(
        db,
        'stores', storeId,
        'inventory', brandId,
        'models', modelId,
        'variants', variantId,
        'dots', dotCode
      );
      
      // ตรวจสอบว่า DOT นี้มีอยู่ไหม
      const dotDoc = await getDoc(dotRef);
      if (!dotDoc.exists()) {
        throw new Error(`DOT ${dotCode} not found`);
      }
      
      const updateData: any = {
        updatedAt: serverTimestamp(),
      };
      
      if (promoPrice !== null) {
        updateData.promoPrice = promoPrice;
      } else {
        // ลบ field promoPrice โดยใส่ null
        updateData.promoPrice = null;
      }
      
      await updateDoc(dotRef, updateData);
      
      console.log(`✅ Updated promo price successfully`);
    } catch (error) {
      console.error('❌ Error setting promo price:', error);
      throw error;
    }
  },

  /**
   * เพิ่ม DOT ใหม่
   */
  async addNewDot(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string,
    qty: number,
    promoPrice?: number
  ): Promise<void> {
    console.log(`➕ Adding new DOT: ${dotCode}`);
    
    try {
      // ตรวจสอบว่า variant มีอยู่ไหม
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
      
      // ตรวจสอบว่า DOT นี้มีอยู่แล้วไหม
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
      
      await setDoc(dotRef, dotData);
      
      console.log(`✅ Added DOT successfully`);
    } catch (error) {
      console.error('❌ Error adding DOT:', error);
      throw error;
    }
  },

  /**
   * ลบ DOT
   */
  async deleteDot(
    storeId: string,
    brandId: string,
    modelId: string,
    variantId: string,
    dotCode: string
  ): Promise<void> {
    console.log(`🗑️ Deleting DOT: ${dotCode}`);
    
    try {
      const dotRef = doc(
        db,
        'stores', storeId,
        'inventory', brandId,
        'models', modelId,
        'variants', variantId,
        'dots', dotCode
      );
      
      // ตรวจสอบว่า DOT มีอยู่ไหม
      const dotDoc = await getDoc(dotRef);
      if (!dotDoc.exists()) {
        throw new Error(`DOT ${dotCode} not found`);
      }
      
      await deleteDoc(dotRef);
      
      console.log(`✅ Deleted DOT successfully`);
    } catch (error) {
      console.error('❌ Error deleting DOT:', error);
      throw error;
    }
  },

  /**
   * ดึงรายการ variants ของ product
   */
  async getVariantsForProduct(
    storeId: string,
    brandId: string,
    modelId: string
  ): Promise<Array<{variantId: string, specification: string}>> {
    console.log(`🔍 Getting variants for: ${brandId}/${modelId}`);
    
    try {
      const variantsRef = collection(
        db,
        'stores', storeId,
        'inventory', brandId,
        'models', modelId,
        'variants'
      );
      
      const variantsSnap = await getDocs(variantsRef);
      
      if (variantsSnap.empty) {
        console.log(`⚠️ No variants found for ${brandId}/${modelId}`);
        return [];
      }
      
      return variantsSnap.docs.map(doc => {
        const data = doc.data();
        const size = data.size || '';
        const loadIndex = data.loadIndex || '';
        const specification = loadIndex ? `${size} (${loadIndex})` : size;
        
        return {
          variantId: doc.id,
          specification,
        };
      });
    } catch (error) {
      console.error('❌ Error getting variants:', error);
      return [];
    }
  },

  /**
   * Helper: แยก brand, model, variant จาก product path ที่ UI ส่งมา
   */
  parseProductInfo(product: GroupedProduct, branchId: string, variantId: string, dotCode: string) {
    // จาก product.id format: "brand-model"
    const parts = product.id.split('-');
    const brandId = parts[0] || slugifyId(product.brand);
    const modelId = parts.slice(1).join('-') || slugifyId(product.model || 'unknown');
    
    return {
      storeId: branchId,
      brandId,
      modelId,
      variantId,
      dotCode,
    };
  },

  /**
   * สร้าง stock movement (สำหรับ logging)
   */
  async createStockMovement(
    storeId: string,
    target: { brand: string; model?: string; variantId: string; dotCode: string },
    type: StockMovementType,
    qtyChange: number,
    meta?: { reason?: string }
  ): Promise<void> {
    console.log(`📝 Creating stock movement: ${type} ${qtyChange} for ${target.dotCode}`);
    
    try {
      // ใช้ adjustDotQuantity แทน เพราะโครงสร้างข้อมูลเปลี่ยน
      const brandId = slugifyId(target.brand);
      const modelId = slugifyId(target.model || 'unknown');
      
      await this.adjustDotQuantity(storeId, brandId, modelId, target.variantId, target.dotCode, qtyChange);
      
      // เพิ่ม logging ใน subcollection movements (optional)
      try {
        const movementData: StockMovement = {
          branchId: storeId,
          brand: target.brand,
          model: target.model || '',
          variantId: target.variantId,
          dotCode: target.dotCode,
          qtyChange,
          type,
          reason: meta?.reason,
          createdAt: serverTimestamp() as any,
        };
        
        await addDoc(collection(db, 'stockMovements'), movementData);
      } catch (logError) {
        console.warn('⚠️ Failed to log stock movement:', logError);
        // ไม่ throw error เพราะส่วนหลักสำเร็จแล้ว
      }
      
      console.log(`✅ Stock movement completed`);
    } catch (error) {
      console.error('❌ Error creating stock movement:', error);
      throw error;
    }
  },

  /**
   * ค้นหาสินค้าด้วย brand และ model
   */
  async findProductByBrandModel(brand: string, model?: string): Promise<string | null> {
    try {
      const brandId = slugifyId(brand);
      const modelId = slugifyId(model || 'unknown');
      return `${brandId}-${modelId}`;
    } catch (error) {
      console.error('❌ Error finding product:', error);
      return null;
    }
  },

  /**
   * สร้าง product ใหม่ (ถ้าจำเป็น)
   */
  async ensureProduct(brand: string, model: string): Promise<string> {
    const brandId = slugifyId(brand);
    const modelId = slugifyId(model);
    const productId = `${brandId}-${modelId}`;
    
    // ในโครงสร้างใหม่ไม่ต้องสร้าง product document แยก
    // เพราะข้อมูลอยู่ใน store/inventory structure แล้ว
    
    return productId;
  },

  /**
   * Upsert DOT (สำหรับ legacy compatibility)
   */
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
      // ลองอัปเดตก่อน ถ้าไม่มีจะ error แล้วสร้างใหม่
      await this.updateDotQuantity(branchId, brandId, modelId, payload.variantId, payload.dotCode, payload.qty);
      
      // ตั้งราคาโปรถ้ามี
      if (payload.promoPrice !== undefined) {
        await this.setPromoPrice(branchId, brandId, modelId, payload.variantId, payload.dotCode, payload.promoPrice);
      }
    } catch (error) {
      // ถ้าไม่พบ DOT ให้สร้างใหม่
      if (error instanceof Error && error.message.includes('not found')) {
        await this.addNewDot(branchId, brandId, modelId, payload.variantId, payload.dotCode, payload.qty, payload.promoPrice);
      } else {
        throw error;
      }
    }
  },
};

// ===== Order Service ===== (Fixed Version)
export const OrderService = {
  /**
   * สร้าง order ใหม่
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
  }): Promise<string> {
    try {
      const orderData = {
        ...payload,
        orderNumber: `TR-${Date.now().toString().slice(-6)}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, 'orders'), orderData);
      console.log(`✅ Created order: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating order:', error);
      throw error;
    }
  },

  /**
   * ดึง orders ของสาขา - ใช้ query แบบง่าย
   */
  async getOrdersByBranch(branchId: string, role: 'buyer' | 'seller'): Promise<Order[]> {
    try {
      const field = role === 'buyer' ? 'buyerBranchId' : 'sellerBranchId';
      
      // ใช้ query แบบง่าย - เฉพาะ where clause เดียว
      const q = query(
        collection(db, 'orders'),
        where(field, '==', branchId)
      );
      
      const snap = await getDocs(q);
      const orders = snap.docs.map((d) => ({ 
        id: d.id, 
        ...(d.data() as any) 
      })) as Order[];
      
      // Sort ใน JavaScript แทน Firestore
      orders.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime; // newest first
      });
      
      return orders;
    } catch (error) {
      console.error(`❌ Error getting orders for ${role} ${branchId}:`, error);
      
      // Fallback: ดึงทั้งหมดแล้วกรองใน JavaScript
      try {
        console.log('🔄 Fallback: Getting all orders and filtering locally...');
        const allOrdersSnap = await getDocs(collection(db, 'orders'));
        const allOrders = allOrdersSnap.docs.map((d) => ({ 
          id: d.id, 
          ...(d.data() as any) 
        })) as Order[];
        
        const field = role === 'buyer' ? 'buyerBranchId' : 'sellerBranchId';
        const filtered = allOrders.filter((order) => 
          order[field] === branchId
        );
        
        // Sort by date
        filtered.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        
        return filtered;
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        return [];
      }
    }
  },

  /**
   * อนุมัติการโอนย้าย
   */
  async approveTransfer(orderId: string): Promise<void> {
    try {
      const ref = doc(db, 'orders', orderId);
      await updateDoc(ref, { 
        status: 'confirmed', 
        updatedAt: serverTimestamp() 
      });
      console.log(`✅ Approved transfer: ${orderId}`);
    } catch (error) {
      console.error(`❌ Error approving transfer ${orderId}:`, error);
      throw error;
    }
  },

  /**
   * ปฏิเสธการโอนย้าย
   */
  async rejectTransfer(orderId: string, reason?: string): Promise<void> {
    try {
      const ref = doc(db, 'orders', orderId);
      await updateDoc(ref, {
        status: 'cancelled',
        cancelReason: reason || null,
        updatedAt: serverTimestamp(),
      });
      console.log(`✅ Rejected transfer: ${orderId}`);
    } catch (error) {
      console.error(`❌ Error rejecting transfer ${orderId}:`, error);
      throw error;
    }
  },

  /**
   * Subscribe to orders (realtime) - ใช้ query แบบง่าย
   */
  onOrdersByBranch(
    branchId: string,
    role: 'buyer' | 'seller',
    callback: (orders: Order[]) => void
  ) {
    const field = role === 'buyer' ? 'buyerBranchId' : 'sellerBranchId';
    
    // ใช้ query แบบง่าย - เฉพาะ where clause เดียว
    const q = query(
      collection(db, 'orders'),
      where(field, '==', branchId)
    );
    
    return onSnapshot(q, (snap) => {
      const orders = snap.docs.map((d) => ({ 
        id: d.id, 
        ...(d.data() as any) 
      })) as Order[];
      
      // Sort ใน JavaScript
      orders.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      
      callback(orders);
    }, (error) => {
      console.error('❌ Realtime orders error:', error);
      
      // Fallback: ใช้ polling แทน realtime
      console.log('🔄 Falling back to simple query...');
      OrderService.getOrdersByBranch(branchId, role)
        .then(callback)
        .catch((err) => {
          console.error('❌ Fallback failed:', err);
          callback([]); // คืนค่า array ว่าง
        });
    });
  },
};

// ===== Legacy Support Functions =====

/**
 * หา productId จาก brand+model (เพื่อ backward compatibility)
 */
async function findProductIdByBrandModel(brand: string, model?: string): Promise<string | null> {
  try {
    const brandId = slugifyId(brand);
    const modelId = slugifyId(model || 'unknown');
    return `${brandId}-${modelId}`;
  } catch (error) {
    console.error('❌ Error finding product ID:', error);
    return null;
  }
}

/**
 * Export legacy function for backward compatibility
 */
export { findProductIdByBrandModel };

// ===== Utility Functions =====

/**
 * สำหรับ debug และทดสอบการเชื่อมต่อ
 */
export const InventoryTestUtils = {
  /**
   * ทดสอบการเขียน/อ่านข้อมูล
   */
  async testConnection(storeId: string): Promise<boolean> {
    try {
      const testRef = doc(db, 'stores', storeId, 'test', 'connection');
      
      // เขียนข้อมูลทดสอบ
      await setDoc(testRef, {
        message: 'Connection test',
        timestamp: serverTimestamp(),
      });
      
      // อ่านข้อมูลกลับมา
      const testDoc = await getDoc(testRef);
      const success = testDoc.exists();
      
      // ลบข้อมูลทดสอบ
      if (success) {
        await deleteDoc(testRef);
      }
      
      return success;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  },

  /**
   * นับจำนวนข้อมูลในสต็อก
   */
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
      
      let brands = 0;
      let models = 0;
      let variants = 0;
      let dots = 0;
      let totalQty = 0;
      
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
              totalQty += dotData.qty || 0;
            }
          }
        }
      }
      
      return { brands, models, variants, dots, totalQty };
    } catch (error) {
      console.error('❌ Error counting inventory:', error);
      return { brands: 0, models: 0, variants: 0, dots: 0, totalQty: 0 };
    }
  },

  /**
   * ดึงข้อมูลสรุป inventory
   */
  async getInventorySummary(storeId: string): Promise<Array<{
    brand: string;
    model: string;
    variants: number;
    totalQty: number;
    totalDots: number;
  }>> {
    try {
      const summary: Array<{
        brand: string;
        model: string;
        variants: number;
        totalQty: number;
        totalDots: number;
      }> = [];
      
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
          
          let variants = 0;
          let totalQty = 0;
          let totalDots = 0;
          
          const variantsRef = collection(modelDoc.ref, 'variants');
          const variantsSnap = await getDocs(variantsRef);
          
          for (const variantDoc of variantsSnap.docs) {
            variants++;
            
            const dotsRef = collection(variantDoc.ref, 'dots');
            const dotsSnap = await getDocs(dotsRef);
            
            for (const dotDoc of dotsSnap.docs) {
              totalDots++;
              const dotData = dotDoc.data();
              totalQty += dotData.qty || 0;
            }
          }
          
          if (variants > 0) {
            summary.push({
              brand: brandName,
              model: modelName,
              variants,
              totalQty,
              totalDots,
            });
          }
        }
      }
      
      return summary.sort((a, b) => b.totalQty - a.totalQty);
    } catch (error) {
      console.error('❌ Error getting inventory summary:', error);
      return [];
    }
  },
};

// ===== Export All =====
export default {
  StoreService,
  InventoryService,
  OrderService,
  InventoryTestUtils,
  // Helper functions
  slugifyId,
  ensureArray,
  findProductIdByBrandModel,
};