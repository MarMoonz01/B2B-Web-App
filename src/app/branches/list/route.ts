import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";
import { getServerSession } from "@/src/lib/session";

export async function GET() {
  const me = await getServerSession();

  // ตรวจสอบว่าผู้ใช้ล็อกอินหรือไม่
  if (!me || !me.uid) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  // หากเป็น moderator ให้ดึงข้อมูลทุกสาขาที่ยัง Active อยู่
  if (me.moderator) {
    const snap = await db.collection("stores").where("isActive", "==", true).get();
    const branches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ ok: true, branches });
  }

  // สำหรับผู้ใช้ทั่วไป ให้ดึงสาขาจากสิทธิ์ที่มีใน 'userBranchRoles'
  try {
    // 1. ค้นหาเอกสารสิทธิ์ทั้งหมดที่ตรงกับ uid ของผู้ใช้
    const userBranchRolesSnap = await db.collection('userBranchRoles').where('uid', '==', me.uid).get();
    
    if (userBranchRolesSnap.empty) {
        // ถ้าไม่พบสิทธิ์ใดๆ ให้ trả về array ว่าง
        return NextResponse.json({ ok: true, branches: [] });
    }

    // 2. รวบรวม branchId ที่ไม่ซ้ำกัน
    const branchIds = [...new Set(userBranchRolesSnap.docs.map(doc => doc.data().branchId as string))];

    if (branchIds.length === 0) {
        return NextResponse.json({ ok: true, branches: [] });
    }

    // 3. ดึงข้อมูลสาขา (stores) จาก branchId ที่ได้มา
    const storesSnap = await db.collection('stores').where('__name__', 'in', branchIds).get();
    
    const branches = storesSnap.docs
      .map(doc => {
        const data = doc.data();
        // กรองสาขาที่ไม่ได้ Active ออก (ถ้ามี field นี้)
        if (data.isActive === false) return null;
        return {
            id: doc.id,
            branchName: data.branchName || data.name || doc.id,
        };
      })
      .filter(Boolean); // เอาค่า null ออก

    return NextResponse.json({ ok: true, branches });

  } catch (error) {
    console.error("Error fetching user branches:", error);
    return NextResponse.json({ ok: false, error: "internal_server_error" }, { status: 500 });
  }
}