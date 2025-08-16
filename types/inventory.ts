// src/types/inventory.ts

// ----- Inventory (normalized) -----
export type DotNode = {
  dotCode: string;          // e.g. "DOT 2323"
  qty: number;              // available units
  basePrice?: number;       // regular price
  promoPrice?: number;      // promotional price (if any)
};

export type SizeNode = {
  specification: string;    // e.g. "205/55R16"
  variantId: string;        // SKU/variant key
  dots: DotNode[];
};

export type BranchStock = {
  branchId: string;
  branchName: string;
  sizes: SizeNode[];
};

export type GroupedProduct = {
  id: string;               // product id
  name: string;             // product display name
  brand: string;
  model?: string;
  branches: BranchStock[];
};

// ----- Transfer Request / Order -----
export type OrderItem = {
  productId: string;
  productName: string;
  specification: string;    // size spec
  dotCode: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type OrderStatus =
  | 'requested'
  | 'confirmed'
  | 'shipped' // เพิ่มสถานะ "จัดส่งแล้ว"
  | 'rejected'
  | 'cancelled'
  | 'completed'; // เพิ่มสถานะ "รับของแล้ว"
export type Order = {
  id: string;
  orderNumber?: string;

  buyerBranchId: string;
  buyerBranchName?: string;

  sellerBranchId: string;
  sellerBranchName?: string;

  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  notes?: string;

  // Firestore timestamps or plain Date if mapped
  createdAt?: { seconds: number; nanoseconds: number } | Date;
  updatedAt?: { seconds: number; nanoseconds: number } | Date;
};
