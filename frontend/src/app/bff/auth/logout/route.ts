import { NextRequest, NextResponse } from "next/server";
import { backendFetch, readCookie, clearAll, COOKIE } from "@/lib/server/auth-bff";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const at = readCookie(req, COOKIE.access);
  const rt = readCookie(req, COOKIE.refresh);
  if (at) {
    // Best-effort backend revocation of the refresh session.
    await backendFetch("/auth/logout", { method: "POST", token: at, body: rt ? { refreshToken: rt } : {} });
  }
  const res = new NextResponse(null, { status: 204 });
  clearAll(res);
  return res;
}
