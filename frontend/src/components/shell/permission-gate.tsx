"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * Renders children only if the user has ANY of `anyPermission`; otherwise a
 * graceful "not on your ledger" notice. Deep-links to forbidden pages fail
 * softly here (the backend enforces independently on every API call).
 */
export function PermissionGate({
  anyPermission,
  children,
}: {
  anyPermission?: string[];
  children: React.ReactNode;
}) {
  const { canAny } = useAuth();
  if (!anyPermission || canAny(anyPermission)) return <>{children}</>;

  return (
    <div className="mx-auto mt-16 max-w-md rounded-[10px] border border-rule-strong bg-paper-raised p-8 text-center shadow-[0_1px_2px_rgba(28,26,23,0.06)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-oxblood">403 · Restricted</p>
      <h1
        className="mt-2 text-[22px] text-ink"
        style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'opsz' 30, 'wght' 520" }}
      >
        Not on your ledger.
      </h1>
      <p className="mt-2 text-[14px] text-ink-muted">
        Your role doesn&rsquo;t grant access to this section. If you believe this is a mistake, contact a
        super-admin.
      </p>
      <Link
        href="/overview"
        className="mt-6 inline-block font-mono text-[12px] uppercase tracking-[0.16em] text-oxblood hover:underline"
      >
        ← Back to overview
      </Link>
    </div>
  );
}
