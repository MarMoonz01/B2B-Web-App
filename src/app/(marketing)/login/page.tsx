// src/app/(marketing)/login/page.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, Shield } from 'lucide-react';

const DEMO_EMAIL = (process.env.NEXT_PUBLIC_DEMO_EMAIL ?? 'demo@transfernet.com').trim();
const DEMO_PASSWORD = (process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? 'demo123').trim();

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [remember, setRemember] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const emailOk = email.trim().toLowerCase() === DEMO_EMAIL.toLowerCase();
      const passOk  = password.trim() === DEMO_PASSWORD;

      await new Promise(r => setTimeout(r, 300)); // หน่วงสั้น ๆ ให้รู้สึกว่ากำลังตรวจ

      if (!emailOk || !passOk) {
        setErr('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        return;
      }

      // (ถ้าต้องการจำค่า remember me ค่อยต่อยอดที่นี่)
      router.replace('/app'); // ← สำเร็จแล้วเข้าแอป
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh grid place-items-center overflow-hidden bg-[radial-gradient(40rem_40rem_at_70%_-10%,hsl(var(--primary)/0.15),transparent),radial-gradient(28rem_28rem_at_-10%_110%,hsl(var(--muted-foreground)/0.12),transparent)]">
      <div className="absolute top-6 left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>Secure access to your network</span>
      </div>

      <Card className="w-full max-w-md border-0 shadow-xl ring-1 ring-black/5">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>เข้าสู่ระบบเพื่อจัดการเครือข่ายสต็อกของคุณ</CardDescription>
        </CardHeader>

        <CardContent>
          {/* Demo credentials */}
          <div className="mb-5 rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="font-medium mb-1">Demo Access</div>
            <div className="grid gap-1 text-muted-foreground">
              <div>Email: <code className="text-foreground">{DEMO_EMAIL}</code></div>
              <div>Password: <code className="text-foreground">{DEMO_PASSWORD}</code></div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Business Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={show ? 'text' : 'password'}
                  placeholder="Enter your secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-muted"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-muted-foreground/30"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Keep me signed in
              </label>
              <span className="text-muted-foreground">Forgot password?</span>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in to TransferNet'}
            </Button>

            {/* แสดง error ชัดเจนถ้า credential ไม่ผ่าน */}
            {err && (
              <div className="text-sm text-red-600 text-center">{err}</div>
            )}

            <div className="text-center text-xs text-muted-foreground">
              By continuing you agree to our Terms & Privacy.
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
