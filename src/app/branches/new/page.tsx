'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { StoreService, slugifyId } from '@/lib/services/InventoryService';
import { useBranch } from '@/contexts/BranchContext';

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

export default function BranchNewPage() {
  const router = useRouter();
  const { setSelectedBranchId } = useBranch();

  const [branchName, setBranchName] = useState('');
  const [branchIdInput, setBranchIdInput] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const branchId = (branchIdInput || slugifyId(branchName || 'new-branch')).trim();

  async function onSubmit() {
    if (!branchName) return toast.error('Please enter branch name');

    setSubmitting(true);
    try {
      const ok = await StoreService.isStoreIdAvailable(branchId);
      if (!ok) {
        setSubmitting(false);
        return toast.error('Branch ID is already used.');
      }

      await StoreService.createStore(branchId, {
        branchName,
        phone: phone || undefined,
        email: email || undefined,
        notes: notes || undefined,
        isActive: true,
      });

      toast.success('Branch created');
      setSelectedBranchId(branchId);

      // ✅ absolute path + encodeURIComponent
      router.push(
        `/branches/new/inventory?branch=${encodeURIComponent(branchId)}&name=${encodeURIComponent(branchName)}`
      );
    } catch (e: any) {
      toast.error('Create failed', { description: e?.message || String(e) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Stepper step={1} />

      <Card>
        <CardHeader>
          <CardTitle>Create a new branch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Branch Name</Label>
              <Input value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="e.g. Tyreplus Ratchaphruek" />
            </div>
            <div>
              <Label>Branch ID (slug)</Label>
              <Input value={branchId} onChange={(e) => setBranchIdInput(e.target.value)} placeholder="auto-generated-from-name" />
              <div className="text-[11px] text-muted-foreground mt-1">Firestore path: <code>stores/{branchId}</code></div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Phone (optional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => history.back()}>Cancel</Button>
            <Button onClick={onSubmit} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create branch & manage inventory'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
