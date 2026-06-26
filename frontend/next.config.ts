import type { NextConfig } from "next";

/**
 * No client-facing rewrite to the backend: the browser only ever talks to the
 * same-origin BFF route handlers (/bff/auth/*), which forward to the backend
 * SERVER-SIDE via BACKEND_ORIGIN and keep tokens in httpOnly cookies. Exposing a
 * direct /api/* proxy would let client JS fetch raw tokens, defeating that — so
 * it is intentionally absent.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
