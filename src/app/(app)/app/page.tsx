// src/app/page.tsx - Full width, no implicit max-width anywhere (final)
'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useBranch } from '@/contexts/BranchContext';
import { FirebaseTest } from '@/src/app/components/FirebaseTest';

// views
import MyInventory from '@/src/app/components/MyInventory';
import TransferPlatformView from '@/src/app/components/TransferPlatformView';
import TransferRequestsView from '@/src/app/components/TransferRequestsView';

// UI helpers
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ใช้ type เดียวกับ /types/nav.ts
import type { ViewKey } from '@/types/nav';

function isViewKey(v: string | null): v is ViewKey {
  return !!v && [
    'inventory','transfer_platform','transfer_requests',
    'dashboard','network','analytics','debug'
  ].includes(v);
}

export default function Page() {
  const search = useSearchParams();
  const router = useRouter();
  const { selectedBranch, selectedBranchId, branches, loading, error } = useBranch();

  const view: ViewKey = isViewKey(search?.get('view'))
    ? (search!.get('view') as ViewKey)
    : 'inventory';

  const myBranchId = selectedBranchId || '';
  const myBranchName = selectedBranch?.branchName || selectedBranchId || 'My Branch';

  // Wrapper กลาง: บังคับเต็มจอ + กันโอเวอร์โฟลว์แนวนอน
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="w-full min-h-dvh overflow-x-hidden">
      <div className="w-full max-w-none p-6">
        {children}
      </div>
    </div>
  );

  const handleNavigate = React.useCallback((targetView: ViewKey) => {
    router.push(`/app?view=${targetView}`);
  }, [router]);
  // Debug view
  if (view === 'debug') {
    return (
      <Wrapper>
        <h1 className="text-2xl font-bold">🐛 Debug Information</h1>

        <FirebaseTest />

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Branch Context Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Badge variant={loading ? 'secondary' : 'default'}>
                Loading: {loading.toString()}
              </Badge>
            </div>
            <div>
              <Badge variant={error ? 'destructive' : 'default'}>
                Error: {error ? String(error) : 'None'}
              </Badge>
            </div>
            <div><strong>Selected Branch ID:</strong> {selectedBranchId || 'None'}</div>
            <div><strong>Selected Branch Name:</strong> {selectedBranch?.branchName || 'None'}</div>
            <div><strong>Total Branches:</strong> {branches?.length ?? 0}</div>

            {!!(branches?.length) && (
              <div>
                <strong>Available Branches:</strong>
                <ul className="mt-1 space-y-1">
                  {branches!.map((b) => (
                    <li key={b.id} className="text-sm bg-gray-100 p-1 rounded">
                      <strong>{b.id}:</strong> {b.branchName}
                      {b.isActive ? (
                        <Badge className="ml-2" variant="default">Active</Badge>
                      ) : (
                        <Badge className="ml-2" variant="secondary">Inactive</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="w-full">
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

        <Button onClick={() => handleNavigate('inventory')}>Back to Inventory</Button>
      </Wrapper>
    );
  }

  // Error
  if (error) {
    return (
      <Wrapper>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-red-600">❌ Database Connection Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-600">{String(error)}</p>
            <div className="space-y-2">
              <p><strong>Possible solutions:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Check your Firebase configuration in <code>.env.local</code></li>
                <li>Verify your Firebase project settings</li>
                <li>Check Firestore security rules</li>
                <li>Ensure you have internet connection</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>🔄 Reload Page</Button>
              <Button variant="outline" onClick={() => handleNavigate('debug')}>🐛 Open Debug View</Button>
            </div>
          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  // Loading
  if (loading) {
    return (
      <Wrapper>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>⏳ Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Connecting to database and loading branch information...</p>
            <div className="mt-4">
              <Button variant="outline" onClick={() => handleNavigate('debug')}>🐛 Debug Info</Button>
            </div>
          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  // ไม่มีสาขา
  if (!myBranchId) {
    return (
      <Wrapper>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>🏪 Select a branch to get started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>เลือกสาขาจากเมนูด้านซ้ายบน (BranchSelect) แล้วหน้านี้จะโหลดข้อมูลให้โดยอัตโนมัติ</p>

            {(branches?.length ?? 0) === 0 && (
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
              <Button variant="outline" onClick={() => handleNavigate('debug')}>🐛 Debug Info</Button>
              <Button onClick={() => window.location.reload()}>🔄 Reload</Button>
            </div>
          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  // ปกติ
  return (
    <Wrapper>
      {(() => {
        switch (view) {
          case 'inventory':
            return (
              <MyInventory
                myBranchId={myBranchId}
                myBranchName={myBranchName}
                onNavigate={handleNavigate}
              />
            );
          case 'transfer_platform':
            return (
              <TransferPlatformView
                myBranchId={myBranchId}
                myBranchName={myBranchName}
              />
            );
          case 'transfer_requests':
            return (
              <TransferRequestsView
                myBranchId={myBranchId}
                myBranchName=""
              />
            );
          case 'dashboard':
          case 'analytics':
            return (
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Analytics Dashboard (placeholder)</CardTitle>
                </CardHeader>
                <CardContent>ใส่กราฟหรือ KPI รวมที่ต้องการในภายหลังได้ที่นี่</CardContent>
              </Card>
            );
          case 'network':
            return (
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Branches (placeholder)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>หน้านี้สำหรับจัดการ/ดูรายการสาขา</p>

                  <div className="space-y-2">
                    <p><strong>Available Branches:</strong></p>
                    <div className="grid gap-2">
                      {(branches ?? []).map((branch) => (
                        <div key={branch.id} className="border rounded p-3">
                          <div className="font-semibold">{branch.branchName}</div>
                          <div className="text-sm text-muted-foreground">ID: {branch.id}</div>
                          <div className="text-sm">
                            {branch.isActive ? (
                              <Badge variant="default">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={() => router.push('/branches/new')}>
                    + Add New Branch
                  </Button>
                </CardContent>
              </Card>
            );
          default:
            return (
              <MyInventory
                myBranchId={myBranchId}
                myBranchName={myBranchName}
                onNavigate={handleNavigate}
              />
            );
        }
      })()}
    </Wrapper>
  );
}
