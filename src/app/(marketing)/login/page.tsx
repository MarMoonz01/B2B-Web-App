// src/app/(marketing)/login/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getClientAuth } from "@/src/lib/firebaseClient";
import { ensureUserProfile } from "@/src/lib/ensureUserProfile";

// Import UI components & icons
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, LogIn, TriangleAlert } from "lucide-react";

async function safeJson(res: Response) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return { raw: t }; }
}

export default function LoginPage() {
  const search = useSearchParams();
  const router = useRouter();
  const nextUrl = useMemo(() => search.get("next") || "/app?view=inventory", [search]);

  const [idOrUsername, setIdOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    try {
      // 1) รองรับ login ด้วย username หรือ email
      let email = idOrUsername.trim();
      if (!email.includes("@")) {
        const r = await fetch("/api/auth/username-to-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: email }),
        });
        const d = await safeJson(r);
        if (!r.ok || !d?.ok || !d.email) throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        email = d.email as string;
      }

      // 2) Firebase client sign-in
      const auth = await getClientAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // 3) สร้าง/อัปเดต users/{uid}
      try { await ensureUserProfile(); } catch {}

      // 4) แลก session cookie ฝั่งเซิร์ฟเวอร์
      const idToken = await cred.user.getIdToken();
      const s = await fetch("/api/auth/sessionLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const d2 = await safeJson(s);
      if (!s.ok || d2?.ok === false) throw new Error(d2?.error || `sessionLogin: ${s.status}`);

      // 5) ไปหน้า app
      router.replace(nextUrl);
    } catch (err: any) {
      console.error(err);
      setMsg(err?.code === 'auth/invalid-credential' 
        ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" 
        : err?.message || "เข้าสู่ระบบไม่สำเร็จ"
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">เข้าสู่ระบบ</CardTitle>
          <CardDescription>
            ยินดีต้อนรับสู่ระบบจัดการสต็อก B2B
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Username หรือ Email</Label>
              <Input
                id="email"
                placeholder="เช่น user01 หรือ user@example.com"
                required
                value={idOrUsername}
                onChange={(e) => setIdOrUsername(e.target.value)}
                autoComplete="username"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 h-full w-10 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={busy}
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {msg && (
              <Alert variant="destructive">
                <TriangleAlert className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {msg}
                </AlertDescription>
              </Alert>
            )}
            
            <Button className="w-full" disabled={busy} type="submit">
              {busy ? (
                <LogIn className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {busy ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
            </Button>
          </form>
        </CardContent>
        {/* CardFooter ถูกลบออกไปแล้ว */}
      </Card>
    </div>
  );
}