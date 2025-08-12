// src/app/components/Dashboard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingUp, Users, FileText } from 'lucide-react';

export default function Dashboard() {
    // Mock data or props passed from main page
    const stats = {
        dealerNetwork: 4,
        yourProducts: 1250,
        pendingOrders: 1,
        monthlySpent: 80,
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Dealer Network</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.dealerNetwork}</div>
                        <p className="text-xs text-muted-foreground">Active dealers</p>
                    </CardContent>
                </Card>
                {/* ... สร้าง Card อื่นๆ ตามรูปภาพ ... */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Your Products</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.yourProducts}</div>
                         <p className="text-xs text-muted-foreground">Total unique products</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingOrders}</div>
                         <p className="text-xs text-muted-foreground">Awaiting your approval</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Spent</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">฿{stats.monthlySpent.toLocaleString()}</div>
                         <p className="text-xs text-muted-foreground">+15.2% from last month</p>
                    </CardContent>
                </Card>
            </div>
             {/* ส่วนอื่นๆ เช่น Recent Activity, Order Summary สามารถสร้างเป็น Card เพิ่มเติมได้ */}
        </div>
    )
}