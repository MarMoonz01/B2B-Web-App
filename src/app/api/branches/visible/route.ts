import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";
import { getServerSession } from "@/src/lib/session";

export async function GET() {
  const me = await getServerSession();
  if (!me) return NextResponse.json({ ok:false, error:"unauthenticated" }, { status:401 });

  if (me.moderator) {
    const snap = await db.collection("stores").get();
    const branches = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ ok:true, branches });
  }

  const ids = me.branches.map(b => b.id);
  if (ids.length === 0) return NextResponse.json({ ok:true, branches: [] });

  const docs = await Promise.all(ids.map(id => db.collection("stores").doc(id).get()));
  const branches = docs.filter(d => d.exists).map(d => ({ id: d.id, ...(d.data() as any) }));
  return NextResponse.json({ ok:true, branches });
}
