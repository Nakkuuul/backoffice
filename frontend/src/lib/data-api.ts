/**
 * Authenticated data client — talks to the same-origin /bff/api/* proxy, which
 * attaches the httpOnly access cookie and forwards to the backend. Reuses ApiError.
 */
import { ApiError } from "./api";

const BASE = "/bff/api";

async function apiFetch<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = "GET", body } = opts;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Could not reach the server. Please try again.", "NETWORK_ERROR", 0);
  }
  if (res.status === 204) return null as T;
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) {
    const e = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(e?.message ?? "Request failed.", e?.code ?? "INTERNAL_ERROR", res.status);
  }
  return payload as T;
}

/* ── Company types (mirror GET /api/v1/company) ──────────────────────────────── */

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}
export interface Person {
  name?: string;
  email?: string;
  phone?: string;
}
export interface Kmp {
  name: string;
  role?: string;
  din?: string;
  pan?: string;
  email?: string;
  phone?: string;
}
export interface BankAccount {
  label?: string;
  bankName: string;
  accountNo: string;
  ifsc?: string;
  branch?: string;
  type?: string;
}
export interface ThirdPartyDp {
  name?: string;
  dpId?: string;
  sebiRegNo?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  agreementRef?: string;
}
export interface Depository {
  depository: string;
  mode: "self" | "third_party";
  dpId?: string | null;
  dpName?: string | null;
  sebiRegNo?: string | null;
  active?: boolean;
  thirdParty?: ThirdPartyDp | null;
}
export interface ThirdPartyClearer {
  name?: string;
  clearingMemberId?: string;
  cmCode?: string;
  sebiRegNo?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  agreementRef?: string;
}
export interface Membership {
  id: number;
  exchange: string;
  membershipType?: string | null;
  tradingMemberId?: string | null;
  clearingMode?: "self" | "third_party" | null;
  clearingMemberId?: string | null;
  cmCode?: string | null;
  thirdPartyClearer?: ThirdPartyClearer | null;
  registrationNo?: string | null;
  segments: string[];
  active: boolean;
  effectiveFrom?: string | null;
}
export interface CompanyProfile {
  tradeName: string;
  legalName?: string | null;
  entityType?: string | null;
  dateOfIncorporation?: string | null;
  foundedYear?: number | null;
  cin?: string | null;
  pan?: string | null;
  gstin?: string | null;
  tan?: string | null;
  sebiRegNo?: string | null;
  logoRef?: string | null;
  registeredAddress: Address;
  headOfficeAddress: Address;
  phone?: string | null;
  altPhone?: string | null;
  email?: string | null;
  website?: string | null;
  supportEmail?: string | null;
  grievanceEmail?: string | null;
  complianceOfficer: Person;
  principalOfficer: Person;
  keyPersonnel: Kmp[];
  depositories: Depository[];
  bankAccounts: BankAccount[];
  baseCurrency?: string;
  financialYearStart?: string;
  timezone?: string;
  updatedAt?: string;
}
export interface CompanyResponse {
  profile: CompanyProfile;
  memberships: Membership[];
  activeSegments: string[];
  dpMode: "none" | "self" | "third_party" | "mixed";
}

export const getCompany = () => apiFetch<CompanyResponse>("/company");

/* ── Company writes (via the same authenticated BFF proxy) ───────────────────── */
export const updateCompany = (body: Record<string, unknown>) =>
  apiFetch<CompanyProfile>("/company", { method: "PUT", body });
export const addMembership = (body: Record<string, unknown>) =>
  apiFetch<Membership>("/company/memberships", { method: "POST", body });
export const updateMembership = (id: number, body: Record<string, unknown>) =>
  apiFetch<Membership>(`/company/memberships/${id}`, { method: "PATCH", body });
export const deleteMembership = (id: number) =>
  apiFetch<null>(`/company/memberships/${id}`, { method: "DELETE" });
