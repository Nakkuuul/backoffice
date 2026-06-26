import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/server/auth-bff";

export const dynamic = "force-dynamic";

/** Public (pre-auth) — proxy the enumeration-safe reset request. No tokens involved. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { status, data } = await backendFetch("/auth/forgot-password", { method: "POST", body });
  return NextResponse.json(data, { status });
}
