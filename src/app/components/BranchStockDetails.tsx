'use client';
import { BranchStockDetailsProps } from '@/types/inventory';
import React from 'react';
import { MapPin, Package, Tag, TrendingDown } from 'lucide-react';

export default function BranchStockDetails({ branches }: BranchStockDetailsProps) {
  return (
    <div className="p-6 space-y-6">
      {branches.map((branch) => (
        <div key={branch.branchName} className="bg-white rounded-xl border border-gray-200 shadow-sm hover-lift">
          {/* Branch Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MapPin className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg">{branch.branchName}</h4>
                  <p className="text-sm text-gray-600">{branch.sizes.length} size variants available</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Total Stock</div>
                <div className="text-xl font-bold text-gray-900">
                  {branch.sizes.reduce((sum, size) => 
                    sum + size.dots.reduce((dotSum, dot) => dotSum + dot.qty, 0), 0
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Size Details */}
          <div className="p-4 space-y-4">
            {branch.sizes.map((size) => (
              <div key={size.specification} className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-semibold text-gray-800 text-lg flex items-center space-x-2">
                    <Package className="h-4 w-4 text-gray-600" />
                    <span>{size.specification}</span>
                  </h5>
                  <span className="badge badge-info">
                    {size.dots.reduce((sum, dot) => sum + dot.qty, 0)} units
                  </span>
                </div>
                
                {/* DOT Details Grid */}
                <div className="grid gap-3">
                  {/* Header */}
                  <div className="grid grid-cols-4 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-300 pb-2">
                    <div>DOT Code</div>
                    <div>Quantity</div>
                    <div>Price</div>
                    <div>Status</div>
                  </div>
                  
                  {/* DOT Rows */}
                  {size.dots.map((dot) => (
                    <div key={dot.dotCode} className="grid grid-cols-4 gap-4 items-center py-2 hover:bg-white rounded-lg px-2 transition-colors duration-150">
                      <div className="font-mono text-sm font-medium text-gray-700">
                        {dot.dotCode}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className={`font-bold ${dot.qty > 10 ? 'text-green-600' : dot.qty > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {dot.qty}
                        </span>
                        <span className="text-xs text-gray-500">pcs</span>
                      </div>
                      
                      <div className="space-y-1">
                        {dot.promoPrice && dot.promoPrice > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <TrendingDown className="h-3 w-3 text-red-600" />
                              <span className="text-red-600 font-bold text-sm">
                                ฿{dot.promoPrice.toLocaleString()}
                              </span>
                            </div>
                            <div className="line-through text-gray-500 text-xs">
                              ฿{dot.basePrice.toLocaleString()}
                            </div>
                          </div>
                        ) : (
                          <span className="font-medium text-gray-900">
                            ฿{dot.basePrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                      
                      <div>
                        {dot.promoPrice && dot.promoPrice > 0 && (
                          <span className="badge bg-red-100 text-red-800 flex items-center space-x-1">
                            <Tag className="h-3 w-3" />
                            <span>Sale</span>
                          </span>
                        )}
                        {dot.qty === 0 && (
                          <span className="badge badge-error">Out</span>
                        )}
                        {dot.qty > 0 && dot.qty <= 5 && !dot.promoPrice && (
                          <span className="badge badge-warning">Low</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}