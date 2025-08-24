// src/app/api/auth/sessionLogin/route.ts
import { NextResponse } from "next/server";
import { adminAuth } from "@/src/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    let payload: any = null;
    try {
      payload = await req.json();
    } catch {
      // ไม่มี body หรือ content-type ไม่ถูกต้อง
      return NextResponse.json(
        { ok: false, error: "missing or invalid JSON body" },
        { status: 400 }
      );
    }

    const idToken = payload?.idToken;
    if (!idToken) {
      return NextResponse.json(
        { ok: false, error: "missing idToken" },
        { status: 400 }
      );
    }

    const expiresIn = Number(process.env.FIREBASE_SESSION_COOKIE_MAXAGE ?? 432000000);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const res = NextResponse.json({ ok: true });
    res.cookies.set("session", sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresIn / 1000),
    });
    return res;
  } catch (e: any) {
    console.error("[sessionLogin] error:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
