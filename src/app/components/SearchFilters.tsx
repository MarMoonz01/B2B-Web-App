'use client';
import { Search } from 'lucide-react';
import React from 'react';

// ปรับปรุง Props ให้รองรับ Filter ใหม่ๆ
interface SearchFiltersProps {
  brands: string[];
  selectedBrand: string;
  setSelectedBrand: (brand: string) => void;
  sizeSearchTerm: string;
  setSizeSearchTerm: (term: string) => void;
}

export default function SearchFilters({
  brands,
  selectedBrand,
  setSelectedBrand,
  sizeSearchTerm,
  setSizeSearchTerm,
}: SearchFiltersProps) {
  return (
    <div className="card p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Brand Filter */}
        <div className="flex flex-col">
          <label htmlFor="brand-select" className="text-sm font-medium text-gray-700 mb-1">
            Brand
          </label>
          <select
            id="brand-select"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="All Brands">All Brands</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>

        {/* Size Filter */}
        <div className="flex flex-col md:col-span-2">
          <label htmlFor="size-search" className="text-sm font-medium text-gray-700 mb-1">
            Search by Size, Model...
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              id="size-search"
              type="text"
              placeholder="e.g., 195/60R15 or Primacy"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={sizeSearchTerm}
              onChange={(e) => setSizeSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}