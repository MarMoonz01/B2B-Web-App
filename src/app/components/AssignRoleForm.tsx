// components/AssignRoleForm.tsx
"use client";
import { useState } from "react";

export default function AssignRoleForm() {
  const [uid, setUid] = useState("");
  const [branchId, setBranchId] = useState("");
  const [role, setRole] = useState<"SALES"|"ADMIN">("SALES");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const r = await fetch("/api/admin/roles/assign", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ uid, branchId, role }),
    });
    const d = await r.json();
    setMsg(d.ok ? "Granted!" : `Error: ${d.error}`);
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input value={uid} onChange={e=>setUid(e.target.value)} placeholder="User UID" required />
      <input value={branchId} onChange={e=>setBranchId(e.target.value)} placeholder="Branch ID" required />
      <select value={role} onChange={e=>setRole(e.target.value as any)}>
        <option value="SALES">SALES</option>
        <option value="ADMIN">ADMIN</option>
      </select>
      <button type="submit">Grant</button>
      {msg && <div>{msg}</div>}
    </form>
  );
}
