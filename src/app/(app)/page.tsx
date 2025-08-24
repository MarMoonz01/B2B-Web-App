// src/app/app/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "@/src/lib/session";
import { canDo } from "@/src/lib/perm";
import AppShell from "src/app/app/shell";  // header/sidebar (client)
import InventoryView from "src/app/app/views/InventoryView";
import TransferView from "src/app/app/views/TransferView";
import TransferRequestsView from "src/app/app/views/TransferRequestView";
import BranchUsersView from "src/app/app/views/BranchUsersView"; // (ขั้นถัดไป)
import AnalyticsView from "src/app/app/views/AnalyticsView";     // (optional)

export default async function AppPage({ searchParams }: { searchParams: { view?: string } }) {
  const me = await getServerSession();
  if (!me) redirect("/login");

  const roleInBranch = me.moderator
    ? "ADMIN"
    : (me.branches.find(b => b.id === me.selectedBranchId)?.roles?.[0] ?? null);

  const view = (searchParams.view ?? "inventory") as
    | "inventory" | "transfer" | "transfer-requests" | "branches" | "analytics";

  const can = (perm: Parameters<typeof canDo>[0]["perm"]) =>
    canDo({ moderator: me.moderator, roleInBranch, perm });

  // ตรวจสิทธิ์ราย view
  const access: Record<string, boolean> = {
    inventory: can("inventory:read"),
    transfer: can("transfer:access"),
    "transfer-requests": can("transfer:access"),
    branches: can("users:manage"),
    analytics: can("users:manage"),
  };

  // หา default view ที่คนนี้เข้าได้จริง
  const firstAllowed = (["inventory","transfer","transfer-requests","branches","analytics"] as const)
    .find(v => access[v]);

  // ถ้า view ปัจจุบันเข้าไม่ได้ ให้เด้งไปตัวที่เข้าได้
  if (!access[view]) {
    redirect(`/app?view=${firstAllowed ?? "inventory"}`);
  }

  // ส่ง allowed views ไปให้ shell สร้างเมนู/ลิงก์
  const allowed = Object.keys(access).filter(k => (access as any)[k]) as (keyof typeof access)[];

  return (
    <AppShell me={me} allowedViews={allowed} currentView={view}>
      {view === "inventory" && (
        <InventoryView canWrite={can("inventory:write")} selectedBranchId={me.selectedBranchId ?? null} />
      )}
      {view === "transfer" && <TransferView />}
      {view === "transfer-requests" && <TransferRequestsView />}
      {view === "branches" && <BranchUsersView />}        {/* ขั้นถัดไป */}
      {view === "analytics" && <AnalyticsView />}         {/* optional */}
    </AppShell>
  );
}
