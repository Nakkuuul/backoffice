/**
 * Client API for the auth flow. Talks ONLY to same-origin /bff/auth/* route
 * handlers (the token-handler BFF). Tokens live in httpOnly cookies set by the
 * BFF and are never readable here — so there is nothing to store client-side.
 */

const BFF = "/bff/auth";

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

/** Login / step-up response (tokens are stripped by the BFF before reaching JS). */
export interface AuthResponse {
  stage: Stage;
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

async function call<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = "GET", body } = opts;
  let res: Response;
  try {
    res = await fetch(`${BFF}${path}`, {
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
    /* empty / non-JSON */
  }

  if (!res.ok) {
    if (isErrorBody(payload)) {
      throw new ApiError(payload.error.message, payload.error.code, res.status, payload.error.details);
    }
    throw new ApiError("Something went wrong. Please try again.", "INTERNAL_ERROR", res.status);
  }
  return payload as T;
}

/* ── Auth flow (cookies handled server-side by the BFF) ─────────────────────── */

export const login = (email: string, password: string) =>
  call<AuthResponse>("/login", { method: "POST", body: { email, password } });

export const changePassword = (currentPassword: string, newPassword: string) =>
  call<AuthResponse>("/change-password", { method: "POST", body: { currentPassword, newPassword } });

export const setupTwoFactor = () => call<SetupResponse>("/2fa/setup", { method: "POST" });

export const enableTwoFactor = (code: string) =>
  call<EnableResponse>("/2fa/enable", { method: "POST", body: { code } });

export const verifyTwoFactor = (code: string) =>
  call<AuthResponse>("/2fa/verify", { method: "POST", body: { code } });

export const getMe = () => call<MeResponse>("/me");

export const logout = () => call<null>("/logout", { method: "POST" });

/* ── Forgot access (password reset) — public, pre-auth ──────────────────────── */

export type ResetMethod = "email_link" | "email_otp" | "sms_otp";

export const forgotPassword = (email: string, method: ResetMethod) =>
  call<{ ok: boolean; message?: string }>("/forgot-password", { method: "POST", body: { email, method } });

export const verifyResetToken = (token: string) =>
  call<{ valid: boolean }>("/reset-password/verify", { method: "POST", body: { token } });

export const resetPassword = (body: {
  token?: string;
  email?: string;
  otp?: string;
  newPassword: string;
}) => call<{ ok: boolean; message?: string }>("/reset-password", { method: "POST", body });
