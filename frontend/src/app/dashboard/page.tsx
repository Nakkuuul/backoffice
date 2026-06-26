"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken, type AuthUser } from "@/lib/api";

const USER_STORAGE_KEY = "bo_user";

interface Session {
  token: string | null;
  user: AuthUser | null;
}

const SERVER_SNAPSHOT: Session = { token: null, user: null };

// Cached client snapshot so useSyncExternalStore gets a stable reference
// (returning a fresh object each call would loop). Recomputed on storage events.
let clientSnapshot: Session | null = null;

function computeSnapshot(): Session {
  const token = getToken();
  let user: AuthUser | null = null;
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (raw) user = JSON.parse(raw) as AuthUser;
  } catch {
    // Fall back to the stub view if the stored user is missing/corrupt.
  }
  return { token, user };
}

function getClientSnapshot(): Session {
  if (clientSnapshot === null) clientSnapshot = computeSnapshot();
  return clientSnapshot;
}

function subscribe(onChange: () => void): () => void {
  function handler() {
    clientSnapshot = computeSnapshot();
    onChange();
  }
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export default function DashboardPage() {
  const router = useRouter();
  // useSyncExternalStore reads client-only state without a hydration mismatch
  // (server uses SERVER_SNAPSHOT) and without setState-in-effect.
  const session = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    () => SERVER_SNAPSHOT,
  );

  useEffect(() => {
    if (!session.token) {
      router.replace("/login");
    }
  }, [session.token, router]);

  function signOut() {
    clearToken();
    try {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // ignore
    }
    clientSnapshot = null;
    router.replace("/login");
  }

  if (!session.token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper text-ink-muted font-mono text-sm uppercase tracking-[0.16em]">
        Redirecting…
      </main>
    );
  }

  const { user } = session;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-6 text-ink">
      <div className="w-full max-w-md rounded-[8px] border border-rule bg-paper-raised px-8 py-10 shadow-[0_1px_2px_rgba(28,26,23,0.06)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-oxblood">
          Backoffice
        </p>
        <h1
          className="mt-2 text-[26px] text-ink"
          style={{
            fontFamily: "var(--font-display)",
            fontVariationSettings: "'opsz' 40, 'wght' 520",
          }}
        >
          {user ? `Welcome, ${user.fullName}.` : "Signed in."}
        </h1>

        {user ? (
          <dl className="mt-6 space-y-2 font-mono text-[13px] text-ink-muted">
            <div className="flex justify-between gap-4">
              <dt>EMAIL</dt>
              <dd className="text-ink">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>ROLE</dt>
              <dd className="text-ink">{user.role}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>TYPE</dt>
              <dd className="text-ink">{user.userType}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-[14px] text-ink-muted">
            A valid session token was found, but no user details were stored.
            This is a placeholder dashboard.
          </p>
        )}

        <button
          type="button"
          onClick={signOut}
          className="mt-8 h-11 w-full rounded-[6px] border border-field-border bg-paper text-[14px] font-medium text-ink transition-colors hover:border-oxblood hover:text-oxblood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
