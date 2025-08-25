// src/components/BranchSelect.tsx (หรือพาธที่คุณวางอยู่)
'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

type VisibleBranch = { id: string; branchName?: string; name?: string; isActive?: boolean };

export default function BranchSelect() {
  const qc = useQueryClient();
  const { selectedBranchId, setSelectedBranchId } = useBranch();
  const [open, setOpen] = React.useState(false);

  // ดึงสาขาที่ผู้ใช้ "มองเห็นได้" ผ่าน API (ไม่ชน Firestore rules)
  const { data, isLoading, error } = useQuery({
    queryKey: ['stores'],
    queryFn: async (): Promise<Record<string, string>> => {
      const r = await fetch('/api/branches/visible', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      const out: Record<string, string> = {};
      (d.branches as VisibleBranch[]).forEach((b) => {
        out[b.id] = (b.branchName || b.name || b.id).toString();
      });
      return out;
    },
    staleTime: 5 * 60_000,
  });

  const items = React.useMemo(
    () =>
      Object.entries(data ?? {}).map(([id, name]) => ({
        id,
        name: String(name ?? id),
      })),
    [data]
  );

  // ตั้งค่า default ถ้ายังไม่เคยเลือก
  React.useEffect(() => {
    if (!isLoading && items.length && !selectedBranchId) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('selectedBranchId') : null;
      const pick = saved && items.find((b) => b.id === saved) ? saved : items[0].id;
      setSelectedBranchId(pick);
    }
  }, [isLoading, items, selectedBranchId, setSelectedBranchId]);

  const currentName =
    items.find((x) => x.id === selectedBranchId)?.name || 'Select branch';

  const choose = (id: string) => {
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
              {error ? 'Error loading branches' : currentName}
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
            ) : (
              <>
                <CommandEmpty>No branches found.</CommandEmpty>
                <CommandGroup heading="All Branches">
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
