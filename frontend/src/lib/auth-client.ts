"use client";

/**
 * Auth flow seam — MOCK. Mirrors the backend auth state machine WITHOUT calling
 * any API yet (per request). Each function maps 1:1 to a backend endpoint and
 * returns the same response shape, so wiring later is a body swap:
 *
 *   submitCredentials   → POST /api/v1/auth/login
 *   submitNewPassword   → POST /api/v1/auth/change-password
 *   beginTwoFactorSetup → POST /api/v1/auth/2fa/setup
 *   confirmTwoFactor    → POST /api/v1/auth/2fa/enable
 *   verifyTwoFactor     → POST /api/v1/auth/2fa/verify
 *
 * See src/lib/api.ts for the real client (login() already implemented). When
 * integrating, replace the bodies below with fetches and keep these signatures.
 */

export type Stage =
  | "credentials"
  | "change_password"
  | "enroll_2fa"
  | "verify_2fa"
  | "authenticated";

export interface CredentialsResult {
  stage: Exclude<Stage, "credentials">;
  mustChangePassword?: boolean;
  twoFactorEnrolled?: boolean;
}
export interface ChallengeResult {
  stage: Stage;
}
export interface SetupResult {
  /** PNG data URL from the backend (null here → UI shows a placeholder QR). */
  qrCode: string | null;
  otpauthUrl: string;
  secret: string;
}
export interface EnableResult {
  stage: "authenticated";
  recoveryCodes: string[];
}

/** Mirrors the backend AppError body ({ error: { code, message } }). */
export class FlowError extends Error {
  readonly code: string;
  constructor(message: string, code = "BAD_REQUEST") {
    super(message);
    this.name = "FlowError";
    this.code = code;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST /auth/login — returns the next required stage. */
export async function submitCredentials(
  email: string,
  password: string,
): Promise<CredentialsResult> {
  await delay(750);
  if (!email || !password) {
    throw new FlowError("Enter your email and password.", "UNAUTHORIZED");
  }
  // MOCK routing so every screen is reachable for review:
  //  - an email containing "return" → a returning, enrolled user (2FA verify)
  //  - anything else                → a first login (force password change)
  if (/return/i.test(email)) {
    return { stage: "verify_2fa", twoFactorEnrolled: true };
  }
  return { stage: "change_password", mustChangePassword: true };
}

/** POST /auth/change-password — advances to 2FA enrollment. */
export async function submitNewPassword(
  currentPassword: string,
  newPassword: string,
): Promise<ChallengeResult> {
  await delay(750);
  void currentPassword;
  if (newPassword.length < 8) {
    throw new FlowError("Password must be at least 8 characters.");
  }
  return { stage: "enroll_2fa" };
}

/** POST /auth/2fa/setup — returns the QR / otpauth / secret to enrol. */
export async function beginTwoFactorSetup(email: string): Promise<SetupResult> {
  await delay(500);
  const secret = "JBSWY3DPEHPK3PXP"; // example base32 (mock)
  const account = encodeURIComponent(email || "you@sapphirebroking.net");
  const otpauthUrl = `otpauth://totp/Sapphire%20Broking:${account}?secret=${secret}&issuer=Sapphire%20Broking&digits=6&period=30`;
  return { qrCode: null, otpauthUrl, secret };
}

/** POST /auth/2fa/enable — confirm the code, return recovery codes + log in. */
export async function confirmTwoFactor(code: string): Promise<EnableResult> {
  await delay(750);
  if (!/^\d{6}$/.test(code)) {
    throw new FlowError("Enter the 6-digit code from your authenticator app.", "UNAUTHORIZED");
  }
  return { stage: "authenticated", recoveryCodes: makeRecoveryCodes() };
}

/** POST /auth/2fa/verify — TOTP or recovery code → log in. */
export async function verifyTwoFactor(code: string): Promise<ChallengeResult> {
  await delay(750);
  const isTotp = /^\d{6}$/.test(code);
  const isRecovery = /^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/.test(code);
  if (!isTotp && !isRecovery) {
    throw new FlowError("Invalid code. Enter the 6-digit code or a recovery code.", "UNAUTHORIZED");
  }
  return { stage: "authenticated" };
}

function makeRecoveryCodes(): string[] {
  const group = () =>
    Array.from({ length: 5 }, () =>
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(Math.floor(Math.random() * 32)),
    ).join("");
  return Array.from({ length: 10 }, () => `${group()}-${group()}-${group()}`);
}
