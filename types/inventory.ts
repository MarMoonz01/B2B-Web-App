// รายละเอียดของแต่ละ DOT
export interface DotDetail {
  dotCode: string;
  qty: number;
  basePrice: number;
  promoPrice?: number;
}

// รายละเอียดของแต่ละ Size ที่มีในสาขา
export interface SizeDetail {
  specification: string; // เช่น "215/55R17 94V"
  dots: DotDetail[];
}

// รายละเอียดของแต่ละสาขาที่มีสต็อก
export interface BranchDetail {
  branchName: string;
  sizes: SizeDetail[];
}

// นี่คือข้อมูลหลักที่เราจะใช้แสดงผลในตาราง
export interface GroupedProduct {
  id: string; // คือชื่อรุ่น เช่น "MICHELIN PRIMACY 4"
  name: string;
  totalAvailable: number;
  branches: BranchDetail[]; // รายละเอียดของทุกสาขาที่มีสินค้านี้
}

// Props สำหรับ Components
export interface InventoryTableProps {
  inventory: GroupedProduct[];
}

export interface BranchStockDetailsProps {
  branches: BranchDetail[];
}