import { NextResponse } from "next/server";
import { adminAuth } from "@/src/lib/firebaseAdmin";
import { CRED_SOURCE } from "@/src/lib/firebaseAdmin";

export async function GET() {
  try {
    // ถ้าทำงานได้ แปลว่า access token ใช้ได้
    await adminAuth.listUsers(1);
    return NextResponse.json({ ok: true, cred: CRED_SOURCE, gac: process.env.GOOGLE_APPLICATION_CREDENTIALS });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, cred: CRED_SOURCE, error: String(e?.message || e), gac: process.env.GOOGLE_APPLICATION_CREDENTIALS },
      { status: 500 }
    );
  }
}
