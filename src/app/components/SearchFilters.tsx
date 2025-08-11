'use client';
import { Search, Filter, X } from 'lucide-react';
import React, { useState } from 'react';

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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const clearFilters = () => {
    setSelectedBrand('All Brands');
    setSizeSearchTerm('');
  };

  const hasActiveFilters = selectedBrand !== 'All Brands' || sizeSearchTerm.length > 0;

  return (
    <div className="space-y-4">
      {/* Main Search Bar */}
      <div className="card hover-lift">
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <label htmlFor="size-search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Inventory
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="size-search"
                  type="text"
                  placeholder="Search by size, model, brand... (e.g., 195/60R15, Primacy, Michelin)"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  value={sizeSearchTerm}
                  onChange={(e) => setSizeSearchTerm(e.target.value)}
                />
                {sizeSearchTerm && (
                  <button
                    onClick={() => setSizeSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Brand Filter */}
            <div className="md:w-64">
              <label htmlFor="brand-select" className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Brand
              </label>
              <select
                id="brand-select"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
              >
                <option value="All Brands">All Brands ({brands.length})</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end space-x-2">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`btn ${showAdvancedFilters ? 'btn-primary' : 'btn-outline'} p-3`}
              >
                <Filter className="h-5 w-5" />
              </button>
              
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="btn btn-secondary p-3"
                  title="Clear all filters"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {selectedBrand !== 'All Brands' && (
                <span className="badge bg-blue-100 text-blue-800 flex items-center gap-1">
                  Brand: {selectedBrand}
                  <button
                    onClick={() => setSelectedBrand('All Brands')}
                    className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {sizeSearchTerm && (
                <span className="badge bg-green-100 text-green-800 flex items-center gap-1">
                  Search: "{sizeSearchTerm}"
                  <button
                    onClick={() => setSizeSearchTerm('')}
                    className="ml-1 hover:bg-green-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters (Hidden by default) */}
      {showAdvancedFilters && (
        <div className="card animate-slide-down">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Range
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option>All Prices</option>
                  <option>Under ฿2,000</option>
                  <option>฿2,000 - ฿5,000</option>
                  <option>฿5,000 - ฿10,000</option>
                  <option>Above ฿10,000</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Availability
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option>All Stock</option>
                  <option>In Stock Only</option>
                  <option>Low Stock (&lt; 5)</option>
                  <option>High Stock (&gt; 20)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Promotion
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option>All Items</option>
                  <option>On Promotion</option>
                  <option>Regular Price</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}