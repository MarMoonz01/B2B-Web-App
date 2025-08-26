// src/app/components/EmptyState.tsx
import React from 'react';
import { Package, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// 👇 [แก้ไข] เพิ่ม props title, description, และ children เข้าไป
interface EmptyStateProps {
  type?: 'no-data' | 'no-results';
  title?: string;
  description?: string;
  children?: React.ReactNode;
  onResetFilters?: () => void;
  onAddProduct?: () => void;
}

// 👇 [แก้ไข] อัปเดต function signature
export default function EmptyState({ type, title, description, children, onResetFilters, onAddProduct }: EmptyStateProps) {
  // 👇 [แก้ไข] เพิ่ม logic สำหรับการแสดงผลแบบทั่วไป
  const content = {
    'no-results': {
      icon: <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />,
      title: 'No Products Found',
      description: 'Try adjusting your search filters to find what you\'re looking for.',
      action: onResetFilters && <Button onClick={onResetFilters} variant="outline">Clear Filters</Button>,
    },
    'no-data': {
      icon: <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />,
      title: 'No Inventory Data',
      description: 'Get started by adding your first product to the inventory.',
      action: onAddProduct && <Button onClick={onAddProduct}><Plus className="h-4 w-4 mr-2" />Add Product</Button>,
    },
    'custom': {
      icon: children,
      title: title,
      description: description,
      action: null,
    }
  };

  const selectedContent = type ? content[type] : content['custom'];

  return (
    <Card>
      <CardContent className="text-center py-12">
        {selectedContent.icon}
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{selectedContent.title}</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {selectedContent.description}
        </p>
        {selectedContent.action}
      </CardContent>
    </Card>
  );
}