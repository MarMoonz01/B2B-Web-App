"use client";

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Truck, Building, Users, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// --- Data Type Definitions ---
interface SummaryData {
  totalInventoryValue: number;
  pendingTransfers: number;
  branchCount: number;
  totalUsers: number;
}

interface ChartData {
  name: string;
  value?: number;
  transfers?: number;
}


const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

// --- Main Component ---
export default function AnalyticsView() {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [inventoryByBranchData, setInventoryByBranchData] = useState<ChartData[]>([]);
  const [transfersOverTimeData, setTransfersOverTimeData] = useState<ChartData[]>([]);
  const [productCategoriesData, setProductCategoriesData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/analytics/summary');
        if (!res.ok) {
          throw new Error(`Failed to fetch analytics data. Status: ${res.status}`);
        }
        const data = await res.json();
        if (data.ok) {
          setSummaryData(data.summaryData);
          setInventoryByBranchData(data.inventoryByBranchData);
          setTransfersOverTimeData(data.transfersOverTimeData);
          setProductCategoriesData(data.productCategoriesData);
        } else {
          throw new Error(data.error || 'An unknown error occurred');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return <AnalyticsLoadingSkeleton />;
  }

  if (error) {
    return <AnalyticsErrorState message={error} />;
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">An overview of your business performance.</p>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard 
            icon={DollarSign} 
            title="Total Inventory Value" 
            value={`฿${summaryData?.totalInventoryValue.toLocaleString() ?? '0'}`} 
            footer="Across all branches" />
        <SummaryCard 
            icon={Truck} 
            title="Pending Transfers" 
            value={summaryData?.pendingTransfers ?? 0}
            footer="Awaiting approval" />
        <SummaryCard 
            icon={Building} 
            title="Active Branches" 
            value={summaryData?.branchCount ?? 0}
            footer="In the network" />
        <SummaryCard 
            icon={Users} 
            title="Total Users" 
            value={summaryData?.totalUsers ?? 0}
            footer="Across all roles" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Transfer Volume Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={transfersOverTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="transfers" stroke="#8884d8" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Product Category Distribution</CardTitle></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie data={productCategoriesData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {productCategoriesData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <Card className="lg:col-span-5">
            <CardHeader><CardTitle>Inventory Value by Branch</CardTitle></CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={inventoryByBranchData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(value) => `฿${Number(value).toLocaleString()}`} />
                        <Tooltip formatter={(value) => `฿${Number(value).toLocaleString()}`} />
                        <Legend />
                        <Bar dataKey="value" fill="#82ca9d" name="Inventory Value" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Helper Components ---
function SummaryCard({ icon: Icon, title, value, footer }: { icon: React.ElementType, title: string, value: string | number, footer: string }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{footer}</p>
            </CardContent>
        </Card>
    )
}

function AnalyticsLoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <header>
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-4 w-1/3 mt-2" />
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Skeleton className="lg:col-span-3 h-80" />
        <Skeleton className="lg:col-span-2 h-80" />
        <Skeleton className="lg:col-span-5 h-80" />
      </div>
    </div>
  );
}

function AnalyticsErrorState({ message }: { message: string }) {
    return(
        <div className="p-6">
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <AlertCircle /> Could Not Load Analytics
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>There was an error fetching the dashboard data.</p>
                    <pre className="mt-2 p-2 bg-muted rounded-md text-sm">Error: {message}</pre>
                </CardContent>
            </Card>
        </div>
    )
}