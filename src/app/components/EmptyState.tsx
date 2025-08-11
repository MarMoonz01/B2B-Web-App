// src/app/components/EmptyState.tsx
import React from 'react';
import { Package, Search } from 'lucide-react';

interface EmptyStateProps {
  type: 'no-data' | 'no-results';
  onReset?: () => void;
}

export default function EmptyState({ type, onReset }: EmptyStateProps) {
  if (type === 'no-results') {
    return (
      <div className="text-center py-12">
        <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
        <p className="text-gray-500 mb-4">
          Try adjusting your search filters to find what you're looking for.
        </p>
        {onReset && (
          <button onClick={onReset} className="btn btn-primary">
            Clear Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory data</h3>
      <p className="text-gray-500">
        There's no inventory data available at the moment.
      </p>
    </div>
  );
}