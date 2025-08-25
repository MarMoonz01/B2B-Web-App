// src/app/(app)/app/admin/layout.tsx  (server component)
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/src/lib/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await getServerSession();
  if (!me) redirect(`/login?next=/app/admin/roles`);
  if (!me.moderator) redirect(`/app?view=inventory`);
  return <>{children}</>;
}