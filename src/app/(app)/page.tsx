import { redirect } from "next/navigation";
import { getServerSession } from "@/src/lib/session";
import { hasPermission } from "@/src/lib/permissionHelper"; // 1. เปลี่ยนมาใช้ Helper ของระบบใหม่
import AppShell from "@/src/app/(app)/shell";
import InventoryView from "@/src/app/(app)/app/views/InventoryView";
import TransferView from "@/src/app/(app)/app/views/TransferView";
import TransferRequestsView from "@/src/app/(app)/app/views/TransferRequestView";
import BranchUsersView from "@/src/app/(app)/app/views/BranchUsersView";
import AnalyticsView from "@/src/app/(app)/app/views/AnalyticsView";
import type { Permission } from "@/types/permission";

// 2. กำหนด View และ Permission ที่จำเป็นสำหรับแต่ละหน้าอย่างชัดเจน
const VIEW_PERMISSIONS: Record<string, Permission> = {
    inventory: 'inventory:read',
    transfer: 'transfer:create',
    'transfer-requests': 'transfer:read',
    analytics: 'admin:view_analytics',
};

type View = keyof typeof VIEW_PERMISSIONS;

export default async function AppPage({ searchParams }: { searchParams: { view?: string } }) {
    const me = await getServerSession();
    if (!me) redirect("/login");

    const currentView = searchParams.view ?? "inventory";

    // 3. ตรวจสอบสิทธิ์สำหรับทุก View โดยใช้ hasPermission (ระบบใหม่)
    const allowedViews: View[] = [];
    for (const view of Object.keys(VIEW_PERMISSIONS) as View[]) {
        if (await hasPermission(me, VIEW_PERMISSIONS[view])) {
            allowedViews.push(view);
        }
    }
    
    // ถ้าไม่มีสิทธิ์เข้าถึงหน้าไหนเลย ให้ไปหน้า "ไม่มีสิทธิ์"
    if (allowedViews.length === 0) {
        redirect('/no-permission');
    }

    // ถ้าพยายามเข้าหน้าที่ไม่มีสิทธิ์ ให้ไปหน้าแรกที่เข้าได้
    if (!allowedViews.includes(currentView as View)) {
        redirect(`/app?view=${allowedViews[0]}`);
    }

    // 4. ตรวจสอบสิทธิ์ย่อย (เช่น การเขียน) แยกต่างหาก
    const canWriteInventory = await hasPermission(me, 'inventory:write');

    return (
        <AppShell me={me} allowedViews={allowedViews} currentView={currentView as View}>
            {currentView === "inventory" && (
                <InventoryView canWrite={canWriteInventory} selectedBranchId={me.selectedBranchId ?? null} />
            )}
            {currentView === "transfer" && <TransferView />}
            {currentView === "transfer-requests" && <TransferRequestsView />}
            {currentView === "branches" && <BranchUsersView />}
            {currentView === "analytics" && <AnalyticsView />}
        </AppShell>
    );
}
