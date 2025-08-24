import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";
import { getServerSession } from "@/src/lib/session";

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function GET() {
  const me = await getServerSession();
  if (!me) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  // Moderator เห็นได้ทุกสาขา
  if (me.moderator) {
    const snap = await db.collection("branches").select("name").get();
    const branches = snap.docs.map(d => ({ id: d.id, name: d.get("name") ?? d.id }));
    return NextResponse.json({ ok: true, branches });
  }

  // Admin/Sales: เห็นเฉพาะสาขาที่ตัวเองมีสิทธิ์
  const ids = me.branches.map(b => b.id);
  if (ids.length === 0) return NextResponse.json({ ok: true, branches: [] });

  const batches = chunk(ids, 10); // Firestore 'in' จำกัด 10 รายการต่อครั้ง
  const result: { id: string; name: string }[] = [];
  for (const batch of batches) {
    const snap = await db
      .collection("branches")
      .where("__name__", "in", batch)
      .select("name")
      .get();
    result.push(...snap.docs.map(d => ({ id: d.id, name: d.get("name") ?? d.id })));
  }
  return NextResponse.json({ ok: true, branches: result });
}
