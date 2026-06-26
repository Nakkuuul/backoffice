/**
 * Server-side fetch of public company branding for the login screen + tab title
 * (pre-auth, no cookie). Talks straight to the backend's public endpoint.
 */
const BACKEND = (process.env.BACKEND_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "") + "/api/v1";

export interface Branding {
  tradeName: string | null;
  legalName: string | null;
  entityType: string | null;
  sebiRegNo: string | null;
  foundedYear: number | null;
  exchanges: string[];
}

export async function getBrandingSSR(): Promise<Branding | null> {
  try {
    const res = await fetch(`${BACKEND}/company/public`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Branding;
  } catch {
    return null;
  }
}
