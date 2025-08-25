import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";

export async function POST(req: Request) {
  const { username } = await req.json();
  if (!username) return NextResponse.json({ ok: false, error: "missing username" }, { status: 400 });

  const snap = await db.collection("users")
    .where("username", "==", username)
    .limit(1)
    .get();

  if (snap.empty) return NextResponse.json({ ok: false, error: "invalid credentials" }, { status: 200 });
  const email = snap.docs[0].get("email");
  return NextResponse.json({ ok: true, email });
}
