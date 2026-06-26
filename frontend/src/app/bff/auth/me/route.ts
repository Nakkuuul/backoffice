import { NextRequest, NextResponse } from "next/server";
import {
  backendFetch,
  refreshAccess,
  readCookie,
  unauthorized,
  setAccessCookies,
  clearAll,
  COOKIE,
} from "@/lib/server/auth-bff";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const at = readCookie(req, COOKIE.access);
  if (!at) return unauthorized("Not signed in.");

  const first = await backendFetch("/auth/me", { token: at });
  if (first.status !== 401) {
    return NextResponse.json(first.data, { status: first.status });
  }

  // Access token expired → rotate the refresh token (de-duped across concurrent
  // requests), set the new cookies, and retry /me once.
  const rt = readCookie(req, COOKIE.refresh);
  let refreshMessage: string | undefined;
  if (rt) {
    const refreshed = await refreshAccess(rt);
    if (refreshed.status >= 200 && refreshed.status < 300 && refreshed.data?.token) {
      const retry = await backendFetch("/auth/me", { token: refreshed.data.token });
      const res = NextResponse.json(retry.data, { status: retry.status });
      setAccessCookies(res, refreshed.data);
      return res;
    }
    // Surface the backend's reason (e.g. "Account is disabled") when present.
    refreshMessage = refreshed.data?.error?.message;
  }

  const res = unauthorized(refreshMessage || "Session expired. Please sign in again.");
  clearAll(res);
  return res;
}
