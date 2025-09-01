'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';

import { useBranch } from '@/contexts/BranchContext';
import type { ViewKey } from '@/types/nav';
import { VIEW_KEYS } from '@/types/nav';

// UI
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* =========================================================
 * Types for dynamically loaded, branch-scoped views
 * =======================================================*/
type BranchScopedProps = { myBranchId: string; myBranchName: string };
type MyInventoryProps = BranchScopedProps & { onNavigate?: (k: ViewKey) => void };

/* =========================================================
 * Loader for dynamic views
 * =======================================================*/
const ViewLoader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <Card className="w-full">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    {subtitle && (
      <CardContent>
        <p>{subtitle}</p>
      </CardContent>
    )}
  </Card>
);

/* =========================================================
 * Dynamic imports (with proper prop generics)
 * =======================================================*/
const OverviewView = dynamic<BranchScopedProps>(
  () => import('./views/OverviewView'),
  { ssr: false, loading: () => <ViewLoader title="Loading Overview..." /> }
);

const MyInventory = dynamic<MyInventoryProps>(
  () => import('@/src/app/components/MyInventory'),
  { ssr: false, loading: () => <ViewLoader title="Loading Inventory..." /> }
);

const TransferPlatformView = dynamic<BranchScopedProps>(
  () => import('@/src/app/components/TransferPlatformView'),
  { ssr: false, loading: () => <ViewLoader title="Loading Transfer Platform..." /> }
);

const TransferRequestsView = dynamic<BranchScopedProps>(
  () => import('@/src/app/components/TransferRequestsView'),
  { ssr: false, loading: () => <ViewLoader title="Loading Transfer Requests..." /> }
);

const AnalyticsView = dynamic(
  () => import('./views/AnalyticsView'),
  { ssr: false, loading: () => <ViewLoader title="Loading Analytics Dashboard..." /> }
);

const FirebaseTest = dynamic(
  () => import('@/src/app/components/FirebaseTest').then((mod) => mod.FirebaseTest),
  { ssr: false, loading: () => <p>Loading debug tools...</p> }
);

/* =========================================================
 * Helpers
 * =======================================================*/
function isViewKey(v: string | null): v is ViewKey {
  return !!v && VIEW_KEYS.includes(v as ViewKey);
}

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full min-h-dvh overflow-x-hidden">
    <div className="w-full max-w-none p-6">{children}</div>
  </div>
);

/* =========================================================
 * Page
 * =======================================================*/
export default function Page() {
  const search = useSearchParams();
  const router = useRouter();
  const { selectedBranch, selectedBranchId, branches, loading, error } = useBranch();

  // Active view (default: overview)
  const view: ViewKey = isViewKey(search?.get('view')) ? (search!.get('view') as ViewKey) : 'overview';

  const myBranchId = selectedBranchId || '';
  const myBranchName = selectedBranch?.branchName || selectedBranchId || 'My Branch';

  const handleNavigate = React.useCallback((k: ViewKey) => {
    router.push(`/app?view=${k}`);
  }, [router]);

  /* ---------------- Error state ---------------- */
  if (error) {
    return (
      <PageWrapper>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-red-600">❌ Database Connection Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-600">{String(error)}</p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>🔄 Reload Page</Button>
              <Button variant="outline" onClick={() => handleNavigate('debug')}>🐛 Open Debug View</Button>
            </div>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  /* ---------------- Loading state ---------------- */
  if (loading) {
    return (
      <PageWrapper>
        <ViewLoader title="⏳ Connecting to Database..." subtitle="Loading branch information, please wait." />
      </PageWrapper>
    );
  }

  /* ---------------- Debug view (no branch required) ---------------- */
  if (view === 'debug') {
    return (
      <PageWrapper>
        <h1 className="text-2xl font-bold">🐛 Debug Information</h1>
        <FirebaseTest />
        <Card className="w-full mt-4">
          <CardHeader>
            <CardTitle>Branch Context Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div><Badge variant={loading ? 'secondary' : 'default'}>Loading: {loading.toString()}</Badge></div>
            <div><Badge variant={error ? 'destructive' : 'default'}>Error: {error ? String(error) : 'None'}</Badge></div>
            <div><strong>Selected Branch ID:</strong> {selectedBranchId || 'None'}</div>
            <div><strong>Selected Branch Name:</strong> {selectedBranch?.branchName || 'None'}</div>
            <div><strong>Total Branches:</strong> {branches?.length ?? 0}</div>
            {!!(branches?.length) && (
              <div>
                <strong>Available Branches:</strong>
                <ul className="mt-1 space-y-1">
                  {branches!.map((b: any) => (
                    <li key={b.id} className="text-sm bg-gray-100 dark:bg-gray-800 p-1 rounded">
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
      </PageWrapper>
    );
  }

  /* ---------------- No-branch selected ---------------- */
  if (!myBranchId) {
    return (
      <PageWrapper>
        <Card className="w-full">
          <CardHeader><CardTitle>🏪 Select a branch to get started</CardTitle></CardHeader>
          <CardContent>
            <p>Please select a branch from the switcher in the header to view its data.</p>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  /* ---------------- View router ---------------- */
  const renderCurrentView = () => {
    switch (view) {
      case 'overview':
        return <OverviewView myBranchId={myBranchId} myBranchName={myBranchName} />;

      case 'inventory':
        return <MyInventory myBranchId={myBranchId} myBranchName={myBranchName} onNavigate={handleNavigate} />;

      case 'transfer_platform':
        return <TransferPlatformView myBranchId={myBranchId} myBranchName={myBranchName} />;

      case 'transfer_requests':
        return <TransferRequestsView myBranchId={myBranchId} myBranchName={myBranchName} />;

      case 'dashboard':
      case 'analytics':
        return <AnalyticsView />;

      default:
        return <OverviewView myBranchId={myBranchId} myBranchName={myBranchName} />;
    }
  };

  return (
    <PageWrapper>
      {renderCurrentView()}
    </PageWrapper>
  );
}
