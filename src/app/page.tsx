'use client';

import { useState, useEffect, useMemo, JSX } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Header from '@/src/app/components/Header';
import SearchFilters from '@/src/app/components/SearchFilters';
import InventoryTable from '@/src/app/components/InventoryTable';
import { GroupedProduct } from '@/types/inventory';
import { Package, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import InventorySkeleton from '@/src/app/components/InventorySkeleton';

export default function Home(): JSX.Element {
  const [inventory, setInventory] = useState<GroupedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // State สำหรับจัดการ Filter ทั้งหมด
  const [allStores, setAllStores] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState('All Stores');
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState('All');
  const [availability, setAvailability] = useState('All');
  const [promotionStatus, setPromotionStatus] = useState('All');

  const fetchAndGroupInventory = async (storeIds: string[]) => {
    try {
      setLoading(true);
      const productGroups = new Map<string, GroupedProduct>();

      // ดึงข้อมูลชื่อสาขาทั้งหมดก่อน
      const storesCollection = await getDocs(collection(db, 'stores'));
      const storeNames: { [id: string]: string } = {};
      storesCollection.docs.forEach(doc => {
        storeNames[doc.id] = doc.data().branchName || doc.id;
      });
      setAllStores(Object.values(storeNames));

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
      const groupedResult = Array.from(productGroups.values());
      setInventory(groupedResult);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndGroupInventory(['tyreplus_ratchapruek']);
  }, []);

  const availableBrands = useMemo(() => {
    const brands = new Set(inventory.map(item => item.name.split(' ')[0]));
    return Array.from(brands).sort();
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    let result = [...inventory];

    // Filter by Store/Branch
    if (selectedStore !== 'All Stores') {
      result = result
        .map(product => {
          const filteredBranches = product.branches.filter(branch => branch.branchName === selectedStore);
          if (filteredBranches.length > 0) {
            const newTotalAvailable = filteredBranches.reduce((sum, branch) => 
              sum + branch.sizes.reduce((sizeSum, size) => 
                sizeSum + size.dots.reduce((dotSum, dot) => dotSum + dot.qty, 0), 0), 0);
            return { ...product, branches: filteredBranches, totalAvailable: newTotalAvailable };
          }
          return null;
        })
        .filter((product): product is GroupedProduct => product !== null && product.totalAvailable > 0);
    }

    if (selectedBrand !== 'All Brands') {
      result = result.filter(item => item.name.startsWith(selectedBrand));
    }

    if (availability === 'inStock') {
      result = result.filter(item => item.totalAvailable > 0);
    } else if (availability === 'lowStock') {
      result = result.filter(item => item.totalAvailable > 0 && item.totalAvailable <= 10);
    }
    
    if (promotionStatus === 'onPromo') {
      result = result.filter(item => 
        item.branches.some(b => b.sizes.some(s => s.dots.some(d => d.promoPrice && d.promoPrice > 0)))
      );
    }

    if (priceRange !== 'All') {
      result = result.filter(item => 
        item.branches.some(b => b.sizes.some(s => s.dots.some(d => {
          const price = d.promoPrice || d.basePrice;
          if (priceRange === '<2000') return price < 2000;
          if (priceRange === '2000-5000') return price >= 2000 && price <= 5000;
          if (priceRange === '>5000') return price > 5000;
          return false;
        })))
      );
    }

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(lowercasedTerm) ||
        item.branches.some(b => b.sizes.some(s => s.specification.toLowerCase().includes(lowercasedTerm)))
      );
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, selectedStore, selectedBrand, searchTerm, priceRange, availability, promotionStatus]);
  
  const summaryStats = useMemo(() => {
    const currentInventory = filteredInventory;
    const totalStock = currentInventory.reduce((sum, item) => sum + item.totalAvailable, 0);
    const lowStockCount = currentInventory.filter(item => item.totalAvailable > 0 && item.totalAvailable <= 10).length;
    return {
      totalProducts: currentInventory.length,
      totalStock,
      lowStockCount,
    };
  }, [filteredInventory]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Products Showing</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.totalProducts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Units Showing</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.totalStock.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Stock</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredInventory.filter(item => item.totalAvailable > 0).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summaryStats.lowStockCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
            <CardHeader>
                <SearchFilters
                  brands={availableBrands}
                  selectedBrand={selectedBrand}
                  setSelectedBrand={setSelectedBrand}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  stores={allStores}
                  selectedStore={selectedStore}
                  setSelectedStore={setSelectedStore}
                  priceRange={priceRange}
                  setPriceRange={setPriceRange}
                  availability={availability}
                  setAvailability={setAvailability}
                  promotionStatus={promotionStatus}
                  setPromotionStatus={setPromotionStatus}
                  onRefresh={() => fetchAndGroupInventory(['tyreplus_ratchapruek'])}
                  isLoading={loading}
                />
            </CardHeader>
            <CardContent>
                {loading ? (
                    <InventorySkeleton />
                ) : (
                    <InventoryTable inventory={filteredInventory} />
                )}
            </CardContent>
        </Card>
      </main>
    </div>
  );
}