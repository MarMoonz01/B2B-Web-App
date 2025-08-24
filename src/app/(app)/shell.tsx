// src/app/app/shell.tsx
"use client";
import Link from "next/link";
import BranchSwitcher from "@/src/app/components/BranchSwitcher"; // มีแล้วจากก่อนหน้า

export default function AppShell({
  me, allowedViews, currentView, children,
}: {
  me: any;
  allowedViews: string[];
  currentView: string;
  children: React.ReactNode;
}) {
  const items: { key: string; label: string }[] = [
    { key: "inventory", label: "Inventory" },
    { key: "transfer", label: "Transfer" },
    { key: "transfer-requests", label: "คำขอโอนสินค้า" },
    { key: "branches", label: "จัดการผู้ใช้สาขา" },
    { key: "analytics", label: "Analytics" },
  ];
  return (
    <div className="min-h-screen">
      <header className="border-b p-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <strong>Tire Network</strong>
          <nav className="flex gap-3">
            {items.filter(it => allowedViews.includes(it.key)).map(it => (
              <Link
                key={it.key}
                href={`/app?view=${it.key}`}
                className={`text-sm ${currentView===it.key ? "font-bold" : ""}`}
              >
                {it.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <BranchSwitcher />
          <span className="text-xs opacity-60">{me.username || me.email}</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
