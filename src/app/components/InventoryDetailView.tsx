'use client';

import React, { useState } from 'react';
import { BranchDetail } from '@/types/inventory';
import InventoryDetailTable from './InventoryDetailTable'; // เราจะใช้ตารางรายละเอียดเดิม
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin } from 'lucide-react';

interface InventoryDetailViewProps {
  branches: BranchDetail[];
}

export default function InventoryDetailView({ branches }: InventoryDetailViewProps) {
  const [selectedBranch, setSelectedBranch] = useState<BranchDetail | null>(null);

  // กรณีที่มีข้อมูลแค่สาขาเดียว ให้แสดงรายละเอียดของสาขานั้นไปเลย
  if (branches.length === 1 && !selectedBranch) {
    setSelectedBranch(branches[0]);
  }

  // --- View 2: แสดงตารางรายละเอียดของสาขาที่เลือก ---
  if (selectedBranch) {
    return (
      <div className="p-4 bg-slate-50">
        <Button variant="ghost" size="sm" onClick={() => setSelectedBranch(null)} className="mb-3 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Branch List
        </Button>
        <InventoryDetailTable branches={[selectedBranch]} />
      </div>
    );
  }

  // --- View 1: แสดงรายชื่อสาขาให้เลือก ---
  return (
    <div className="p-4 bg-slate-50">
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
        Select a branch to view detailed stock:
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {branches.map((branch) => (
          <button
            key={branch.branchName}
            onClick={() => setSelectedBranch(branch)}
            className="p-4 border rounded-lg text-left hover:bg-slate-100 transition-colors bg-white shadow-sm"
          >
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">{branch.branchName}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {branch.sizes.length} size variants available
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}