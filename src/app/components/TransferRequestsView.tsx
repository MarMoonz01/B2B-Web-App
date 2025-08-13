'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Order, OrderService } from '@/lib/services/InventoryService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, FileText } from 'lucide-react';

// ✅  Component ที่ขาดไป ถูกนำมาประกาศไว้ที่นี่แล้ว
const EmptyState = ({ title, message }: { title: string, message: string }) => (
    <Card className="mt-4">
        <CardContent className="py-14 text-center">
            <FileText className="h-10 w-10 mx-auto text-slate-400" />
            <p className="mt-2 font-medium text-muted-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
    </Card>
);

// ✅  Component ที่ขาดไป ถูกนำมาประกาศไว้ที่นี่แล้ว
const TransferRequestCard = ({ order, type, onApprove }: { order: Order; type: 'incoming' | 'outgoing', onApprove: (orderId: string) => void }) => {
    const fromStore = type === 'incoming' ? order.buyerBranchName : order.sellerBranchName;
    const toStore = type === 'incoming' ? order.sellerBranchName : order.buyerBranchName;
    const item = order.items[0];

    const handleApprove = async () => {
        if (!order.id) return;
        try {
            await OrderService.approveTransfer(order.id);
            alert('Transfer Approved!');
            onApprove(order.id);
        } catch (error) {
            console.error("Failed to approve transfer:", error);
            alert(`Failed to approve transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-semibold">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">{item.specification} - DOT: {item.dotCode}</p>
                    </div>
                    <Badge variant="outline">{order.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm mt-4">
                    <div className="flex items-center gap-2">
                        <span>From: {fromStore}</span>
                        <ArrowRight className="w-4 h-4" />
                        <span>To: {toStore}</span>
                    </div>
                    <span>Qty: {item.quantity}</span>
                </div>
                {order.notes && <p className="text-xs text-muted-foreground mt-2 italic">Note: "{order.notes}"</p>}
                {type === 'incoming' && order.status === 'requested' && (
                    <div className="flex gap-2 mt-4">
                        <Button size="sm" variant="outline">Details</Button>
                        <Button size="sm" onClick={handleApprove}>Approve</Button>
                        <Button size="sm" variant="destructive">Cancel</Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


export default function TransferRequestsView({ myBranchId }: { myBranchId: string }) {
    const [outgoing, setOutgoing] = useState<Order[]>([]);
    const [incoming, setIncoming] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTransfers = useCallback(async () => {
        if (!myBranchId) { setLoading(false); return; }
        setLoading(true);
        try {
            const buyerOrders = await OrderService.getOrdersByBranch(myBranchId, 'buyer');
            const sellerOrders = await OrderService.getOrdersByBranch(myBranchId, 'seller');
            setOutgoing(buyerOrders);
            setIncoming(sellerOrders);
        } catch (error) {
            console.error("Failed to fetch transfers:", error);
        } finally {
            setLoading(false);
        }
    }, [myBranchId]);

    useEffect(() => {
        fetchTransfers();
    }, [fetchTransfers]);

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-semibold">Transfers</h1>
                <p className="text-muted-foreground">Review incoming and outgoing inventory transfer requests.</p>
            </div>
            <Tabs defaultValue="outgoing">
                <TabsList>
                    <TabsTrigger value="outgoing">Outgoing ({outgoing.length})</TabsTrigger>
                    <TabsTrigger value="incoming">Incoming ({incoming.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="outgoing" className="space-y-3 mt-4">
                    {loading ? <p>Loading...</p> : outgoing.length === 0 ? <EmptyState title="No Outgoing Transfers" message='You have not requested any transfers yet.' /> : outgoing.map(order => <TransferRequestCard key={order.id} order={order} type="outgoing" onApprove={fetchTransfers} />)}
                </TabsContent>
                <TabsContent value="incoming" className="space-y-3 mt-4">
                    {loading ? <p>Loading...</p> : incoming.length === 0 ? <EmptyState title="No Incoming Transfers" message='No other branches have requested transfers from you.' /> : incoming.map(order => <TransferRequestCard key={order.id} order={order} type="incoming" onApprove={fetchTransfers} />)}
                </TabsContent>
            </Tabs>
        </div>
    );
}