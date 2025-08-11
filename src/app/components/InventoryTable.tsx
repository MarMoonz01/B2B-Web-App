'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ShoppingCart, Eye, Package, TrendingUp } from 'lucide-react';
import { InventoryTableProps } from '@/types/inventory';
import BranchStockDetails from './BranchStockDetails';

export default function InventoryTable({ inventory }: InventoryTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (productId: string) => {
    setExpandedRow(expandedRow === productId ? null : productId);
  };

  const getStockStatus = (total: number) => {
    if (total === 0) return { label: 'Out of Stock', class: 'badge-error' };
    if (total < 5) return { label: 'Low Stock', class: 'badge-warning' };
    if (total < 20) return { label: 'In Stock', class: 'badge-success' };
    return { label: 'High Stock', class: 'badge-success' };
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card hover-lift">
          <div className="card-content">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{inventory.length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="card hover-lift">
          <div className="card-content">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inventory.reduce((sum, item) => sum + item.totalAvailable, 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="card hover-lift">
          <div className="card-content">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Stock</p>
                <p className="text-2xl font-bold text-green-600">
                  {inventory.filter(item => item.totalAvailable > 0).length}
                </p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <div className="w-3 h-3 bg-green-600 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="card hover-lift">
          <div className="card-content">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">
                  {inventory.filter(item => item.totalAvailable === 0).length}
                </p>
              </div>
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Product Inventory</h2>
          <p className="text-sm text-gray-600 mt-1">Click on any product to view detailed stock information</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product Information
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Available
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {inventory.map((item) => {
                const stockStatus = getStockStatus(item.totalAvailable);
                const isExpanded = expandedRow === item.id;
                
                return (
                  <React.Fragment key={item.id}>
                    <tr className={`hover:bg-gray-50 transition-colors duration-150 ${isExpanded ? 'bg-blue-50' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <button 
                            onClick={() => toggleRow(item.id)} 
                            className={`mr-3 p-1.5 hover:bg-gray-200 rounded-full transition-all duration-200 ${isExpanded ? 'bg-blue-100 text-blue-600' : ''}`}
                          >
                            {isExpanded ? 
                              <ChevronDown className="h-4 w-4" /> : 
                              <ChevronRight className="h-4 w-4" />
                            }
                          </button>
                          <div>
                            <div className="font-semibold text-gray-900 text-lg">{item.name}</div>
                            <div className="text-sm text-gray-500">
                              Available in {item.branches.length} location{item.branches.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <span className={`badge ${stockStatus.class}`}>
                          {stockStatus.label}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl font-bold text-gray-900">
                            {item.totalAvailable}
                          </span>
                          <span className="text-sm text-gray-500">units</span>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button className="btn btn-primary btn-sm flex items-center space-x-1">
                            <ShoppingCart className="h-4 w-4" />
                            <span>Order</span>
                          </button>
                          <button className="btn btn-outline btn-sm p-2">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr className="bg-slate-50">
                        <td colSpan={4} className="p-0">
                          <div className="animate-slide-down">
                            <BranchStockDetails branches={item.branches} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {inventory.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500">Try adjusting your search filters to find what you're looking for.</p>
          </div>
        )}
      </div>
    </div>
  );
}