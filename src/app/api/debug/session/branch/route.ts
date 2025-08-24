// src/app/api/session/branch/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "@/src/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { branchId } = body || {};
    if (!branchId) {
      return NextResponse.json({ ok: false, error: "missing branchId" }, { status: 400 });
    }

    const me = await getServerSession();
    if (!me) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    // moderator เลือกอะไรก็ได้, อื่น ๆ ต้องเป็นสาขาที่ตนมีสิทธิ์
    const allowed = me.moderator || me.branches.some((b) => b.id === branchId);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "forbidden for this branch" }, { status: 403 });
    }

    const res = NextResponse.json({ ok: true, branchId });
    res.cookies.set("sb", branchId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // ไม่ต้อง secure ใน dev; ใน prod ตั้ง secure: true
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
