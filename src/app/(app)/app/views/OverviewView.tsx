'use client';

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, Warehouse, ArrowLeftRight, BellRing, PackageSearch, PlusCircle, History, FileText,
} from 'lucide-react';
import { useBranch } from '@/contexts/BranchContext';
import { useOverviewData } from '@/hooks/useOverviewData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

// Helper component for KPI Cards
const KpiCard = ({ title, value, icon: Icon, isLoading }: { title: string; value: string | number; icon: React.ElementType; isLoading: boolean; }) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-3/4" />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
};

// Main Component
export default function OverviewView() {
  const router = useRouter();
  const { selectedBranchId, selectedBranch } = useBranch();
  const { kpiData, performanceData, recentTransactions, loading, error } = useOverviewData(selectedBranchId);

  const branchName = selectedBranch?.branchName || 'your branch';

  if (error) {
    return (
      <Alert variant="destructive">
        <BellRing className="h-4 w-4" />
        <AlertTitle>Error Fetching Data</AlertTitle>
        <AlertDescription>
          Could not load overview data for {branchName}. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Business Overview</h1>
            <p className="text-muted-foreground">Welcome back! Here's a summary for {branchName}.</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => router.push('/app?view=inventory&action=add')}>
                <PlusCircle className="mr-2 h-4 w-4"/> Add Product
            </Button>
            <Button variant="outline" onClick={() => router.push('/app?view=transfer_platform')}>
                <ArrowLeftRight className="mr-2 h-4 w-4"/> New Transfer
            </Button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Today's Revenue"
          value={loading || !kpiData ? "..." : `฿${kpiData.revenue.toLocaleString()}`}
          icon={DollarSign}
          isLoading={loading}
        />
        <KpiCard
          title="Inventory Value"
          value={loading || !kpiData ? "..." : `฿${kpiData.inventoryValue.toLocaleString()}`}
          icon={Warehouse}
          isLoading={loading}
        />
        <KpiCard
          title="Open Transfers"
          value={loading || !kpiData ? "..." : kpiData.openTransfers}
          icon={ArrowLeftRight}
          isLoading={loading}
        />
        <KpiCard
          title="Critical Alerts"
          value={loading || !kpiData ? "..." : kpiData.criticalAlerts}
          icon={BellRing}
          isLoading={loading}
        />
      </div>

      {/* Charts and Recent Activities */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader>
            <CardTitle>7-Day Performance</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? (
                <Skeleton className="h-[250px] w-full" />
            ) : (
                <ResponsiveContainer width="100%" height={250}>
                <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `฿${Number(value) / 1000}k`} />
                    <Tooltip formatter={(value) => [`฿${Number(value).toLocaleString()}`, "Revenue"]} />
                    <Bar dataKey="revenue" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                </BarChart>
                </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : (
                <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {recentTransactions.map((tx) => (
                          <TableRow key={tx.id}>
                              <TableCell className="font-medium">{tx.productName}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{tx.type}</Badge>
                              </TableCell>
                              <TableCell className="text-right">฿{tx.amount.toLocaleString()}</TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>

       {/* Quick Actions & Alerts */}
       <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="w-full justify-start text-left" onClick={() => router.push('/app?view=inventory')}>
                        <PackageSearch className="mr-2 h-4 w-4" />
                        <span>Manage Inventory</span>
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-left" onClick={() => router.push('/app?view=transfer_requests')}>
                        <History className="mr-2 h-4 w-4" />
                        <span>View Transfer Requests</span>
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-left" onClick={() => router.push('/app/admin/branches')}>
                         <FileText className="mr-2 h-4 w-4" />
                        <span>Generate Report</span>
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-left" onClick={() => router.push('/app/admin/users')}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        <span>Add New User</span>
                    </Button>
                </CardContent>
            </Card>
            <Alert>
                <BellRing className="h-4 w-4" />
                <AlertTitle>System Notifications</AlertTitle>
                <AlertDescription>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li><strong>Low Stock:</strong> Michelin Pilot Sport 4 (2 units left).</li>
                        <li><strong>Aging DOT:</strong> 2 tires approaching 4-year mark.</li>
                        <li>New transfer request received from Sukhumvit branch.</li>
                    </ul>
                </AlertDescription>
            </Alert>
       </div>
    </div>
  );
}

