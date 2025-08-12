'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import SearchFilters from '@/src/app/components/SearchFilters';
import InventoryTable from '@/src/app/components/InventoryTable';
import { GroupedProduct } from '@/types/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import InventorySkeleton from '@/src/app/components/InventorySkeleton';

/**
 * ดึงข้อมูล Store ID และชื่อทั้งหมดจาก Firestore
 * @returns {Promise<Record<string, string>>} Object ที่มี key เป็น storeId และ value เป็น branchName
 */
const getAllStores = async (): Promise<Record<string, string>> => {
  const storesCollection = await getDocs(collection(db, 'stores'));
  const storeMap: Record<string, string> = {};
  storesCollection.docs.forEach(doc => {
    storeMap[doc.id] = doc.data().branchName || doc.id;
  });
  return storeMap;
};

/**
 * ดึงและจัดกลุ่มข้อมูลสินค้าคงคลังจากหลายๆ สาขา
 * @param {string[]} storeIds - Array ของ Store ID ที่ต้องการดึงข้อมูล
 * @param {Record<string, string>} storeNames - Object สำหรับ map storeId ไปเป็น branchName
 * @returns {Promise<GroupedProduct[]>} - Array ของสินค้าที่จัดกลุ่มแล้ว
 */
const fetchAndGroupMarketplaceInventory = async (
  storeIds: string[],
  storeNames: Record<string, string>
): Promise<GroupedProduct[]> => {
  const productGroups = new Map<string, GroupedProduct>();

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
  return Array.from(productGroups.values());
};


export default function MarketplaceView() {
  const [inventory, setInventory] = useState<GroupedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // State สำหรับจัดการ Filter
  const [allStores, setAllStores] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState('All Stores');
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState('All');
  const [availability, setAvailability] = useState('All');
  const [promotionStatus, setPromotionStatus] = useState('All');

  const fetchData = async () => {
    try {
      setLoading(true);
      const storeNameMap = await getAllStores();
      const storeIds = Object.keys(storeNameMap);
      
      setAllStores(Object.values(storeNameMap));
      
      const groupedResult = await fetchAndGroupMarketplaceInventory(storeIds, storeNameMap);
      setInventory(groupedResult);

    } catch (err) {
      console.error('Failed to fetch marketplace data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold">B2B Marketplace</h1>
                <p className="text-muted-foreground">Discover and order inventory from other dealers in your network.</p>
            </div>
       </div>

      <Card>
        <CardContent className="p-4">
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
            onRefresh={fetchData}
            isLoading={loading}
          />
        </CardContent>
      </Card>
      
      <div>
        {loading ? (
            <InventorySkeleton />
        ) : (
            <InventoryTable inventory={filteredInventory} />
        )}
      </div>
    </div>
  );
}