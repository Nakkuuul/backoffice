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

/**
 * Generic authenticated proxy for app data. The browser calls same-origin
 * /bff/api/<path>; this attaches the httpOnly access token, forwards to the
 * backend /api/v1/<path>, and on a 401 rotates the refresh token (de-duped),
 * sets the new cookies, and retries once. Reusable by every module.
 */
async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `/${path.join("/")}${req.nextUrl.search}`;

  const at = readCookie(req, COOKIE.access);
  if (!at) return unauthorized("Not signed in.");

  const method = req.method;
  let body: unknown;
  if (method !== "GET" && method !== "HEAD" && method !== "DELETE") {
    body = await req.json().catch(() => undefined);
  }

  const send = (token: string) => backendFetch(target, { method, token, body });

  let r = await send(at);
  let refreshedCookies: NextResponse | null = null;

  if (r.status === 401) {
    const rt = readCookie(req, COOKIE.refresh);
    const refreshed = rt ? await refreshAccess(rt) : null;
    if (refreshed && refreshed.status >= 200 && refreshed.status < 300 && refreshed.data?.token) {
      r = await send(refreshed.data.token);
      refreshedCookies = NextResponse.json(null); // placeholder to carry Set-Cookie
      setAccessCookies(refreshedCookies, refreshed.data);
    } else {
      const res = unauthorized("Session expired. Please sign in again.");
      clearAll(res);
      return res;
    }
  }

  const res = r.status === 204 ? new NextResponse(null, { status: 204 }) : NextResponse.json(r.data, { status: r.status });
  if (refreshedCookies) {
    for (const c of refreshedCookies.cookies.getAll()) res.cookies.set(c);
  }
  return res;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
