'use client';
import { BranchStockDetailsProps } from '@/types/inventory';
import React from 'react';

export default function BranchStockDetails({ branches }: BranchStockDetailsProps) {
  return (
    <tr className="bg-slate-50">
      <td colSpan={4} className="p-4">
        <div className="space-y-4">
          {branches.map((branch) => (
            <div key={branch.branchName} className="p-3 bg-white rounded-lg border">
              <h4 className="font-bold text-slate-800 mb-2">{branch.branchName}</h4>
              <div className="space-y-2">
                {branch.sizes.map((size) => (
                  <div key={size.specification} className="pl-4 border-l-2 border-slate-200">
                    <p className="font-semibold text-slate-700">{size.specification}</p>
                    <div className="mt-1 grid grid-cols-4 gap-x-4 gap-y-1 text-xs pl-4">
                      <div className="font-medium text-slate-500">DOT</div>
                      <div className="font-medium text-slate-500">Qty</div>
                      <div className="font-medium text-slate-500 col-span-2">Price</div>
                      {size.dots.map((dot) => (
                        <React.Fragment key={dot.dotCode}>
                          <div className="font-mono">{dot.dotCode}</div>
                          <div>{dot.qty}</div>
                          <div className="col-span-2">
                            {dot.promoPrice && dot.promoPrice > 0 ? (
                              <>
                                <span className="text-red-600 font-bold">฿{dot.promoPrice.toLocaleString()}</span>
                                <span className="ml-2 line-through text-gray-500">฿{dot.basePrice.toLocaleString()}</span>
                              </>
                            ) : (
                              <span>฿{dot.basePrice.toLocaleString()}</span>
                            )}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}