import { NextRequest, NextResponse } from "next/server";

/**
 * Server-only BFF (token-handler) helpers. The browser talks to same-origin
 * /bff/auth/* route handlers; THESE hold the tokens in httpOnly cookies and
 * forward them as bearer tokens to the Express backend. Tokens never reach JS.
 *
 * Only imported by route handlers (server). Backend origin via BACKEND_ORIGIN.
 */

const BACKEND =
  (process.env.BACKEND_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "") + "/api/v1";
const PROD = process.env.NODE_ENV === "production";

export const COOKIE = { access: "bo_at", refresh: "bo_rt", challenge: "bo_ct" } as const;

// httpOnly so JS can't read; SameSite=Lax blocks the cookie on cross-site POST
// (CSRF baseline); Secure in production.
const BASE = { httpOnly: true, secure: PROD, sameSite: "lax" as const, path: "/" };
const TTL = { access: 60 * 60 * 24, refresh: 60 * 60 * 24 * 30, challenge: 60 * 10 };

export interface BackendResult {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export async function backendFetch(
  path: string,
  opts: { method?: string; token?: string | null; body?: unknown } = {},
): Promise<BackendResult> {
  const { method = "GET", token, body } = opts;
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* empty / non-JSON */
    }
    return { status: res.status, data };
  } catch {
    return {
      status: 502,
      data: { error: { code: "BACKEND_UNREACHABLE", message: "Could not reach the server. Please try again." } },
    };
  }
}

export const readCookie = (req: NextRequest, name: string) => req.cookies.get(name)?.value ?? null;

/**
 * De-duplicated refresh: the backend rotates refresh tokens atomically (the old
 * one is revoked once redeemed), so two concurrent /me requests refreshing the
 * SAME token would race — one wins, the other 401s and logs the user out.
 * Coalesce concurrent refreshes of the same token into one in-flight call.
 */
const refreshInFlight = new Map<string, Promise<BackendResult>>();
export function refreshAccess(refreshToken: string): Promise<BackendResult> {
  const existing = refreshInFlight.get(refreshToken);
  if (existing) return existing;
  const p = backendFetch("/auth/refresh", { method: "POST", body: { refreshToken } }).finally(() =>
    refreshInFlight.delete(refreshToken),
  );
  refreshInFlight.set(refreshToken, p);
  return p;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function strip(data: any) {
  if (!data || typeof data !== "object") return data;
  const clone = { ...data };
  delete clone.token;
  delete clone.refreshToken;
  return clone;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setAccessCookies(res: NextResponse, data: any) {
  if (data?.token) res.cookies.set(COOKIE.access, data.token, { ...BASE, maxAge: TTL.access });
  if (data?.refreshToken) res.cookies.set(COOKIE.refresh, data.refreshToken, { ...BASE, maxAge: TTL.refresh });
  res.cookies.delete(COOKIE.challenge);
}

export function clearAll(res: NextResponse) {
  res.cookies.delete(COOKIE.access);
  res.cookies.delete(COOKIE.refresh);
  res.cookies.delete(COOKIE.challenge);
}

/**
 * Build the client response for an auth (login / step-up) backend result: set
 * the right httpOnly cookies (access+refresh when authenticated, else the
 * interim challenge cookie) and strip tokens from the JSON sent to the browser.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function authResponse(status: number, data: any): NextResponse {
  const res = NextResponse.json(strip(data), { status });
  if (status >= 200 && status < 300 && data?.stage) {
    if (data.stage === "authenticated") setAccessCookies(res, data);
    else if (data.token) res.cookies.set(COOKIE.challenge, data.token, { ...BASE, maxAge: TTL.challenge });
  }
  return res;
}

export const unauthorized = (message = "Session expired. Please sign in again.") =>
  NextResponse.json({ error: { code: "UNAUTHENTICATED", message } }, { status: 401 });
