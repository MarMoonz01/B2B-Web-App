'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronsUpDown, Check } from 'lucide-react';

import { useBranch } from '@/contexts/BranchContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

// ✅ ใช้ hook ฝั่ง Firebase ที่แก้แล้ว
import { useUserBranches } from '@/hooks/useUserBranches';

type VisibleItem = { id: string; name: string };

export default function BranchSelect({
  allowedBranchIds,
}: {
  allowedBranchIds?: string[];
}) {
  const qc = useQueryClient();
  const { selectedBranchId, setSelectedBranchId } = useBranch();
  const [open, setOpen] = React.useState(false);

  // 🔗 ดึงสาขาที่ผู้ใช้มีสิทธิ์จาก Firestore (ปลอดภัยตาม rules)
  const { branches, loading, error } = useUserBranches();

  // map -> UI items
  const rawItems = React.useMemo<VisibleItem[]>(
    () =>
      (branches ?? []).map((b) => ({
        id: b.branchId,
        name: String(b.branchName ?? b.branchId),
      })),
    [branches]
  );

  // ถ้ามี allowedBranchIds ให้ intersect อีกรอบ (กัน edge case จาก upstream)
  const items = React.useMemo<VisibleItem[]>(() => {
    if (!allowedBranchIds || allowedBranchIds.length === 0) return rawItems;
    const allow = new Set(allowedBranchIds);
    return rawItems.filter((b) => allow.has(b.id));
  }, [rawItems, allowedBranchIds]);

  // ตั้งค่า default หรือแก้ให้ถูกต้องถ้าค่าเก่าหลุดสิทธิ์
  React.useEffect(() => {
    if (loading) return;
    if (!items.length) return;

    const saved =
      typeof window !== 'undefined' ? localStorage.getItem('selectedBranchId') : null;
    const hasSaved = saved && items.some((b) => b.id === saved);

    if (!selectedBranchId || !items.some((b) => b.id === selectedBranchId)) {
      const next = (hasSaved ? (saved as string) : items[0].id) as string;
      setSelectedBranchId(next);
      if (typeof window !== 'undefined') localStorage.setItem('selectedBranchId', next);
    }
  }, [loading, items, selectedBranchId, setSelectedBranchId]);

  const currentName =
    items.find((x) => x.id === selectedBranchId)?.name ||
    (loading ? 'Loading…' : error ? 'Error' : 'Select branch');

  const choose = (id: string) => {
    // กันผู้ใช้เลือกสาขาที่ไม่มีสิทธิ์
    if (allowedBranchIds && allowedBranchIds.length > 0 && !allowedBranchIds.includes(id)) {
      console.warn('Forbidden branchId selected:', id);
      return;
    }
    if (!items.some((b) => b.id === id)) {
      console.warn('BranchId not in fetched list:', id);
      return;
    }
    setSelectedBranchId(id);
    if (typeof window !== 'undefined') localStorage.setItem('selectedBranchId', id);
    setOpen(false);

    // รีเฟรชข้อมูลที่อาศัยสาขา
    qc.invalidateQueries({ queryKey: ['inventory'] });
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['inventory', 'store', id] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between" aria-label="Select branch">
          <span className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="truncate">
              {error
                ? 'Missing or insufficient permissions.'
                : loading
                ? 'Loading branches…'
                : currentName}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search branches..." />
          <CommandList>
            {error ? (
              <CommandEmpty>Missing or insufficient permissions.</CommandEmpty>
            ) : loading ? (
              <CommandEmpty>Loading…</CommandEmpty>
            ) : items.length === 0 ? (
              <CommandEmpty>No branches found.</CommandEmpty>
            ) : (
              <>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="My Branches">
                  {items.map((b) => (
                    <CommandItem
                      key={b.id}
                      value={`${b.name} ${b.id}`}
                      onSelect={() => choose(b.id)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          b.id === selectedBranchId ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="truncate">{b.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
