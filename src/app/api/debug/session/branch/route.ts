// src/app/api/session/branch/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "@/src/lib/session";

export async function POST(req: Request) {
  // แปลง NODE_ENV เป็น string ชัดเจน เพื่อกัน TS2367
  const isProd = (process.env.NODE_ENV ?? "").toLowerCase() === "production";

  if (isProd) {
    return NextResponse.json(
      { ok: false, error: "disabled in production" },
      { status: 404 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { branchId } = (body as any) || {};
    if (!branchId) {
      return NextResponse.json(
        { ok: false, error: "missing branchId" },
        { status: 400 }
      );
    }

    const me = await getServerSession();
    if (!me) {
      return NextResponse.json(
        { ok: false, error: "unauthenticated" },
        { status: 401 }
      );
    }

    // moderator เลือกอะไรก็ได้, อื่น ๆ ต้องเป็นสาขาที่ตนมีสิทธิ์
    const allowed = me.moderator || me.branches.some((b) => b.id === branchId);
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "forbidden for this branch" },
        { status: 403 }
      );
    }

    const res = NextResponse.json({ ok: true, branchId });
    res.cookies.set("sb", branchId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isProd, // ← ใช้ตัวแปรที่เป็น string แล้ว
    });
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
