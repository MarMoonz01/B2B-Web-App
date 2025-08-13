'use client';

import { useState, useEffect, useMemo } from 'react';
import { InventoryService, GroupedProduct } from '@/lib/services/InventoryService';
import { Package, Users, FileText, TrendingUp, Download, Plus, Search, RefreshCw, LayoutGrid, List, Columns, Upload, MoreHorizontal, Eye, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Import View Components (ถ้ามี)
import InventorySkeleton from './InventorySkeleton';
import InventoryTable from './InventoryTable'; // Card View
import FlatInventoryTable from './FlatInventoryTable'; // Table View
// import InventoryMatrixView from './InventoryMatrixView'; // Matrix View (ถ้ามี)

// Get current user's branch ID (ในระบบจริงจะดึงจาก Auth context)
const MY_BRANCH_ID = 'tyreplus_ratchapruek';
const MY_BRANCH_NAME = 'TyrePlus Ratchapruek';

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

// View Switcher Component
function ViewSwitcher({ viewMode, setViewMode }: { viewMode: string, setViewMode: (view: 'card' | 'table' | 'matrix') => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-slate-100 p-1">
      <Button 
        variant={viewMode === 'card' ? 'secondary' : 'ghost'} 
        size="sm" 
        onClick={() => setViewMode('card')} 
        className="h-7 px-3 text-xs"
      >
        <Columns className="h-3.5 w-3.5 mr-2"/>
        Card
      </Button>
      <Button 
        variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
        size="sm" 
        onClick={() => setViewMode('table')} 
        className="h-7 px-3 text-xs"
      >
        <List className="h-3.5 w-3.5 mr-2"/>
        Table
      </Button>
      <Button 
        variant={viewMode === 'matrix' ? 'secondary' : 'ghost'} 
        size="sm" 
        onClick={() => setViewMode('matrix')} 
        className="h-7 px-3 text-xs"
      >
        <LayoutGrid className="h-3.5 w-3.5 mr-2"/>
        Matrix
      </Button>
    </div>
  );
}

// Search Filters Component
function SearchFilters({
  brands, selectedBrand, setSelectedBrand, availability, setAvailability,
  promotionStatus, setPromotionStatus, searchTerm, setSearchTerm, onRefresh, isLoading, filteredCount
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

// Matrix View Component (Simple Implementation)
function InventoryMatrixView({ inventory }: { inventory: GroupedProduct[] }) {
  if (!inventory || inventory.length === 0) {
    return (
      <Card>
        <div className="py-20 text-center">
          <Package className="h-12 w-12 mx-auto text-slate-400" />
          <p className="mt-4 text-muted-foreground">No products found</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {inventory.map((product) => {
        const totalStock = product.totalAvailable;
        const stockStatus = totalStock === 0 ? 'out' : totalStock <= 10 ? 'low' : 'in';
        
        return (
          <Card key={product.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-sm font-medium line-clamp-2">
                  {product.name}
                </CardTitle>
                <Badge 
                  variant={stockStatus === 'out' ? 'destructive' : stockStatus === 'low' ? 'default' : 'secondary'}
                  className={stockStatus === 'low' ? 'bg-yellow-500' : stockStatus === 'in' ? 'bg-green-600' : ''}
                >
                  {totalStock}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sizes:</span>
                  <span className="font-medium">
                    {product.branches[0]?.sizes.length || 0} variants
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Stock:</span>
                  <span className="font-medium">{totalStock} units</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Main Component
export default function MyInventory() {
  const [inventory, setInventory] = useState<GroupedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState('All Brands');
  const [searchTerm, setSearchTerm] = useState('');
  const [availability, setAvailability] = useState('All Status'); 
  const [promotionStatus, setPromotionStatus] = useState('All Items');
  const [viewMode, setViewMode] = useState<'card' | 'table' | 'matrix'>('card');
  
  const fetchMyInventory = async () => {
    setLoading(true);
    try {
      // ใช้ InventoryService แทนการดึงข้อมูลโดยตรง
      const products = await InventoryService.fetchStoreInventory(MY_BRANCH_ID, MY_BRANCH_NAME);
      setInventory(products);
    } catch (error) {
      console.error("Failed to fetch inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyInventory();
  }, []);

  const availableBrands = useMemo(() => {
    const brands = new Set(inventory.map(item => item.brand));
    return Array.from(brands).sort();
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    let result = [...inventory];
    
    if (selectedBrand !== 'All Brands') {
      result = result.filter(item => item.brand === selectedBrand);
    }
    
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(lowercasedTerm) ||
        item.branches.some(b => b.sizes.some(s => s.specification.toLowerCase().includes(lowercasedTerm)))
      );
    }
    
    // Filter by availability
    if (availability !== 'All Status') {
      result = result.filter(item => {
        if (availability === 'In Stock') return item.totalAvailable > 10;
        if (availability === 'Low Stock') return item.totalAvailable > 0 && item.totalAvailable <= 10;
        if (availability === 'Out of Stock') return item.totalAvailable === 0;
        return true;
      });
    }
    
    // Filter by promotion status
    if (promotionStatus === 'On Promotion') {
      result = result.filter(item => 
        item.branches.some(b => 
          b.sizes.some(s => 
            s.dots.some(d => d.promoPrice && d.promoPrice > 0)
          )
        )
      );
    }
    
    return result;
  }, [inventory, selectedBrand, searchTerm, availability, promotionStatus]);

  const totalStock = inventory.reduce((sum, product) => sum + product.totalAvailable, 0);
  const lowStockCount = inventory.filter(p => p.totalAvailable > 0 && p.totalAvailable <= 10).length;
  const outOfStockCount = inventory.filter(p => p.totalAvailable === 0).length;
  const totalFilteredProducts = filteredInventory.length;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">My Inventory</h1>
            <p className="text-muted-foreground">Manage your branch operations and inventory with real-time insights.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="focus-ring hover-lift">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <Button className="gradient-primary focus-ring hover-lift shadow-md">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="hover-lift gradient-card border-0 shadow-sm">
            <CardHeader className="p-6 flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className='p-6 pt-0'>
              <div className="text-3xl font-bold text-foreground mb-1">{inventory.length}</div>
              <p className="text-sm text-muted-foreground">Unique SKUs</p>
            </CardContent>
          </Card>
          <Card className="hover-lift gradient-card border-0 shadow-sm">
            <CardHeader className="p-6 flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Stock</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent className='p-6 pt-0'>
              <div className="text-3xl font-bold text-foreground mb-1">{totalStock.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Units available</p>
            </CardContent>
          </Card>
          <Card className="hover-lift gradient-card border-0 shadow-sm">
            <CardHeader className="p-6 flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alert</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent className='p-6 pt-0'>
              <div className="text-3xl font-bold text-amber-600 mb-1">{lowStockCount}</div>
              <p className="text-sm text-muted-foreground">Items need restock</p>
            </CardContent>
          </Card>
          <Card className="hover-lift gradient-card border-0 shadow-sm">
            <CardHeader className="p-6 flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Out of Stock</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-red-600" />
              </div>
            </CardHeader>
            <CardContent className='p-6 pt-0'>
              <div className="text-3xl font-bold text-red-600 mb-1">{outOfStockCount}</div>
              <p className="text-sm text-muted-foreground">Items unavailable</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="hover-lift border-0 shadow-sm">
        <CardHeader className="p-6 flex flex-row items-center justify-between">
          <CardTitle className='text-lg font-semibold text-foreground'>Search & Filters</CardTitle>
          <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <SearchFilters
            brands={availableBrands}
            selectedBrand={selectedBrand}
            setSelectedBrand={setSelectedBrand}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onRefresh={fetchMyInventory}
            isLoading={loading}
            availability={availability}
            setAvailability={setAvailability}
            promotionStatus={promotionStatus}
            setPromotionStatus={setPromotionStatus}
            filteredCount={totalFilteredProducts}
          />
        </CardContent>
      </Card>

      {/* Inventory Display */}
      {loading ? (
        <InventorySkeleton />
      ) : (
        <div className="mt-6">
          {viewMode === 'card' && <InventoryTable inventory={filteredInventory} />}
          {viewMode === 'table' && <FlatInventoryTable inventory={filteredInventory} />}
          {viewMode === 'matrix' && <InventoryMatrixView inventory={filteredInventory} />}
        </div>
      )}
    </div>
  );
}