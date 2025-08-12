'use client';

import React, { useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { GroupedProduct } from '@/types/inventory';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from '@/components/ui/card';

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

// --- Flatten data structure for the table ---
type FlatInventoryItem = {
  productName: string;
  specification: string;
  brand: string;
  sku: string;
  dotCode: string;
  price: number;
  stock: number;
  promoPrice?: number;
};

const columnHelper = createColumnHelper<FlatInventoryItem>();

// --- Define Table Columns ---
const columns = [
  columnHelper.accessor(row => `${row.productName} (${row.specification})`, {
    id: 'productName',
    header: () => <span>Product Name (Size)</span>,
    cell: info => <div className="font-medium text-sm">{info.getValue()}</div>,
  }),
  columnHelper.accessor('brand', {
    header: 'Brand',
    cell: info => <span className="text-sm">{info.getValue()}</span>,
  }),
  columnHelper.accessor('sku', {
    header: 'SKU',
    cell: info => <span className="text-muted-foreground text-xs">{info.getValue()}</span>,
  }),
  columnHelper.accessor('dotCode', {
    header: 'DOT',
    cell: info => <span className="font-mono text-xs">{info.getValue()}</span>,
  }),
  columnHelper.accessor('price', {
    header: () => <div className="text-right">Price</div>,
    cell: info => {
      const originalPrice = info.getValue();
      const promoPrice = info.row.original.promoPrice;
      return (
        <div className="text-right text-sm">
            {promoPrice ? (
                <div className="flex flex-col">
                    <span className="font-bold text-green-600">฿{promoPrice.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground line-through">฿{originalPrice.toLocaleString()}</span>
                </div>
            ) : (
                <span className="font-medium">฿{originalPrice.toLocaleString()}</span>
            )}
        </div>
      );
    }
  }),
  columnHelper.accessor('stock', {
    header: () => <div className="text-center">Stock</div>,
    cell: info => <div className="text-center font-semibold text-sm">{info.getValue()}</div>,
  }),
  columnHelper.accessor(row => row.stock, {
    id: 'status',
    header: 'Status',
    cell: info => {
      const status = getStockStatus(info.getValue());
      return <Badge variant="outline" className={`font-normal text-xs ${status.className}`}>{status.label}</Badge>;
    },
  }),
];

// --- Main Table Component ---
// Rename the component function to avoid confusion
export default function FlatInventoryTable({ inventory }: { inventory: GroupedProduct[] }) {
  const flatData = useMemo(() => {
    return inventory.flatMap(product =>
      product.branches.flatMap(branch =>
        branch.sizes.flatMap(size =>
          size.dots.map(dot => ({
            productName: product.name,
            specification: size.specification,
            brand: product.name.split(' ')[0],
            sku: `SKU-${product.id.substring(0, 5)}-${size.specification.substring(0,6)}`,
            dotCode: dot.dotCode,
            price: dot.basePrice,
            promoPrice: dot.promoPrice,
            stock: dot.qty,
          }))
        )
      )
    );
  }, [inventory]);

  const table = useReactTable({
    data: flatData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card>
      <CardContent className="p-0">
         <div className="border-t">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map(row => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
         </div>
      </CardContent>
    </Card>
  );
}