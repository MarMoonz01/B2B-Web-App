import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";
import { getServerSession } from "@/src/lib/session";

export async function GET() {
  const me = await getServerSession();
  if (!me) return NextResponse.json({ ok:false, error:"unauthenticated" }, { status:401 });

  const id = me.selectedBranchId || null;
  if (!id) return NextResponse.json({ ok:true, branch: null });

  const doc = await db.collection("branches").doc(id).get();
  const name = doc.exists ? (doc.get("name") ?? id) : id;

  return NextResponse.json({ ok:true, branch: { id, name } });
}
