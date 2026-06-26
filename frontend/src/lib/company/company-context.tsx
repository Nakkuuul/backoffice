"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCompany, type CompanyProfile } from "@/lib/data-api";

interface CompanyValue {
  company: CompanyProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyValue>({ company: null, loading: true, refresh: async () => {} });

export function useCompany(): CompanyValue {
  return useContext(CompanyContext);
}

/**
 * Fetches the company profile once for the authenticated shell and shares it
 * (masthead wordmark, overview). Non-blocking: on error (e.g. a user without
 * company:read) it leaves `company` null and consumers fall back gracefully.
 */
export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = (profile: CompanyProfile) => {
    setCompany(profile);
    if (profile.tradeName) document.title = `${profile.tradeName} · Backoffice`;
  };

  const refresh = useCallback(async () => {
    const res = await getCompany().catch(() => null);
    if (res) apply(res.profile);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCompany()
      .then((res) => {
        if (!cancelled) apply(res.profile);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <CompanyContext.Provider value={{ company, loading, refresh }}>{children}</CompanyContext.Provider>;
}
