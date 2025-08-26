import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";
import { getServerSession } from "@/src/lib/session";

export async function GET() {
  const me = await getServerSession();
  if (!me) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  // [แก้ไข] ไม่ว่าจะเป็น Role ไหนก็ตาม ถ้าล็อกอินแล้ว ให้ดึงข้อมูลทุกสาขา
  // เพราะหน้านี้ (Transfer Platform) จำเป็นต้องใช้ข้อมูลของทุกสาขา
  const snap = await db.collection("stores").get();
  const branches = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  
  return NextResponse.json({ ok: true, branches });
}