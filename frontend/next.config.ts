import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Dev-only proxy so the frontend can call the backend same-origin via
    // /api/* and avoid CORS during local development. In production, point
    // NEXT_PUBLIC_API_URL at the real API origin (or front the API behind the
    // same domain) instead of relying on this rewrite.
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    const backendOrigin =
      process.env.BACKEND_ORIGIN ?? "http://localhost:3000";

    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
