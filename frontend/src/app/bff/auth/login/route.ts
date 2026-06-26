import { NextRequest } from "next/server";
import { backendFetch, authResponse } from "@/lib/server/auth-bff";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { status, data } = await backendFetch("/auth/login", { method: "POST", body });
  return authResponse(status, data);
}
