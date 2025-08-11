'use client';
import { InventoryDetailTableProps } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

export default function InventoryDetailTable({ branches }: InventoryDetailTableProps) {
  return (
    <div className="bg-slate-50 p-4 space-y-4">
      {/* 1. วนลูปแสดงข้อมูลของแต่ละสาขา (Branch/Seller) */}
      {branches.map((branch) => (
        <div key={branch.branchName} className="bg-white rounded-lg border shadow-sm overflow-hidden">
          
          {/* ส่วนหัวของสาขา */}
          <div className="p-3 border-b bg-slate-50">
            <h4 className="flex items-center gap-2 font-semibold text-slate-800">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {branch.branchName}
            </h4>
          </div>

          {/* 2. ตารางแสดงสต็อกของสาขานั้นๆ */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 px-3 text-left font-medium">Specification</th>
                  <th className="py-2 px-3 text-left font-medium">DOT</th>
                  <th className="py-2 px-3 text-left font-medium">Qty</th>
                  <th className="py-2 px-3 text-left font-medium">Price</th>
                  <th className="py-2 px-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {branch.sizes.flatMap((size, sizeIndex) =>
                  size.dots.map((dot, dotIndex) => (
                    <tr key={`${size.specification}-${dot.dotCode}`} className="hover:bg-slate-50">
                      {/* รวมแถวของ Specification ที่เหมือนกัน */}
                      {dotIndex === 0 && (
                        <td rowSpan={size.dots.length} className="py-3 px-3 font-semibold align-top border-r">
                          {size.specification}
                        </td>
                      )}
                      <td className="py-3 px-3 font-mono text-slate-700">{dot.dotCode}</td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-lg">{dot.qty}</span>
                      </td>
                      <td className="py-3 px-3">
                        {dot.promoPrice ? (
                          <div className="flex flex-col">
                            <span className="text-green-600 font-bold">฿{dot.promoPrice.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground line-through">฿{dot.basePrice.toLocaleString()}</span>
                          </div>
                        ) : (
                          <span className="font-medium">฿{dot.basePrice.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {dot.qty > 0 ? (
                           <Button size="sm">Add to Cart</Button>
                        ) : (
                           <Badge variant="outline">Out of Stock</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}