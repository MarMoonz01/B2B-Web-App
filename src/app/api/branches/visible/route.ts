import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";
import { getServerSession } from "@/src/lib/session";

export async function GET() {
  const me = await getServerSession();
  if (!me) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  // สำหรับหน้า Transfer Platform เราจำเป็นต้องดึงข้อมูลของทุกสาขา
  // โดยไม่สนใจ Role ของผู้ใช้ที่ล็อกอินเข้ามา
  const snap = await db.collection("stores").get();
  const branches = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  
  return NextResponse.json({ ok: true, branches });
}