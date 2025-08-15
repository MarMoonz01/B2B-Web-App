// src/app/components/EmptyState.tsx
import React from 'react';
import { Package, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  type: 'no-data' | 'no-results';
  onResetFilters?: () => void;
  onAddProduct?: () => void;
}

export default function EmptyState({ type, onResetFilters, onAddProduct }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="text-center py-12">
        {type === 'no-results' ? (
          <>
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Products Found</h3>
            <p className="text-gray-500 mb-4">
              Try adjusting your search filters to find what you're looking for.
            </p>
            {onResetFilters && (
              <Button onClick={onResetFilters} variant="outline">
                Clear Filters
              </Button>
            )}
          </>
        ) : (
          <>
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Inventory Data</h3>
            <p className="text-gray-500 mb-4">
              Get started by adding your first product to the inventory.
            </p>
            {onAddProduct && (
              <Button onClick={onAddProduct}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}