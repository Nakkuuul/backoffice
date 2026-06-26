import { NextRequest } from "next/server";
import { backendFetch, authResponse, readCookie, unauthorized, COOKIE } from "@/lib/server/auth-bff";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ct = readCookie(req, COOKIE.challenge);
  if (!ct) return unauthorized();
  const body = await req.json().catch(() => ({}));
  // Enable returns the authenticated session (cookies set) + recoveryCodes (kept).
  const { status, data } = await backendFetch("/auth/2fa/enable", { method: "POST", token: ct, body });
  return authResponse(status, data);
}
