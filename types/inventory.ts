// types/inventory.ts

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
  branchId: string;
  branchName: string;
  sizes: SizeDetail[];
}

// ✅ พิมพ์เขียวหลักที่ทุกไฟล์จะใช้
export interface GroupedProduct {
  id: string; // e.g., "MICHELIN PRIMACY-4"
  name: string; // e.g., "Michelin Primacy 4"
  brand: string; // e.g., "Michelin"
  model: string; // e.g., "Primacy 4"
  totalAvailable: number;
  branches: BranchDetail[];
}

// Type สำหรับ Log การเคลื่อนไหวของสต็อก
export interface StockMovement {
  id?: string;
  productId: string;
  variantId: string;
  dotCode: string;
  type: 'sell' | 'receive' | 'adjust' | 'transfer-out' | 'transfer-in';
  qtyChange: number;
  newQty: number;
  price?: number;
  reason?: string;
  relatedTransferId?: string;
  createdAt: any; // Firestore Timestamp
}

// Type สำหรับ Order (Transfer)
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