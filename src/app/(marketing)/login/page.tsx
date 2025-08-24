// src/app/(marketing)/login/page.tsx  (client component)
"use client";
import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getClientAuth } from "@/src/lib/firebaseClient";

async function safeJson(res: Response) {
  const t = await res.text(); try { return JSON.parse(t) } catch { return { raw: t } }
}

export default function LoginPage() {
  const search = useSearchParams();
  const router = useRouter();
  const next = useMemo(() => search.get("next") || "/app?view=inventory", [search]); // ✅

  const [idOrUsername, setIdOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      let email = idOrUsername.trim();
      if (!email.includes("@")) {
        const r = await fetch("/api/auth/username-to-email",{ method:"POST", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ username: email }) });
        const d = await safeJson(r);
        if (!r.ok || !d?.ok) throw new Error("ไม่พบ username นี้");
        email = d.email;
      }
      const auth = await getClientAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      const s = await fetch("/api/auth/sessionLogin", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ idToken }),
      });
      const d2 = await safeJson(s);
      if (!s.ok || d2?.ok === false) throw new Error(d2?.error || String(s.status));
      router.replace(next); // ✅ ไป /app?view=inventory (หรือ next ที่ส่งมา)
    } catch (e:any) { setMsg(e?.message || String(e)); setBusy(false); }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
      <input className="border p-2 w-full" placeholder="username หรือ email"
        value={idOrUsername} onChange={e=>setIdOrUsername(e.target.value)} />
      <input className="border p-2 w-full" type="password" placeholder="รหัสผ่าน"
        value={password} onChange={e=>setPassword(e.target.value)} />
      <button className="w-full p-2 rounded bg-black text-white disabled:opacity-50" disabled={busy}>
        {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>
      {msg && <p className="text-red-600 text-sm">{msg}</p>}
    </form>
  );
}
