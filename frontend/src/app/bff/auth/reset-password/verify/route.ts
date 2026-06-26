import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/server/auth-bff";

export const dynamic = "force-dynamic";

/** Public (pre-auth) — check whether a reset link token is still valid → { valid }. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { status, data } = await backendFetch("/auth/reset-password/verify", { method: "POST", body });
  return NextResponse.json(data, { status });
}
