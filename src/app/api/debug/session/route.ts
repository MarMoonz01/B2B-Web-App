// src/app/api/debug/session/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "@/src/lib/session";

export async function GET() {
    if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "disabled in production" }, { status: 404 });
  }
try {
    const session = await getServerSession();
    // จะเป็น object (ถ้ามี session) หรือ null (ถ้ายังไม่ login)
    return NextResponse.json(session);
  } catch (e: any) {
    console.error("[debug/session] error:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
