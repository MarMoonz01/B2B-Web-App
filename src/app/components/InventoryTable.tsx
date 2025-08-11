'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { InventoryListProps } from '@/types/inventory';
import InventoryDetailTable from './InventoryDetailTable';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import InventoryDetailView from './InventoryDetailView';

export default function InventoryTable({ inventory }: InventoryListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getStockStatus = (total: number) => {
    if (total === 0) return { label: 'Out of Stock', variant: 'destructive' as const };
    if (total <= 10) return { label: 'Low Stock', variant: 'default' as const, className: 'bg-yellow-500 text-white hover:bg-yellow-500/80' };
    return { label: 'In Stock', variant: 'default' as const, className: 'bg-green-600 text-white hover:bg-green-600/80' };
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
    <div className="space-y-4">
      {inventory.map((product) => {
        const status = getStockStatus(product.totalAvailable);
        const isExpanded = expandedId === product.id;

        return (
          <Card key={product.id} className="overflow-hidden transition-all duration-300">
            <CardHeader 
              className="p-4 flex flex-row items-center justify-between cursor-pointer hover:bg-slate-50" 
              onClick={() => toggleExpand(product.id)}
            >
              <div className="flex items-center gap-4">
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                <div>
                  <CardTitle className="text-base sm:text-lg">{product.name}</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">
                    Total <span className="font-bold">{product.totalAvailable}</span> units across {product.branches.length} branch(es)
                  </div>
                </div>
                <Badge variant={status.variant} className={status.className}>{status.label}</Badge>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <Button size="sm">Details</Button>
                <Button size="sm" variant="outline">Order Stock</Button>
              </div>
            </CardHeader>

            {isExpanded && (
              <div className="animate-slide-down border-t">
                <InventoryDetailView branches={product.branches} /> 
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}