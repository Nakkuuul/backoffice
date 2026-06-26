"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout as apiLogout, type MeResponse } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    // The httpOnly cookie is the source of truth: /bff/auth/me 401s (and the BFF
    // attempts a refresh first) → not authenticated → back to /login.
    getMe().then(
      (res) => {
        if (cancelled) return;
        setMe(res);
        setStatus("ready");
      },
      () => {
        if (!cancelled) router.replace("/login");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [router]);

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* best-effort */
    }
    router.replace("/login");
  }, [router]);

  if (status !== "ready" || !me) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-[0.16em] text-ink-muted">
        <span>
          Loading session<span className="sb-caret ml-0.5 inline-block">▍</span>
        </span>
      </main>
    );
  }

  const { user, permissions } = me;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-6 py-12 text-ink">
      <div className="w-full max-w-xl rounded-[10px] border border-rule bg-paper-raised px-8 py-10 shadow-[0_1px_2px_rgba(28,26,23,0.06)]">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-oxblood">Backoffice</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            {user.role}
            {user.twoFactorEnabled ? " · 2FA ✓" : ""}
          </p>
        </div>

        <h1
          className="mt-2 text-[26px] text-ink"
          style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'opsz' 40, 'wght' 520" }}
        >
          Welcome, {user.fullName}.
        </h1>

        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 font-mono text-[13px]">
          {[
            ["Email", user.email],
            ["Role", user.role],
            ["Type", user.userType],
            ["Client ref", user.clientRef ?? "—"],
            ["Last login", user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="uppercase tracking-[0.1em] text-ink-muted">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Permissions · {permissions.length}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {permissions.map((p) => (
              <span
                key={p}
                className="rounded-[4px] border border-rule bg-paper px-2 py-0.5 font-mono text-[11px] text-ink-muted"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="mt-8 h-11 w-full rounded-[6px] border border-field-border bg-paper text-[14px] font-medium text-ink transition-colors hover:border-oxblood hover:text-oxblood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised"
        >
          Sign out
        </button>
      </div>

      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
        v2026.06 · placeholder dashboard
      </p>
    </main>
  );
}
