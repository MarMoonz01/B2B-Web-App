'use client';

import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = ['Branch details', 'Inventory', 'Done'];
  return (
    <ol className="mb-6 grid grid-cols-3 gap-2">
      {items.map((t, i) => {
        const idx = (i + 1) as 1 | 2 | 3;
        const active = idx <= step;
        return (
          <li key={t} className={`rounded-lg border p-3 text-center text-sm ${active ? 'bg-primary/5 border-primary/30' : 'bg-muted/40'}`}>
            <div className={`font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>{idx}. {t}</div>
          </li>
        );
      })}
    </ol>
  );
}

export default function BranchCreateDonePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const branchId = sp.get('branch') || '';

  return (
    <div className="max-w-3xl">
      <Stepper step={3} />
      <Card>
        <CardHeader><CardTitle>All set!</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
            <div className="text-lg font-semibold">Branch created successfully</div>
          </div>
          <p className="text-sm text-muted-foreground">
            You can add or update inventory later from Inventory or Transfer Platform.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/branches')}>Back to Branches</Button>
            <Button onClick={() => router.push('/transfer-platform')}>Go to Transfer Platform</Button>
            {branchId && (
              <Button variant="ghost" onClick={() => router.push(`/branches/new/inventory?branch=${encodeURIComponent(branchId)}`)}>
                Add more inventory
              </Button>
            )}
          </div>
          {branchId ? (
            <div className="text-xs text-muted-foreground">Branch ID: <code>{branchId}</code></div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
