'use client';

import { useState, useEffect, useMemo, JSX } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from 'lib/firebase';
import Header from './components/Header';
import SearchFilters from './components/SearchFilters';
import InventoryTable from './components/InventoryTable';
import { GroupedProduct } from '@/types/inventory';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function Home(): JSX.Element {
  const [inventory, setInventory] = useState<GroupedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // State สำหรับจัดการ Filter
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [searchTerm, setSearchTerm] = useState('');

  // ฟังก์ชันดึงและจัดกลุ่มข้อมูลจาก Firestore
  const fetchAndGroupInventory = async (storeIds: string[]) => {
    try {
      setLoading(true);
      setError(null);
      const productGroups = new Map<string, GroupedProduct>();
      
      for (const storeId of storeIds) {
        const storesCollection = await getDocs(collection(db, 'stores'));
        const storeData = storesCollection.docs.find(doc => doc.id === storeId)?.data();
        const branchName = storeData?.branchName || storeId;
        const brandsRef = collection(db, 'stores', storeId, 'inventory');
        const brandSnapshots = await getDocs(brandsRef);
        
        for (const brandDoc of brandSnapshots.docs) {
          const modelsRef = collection(brandDoc.ref, 'models');
          const modelSnapshots = await getDocs(modelsRef);
          
          for (const modelDoc of modelSnapshots.docs) {
            const modelData = modelDoc.data();
            const groupKey = `${brandDoc.id} ${modelData.modelName}`;
            
            if (!productGroups.has(groupKey)) {
              productGroups.set(groupKey, { 
                id: groupKey, 
                name: groupKey, 
                totalAvailable: 0, 
                branches: [] 
              });
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
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching and grouping inventory:", error);
      setError("Failed to load inventory data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // โหลดข้อมูลครั้งแรกเมื่อ Component ถูกสร้าง
  useEffect(() => {
    const storeIds = ['tyreplus_ratchapruek'];
    fetchAndGroupInventory(storeIds);
  }, []);

  // สร้างรายชื่อยี่ห้อทั้งหมดสำหรับ Dropdown
  const availableBrands = useMemo(() => {
    const brands = new Set(inventory.map(item => item.name.split(' ')[0]));
    return Array.from(brands).sort();
  }, [inventory]);

  // กรองข้อมูลที่จะแสดงผล
  const filteredInventory = useMemo(() => {
    let result = inventory;

    // กรองตามยี่ห้อ
    if (selectedBrand !== 'All Brands') {
      result = result.filter(item => item.name.startsWith(selectedBrand));
    }

    // กรองตามคำค้นหา
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      result = result.filter(item => {
        if (item.name.toLowerCase().includes(lowercasedTerm)) {
          return true;
        }
        return item.branches.some(branch => 
          branch.sizes.some(size => 
            size.specification.toLowerCase().includes(lowercasedTerm)
          )
        );
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, selectedBrand, searchTerm]);

  const handleRefresh = () => {
    const storeIds = ['tyreplus_ratchapruek'];
    fetchAndGroupInventory(storeIds);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-gray-600 mt-1">
              Real-time tire inventory across all locations
              {lastUpdated && (
                <span className="ml-2 text-sm">
                  • Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn btn-outline flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="card border-red-200 bg-red-50">
            <div className="card-content">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <h3 className="font-medium text-red-800">Error Loading Data</h3>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
                <button
                  onClick={handleRefresh}
                  className="btn btn-secondary btn-sm ml-auto"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <SearchFilters
          brands={availableBrands}
          selectedBrand={selectedBrand}
          setSelectedBrand={setSelectedBrand}
          sizeSearchTerm={searchTerm}
          setSizeSearchTerm={setSearchTerm}
        />

        {/* Results Info */}
        {!loading && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {filteredInventory.length} of {inventory.length} products
            </span>
            {(selectedBrand !== 'All Brands' || searchTerm) && (
              <span className="text-blue-600">
                Filters applied - showing filtered results
              </span>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="card">
            <div className="card-content">
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="text-lg text-gray-600">Loading inventory data...</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <InventoryTable inventory={filteredInventory} />
        )}
      </main>
    </div>
  );
}