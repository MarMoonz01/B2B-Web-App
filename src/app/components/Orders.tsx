'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Clock, CheckCircle, XCircle, Truck, Eye, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface OrderItem {
  productName: string;
  specification: string;
  dotCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerBranch: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: Date;
  deliveryDate?: Date;
  notes?: string;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Mock data for demo (ในระบบจริงจะดึงจาก Firestore)
  useEffect(() => {
    const mockOrders: Order[] = [
      {
        id: '1',
        orderNumber: 'ORD-2025-001',
        customerName: 'TyrePlus Ratchapruek',
        customerBranch: 'Ratchapruek Branch',
        items: [
          {
            productName: 'MICHELIN PRIMACY 4',
            specification: '215/55R17 94V',
            dotCode: '2324',
            quantity: 4,
            unitPrice: 3500,
            totalPrice: 14000
          },
          {
            productName: 'BRIDGESTONE TURANZA T005',
            specification: '205/55R16 91V',
            dotCode: '3424',
            quantity: 2,
            unitPrice: 2800,
            totalPrice: 5600
          }
        ],
        totalAmount: 19600,
        status: 'pending',
        orderDate: new Date('2025-01-10'),
        notes: 'Urgent delivery requested'
      },
      {
        id: '2',
        orderNumber: 'ORD-2025-002',
        customerName: 'Central Bangkok',
        customerBranch: 'Silom Branch',
        items: [
          {
            productName: 'GOODYEAR EAGLE F1',
            specification: '225/45R18 95Y',
            dotCode: '4524',
            quantity: 8,
            unitPrice: 4200,
            totalPrice: 33600
          }
        ],
        totalAmount: 33600,
        status: 'processing',
        orderDate: new Date('2025-01-09'),
        deliveryDate: new Date('2025-01-12')
      },
      {
        id: '3',
        orderNumber: 'ORD-2025-003',
        customerName: 'Northern Wheels',
        customerBranch: 'Chiang Mai Branch',
        items: [
          {
            productName: 'CONTINENTAL PREMIUMCONTACT 6',
            specification: '195/65R15 91H',
            dotCode: '1224',
            quantity: 12,
            unitPrice: 2500,
            totalPrice: 30000
          }
        ],
        totalAmount: 30000,
        status: 'shipped',
        orderDate: new Date('2025-01-08'),
        deliveryDate: new Date('2025-01-11')
      }
    ];
    
    setOrders(mockOrders);
    setLoading(false);
  }, []);

  const getStatusBadge = (status: Order['status']) => {
    const statusConfig = {
      pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
      confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-700 border-blue-200' },
      processing: { label: 'Processing', className: 'bg-purple-100 text-purple-700 border-purple-200' },
      shipped: { label: 'Shipped', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
      delivered: { label: 'Delivered', className: 'bg-green-100 text-green-700 border-green-200' },
      cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-200' }
    };
    const config = statusConfig[status];
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  const getStatusIcon = (status: Order['status']) => {
    switch(status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'confirmed': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'processing': return <Package className="h-4 w-4 text-purple-600" />;
      case 'shipped': return <Truck className="h-4 w-4 text-indigo-600" />;
      case 'delivered': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    // Update in Firestore (implementation needed)
    setOrders(prev => 
      prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );
  };

  const filteredOrders = selectedStatus === 'all' 
    ? orders 
    : orders.filter(order => order.status === selectedStatus);

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing' || o.status === 'confirmed').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading orders...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders Management</h1>
        <p className="text-sm text-muted-foreground">Manage and track all your orders</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedStatus('all')}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedStatus('pending')}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">Pending</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedStatus('processing')}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-purple-600">Processing</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.processing}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedStatus('shipped')}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-600">Shipped</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.shipped}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedStatus('delivered')}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Delivered</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.delivered}</div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Orders</CardTitle>
          <Button size="sm">Create Order</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(order.status)}
                      {order.orderNumber}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.customerName}</div>
                      <div className="text-xs text-muted-foreground">{order.customerBranch}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {order.items.length} item{order.items.length > 1 ? 's' : ''}
                      <div className="text-xs text-muted-foreground">
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)} units
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    ฿{order.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {order.orderDate.toLocaleDateString()}
                      {order.deliveryDate && (
                        <div className="text-xs text-muted-foreground">
                          Delivery: {order.deliveryDate.toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                          <Eye className="mr-2 h-4 w-4" />View Details
                        </DropdownMenuItem>
                        {order.status === 'pending' && (
                          <>
                            <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'confirmed')}>
                              <CheckCircle className="mr-2 h-4 w-4" />Confirm Order
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'cancelled')} className="text-red-600">
                              <XCircle className="mr-2 h-4 w-4" />Cancel Order
                            </DropdownMenuItem>
                          </>
                        )}
                        {order.status === 'confirmed' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'processing')}>
                            <Package className="mr-2 h-4 w-4" />Start Processing
                          </DropdownMenuItem>
                        )}
                        {order.status === 'processing' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'shipped')}>
                            <Truck className="mr-2 h-4 w-4" />Mark as Shipped
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}