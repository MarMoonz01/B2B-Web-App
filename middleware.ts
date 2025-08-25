// middleware.ts (ที่รากโปรเจกต์)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/app"]; // ✅ ใช้ /app เป็น gateway เดียว

export function middleware(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";

  const { pathname, search } = req.nextUrl;

  if (isProd && pathname.startsWith("/debug")) {
    return NextResponse.redirect(new URL("/", req.url));
  }


  // กันโซน /app
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const hasSession = req.cookies.get("session")?.value;
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // เก็บทั้ง path+query (เช่น ?view=inventory)
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|.*\\.(?:ico|png|jpg|jpeg|svg|css|js)).*)"],
};
