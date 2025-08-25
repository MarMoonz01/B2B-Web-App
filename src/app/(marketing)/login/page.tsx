// src/app/(marketing)/login/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getClientAuth } from "@/src/lib/firebaseClient";
import { ensureUserProfile } from "@/src/lib/ensureUserProfile";

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

      // 3) สร้าง/อัปเดต users/{uid} (กันล้มกรณี rules ยังไม่พร้อม)
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
      setMsg(err?.message || "เข้าสู่ระบบไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>

      <input
        className="border p-2 w-full rounded"
        placeholder="username หรือ email"
        value={idOrUsername}
        onChange={(e) => setIdOrUsername(e.target.value)}
        autoComplete="username"
      />

      <input
        className="border p-2 w-full rounded"
        type="password"
        placeholder="รหัสผ่าน"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />

      <button
        className="w-full p-2 rounded bg-black text-white disabled:opacity-50"
        disabled={busy}
        type="submit"
      >
        {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>

      {msg && <p className="text-red-600 text-sm">{msg}</p>}
    </form>
  );
}
