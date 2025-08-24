// middleware.ts (ที่รากโปรเจกต์)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/app"]; // ✅ ใช้ /app เป็น gateway เดียว

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // สาธารณะ
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/debug")
  ) {
    return NextResponse.next();
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
