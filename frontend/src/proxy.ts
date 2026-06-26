import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route protection (Next 16 renamed Middleware → Proxy). Gates the app: if the
 * httpOnly access cookie (bo_at) is absent, redirect to /login. This is a cheap
 * presence check; the real validation happens when the page's AuthProvider calls
 * /bff/auth/me (which refreshes or 401s). The matcher excludes /login, the BFF
 * route handlers, and static assets.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("bo_at");
  if (!hasSession) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|bff/).*)"],
};
