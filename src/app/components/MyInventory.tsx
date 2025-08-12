'use client';

import { useState, useEffect, useMemo, JSX } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { Package, Users, FileText, TrendingUp, Download, Plus, Search, RefreshCw, Upload, MoreHorizontal, Eye, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

//================================================================
// 1. Type Definitions (รวมเข้ามาในไฟล์)
//================================================================
interface DotDetail {
  dotCode: string;
  qty: number;
  basePrice: number;
  promoPrice?: number;
}
interface SizeDetail {
  specification: string;
  dots: DotDetail[];
}
interface BranchDetail {
  branchName: string;
  sizes: SizeDetail[];
}
interface GroupedProduct {
  id: string;
  name: string;
  totalAvailable: number;
  branches: BranchDetail[];
}
// *** FIX: Removed priceRange and setPriceRange from props interface ***
interface SearchFiltersProps {
  brands: string[];
  selectedBrand: string;
  setSelectedBrand: (brand: string) => void;
  availability: string;
  setAvailability: (value: string) => void;
  promotionStatus: string;
  setPromotionStatus: (value: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  filteredCount: number;
}

//================================================================
// 2. Firebase Initialization (รวมเข้ามาในไฟล์)
//================================================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "tirestock-a2ef4",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


//================================================================
// 3. Helper Components (รวมเข้ามาในไฟล์)
//================================================================

//--- InventorySkeleton Component ---
const SkeletonCard = () => (
  <Card className="overflow-hidden">
    <CardHeader className="p-3 flex flex-row items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded-full bg-slate-200" />
        <div className="space-y-2">
          <div className="h-4 w-40 rounded-md bg-slate-200" />
          <div className="h-3 w-24 rounded-md bg-slate-200" />
        </div>
      </div>
    </CardHeader>
  </Card>
);

function InventorySkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}


//--- SearchFilters Component ---
function SearchFilters({
  brands,
  selectedBrand,
  setSelectedBrand,
  availability,
  setAvailability,
  promotionStatus,
  setPromotionStatus,
  searchTerm,
  setSearchTerm,
  onRefresh,
  isLoading,
  filteredCount
}: SearchFiltersProps) {

  const statusOptions = ['All Status', 'In Stock', 'Low Stock', 'Out of Stock'];
  const itemOptions = ['All Items', 'On Promotion'];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
        <div className="md:col-span-4">
            <label className="text-xs font-medium text-muted-foreground">Search products, brands, SKU...</label>
            <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search..."
                    className="pl-9 h-9 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Brand</label>
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem className="text-sm" value="All Brands">All Brands</SelectItem>
                    {brands.map((brand) => (
                        <SelectItem key={brand} className="text-sm" value={brand}>{brand}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Items</label>
            <Select value={promotionStatus} onValueChange={setPromotionStatus}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {itemOptions.map((item) => (
                        <SelectItem key={item} className="text-sm" value={item}>{item}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={availability} onValueChange={setAvailability}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {statusOptions.map((status) => (
                        <SelectItem key={status} className="text-sm" value={status}>{status}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>
      <div className="flex justify-between items-center pt-2 border-t mt-3">
        <p className="text-xs text-muted-foreground">Showing {filteredCount} products</p>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading} className="text-xs">
            <RefreshCw className={`h-3 w-3 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
        </Button>
      </div>
    </div>
  );
}

//--- FlatInventoryTable Component ---
const getStockStatus = (total: number) => {
  if (total === 0) return { 
    label: 'Out of Stock', 
    className: 'bg-red-100 text-red-700 border-red-200',
    dotClassName: 'bg-red-500' 
  };
  if (total <= 10) return { 
    label: 'Low Stock', 
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    dotClassName: 'bg-yellow-500'
  };
  return { 
    label: 'In Stock', 
    className: 'bg-green-100 text-green-700 border-green-200',
    dotClassName: 'bg-green-500'
  };
};

function FlatInventoryTable({ inventory }: { inventory: GroupedProduct[] }) {
  const dotItems = inventory.flatMap(product =>
    product.branches.flatMap(branch =>
      branch.sizes.flatMap(size =>
        size.dots.map(dot => ({
          ...dot,
          productId: product.id,
          productName: product.name,
          brand: product.name.split(' ')[0],
          specification: size.specification,
        }))
      )
    )
  );

  return (
    <Card>
        <CardHeader className='flex-row items-center justify-between py-3 px-4'>
            <CardTitle className='text-base font-semibold'>Inventory Items</CardTitle>
            <div className='flex gap-2'>
                <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-2" />Import</Button>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Product</Button>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="border-t">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[320px] px-4">Product Name</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>DOT</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead className="text-center">Stock</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right pr-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dotItems.map(item => {
                            const status = getStockStatus(item.qty);
                            const displayPrice = item.promoPrice || item.basePrice || 0;

                            return (
                                <TableRow key={`${item.productId}-${item.specification}-${item.dotCode}`}>
                                    <TableCell className="font-medium px-4">
                                        <div className="flex items-center gap-3">
                                            <span className={`block w-2 h-2 rounded-full ${status.dotClassName}`}></span>
                                            <div>
                                                <div className="text-sm">{item.productName}</div>
                                                <div className="text-xs text-muted-foreground">{item.specification}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">{item.brand}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs">{`SKU-${item.productId.substring(0, 5)}-${item.specification.substring(0,6)}`}</TableCell>
                                    <TableCell className="font-mono text-xs">{item.dotCode}</TableCell>
                                    <TableCell className="text-sm">฿{displayPrice.toLocaleString()}</TableCell>
                                    <TableCell className="font-semibold text-center text-sm">{item.qty}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`font-normal text-xs ${status.className}`}>{status.label}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-4">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem className="text-sm"><Eye className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
                                                <DropdownMenuItem className="text-sm"><Pencil className="mr-2 h-4 w-4" />Edit Product</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
  );
}

//================================================================
// 4. Data Fetching Logic
//================================================================
const fetchAndGroupInventory = async (storeIds: string[]) => {
  try {
    const productGroups = new Map<string, GroupedProduct>();
    const storesCollection = await getDocs(collection(db, 'stores'));
    const storeNames: { [id: string]: string } = {};
    storesCollection.docs.forEach(doc => {
      storeNames[doc.id] = doc.data().branchName || doc.id;
    });

    for (const storeId of storeIds) {
        const branchName = storeNames[storeId] || storeId;
        const brandsRef = collection(db, 'stores', storeId, 'inventory');
        const brandSnapshots = await getDocs(brandsRef);

        for (const brandDoc of brandSnapshots.docs) {
          const modelsRef = collection(brandDoc.ref, 'models');
          const modelSnapshots = await getDocs(modelsRef);

          for (const modelDoc of modelSnapshots.docs) {
            const modelData = modelDoc.data();
            const groupKey = `${brandDoc.id} ${modelData.modelName}`;

            if (!productGroups.has(groupKey)) {
              productGroups.set(groupKey, { id: groupKey, name: groupKey, totalAvailable: 0, branches: [] });
            }
            const currentGroup = productGroups.get(groupKey)!;

            let currentBranch = currentGroup.branches.find(b => b.branchName === branchName);
            if (!currentBranch) {
              currentBranch = { branchName: branchName, sizes: [] };
              currentGroup.branches.push(currentBranch);
            }
            
            const variantsRef = collection(modelDoc.ref, 'variants');
            const variantSnapshots = await getDocs(variantsRef);

            for (const variantDoc of variantSnapshots.docs) {
              const variantData = variantDoc.data();
              const specification = `${variantData.size} ${variantData.loadIndex || ''}`.trim();
              const sizeData = { specification: specification, dots: [] };

              const dotsRef = collection(variantDoc.ref, 'dots');
              const dotSnapshots = await getDocs(dotsRef);
              
              dotSnapshots.forEach(dotDoc => {
                const dotData = dotDoc.data();
                currentGroup.totalAvailable += dotData.qty;
                (sizeData.dots as any).push({
                  dotCode: dotDoc.id,
                  qty: dotData.qty,
                  basePrice: variantData.basePrice,
                  promoPrice: dotData.promoPrice,
                });
              });
              
              if (sizeData.dots.length > 0) {
                (currentBranch.sizes as any).push(sizeData);
              }
            }
          }
        }
    }
    return { groupedResult: Array.from(productGroups.values()), storeNames: Object.values(storeNames) };
  } catch (err) {
    console.error('Failed to fetch data:', err);
    return { groupedResult: [], storeNames: [] };
  } 
};

//================================================================
// 5. Main MyInventory Component
//================================================================
export default function MyInventory(): JSX.Element {
  const [inventory, setInventory] = useState<GroupedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // --- States for Filters ---
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [searchTerm, setSearchTerm] = useState('');
  const [availability, setAvailability] = useState('All Status'); 
  const [promotionStatus, setPromotionStatus] = useState('All Items');
  
  const fetchDataForMyBranch = async () => {
    setLoading(true);
    const myBranchId = ['tyreplus_ratchapruek'];
    const { groupedResult } = await fetchAndGroupInventory(myBranchId);
    setInventory(groupedResult);
    setLoading(false);
  }

  useEffect(() => {
    fetchDataForMyBranch();
  }, []);

  const availableBrands = useMemo(() => {
    const brands = new Set(inventory.map(item => item.name.split(' ')[0]));
    return Array.from(brands).sort();
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    let result = [...inventory];

    if (selectedBrand !== 'All Brands') {
      result = result.filter(item => item.name.startsWith(selectedBrand));
    }

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(lowercasedTerm) ||
        item.branches.some(b => b.sizes.some(s => s.specification.toLowerCase().includes(lowercasedTerm)))
      );
    }
    
    if (availability !== 'All Status' || promotionStatus !== 'All Items') {
      result = result.map(product => {
        const newBranches = product.branches.map(branch => {
          const newSizes = branch.sizes.map(size => {
            let newDots = size.dots;

            if (availability !== 'All Status') {
              newDots = newDots.filter(dot => {
                if (availability === 'In Stock') return dot.qty > 10;
                if (availability === 'Low Stock') return dot.qty > 0 && dot.qty <= 10;
                if (availability === 'Out of Stock') return dot.qty === 0;
                return true;
              });
            }

            if (promotionStatus === 'On Promotion') {
              newDots = newDots.filter(dot => dot.promoPrice && dot.promoPrice > 0);
            }

            return { ...size, dots: newDots };
          }).filter(size => size.dots.length > 0);
          return { ...branch, sizes: newSizes };
        }).filter(branch => branch.sizes.length > 0);
        
        return { ...product, branches: newBranches };
      }).filter(product => product.branches.length > 0);
    }
    
    return result.filter(item => !item.name.toLowerCase().includes('high performance'));

  }, [inventory, selectedBrand, searchTerm, availability, promotionStatus]);

  const totalFilteredDots = filteredInventory.reduce((acc, product) => 
    acc + product.branches.reduce((bAcc, branch) => 
      bAcc + branch.sizes.reduce((sAcc, size) => sAcc + size.dots.length, 0), 0), 0);

  return (
    <div className="space-y-4">
       <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Inventory</h1>
                    <p className="text-sm text-muted-foreground">Manage your branch operations and inventory.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Export</Button>
                    <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Product</Button>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Dealer Network</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className='p-4 pt-0'>
                        <div className="text-2xl font-bold">4</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Your Products</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className='p-4 pt-0'>
                        <div className="text-2xl font-bold">1,250</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className='p-4 pt-0'>
                        <div className="text-2xl font-bold text-orange-500">1</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Spent</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className='p-4 pt-0'>
                        <div className="text-2xl font-bold">฿80</div>
                    </CardContent>
                </Card>
            </div>
       </div>

        <Card>
            <CardHeader className="p-4">
                <CardTitle className='text-base font-semibold'>Search & Filters</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                <SearchFilters
                  brands={availableBrands}
                  selectedBrand={selectedBrand}
                  setSelectedBrand={setSelectedBrand}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onRefresh={fetchDataForMyBranch}
                  isLoading={loading}
                  availability={availability}
                  setAvailability={setAvailability}
                  promotionStatus={promotionStatus}
                  setPromotionStatus={setPromotionStatus}
                  filteredCount={totalFilteredDots}
                />
            </CardContent>
        </Card>

        {loading ? (
            <InventorySkeleton />
        ) : (
            <FlatInventoryTable inventory={filteredInventory} />
        )}
    </div>
  );
}
