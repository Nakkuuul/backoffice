"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout as apiLogout, type AuthUser } from "@/lib/api";
import { can as canPerm, canAny as canAnyPerm } from "./permissions";

interface AuthValue {
  user: AuthUser;
  permissions: string[];
  can: (need: string) => boolean;
  canAny: (needs: string[]) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<{ user: AuthUser; permissions: string[] } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    getMe().then(
      (res) => {
        if (!cancelled) {
          setData(res);
          setStatus("ready");
        }
      },
      () => {
        if (!cancelled) router.replace("/login");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* best-effort */
    }
    router.replace("/login");
  }, [router]);

  if (status !== "ready" || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper font-mono text-sm uppercase tracking-[0.16em] text-ink-muted">
        <span>
          Opening the registry<span className="sb-caret ml-0.5 inline-block">▍</span>
        </span>
      </div>
    );
  }

  const value: AuthValue = {
    user: data.user,
    permissions: data.permissions,
    can: (need) => canPerm(data.permissions, need),
    canAny: (needs) => canAnyPerm(data.permissions, needs),
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
