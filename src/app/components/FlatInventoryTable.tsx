'use client';

import { GroupedProduct } from '@/types/inventory';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Eye, Upload, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface FlatInventoryTableProps {
  inventory: GroupedProduct[];
}

// ฟังก์ชันสำหรับกำหนดสถานะของสต็อก
const getStockStatus = (total: number) => {
  if (total === 0) return { 
    label: 'Out of Stock', 
    className: 'bg-red-100 text-red-700 border-red-200',
    dotClassName: 'bg-red-500' 
  };
  if (total <= 10) return { 
    label: 'Low Stock', 
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    dotClassName: 'bg-yellow-500'
  };
  return { 
    label: 'In Stock', 
    className: 'bg-green-100 text-green-700 border-green-200',
    dotClassName: 'bg-green-500'
  };
};

export default function FlatInventoryTable({ inventory }: FlatInventoryTableProps) {
  return (
    <Card>
        <CardHeader className='flex-row items-center justify-between py-2 px-3'>
            <CardTitle className='text-sm'>Inventory Items</CardTitle>
            <div className='flex gap-1'>
                <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-2" />Import</Button>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Product</Button>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="border-t">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[280px] px-3">Product Name</TableHead>
                            <TableHead className="px-2">Brand</TableHead>
                            <TableHead className="px-2">SKU</TableHead>
                            <TableHead className="px-2">DOT</TableHead>
                            <TableHead className="px-2">Price</TableHead>
                            <TableHead className="px-2 text-center">Stock</TableHead>
                            <TableHead className="px-2">Status</TableHead>
                            <TableHead className="w-[80px] text-right pr-3">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inventory.flatMap(product =>
                          product.branches.flatMap(branch =>
                            branch.sizes.flatMap(size =>
                              size.dots.map(dot => {
                                const status = getStockStatus(dot.qty);
                                const displayPrice = dot.promoPrice || dot.basePrice || 0;

                                return (
                                    <TableRow key={`${product.id}-${size.specification}-${dot.dotCode}`}>
                                        <TableCell className="font-medium px-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`block w-2 h-2 rounded-full ${status.dotClassName}`}></span>
                                                <div>
                                                    <div>{product.name}</div>
                                                    <div className="text-xs text-muted-foreground">{size.specification}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-2">{product.name.split(' ')[0]}</TableCell>
                                        <TableCell className="text-muted-foreground px-2">{`SKU-${product.id.substring(0, 5)}-${size.specification.substring(0,6)}`}</TableCell>
                                        <TableCell className="font-mono text-sm px-2">{dot.dotCode}</TableCell>
                                        <TableCell className="px-2">฿{displayPrice.toLocaleString()}</TableCell>
                                        <TableCell className="font-semibold text-center px-2">{dot.qty}</TableCell>
                                        <TableCell className="px-2">
                                            <Badge variant="outline" className={`font-normal text-xs ${status.className}`}>{status.label}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-3">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem className="text-sm"><Eye className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-sm"><Pencil className="mr-2 h-4 w-4" />Edit Product</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                              })
                            )
                          )
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
  );
}