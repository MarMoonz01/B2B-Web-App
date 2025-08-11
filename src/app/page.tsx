'use client';

import { useState, useEffect, useMemo, JSX } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from 'lib/firebase';
import Header from './components/Header';
import SearchFilters from './components/SearchFilters';
import InventoryTable from './components/InventoryTable';
import { GroupedProduct } from '@/types/inventory';

export default function Home(): JSX.Element {
  const [inventory, setInventory] = useState<GroupedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // State สำหรับจัดการ Filter
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [searchTerm, setSearchTerm] = useState('');

  // ฟังก์ชันดึงและจัดกลุ่มข้อมูลจาก Firestore (เหมือนเดิม)
  const fetchAndGroupInventory = async (storeIds: string[]) => {
    // โค้ดในส่วนนี้เหมือนกับเวอร์ชันก่อนหน้าทุกประการ
    // เพื่อดึงข้อมูลและจัดกลุ่มให้พร้อมใช้งาน
    try {
      setLoading(true);
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
    } catch (error) {
      console.error("Error fetching and grouping inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  // โหลดข้อมูลครั้งแรกเมื่อ Component ถูกสร้าง
  useEffect(() => {
    const storeIds = ['tyreplus_ratchapruek'];
    fetchAndGroupInventory(storeIds);
  }, []);

  // สร้างรายชื่อยี่ห้อทั้งหมดสำหรับ Dropdown (คำนวณใหม่เมื่อ inventory เปลี่ยน)
  const availableBrands = useMemo(() => {
    const brands = new Set(inventory.map(item => item.name.split(' ')[0]));
    return Array.from(brands);
  }, [inventory]);

  // กรองข้อมูลที่จะแสดงผล (คำนวณใหม่เมื่อ inventory หรือค่า Filter เปลี่ยน)
  const filteredInventory = useMemo(() => {
    let result = inventory;

    // 1. กรองตามยี่ห้อ (Brand)
    if (selectedBrand !== 'All Brands') {
      result = result.filter(item => item.name.startsWith(selectedBrand));
    }

    // 2. กรองตามคำค้นหา (Search Term)
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

    return result;
  }, [inventory, selectedBrand, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SearchFilters
          brands={availableBrands}
          selectedBrand={selectedBrand}
          setSelectedBrand={setSelectedBrand}
          sizeSearchTerm={searchTerm}
          setSizeSearchTerm={setSearchTerm}
        />
        {loading ? (
          <div className="text-center py-10">Loading inventory...</div>
        ) : (
          <InventoryTable inventory={filteredInventory} />
        )}
      </main>
    </div>
  );
}