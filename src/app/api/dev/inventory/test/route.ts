import { NextResponse } from "next/server";
import { getServerSession, canDo } from "@/src/lib/session";

export async function GET() {
  const me = await getServerSession();
  if (!me) return NextResponse.json({ ok:false, error:"unauthenticated" }, { status: 401 });

  const roleInBranch = me.moderator
    ? "ADMIN"
    : me.branches.find(b => b.id === me.selectedBranchId)?.roles?.[0] ?? null;

  if (!canDo({ moderator: me.moderator, roleInBranch, perm: "inventory:read" })) {
    return NextResponse.json({ ok:false, error:"forbidden: inventory:read" }, { status: 403 });
  }
  return NextResponse.json({ ok:true, action:"read", branch: me.selectedBranchId, user: me.uid });
}

export async function POST() {
  const me = await getServerSession();
  if (!me) return NextResponse.json({ ok:false, error:"unauthenticated" }, { status: 401 });

  const roleInBranch = me.moderator
    ? "ADMIN"
    : me.branches.find(b => b.id === me.selectedBranchId)?.roles?.[0] ?? null;

  if (!canDo({ moderator: me.moderator, roleInBranch, perm: "inventory:write" })) {
    return NextResponse.json({ ok:false, error:"forbidden: inventory:write" }, { status: 403 });
  }
  return NextResponse.json({ ok:true, action:"write", branch: me.selectedBranchId, user: me.uid });
}
