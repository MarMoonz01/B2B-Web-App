'use client';

import React from 'react';
import { GroupedProduct } from '@/types/inventory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, MoreHorizontal } from 'lucide-react';

// --- Helper function to get stock status ---
const getStockStatus = (total: number) => {
  if (total === 0) return { 
    label: 'Out of Stock', 
    className: 'bg-red-100 text-red-700 border-red-200',
  };
  if (total <= 10) return { 
    label: 'Low Stock', 
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  };
  return { 
    label: 'In Stock', 
    className: 'bg-green-100 text-green-700 border-green-200',
  };
};

// --- Helper to find min/max price ---
const getPriceRange = (product: GroupedProduct) => {
    let minPrice = Infinity;
    let maxPrice = 0;

    product.branches.forEach(branch => {
        branch.sizes.forEach(size => {
            size.dots.forEach(dot => {
                const price = dot.promoPrice || dot.basePrice;
                if (price < minPrice) minPrice = price;
                if (price > maxPrice) maxPrice = price;
            });
        });
    });

    if (minPrice === Infinity) return 'N/A';
    if (minPrice === maxPrice) return `฿${minPrice.toLocaleString()}`;
    return `฿${minPrice.toLocaleString()} - ฿${maxPrice.toLocaleString()}`;
}


export default function InventoryMatrixView({ inventory }: { inventory: GroupedProduct[] }) {
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {inventory.map((product) => {
        const status = getStockStatus(product.totalAvailable);
        const priceRange = getPriceRange(product);

        return (
          <Card key={product.id} className="flex flex-col">
            <CardHeader className="p-4">
              <div className="flex justify-between items-start">
                  <div className="flex-shrink-0 bg-slate-100 rounded-md h-10 w-10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-slate-500"/>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                     <MoreHorizontal className="h-4 w-4"/>
                  </Button>
              </div>
              <CardTitle className="text-sm font-medium pt-2">{product.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex-grow flex flex-col justify-end">
                <div>
                    <Badge variant="outline" className={`text-xs mb-2 ${status.className}`}>{status.label}</Badge>
                    <div className="text-xs text-muted-foreground">
                        Stock: <span className="font-bold text-foreground">{product.totalAvailable} units</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Price: <span className="font-bold text-foreground">{priceRange}</span>
                    </div>
                </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}