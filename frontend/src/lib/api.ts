/**
 * Typed API client for the Sapphire Broking backoffice auth flow.
 *
 * Base URL: NEXT_PUBLIC_API_URL when set (absolute origin in prod), else the
 * same-origin `/api/v1`, proxied to the backend by the dev `rewrites()` in
 * next.config.ts (so dev is CORS-free).
 *
 * Backend auth is a STATE MACHINE. `POST /auth/login` returns either a fully
 * authenticated result or a challenge with a short-lived interim token; the
 * step-up calls (change-password, 2fa/*) carry that interim token until login
 * completes, at which point a real access + refresh pair is issued.
 */

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "/api/v1").replace(/\/$/, "");

export const TOKEN_STORAGE_KEY = "bo_token";
export const REFRESH_STORAGE_KEY = "bo_refresh";
export const USER_STORAGE_KEY = "bo_user";

export type Stage = "change_password" | "enroll_2fa" | "verify_2fa" | "authenticated";
export type UserType = "broker" | "client";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  userType: UserType;
  clientRef: string | null;
  phone: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Login / step-up response. `token` is interim while staged, the access token once authenticated. */
export interface AuthResponse {
  stage: Stage;
  token: string;
  refreshToken?: string;
  user?: AuthUser;
  permissions?: string[];
  mustChangePassword?: boolean;
  twoFactorEnrolled?: boolean;
  twoFactorRequired?: boolean;
}

export interface SetupResponse {
  qrCode: string | null;
  otpauthUrl: string;
  secret: string;
}

export interface EnableResponse extends AuthResponse {
  recoveryCodes: string[];
}

export interface MeResponse {
  user: AuthUser;
  permissions: string[];
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function isErrorBody(
  v: unknown,
): v is { error: { code: string; message: string; details?: unknown } } {
  if (typeof v !== "object" || v === null) return false;
  const e = (v as { error?: unknown }).error as { code?: unknown; message?: unknown } | undefined;
  return !!e && typeof e.code === "string" && typeof e.message === "string";
}

interface RequestOpts {
  method?: string;
  token?: string | null;
  body?: unknown;
}

async function request<T>(path: string, { method = "GET", token, body }: RequestOpts = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      "NETWORK_ERROR",
      0,
    );
  }

  if (res.status === 204) return null as T;

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* empty / non-JSON body */
  }

  if (!res.ok) {
    if (isErrorBody(payload)) {
      throw new ApiError(payload.error.message, payload.error.code, res.status, payload.error.details);
    }
    throw new ApiError("Something went wrong. Please try again.", "INTERNAL_ERROR", res.status);
  }
  return payload as T;
}

/* ── Auth endpoints ─────────────────────────────────────────────────────────── */

export const login = (email: string, password: string) =>
  request<AuthResponse>("/auth/login", { method: "POST", body: { email, password } });

export const changePassword = (token: string, currentPassword: string, newPassword: string) =>
  request<AuthResponse>("/auth/change-password", {
    method: "POST",
    token,
    body: { currentPassword, newPassword },
  });

export const setupTwoFactor = (token: string) =>
  request<SetupResponse>("/auth/2fa/setup", { method: "POST", token });

export const enableTwoFactor = (token: string, code: string) =>
  request<EnableResponse>("/auth/2fa/enable", { method: "POST", token, body: { code } });

export const verifyTwoFactor = (token: string, code: string) =>
  request<AuthResponse>("/auth/2fa/verify", { method: "POST", token, body: { code } });

export const getMe = (token: string) => request<MeResponse>("/auth/me", { token });

export const refresh = (refreshToken: string) =>
  request<AuthResponse>("/auth/refresh", { method: "POST", body: { refreshToken } });

export const logout = (token: string, refreshToken?: string | null) =>
  request<null>("/auth/logout", {
    method: "POST",
    token,
    body: refreshToken ? { refreshToken } : {},
  });

/* ── Client-side session persistence ──────────────────────────────────────────
 * SECURITY NOTE: tokens live in localStorage — simple and works across tabs, but
 * readable by any script, so an XSS would expose them. Accepted for now; the
 * hardening path is an httpOnly + Secure + SameSite cookie set by a Next.js Route
 * Handler so the token is never reachable from JS. TODO before production.
 * ──────────────────────────────────────────────────────────────────────────── */

const safe = {
  set(k: string, v: string) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* private mode / disabled */
    }
  },
  get(k: string) {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  del(k: string) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

/** Persist the authenticated session (access + refresh + user). */
export function storeSession(res: AuthResponse): void {
  safe.set(TOKEN_STORAGE_KEY, res.token);
  if (res.refreshToken) safe.set(REFRESH_STORAGE_KEY, res.refreshToken);
  if (res.user) safe.set(USER_STORAGE_KEY, JSON.stringify(res.user));
}
export const getToken = () => safe.get(TOKEN_STORAGE_KEY);
export const getRefresh = () => safe.get(REFRESH_STORAGE_KEY);
export function getStoredUser(): AuthUser | null {
  const raw = safe.get(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}
export function clearSession(): void {
  safe.del(TOKEN_STORAGE_KEY);
  safe.del(REFRESH_STORAGE_KEY);
  safe.del(USER_STORAGE_KEY);
}
