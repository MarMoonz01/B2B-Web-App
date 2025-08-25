import { NextResponse } from "next/server";
import { adminAuth, db } from "@/src/lib/firebaseAdmin";

export async function POST(req: Request) {
  // ป้องกันด้วย Secret
  const secret = req.headers.get("x-bootstrap-secret");
  if (!process.env.BOOTSTRAP_SECRET || secret !== process.env.BOOTSTRAP_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { email, makeModerator = true, branches = [], roles = ["ADMIN"] } =
    (await req.json().catch(() => ({}))) || {};
  if (!email) return NextResponse.json({ ok: false, error: "missing email" }, { status: 400 });

  // หา หรือสร้างผู้ใช้ตามอีเมล
  const u =
    (await adminAuth.getUserByEmail(email).catch(async () =>
      adminAuth.createUser({ email, password: "ChangeMe!123", displayName: email.split("@")[0] })
    )) as any;

  // ใส่ custom claim moderator
  await adminAuth.setCustomUserClaims(u.uid, { ...(u.customClaims || {}), moderator: !!makeModerator });

  // ensure users/{uid} (เผื่อยังไม่มี)
  await db.doc(`users/${u.uid}`).set(
    {
      email,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    { merge: true }
  );

  // (ทางเลือก) ให้สิทธิ์ในสาขาที่ระบุ
  for (const b of branches as string[]) {
    for (const r of roles as string[]) {
      const docId = `${u.uid}_${b}_${r}`;
      await db.doc(`userBranchRoles/${docId}`).set(
        {
          uid: u.uid,
          branchId: b,
          role: r,
          assignedBy: u.uid,
          assignedAt: new Date(),
        },
        { merge: true }
      );
    }
  }

  return NextResponse.json({ ok: true, uid: u.uid });
}
