import { NextResponse } from "next/server";
import { adminAuth, db } from "@/src/lib/firebaseAdmin"; // Import 'db'

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ ok: false, error: "missing idToken" }, { status: 400 });
    }

    // ========== START: ADD THIS VERIFICATION BLOCK ==========
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Force a server-side read of the user's roles
    try {
      const snap = await db.collection("userBranchRoles").where("uid", "==", uid).get();
      if (snap.empty) {
        // This log will tell us if the roles don't exist yet
        console.log(`sessionLogin: No roles found for UID: ${uid}`);
      }
    } catch (error) {
      // If this error happens, it's 100% a security rule issue
      console.error("sessionLogin: FAILED to read userBranchRoles.", error);
      return NextResponse.json({ ok: false, error: "Server-side permission denied when reading roles." }, { status: 500 });
    }
    // ========== END: ADD THIS VERIFICATION BLOCK ==========


    // อายุ session 7 วัน
    const expiresIn = 1000 * 60 * 60 * 24 * 7;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const isProd = (process.env.NODE_ENV ?? "").toLowerCase() === "production";

    const res = NextResponse.json({ ok: true });
    res.cookies.set("session", sessionCookie, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isProd,          // dev=false, prod=true
      maxAge: expiresIn / 1000 // วินาที
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 401 });
  }
}