/**
 * Tiny typed API client for the Sapphire Broking backoffice.
 *
 * Base URL resolution:
 *  - Reads `NEXT_PUBLIC_API_URL` when provided (e.g. an absolute origin in prod).
 *  - Defaults to the same-origin `/api/v1` path, which is proxied to the backend
 *    in development via the `rewrites()` rule in `next.config.ts` (avoids CORS).
 *
 * The backend contract (verified):
 *   POST /api/v1/auth/login  { email, password }
 *     200 -> { token, user, permissions }
 *     non-200 -> { error: { code, message, details? } }
 */

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "/api/v1"
).replace(/\/$/, "");

/** Token persisted client-side after a successful login. */
export const TOKEN_STORAGE_KEY = "bo_token";

export interface LoginRequest {
  email: string;
  password: string;
}

export type UserType = "broker" | "client";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  userType: UserType;
  clientRef: string | null;
  phone: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  permissions: string[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Error thrown for any non-2xx response or transport failure. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const maybe = value as { error?: unknown };
  if (typeof maybe.error !== "object" || maybe.error === null) return false;
  const err = maybe.error as { code?: unknown; message?: unknown };
  return typeof err.code === "string" && typeof err.message === "string";
}

/**
 * POST the login credentials and return the typed response.
 * Throws {@link ApiError} on any failure (bad credentials, validation, network).
 */
export async function login(body: LoginRequest): Promise<LoginResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      "NETWORK_ERROR",
      0,
    );
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Body was empty or non-JSON; handled below by status.
  }

  if (!res.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiError(
        payload.error.message,
        payload.error.code,
        res.status,
        payload.error.details,
      );
    }
    throw new ApiError(
      "Something went wrong. Please try again.",
      "INTERNAL_ERROR",
      res.status,
    );
  }

  return payload as LoginResponse;
}

/* --- Token storage --------------------------------------------------------
 * v1 uses localStorage for simplicity. Hardening path (TODO): move to an
 * httpOnly, Secure, SameSite cookie set by a Next.js Route Handler so the
 * token is never readable from JS.
 * ------------------------------------------------------------------------- */

export function storeToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage may be unavailable (private mode / disabled); fail soft.
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}
