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

// ข้อมูลหลักที่เราจะใช้แสดงผลในตาราง
export interface GroupedProduct {
  id: string; // คือชื่อรุ่น เช่น "MICHELIN PRIMACY 4"
  name: string;
  totalAvailable: number;
  branches: BranchDetail[]; // รายละเอียดของทุกสาขาที่มีสินค้านี้
}

// Props สำหรับ InventoryList (เดิมคือ InventoryTable)
export interface InventoryListProps {
  inventory: GroupedProduct[];
}

// Props สำหรับตารางแสดงรายละเอียด
export interface InventoryDetailTableProps {
  branches: BranchDetail[];
}

// Props สำหรับส่วน Filter
export interface SearchFiltersProps {
  brands: string[];
  selectedBrand: string;
  setSelectedBrand: (brand: string) => void;
  
  // เพิ่ม Category เข้ามา
  categories: string[];
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;

  // เพิ่ม Status เข้ามา
  statuses: string[];
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;

  searchTerm: string;
  setSearchTerm: (term: string) => void;

  // ส่วนนี้อาจจะไม่จำเป็นแล้วใน UI ใหม่ แต่เก็บไว้เผื่อใช้
  priceRange: string;
  setPriceRange: (value: string) => void;
  availability: string;
  setAvailability: (value: string) => void;
  promotionStatus: string;
  setPromotionStatus: (value: string) => void;
  stores: string[];
  selectedStore: string;
  setSelectedStore: (store: string) => void;
  
  onRefresh: () => void;
  isLoading: boolean;
}