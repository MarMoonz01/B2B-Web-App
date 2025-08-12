// lib/services/inventoryService.ts

import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  getDoc,
  query,
  where,
  DocumentData,
  writeBatch,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ==================== TYPE DEFINITIONS ====================
export interface DotDetail {
  dotCode: string;
  qty: number;
  basePrice: number;
  promoPrice?: number;
}

export interface SizeDetail {
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

// ==================== STORE MANAGEMENT ====================
export class StoreService {
  static async getAllStores(): Promise<Record<string, string>> {
    const storesCollection = await getDocs(collection(db, 'stores'));
    const storeMap: Record<string, string> = {};
    storesCollection.docs.forEach(doc => {
      storeMap[doc.id] = doc.data().branchName || doc.id;
    });
    return storeMap;
  }

  static async getStoreInfo(storeId: string): Promise<StoreInfo | null> {
    const storeDoc = await getDoc(doc(db, 'stores', storeId));
    if (!storeDoc.exists()) return null;
    
    const data = storeDoc.data();
    return {
      id: storeDoc.id,
      branchName: data.branchName,
      location: data.location,
      isActive: data.isActive !== false
    };
  }
}

// ==================== INVENTORY SERVICE ====================
export class InventoryService {
  /**
   * ดึงข้อมูล Inventory จากหลายสาขาพร้อมกัน
   * @param storeIds - Array ของ Store IDs (ถ้าไม่ส่งมาจะดึงทุกสาขา)
   */
  static async fetchInventory(storeIds?: string[]): Promise<GroupedProduct[]> {
    try {
      // ถ้าไม่ระบุ storeIds ให้ดึงทุกสาขา
      const storeMap = await StoreService.getAllStores();
      const targetStoreIds = storeIds || Object.keys(storeMap);
      
      const productGroups = new Map<string, GroupedProduct>();

      for (const storeId of targetStoreIds) {
        const branchName = storeMap[storeId] || storeId;
        
        // ดึง inventory ของแต่ละสาขา
        const inventoryData = await this.fetchStoreInventory(storeId, branchName);
        
        // รวมข้อมูลเข้า productGroups
        inventoryData.forEach(product => {
          const existingProduct = productGroups.get(product.id);
          
          if (existingProduct) {
            // ถ้ามีสินค้านี้อยู่แล้ว ให้เพิ่ม branch เข้าไป
            existingProduct.branches.push(...product.branches);
            existingProduct.totalAvailable += product.totalAvailable;
          } else {
            // ถ้ายังไม่มี ให้เพิ่มใหม่
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

  /**
   * ดึง Inventory ของสาขาเดียว
   */
  static async fetchStoreInventory(
    storeId: string, 
    branchName: string
  ): Promise<GroupedProduct[]> {
    const products: GroupedProduct[] = [];
    
    const brandsRef = collection(db, 'stores', storeId, 'inventory');
    const brandSnapshots = await getDocs(brandsRef);

    for (const brandDoc of brandSnapshots.docs) {
      const brandName = brandDoc.id;
      const modelsRef = collection(brandDoc.ref, 'models');
      const modelSnapshots = await getDocs(modelsRef);

      for (const modelDoc of modelSnapshots.docs) {
        const modelData = modelDoc.data();
        const modelName = modelData.modelName;
        const productId = `${brandName} ${modelName}`;

        const product: GroupedProduct = {
          id: productId,
          name: productId,
          brand: brandName,
          model: modelName,
          totalAvailable: 0,
          branches: [{
            branchName,
            branchId: storeId,
            sizes: []
          }]
        };

        const variantsRef = collection(modelDoc.ref, 'variants');
        const variantSnapshots = await getDocs(variantsRef);

        for (const variantDoc of variantSnapshots.docs) {
          const variantData = variantDoc.data();
          const specification = `${variantData.size} ${variantData.loadIndex || ''}`.trim();
          
          const sizeDetail: SizeDetail = {
            specification,
            dots: []
          };

          const dotsRef = collection(variantDoc.ref, 'dots');
          const dotSnapshots = await getDocs(dotsRef);
          
          dotSnapshots.forEach(dotDoc => {
            const dotData = dotDoc.data();
            const dot: DotDetail = {
              dotCode: dotDoc.id,
              qty: dotData.qty || 0,
              basePrice: variantData.basePrice || 0,
              promoPrice: dotData.promoPrice
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

  /**
   * อัพเดทจำนวนสินค้าหลังจากสั่งซื้อ
   */
  static async updateInventoryQuantity(
    storeId: string,
    brandName: string,
    modelName: string,
    size: string,
    dotCode: string,
    newQty: number
  ): Promise<boolean> {
    try {
      // สร้าง path ไปยัง dot document
      const dotRef = doc(
        db, 
        'stores', storeId, 
        'inventory', brandName,
        'models', modelName,
        'variants', size,
        'dots', dotCode
      );

      await updateDoc(dotRef, { 
        qty: newQty,
        lastUpdated: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error updating inventory:', error);
      return false;
    }
  }

  /**
   * ตรวจสอบ stock availability ก่อนสั่งซื้อ
   */
  static async checkAvailability(
    storeId: string,
    brandName: string,
    modelName: string,
    size: string,
    dotCode: string,
    requestedQty: number
  ): Promise<{ available: boolean; currentQty: number }> {
    try {
      const dotRef = doc(
        db, 
        'stores', storeId, 
        'inventory', brandName,
        'models', modelName,
        'variants', size,
        'dots', dotCode
      );

      const dotDoc = await getDoc(dotRef);
      
      if (!dotDoc.exists()) {
        return { available: false, currentQty: 0 };
      }

      const currentQty = dotDoc.data().qty || 0;
      return { 
        available: currentQty >= requestedQty, 
        currentQty 
      };
    } catch (error) {
      console.error('Error checking availability:', error);
      return { available: false, currentQty: 0 };
    }
  }

  /**
   * ค้นหาสินค้าจากทุกสาขา
   */
  static async searchProducts(searchTerm: string): Promise<GroupedProduct[]> {
    const allProducts = await this.fetchInventory();
    const lowercasedTerm = searchTerm.toLowerCase();
    
    return allProducts.filter(product => 
      product.name.toLowerCase().includes(lowercasedTerm) ||
      product.brand.toLowerCase().includes(lowercasedTerm) ||
      product.model.toLowerCase().includes(lowercasedTerm) ||
      product.branches.some(branch => 
        branch.sizes.some(size => 
          size.specification.toLowerCase().includes(lowercasedTerm)
        )
      )
    );
  }

  /**
   * ดึงสินค้าที่มีโปรโมชั่น
   */
  static async getPromotionalProducts(): Promise<GroupedProduct[]> {
    const allProducts = await this.fetchInventory();
    
    return allProducts.filter(product =>
      product.branches.some(branch =>
        branch.sizes.some(size =>
          size.dots.some(dot => dot.promoPrice && dot.promoPrice > 0)
        )
      )
    );
  }
}

// ==================== ORDER SERVICE ====================
export interface OrderItem {
  productId: string;
  productName: string;
  specification: string;
  dotCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sellerBranchId: string;
  sellerBranchName: string;
}

export interface Order {
  id?: string;
  orderNumber: string;
  buyerBranchId: string;
  buyerBranchName: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: any;
  updatedAt?: any;
  notes?: string;
}

export class OrderService {
  /**
   * สร้าง Order ใหม่พร้อมอัพเดท Inventory
   */
  static async createOrder(order: Omit<Order, 'id' | 'orderNumber' | 'createdAt'>): Promise<string> {
    const batch = writeBatch(db);
    
    try {
      // 1. Generate order number
      const orderNumber = `ORD-${Date.now()}`;
      
      // 2. ตรวจสอบ stock availability ทั้งหมดก่อน
      for (const item of order.items) {
        const [brand, ...modelParts] = item.productName.split(' ');
        const model = modelParts.join(' ');
        
        const availability = await InventoryService.checkAvailability(
          item.sellerBranchId,
          brand,
          model,
          item.specification,
          item.dotCode,
          item.quantity
        );
        
        if (!availability.available) {
          throw new Error(`Insufficient stock for ${item.productName} ${item.specification}`);
        }
      }
      
      // 3. สร้าง order document
      const orderData: Order = {
        ...order,
        orderNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      
      // 4. อัพเดท inventory quantities
      for (const item of order.items) {
        const [brand, ...modelParts] = item.productName.split(' ');
        const model = modelParts.join(' ');
        
        // ดึง qty ปัจจุบัน
        const availability = await InventoryService.checkAvailability(
          item.sellerBranchId,
          brand,
          model,
          item.specification,
          item.dotCode,
          item.quantity
        );
        
        // อัพเดท qty ใหม่
        await InventoryService.updateInventoryQuantity(
          item.sellerBranchId,
          brand,
          model,
          item.specification,
          item.dotCode,
          availability.currentQty - item.quantity
        );
      }
      
      await batch.commit();
      return orderRef.id;
      
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  /**
   * ดึง Orders ของ branch
   */
  static async getOrdersByBranch(branchId: string, type: 'buyer' | 'seller'): Promise<Order[]> {
    const field = type === 'buyer' ? 'buyerBranchId' : 'items.sellerBranchId';
    const q = query(collection(db, 'orders'), where(field, '==', branchId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Order));
  }

  /**
   * อัพเดท Order status
   */
  static async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      updatedAt: serverTimestamp()
    });
  }
}