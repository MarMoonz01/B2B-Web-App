'use client';

import React from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { SearchFiltersProps } from '@/types/inventory';

export default function SearchFilters({
  brands,
  selectedBrand,
  setSelectedBrand,
  availability,
  setAvailability,
  promotionStatus,
  setPromotionStatus,
  priceRange,
  setPriceRange,
  searchTerm,
  setSearchTerm,
  onRefresh,
  isLoading
}: SearchFiltersProps) {

  const statusOptions = ['All Status', 'In Stock', 'Low Stock', 'Out of Stock'];
  const itemOptions = ['All Items', 'On Promotion'];
  const priceOptions = ['All Prices', '<2000', '2000-5000', '>5000'];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2 items-end">
        <div className="lg:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Search products, brands, SKU...</label>
            <div className="relative mt-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search..."
                    className="pl-7 h-9 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        <div>
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
        <div>
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
         <div>
            <label className="text-xs font-medium text-muted-foreground">Price</label>
            <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {priceOptions.map((price) => (
                      <SelectItem key={price} className="text-sm" value={price}>
                        {price === 'All Prices' ? 'All Prices' : price.replace('<', 'Under ฿').replace('>', 'Above ฿').replace('-', ' - ฿')}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
        </div>
        <div>
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
      <div className="flex justify-end items-center pt-1">
        <div className='flex items-center gap-2'>
            <div className='flex items-center gap-1'>
                <label className="text-xs text-muted-foreground">Sort by:</label>
                <Select defaultValue="name">
                    <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue placeholder="Sort by" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem className="text-sm" value="name">Name</SelectItem>
                        <SelectItem className="text-sm" value="price">Price</SelectItem>
                        <SelectItem className="text-sm" value="stock">Stock</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
        </div>
      </div>
    </div>
  );
}