'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { InventoryTableProps } from '@/types/inventory';
import BranchStockDetails from './BranchStockDetails'; // <-- Import component ใหม่

export default function InventoryTable({ inventory }: InventoryTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (productId: string) => {
    setExpandedRow(expandedRow === productId ? null : productId);
  };

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Available</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {inventory.map((item) => (
            <React.Fragment key={item.id}>
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <button onClick={() => toggleRow(item.id)} className="mr-2 p-1 hover:bg-gray-200 rounded-full">
                      {expandedRow === item.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="font-medium text-gray-900">{item.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full font-medium bg-green-100 text-green-800">
                    {item.totalAvailable}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="btn-primary">Order All</button>
                </td>
              </tr>
              {expandedRow === item.id && (
                <BranchStockDetails branches={item.branches} />
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}