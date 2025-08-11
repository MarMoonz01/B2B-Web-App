'use client';

import React, { useState } from 'react';
import { Search, Filter, X, RefreshCw, Store } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchFiltersProps } from '@/types/inventory';

export default function SearchFilters({
  brands,
  selectedBrand,
  setSelectedBrand,
  searchTerm,
  setSearchTerm,
  stores,
  selectedStore,
  setSelectedStore,
  priceRange,
  setPriceRange,
  availability,
  setAvailability,
  promotionStatus,
  setPromotionStatus,
  onRefresh,
  isLoading
}: SearchFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-end gap-3">
            {/* Search Input */}
            <div className="flex-grow w-full">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by product name, size..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Branch/Store Filter */}
            <div className="w-full md:w-auto md:min-w-[180px]">
              <label className="text-xs font-medium text-muted-foreground">Branch</label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Stores">All Branches</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store} value={store}>{store}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Brand Filter */}
            <div className="w-full md:w-auto md:min-w-[180px]">
              <label className="text-xs font-medium text-muted-foreground">Brand</label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Brands">All Brands</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAdvanced(!showAdvanced)}>
                <Filter className="h-4 w-4 mr-2" /> More
              </Button>
              <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading} className="text-muted-foreground">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters Section */}
      {showAdvanced && (
        <Card className="animate-slide-down">
          <CardHeader>
            <CardTitle className="text-base">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Price Range</label>
              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Prices</SelectItem>
                  <SelectItem value="<2000">Under ฿2,000</SelectItem>
                  <SelectItem value="2000-5000">฿2,000 - ฿5,000</SelectItem>
                  <SelectItem value=">5000">Above ฿5,000</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Availability</label>
              <Select value={availability} onValueChange={setAvailability}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Stock</SelectItem>
                  <SelectItem value="inStock">In Stock Only</SelectItem>
                  <SelectItem value="lowStock">Low Stock (&lt;=10)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Promotion</label>
              <Select value={promotionStatus} onValueChange={setPromotionStatus}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Items</SelectItem>
                  <SelectItem value="onPromo">On Promotion</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}