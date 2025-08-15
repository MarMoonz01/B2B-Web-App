'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useBranch } from '@/contexts/BranchContext';
import { FirebaseTest } from '@/src/app/components/FirebaseTest'; // เพิ่มนี้

// views
import MyInventory from '@/src/app/components/MyInventory';
import TransferPlatformView from '@/src/app/components/TransferPlatformView';
import TransferRequestsView from '@/src/app/components/TransferRequestsView';

// UI helpers
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ViewKey =
  | 'inventory'
  | 'transfer_platform'
  | 'transfer_requests'
  | 'dashboard'
  | 'network'
  | 'debug'; // เพิ่ม debug view

function isViewKey(v: string | null): v is ViewKey {
  return !!v && ['inventory','transfer_platform','transfer_requests','dashboard','network','debug'].includes(v);
}

export default function Page() {
  const search = useSearchParams();
  const { selectedBranch, selectedBranchId, branches, loading, error } = useBranch();

  const view: ViewKey = isViewKey(search?.get('view')) ? (search!.get('view') as ViewKey) : 'inventory';
  const myBranchId = selectedBranchId || '';
  const myBranchName = selectedBranch?.branchName || selectedBranchId || 'My Branch';

  // Debug view
  if (view === 'debug') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">🐛 Debug Information</h1>
        
        <FirebaseTest />
        
        <Card>
          <CardHeader>
            <CardTitle>Branch Context Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div><Badge variant={loading ? "secondary" : "default"}>Loading: {loading.toString()}</Badge></div>
            <div><Badge variant={error ? "destructive" : "default"}>Error: {error || 'None'}</Badge></div>
            <div><strong>Selected Branch ID:</strong> {selectedBranchId || 'None'}</div>
            <div><strong>Selected Branch Name:</strong> {selectedBranch?.branchName || 'None'}</div>
            <div><strong>Total Branches:</strong> {branches.length}</div>
            
            {branches.length > 0 && (
              <div>
                <strong>Available Branches:</strong>
                <ul className="mt-1 space-y-1">
                  {branches.map((b) => (
                    <li key={b.id} className="text-sm bg-gray-100 p-1 rounded">
                      <strong>{b.id}:</strong> {b.branchName} 
                      {b.isActive ? <Badge className="ml-2" variant="default">Active</Badge> : <Badge className="ml-2" variant="secondary">Inactive</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Environment Variables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm font-mono">
              <div>API Key: {process.env.NEXT_PUBLIC_FB_API_KEY ? '✅ Set' : '❌ Missing'}</div>
              <div>Auth Domain: {process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN ? '✅ Set' : '❌ Missing'}</div>
              <div>Project ID: {process.env.NEXT_PUBLIC_FB_PROJECT_ID || '❌ Missing'}</div>
              <div>Storage Bucket: {process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET ? '✅ Set' : '❌ Missing'}</div>
              <div>Messaging Sender ID: {process.env.NEXT_PUBLIC_FB_MESSAGING_SENDER_ID ? '✅ Set' : '❌ Missing'}</div>
              <div>App ID: {process.env.NEXT_PUBLIC_FB_APP_ID ? '✅ Set' : '❌ Missing'}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // แสดง error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">❌ Database Connection Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-red-600">{error}</p>
          <div className="space-y-2">
            <p><strong>Possible solutions:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Check your Firebase configuration in <code>.env.local</code></li>
              <li>Verify your Firebase project settings</li>
              <li>Check Firestore security rules</li>
              <li>Ensure you have internet connection</li>
            </ul>
          </div>
          <Button onClick={() => window.location.reload()}>🔄 Reload Page</Button>
          <Button variant="outline" onClick={() => window.open('?view=debug', '_blank')}>🐛 Open Debug View</Button>
        </CardContent>
      </Card>
    );
  }

  // แสดง loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>⏳ Loading...</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Connecting to database and loading branch information...</p>
          <div className="mt-4">
            <Button variant="outline" onClick={() => window.open('?view=debug', '_blank')}>🐛 Debug Info</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ป้องกัน edge case ที่ยังไม่มีสาขา
  if (!myBranchId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>🏪 Select a branch to get started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>เลือกสาขาจากเมนูด้านซ้ายบน (BranchSelect) แล้วหน้านี้จะโหลดข้อมูลให้โดยอัตโนมัติ</p>
          
          {branches.length === 0 && (
            <div className="space-y-2">
              <p className="text-amber-600"><strong>⚠️ No branches found in database</strong></p>
              <p>You may need to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Add some branch data to your Firestore 'stores' collection</li>
                <li>Check your Firestore security rules</li>
                <li>Verify your Firebase configuration</li>
              </ul>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open('?view=debug', '_blank')}>🐛 Debug Info</Button>
            <Button onClick={() => window.location.reload()}>🔄 Reload</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // แสดง view ตามปกติ
  switch (view) {
    case 'inventory':
      return <MyInventory myBranchId={myBranchId} myBranchName={myBranchName} />;
    case 'transfer_platform':
      return <TransferPlatformView myBranchId={myBranchId} myBranchName={myBranchName} />;
    case 'transfer_requests':
      return <TransferRequestsView myBranchId={myBranchId} />;
    case 'dashboard':
      return (
        <Card>
          <CardHeader>
            <CardTitle>Dashboard (placeholder)</CardTitle>
          </CardHeader>
          <CardContent>ใส่กราฟหรือ KPI รวมที่ต้องการในภายหลังได้ที่นี่</CardContent>
        </Card>
      );
    case 'network':
      return (
        <Card>
          <CardHeader>
            <CardTitle>Branches (placeholder)</CardTitle>
          </CardHeader>
          <CardContent>หน้านี้สำหรับจัดการ/ดูรายการสาขา</CardContent>
        </Card>
      );
    default:
      return <MyInventory myBranchId={myBranchId} myBranchName={myBranchName} />;
  }
}