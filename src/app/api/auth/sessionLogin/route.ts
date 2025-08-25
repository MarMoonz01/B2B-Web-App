import { NextResponse } from "next/server";
import { adminAuth } from "@/src/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ ok: false, error: "missing idToken" }, { status: 400 });
    }

    // อายุ session 7 วัน
    const expiresIn = 1000 * 60 * 60 * 24 * 7;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const isProd = (process.env.NODE_ENV ?? "").toLowerCase() === "production";

    const res = NextResponse.json({ ok: true });
    res.cookies.set("session", sessionCookie, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isProd,          // dev=false, prod=true
      maxAge: expiresIn / 1000 // วินาที
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 401 });
  }
}
