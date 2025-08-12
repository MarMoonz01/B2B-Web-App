'use client';

import React, { useState } from 'react';
import { InventoryListProps, DotDetail } from '@/types/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Edit, ChevronDown, MapPin, ShoppingCart, Tag, ArrowRight } from 'lucide-react';

// --- Interfaces for restructured data ---
interface SizeGroup {
  specification: string;
  totalUnits: number;
  branches: {
    branchName: string;
    totalUnits: number;
    dots: DotDetail[];
  }[];
}

// --- Helper Functions ---
const getStockStatus = (total: number) => {
    if (total === 0) return { label: 'Out of Stock', variant: 'destructive' as const, className: 'bg-red-100 text-red-700 border-red-200' };
    if (total <= 10) return { label: 'Low Stock', variant: 'default' as const, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    return { label: 'In Stock', variant: 'default' as const, className: 'bg-green-100 text-green-800 border-green-200' };
};

const getQtyColor = (qty: number) => {
    if (qty === 0) return 'text-red-500';
    if (qty <= 10) return 'text-yellow-600';
    return 'text-green-600';
};

export default function InventoryTable({ inventory }: InventoryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (!inventory || inventory.length === 0) {
      return (
          <Card>
              <div className="py-20 text-center">
                  <Package className="h-12 w-12 mx-auto text-slate-400" />
                  <p className="mt-4 text-muted-foreground">No products found for your current filter.</p>
              </div>
          </Card>
      );
  }

  return (
    <div className="space-y-3">
      {inventory.map((product) => {
        const isExpanded = expandedId === product.id;
        const status = getStockStatus(product.totalAvailable);

        const groupedSizes: SizeGroup[] = (() => {
          if (!isExpanded) return [];
          const sizesMap = new Map<string, { totalUnits: number; branches: Map<string, { totalUnits: number; dots: DotDetail[] }> }>();
          product.branches.forEach(branch => {
            branch.sizes.forEach(size => {
              if (!sizesMap.has(size.specification)) {
                sizesMap.set(size.specification, { totalUnits: 0, branches: new Map() });
              }
              const sizeGroup = sizesMap.get(size.specification)!;
              const dotTotal = size.dots.reduce((sum, dot) => sum + dot.qty, 0);
              sizeGroup.totalUnits += dotTotal;
              sizeGroup.branches.set(branch.branchName, { totalUnits: dotTotal, dots: size.dots });
            });
          });
          return Array.from(sizesMap.entries()).map(([spec, data]) => ({
            specification: spec,
            totalUnits: data.totalUnits,
            branches: Array.from(data.branches.entries()).map(([branchName, branchData]) => ({
              branchName,
              totalUnits: branchData.totalUnits,
              dots: branchData.dots,
            })),
          }));
        })();

        return (
          <Card key={product.id} className="overflow-hidden transition-all duration-300 bg-white">
            {/* Collapsed Header (Clickable Trigger) */}
            <div 
              className="flex items-center justify-between p-3 pr-2 cursor-pointer hover:bg-slate-50"
              onClick={() => toggleExpand(product.id)}
            >
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 bg-slate-100 rounded-md h-10 w-10 flex items-center justify-center">
                       <Package className="h-5 w-5 text-slate-500"/>
                    </div>
                    <div>
                        <p className="text-base font-medium">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                             <Badge variant="outline" className={`text-xs ${status.className}`}>{status.label}</Badge>
                             <span className="text-xs text-muted-foreground">{product.totalAvailable} total units</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="text-xs" onClick={(e) => e.stopPropagation()}>Edit</Button>
                    <div className="px-2">
                        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </div>
            
            {/* Expanded Content */}
            {isExpanded && (
              <CardContent className="p-0 animate-slide-down border-t bg-slate-50/50">
                <div className="p-4 space-y-4">
                  {groupedSizes.map(size => (
                    <div key={size.specification} className="bg-white rounded-lg border">
                      {/* Size Header */}
                      <div className="flex justify-between items-center p-3 border-b">
                          <div className="flex items-center gap-3">
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            <div>
                               <h3 className="font-semibold text-sm">{`Tire Size: ${size.specification}`}</h3>
                               <p className="text-xs text-muted-foreground">{size.totalUnits} units available across branches</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="font-semibold">{size.totalUnits} total</Badge>
                      </div>
                      
                      {/* Branches & DOTs List */}
                      <div className="divide-y">
                          {size.branches.map(branch => (
                              <div key={branch.branchName} className="p-4">
                                  <div className="flex justify-between items-center mb-3">
                                      <h4 className="text-sm font-medium flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        {branch.branchName} ({branch.totalUnits} units)
                                      </h4>
                                      <Badge variant="secondary">{branch.dots.length} DOT codes</Badge>
                                  </div>
                                  <div className="space-y-2 pl-6">
                                      {branch.dots.map((dot, index) => (
                                          <div key={dot.dotCode} className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50">
                                              <div className="flex items-center gap-3">
                                                  <Tag className="h-4 w-4 text-slate-400" />
                                                  <div>
                                                      <p className="font-mono text-sm">{dot.dotCode}</p>
                                                      <p className={`text-sm font-bold ${getQtyColor(dot.qty)}`}>{dot.qty} units</p>
                                                  </div>
                                              </div>
                                              <div className="flex items-center gap-6">
                                                  <div className="text-right">
                                                      <div className="flex items-baseline gap-2">
                                                        {dot.promoPrice && <p className="text-xs text-muted-foreground line-through">฿{dot.basePrice.toLocaleString()}</p>}
                                                        <p className="font-bold text-green-600 text-base">฿{(dot.promoPrice || dot.basePrice).toLocaleString()}</p>
                                                      </div>
                                                      {dot.promoPrice && <p className="text-xs text-green-600">Save ฿{(dot.basePrice - dot.promoPrice).toLocaleString()}</p>}
                                                  </div>
                                                  {/* Placeholder for price comparison */}
                                                  <div className={`text-xs flex items-center gap-1 ${index % 2 === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    <ArrowRight className="h-3 w-3" />
                                                    <span>{index % 2 === 0 ? `฿25 lower` : '฿125 higher'}</span>
                                                  </div>
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
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}