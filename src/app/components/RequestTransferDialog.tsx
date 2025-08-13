'use client';

import React, { useState } from 'react';
import { GroupedProduct, OrderService } from '@/lib/services/InventoryService';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner'; // Assuming you have sonner installed

interface RequestTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: GroupedProduct | null;
  fromBranchId: string;
  fromBranchName: string;
  myBranchId: string;
  myBranchName: string;
  onSuccess: () => void;
}

export default function RequestTransferDialog({ open, onOpenChange, product, fromBranchId, fromBranchName, myBranchId, myBranchName, onSuccess }: RequestTransferDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  
  const handleSubmit = async () => {
    if (!product) return;
    
    const fromStoreInfo = product.branches.find(b => b.branchId === fromBranchId);
    if (!fromStoreInfo) return;

    // A real implementation would let the user select the specific size/dot
    const size = fromStoreInfo.sizes[0];
    const dot = size?.dots[0];

    if (!size || !dot) {
      toast.error("Product variant not found.");
      return;
    }

    try {
      await OrderService.createOrder({
        buyerBranchId: myBranchId,
        buyerBranchName: myBranchName,
        sellerBranchId: fromBranchId,      // Correct: at the top level of the order
        sellerBranchName: fromBranchName,  // Correct: at the top level of the order
        status: 'requested',
        totalAmount: (dot.promoPrice || dot.basePrice) * quantity,
        notes: notes,
        items: [{
          productId: product.id,
          productName: product.name,
          specification: size.specification,
          dotCode: dot.dotCode,
          quantity: quantity,
          unitPrice: (dot.promoPrice || dot.basePrice),
          totalPrice: (dot.promoPrice || dot.basePrice) * quantity,
          // sellerBranchId: fromBranchId,      //  <-- ❌ ลบบรรทัดนี้
          // sellerBranchName: fromBranchName,  //  <-- ❌ ลบบรรทัดนี้
          variantId: (size as any).variantId,
        }],
      });
      onSuccess();
      toast.success("Transfer request submitted successfully!");
    } catch (error) {
      console.error("Failed to create transfer request", error);
      toast.error("Failed to submit request. See console for details.");
    }
  };
  
  const fromStoreInfo = product?.branches.find(b => b.branchId === fromBranchId);
  const variant = fromStoreInfo?.sizes[0];
  const dotInfo = variant?.dots[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Inventory Transfer</DialogTitle>
          <DialogDescription>
            Create a transfer request to move {product?.name} inventory between stores.
          </DialogDescription>
        </DialogHeader>
        
        <div className="border rounded-lg p-4 space-y-2">
          <h3 className="font-semibold">{product?.name}</h3>
          <p className="text-sm text-muted-foreground">{variant?.specification} | DOT: {dotInfo?.dotCode}</p>
          <div className="flex justify-between items-end">
             <div><span className="text-xs">Available</span><p>{dotInfo?.qty}</p></div>
             <div><span className="text-xs">Price</span><p>${dotInfo?.basePrice}</p></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium">From Store</label>
            <Input value={fromBranchName} readOnly className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium">To Store</label>
             <Input value={myBranchName} readOnly className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium">Quantity</label>
            <Input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min={1} max={dotInfo?.qty} className="mt-1" />
          </div>
           <div>
            <label className="text-xs font-medium">DOT Code</label>
            <Input value={dotInfo?.dotCode} readOnly className="mt-1" />
          </div>
        </div>

        <div>
            <label className="text-xs font-medium">Note (Optional)</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any additional information..." className="mt-1" />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Submit Transfer Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}