import { NextRequest, NextResponse } from "next/server";
import { backendFetch, readCookie, unauthorized, COOKIE } from "@/lib/server/auth-bff";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ct = readCookie(req, COOKIE.challenge);
  if (!ct) return unauthorized();
  // Setup returns { qrCode, otpauthUrl, secret } — no token, no cookie change.
  const { status, data } = await backendFetch("/auth/2fa/setup", { method: "POST", token: ct });
  return NextResponse.json(data, { status });
}
