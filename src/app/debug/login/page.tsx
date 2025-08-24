"use client";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getClientAuth } from "@/src/lib/firebaseClient";

async function safeJson(res: Response) {
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

export default function DebugLoginPage() {
  const [idOrUsername, setIdOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<any>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    let email = idOrUsername;
    if (!idOrUsername.includes("@")) {
      const r = await fetch("/api/auth/username-to-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: idOrUsername }),
      });
      const data = await safeJson(r);
      if (!r.ok || !data?.ok) {
        setResult({ step: "username-to-email", status: r.status, data });
        return;
      }
      email = data.email;
    }

    try {
      const auth = await getClientAuth();
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();

      const s = await fetch("/api/auth/sessionLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data2 = await safeJson(s);
      if (!s.ok || data2?.ok === false) {
        setResult({ step: "sessionLogin", status: s.status, data: data2 });
        return;
      }
      setResult({ ok: true, step: "sessionLogin", data: data2 });
    } catch (err: any) {
      setResult({ step: "signin", error: err?.message || String(err) });
    }
  }

  async function checkSession() {
    const r = await fetch("/api/debug/session");
    const data = await safeJson(r);
    setResult({ step: "checkSession", status: r.status, data });
  }

  async function logout() {
    const r = await fetch("/api/auth/sessionLogout", { method: "POST" });
    const data = await safeJson(r);
    setResult({ step: "logout", status: r.status, data });
  }

  return (
    <div className="p-6 space-y-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold">Debug Login</h1>
      <form onSubmit={handleLogin} className="space-y-2">
        <input className="border p-2 w-full" placeholder="username หรือ email"
               value={idOrUsername} onChange={(e)=>setIdOrUsername(e.target.value)} />
        <input type="password" className="border p-2 w-full" placeholder="password"
               value={password} onChange={(e)=>setPassword(e.target.value)} />
        <button className="px-4 py-2 border rounded">Login</button>
      </form>

      <div className="flex gap-2">
        <button onClick={checkSession} className="px-3 py-1 border rounded">Check Session</button>
        <button onClick={logout} className="px-3 py-1 border rounded">Logout</button>
      </div>

      <pre className="bg-gray-100 p-2 text-xs whitespace-pre-wrap">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}
