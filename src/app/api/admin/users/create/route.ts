export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "@/src/lib/session";
import { adminAuth, db } from "@/src/lib/firebaseAdmin";

export async function POST(req: Request) {
  const me = await getServerSession();
  if (!me) return NextResponse.json({ ok:false, error:"unauthenticated" }, { status:401 });
  if (!me.moderator) return NextResponse.json({ ok:false, error:"forbidden" }, { status:403 });

  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ ok:false, error:"email/password required" }, { status:400 });

  const u = await adminAuth.createUser({ email, password, emailVerified: false, disabled: false });

  await db.collection("users").doc(u.uid).set(
    { email, createdAt: Date.now(), updatedAt: Date.now() },
    { merge: true }
  );

  return NextResponse.json({ ok:true, uid: u.uid });
}
