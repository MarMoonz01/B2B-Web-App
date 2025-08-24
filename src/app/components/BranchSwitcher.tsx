"use client";
import { useEffect, useState } from "react";

type Branch = { id: string; name: string };

export default function BranchSwitcher() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    // โหลดรายชื่อสาขาที่ "อนุญาต" + ค่า branch ปัจจุบันจาก session
    const [bRes, sRes] = await Promise.all([
      fetch("/api/branches/list", { cache: "no-store" }),
      fetch("/api/debug/session", { cache: "no-store" }),
    ]);
    const b = await bRes.json();
    const s = await sRes.json();
    if (bRes.ok && b?.ok) setBranches(b.branches || []);
    setCurrent(s?.selectedBranchId ?? null);
  }

  useEffect(() => { load(); }, []);

  async function change(branchId: string) {
    setBusy(true);
    const r = await fetch("/api/session/branch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId }),
    });
    setBusy(false);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(`เปลี่ยนสาขาไม่สำเร็จ: ${e?.error || r.status}`);
      return;
    }
    setCurrent(branchId);
  }

  if (!branches.length) {
    return <div className="text-xs opacity-70">ไม่มีสาขาที่ได้รับสิทธิ์</div>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm opacity-70">Branch</span>
      <select
        className="border rounded p-1"
        disabled={busy}
        value={current ?? ""}
        onChange={(e) => change(e.target.value)}
      >
        {branches.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  );
}
