import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  return NextResponse.json({
    node: process.version,
    openssl: process.versions.openssl,
    fips: (crypto as any).getFips ? (crypto as any).getFips() : 0,
  });
}
