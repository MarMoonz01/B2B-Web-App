import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // เคลียร์คุกกี้
  res.cookies.set("session", "", {
    httpOnly: true, sameSite: "lax", path: "/", secure: false, maxAge: 0
  });
  return res;
}
