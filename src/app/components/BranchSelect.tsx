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

export default function BranchSelect({
  allowedBranchIds,
}: {
  allowedBranchIds?: string[];
}) {
  const qc = useQueryClient();
  const { selectedBranchId, setSelectedBranchId } = useBranch();
  const [open, setOpen] = React.useState(false);

  // ใช้ใน queryKey เพื่อให้ refetch เมื่อสิทธิเปลี่ยน (เช่นโหลด me เสร็จ)
  const allowKey = React.useMemo(
    () =>
      allowedBranchIds && allowedBranchIds.length
        ? [...allowedBranchIds].sort().join('|')
        : 'none',
    [allowedBranchIds]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['branches', 'scoped', allowKey],
    queryFn: async (): Promise<Record<string, string>> => {
      const toRecord = (arr: VisibleBranch[] | undefined) => {
        const out: Record<string, string> = {};
        (arr ?? []).forEach((b) => {
          if (typeof b.isActive === 'boolean' && !b.isActive) return;
          out[b.id] = (b.branchName || b.name || b.id).toString();
        });
        return out;
      };

      // 1) ลอง /list ก่อน (ควรเป็นรายการที่ backend กรองตามสิทธิแล้ว)
      const rList = await fetch('/api/branches/list', { cache: 'no-store' }).catch(() => null);
      if (rList) {
        try {
          const d = await rList.json();
          if (rList.ok && d?.ok && Array.isArray(d.branches) && d.branches.length > 0) {
            return toRecord(d.branches as VisibleBranch[]);
          }
        } catch {
          // noop; จะไปใช้ fallback
        }
      }

      // 2) fallback -> /visible (ต้องมี allowedBranchIds เพื่อกรอง)
      const rVis = await fetch('/api/branches/visible', { cache: 'no-store' });
      const dVis = await rVis.json();
      if (!rVis.ok || !dVis?.ok) throw new Error(dVis?.error || `HTTP ${rVis.status}`);

      const allVisible: VisibleBranch[] = Array.isArray(dVis.branches) ? dVis.branches : [];
      if (!allowedBranchIds || allowedBranchIds.length === 0) {
        // เพื่อความปลอดภัย: ถ้าไม่รู้สิทธิที่แน่ชัด อย่าโชว์อะไรเลย
        return {};
      }
      const allow = new Set(allowedBranchIds);
      const filtered = allVisible.filter((b) => allow.has(b.id));
      return toRecord(filtered);
    },
    staleTime: 5 * 60_000,
  });

  const rawItems = React.useMemo(
    () =>
      Object.entries(data ?? {}).map(([id, name]) => ({
        id,
        name: String(name ?? id),
      })),
    [data]
  );

  // intersect อีกชั้น (กันกรณี fallback มาจาก /visible)
  const items = React.useMemo(() => {
    if (!allowedBranchIds || allowedBranchIds.length === 0) return rawItems;
    const allow = new Set(allowedBranchIds);
    return rawItems.filter((b) => allow.has(b.id));
  }, [rawItems, allowedBranchIds]);

  // ตั้งค่า default หรือ auto-correct ถ้าค่าเดิมไม่มีสิทธิแล้ว
  React.useEffect(() => {
    if (isLoading) return;
    if (!items.length) return;

    const saved = typeof window !== 'undefined' ? localStorage.getItem('selectedBranchId') : null;
    const hasSaved = saved && items.some((b) => b.id === saved);

    if (!selectedBranchId || !items.some((b) => b.id === selectedBranchId)) {
      const next = (hasSaved ? (saved as string) : items[0].id) as string;
      setSelectedBranchId(next);
      if (typeof window !== 'undefined') localStorage.setItem('selectedBranchId', next);
    }
  }, [isLoading, items, selectedBranchId, setSelectedBranchId]);

  const currentName = items.find((x) => x.id === selectedBranchId)?.name || 'Select branch';

  const choose = (id: string) => {
    // กันผู้ใช้เลือกสาขาที่ไม่มีสิทธิ
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
            <span className="truncate">{error ? 'Error loading branches' : currentName}</span>
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
