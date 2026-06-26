"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Seal } from "./seal";
import { ErrorBanner } from "./step-chrome";
import { CredentialsStep } from "./steps/credentials-step";
import { ChangePasswordStep } from "./steps/change-password-step";
import { EnrollTwoFactorStep } from "./steps/enroll-2fa-step";
import { VerifyTwoFactorStep } from "./steps/verify-2fa-step";
import { storeToken } from "@/lib/api";
import {
  type Stage,
  type SetupResult,
  FlowError,
  submitCredentials,
  submitNewPassword,
  beginTwoFactorSetup,
  confirmTwoFactor,
  verifyTwoFactor,
} from "@/lib/auth-client";

const USER_STORAGE_KEY = "bo_user";
const PREVIEW_CODES = [
  "K7H2M-9QXR4-WP3JD",
  "T8N5B-2VC6F-LMZ9Q",
  "A4D7G-XH1KP-RS8WN",
  "Q2W9E-7TY4U-IO5PA",
  "Z3X6C-V8B2N-MK1JH",
  "L9P4O-3IU7Y-TR6EW",
];

const VALID_STAGES = new Set<Stage>([
  "credentials",
  "change_password",
  "enroll_2fa",
  "verify_2fa",
  "authenticated",
]);

export function LoginFlow() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<SetupResult | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const previewRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // Preview aid (design review only): /login?stage=verify_2fa etc. "recovery"
  // jumps straight to the enrolled recovery-codes view. Never navigates away.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("stage");
    if (!param) return;
    previewRef.current = true;
    if (param === "recovery") {
      setStage("enroll_2fa");
      setSetup({ qrCode: null, otpauthUrl: "", secret: "JBSWY3DPEHPK3PXP" });
      setRecoveryCodes(PREVIEW_CODES);
    } else if (VALID_STAGES.has(param as Stage)) {
      setStage(param as Stage);
    }
  }, []);

  // Fetch the 2FA setup payload when entering enrollment.
  useEffect(() => {
    if (stage !== "enroll_2fa" || setup || recoveryCodes) return;
    let cancelled = false;
    beginTwoFactorSetup(email).then(
      (res) => !cancelled && setSetup(res),
      () => !cancelled && setError("Couldn't start two-factor setup. Try again."),
    );
    return () => {
      cancelled = true;
    };
  }, [stage, setup, recoveryCodes, email]);

  const fail = useCallback((err: unknown) => {
    const message =
      err instanceof FlowError || err instanceof Error
        ? err.message
        : "Something went wrong. Please try again.";
    setError(message);
    setLoading(false);
    setShake(true);
    window.requestAnimationFrame(() => errorRef.current?.focus());
  }, []);

  const advance = useCallback((nextStage: Stage) => {
    setError(null);
    setLoading(false);
    setStage(nextStage);
  }, []);

  const finish = useCallback(() => {
    // MOCK session persistence so the placeholder dashboard renders. Replace
    // with the real { token, user } from the backend on integration.
    storeToken("mock-session-token");
    try {
      window.localStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify({ email: email || "user@sapphirebroking.net", role: "operations" }),
      );
    } catch {
      /* storage unavailable — non-fatal */
    }
    setError(null);
    setStage("authenticated");
    if (!previewRef.current) {
      window.setTimeout(() => router.replace("/dashboard"), 1300);
    }
  }, [email, router]);

  // ── Stage actions ──────────────────────────────────────────────────────────
  const onCredentials = useCallback(
    async (e: string, p: string) => {
      setLoading(true);
      setError(null);
      setEmail(e);
      setPassword(p);
      try {
        const res = await submitCredentials(e, p);
        if (res.stage === "authenticated") finish();
        else advance(res.stage);
      } catch (err) {
        fail(err);
      }
    },
    [advance, finish, fail],
  );

  const onChangePassword = useCallback(
    async (newPassword: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await submitNewPassword(password, newPassword);
        advance(res.stage);
      } catch (err) {
        fail(err);
      }
    },
    [password, advance, fail],
  );

  const onConfirmEnroll = useCallback(
    async (code: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await confirmTwoFactor(code);
        setRecoveryCodes(res.recoveryCodes);
        setLoading(false);
      } catch (err) {
        fail(err);
      }
    },
    [fail],
  );

  const onVerify = useCallback(
    async (code: string) => {
      setLoading(true);
      setError(null);
      try {
        await verifyTwoFactor(code);
        finish();
      } catch (err) {
        fail(err);
      }
    },
    [finish, fail],
  );

  const sealState: "idle" | "press" | "verified" =
    stage === "authenticated" ? "verified" : loading ? "press" : "idle";

  return (
    <div className="w-full max-w-[420px] px-6 py-12 sm:px-10">
      {/* Mobile-only seal above the form. */}
      <div className="mb-8 flex justify-center lg:hidden">
        <Seal size={56} state={sealState} />
      </div>

      <ErrorBanner ref={errorRef} error={error} />

      <div
        key={stage + (recoveryCodes ? "-rc" : "")}
        className={`sb-animate-step ${shake ? "sb-animate-shake" : ""}`}
        onAnimationEnd={() => setShake(false)}
      >
        {stage === "credentials" ? (
          <CredentialsStep loading={loading} initialEmail={email} onSubmit={onCredentials} />
        ) : null}

        {stage === "change_password" ? (
          <ChangePasswordStep loading={loading} onSubmit={onChangePassword} />
        ) : null}

        {stage === "enroll_2fa" ? (
          <EnrollTwoFactorStep
            loading={loading}
            setup={setup}
            recoveryCodes={recoveryCodes}
            onConfirm={onConfirmEnroll}
            onContinue={finish}
          />
        ) : null}

        {stage === "verify_2fa" ? (
          <VerifyTwoFactorStep loading={loading} invalid={Boolean(error)} onSubmit={onVerify} />
        ) : null}

        {stage === "authenticated" ? <AuthenticatedView email={email} /> : null}
      </div>

      {stage !== "authenticated" ? (
        <>
          <div className="mt-8" aria-hidden="true">
            <div className="h-px w-full bg-rule" />
            <div className="h-px w-full shadow-[0_1px_0_rgba(255,255,255,0.7)]" />
          </div>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
            v2026.06 · Sapphire Broking Pvt Ltd · Authorized access only
          </p>
        </>
      ) : null}
    </div>
  );
}

function AuthenticatedView({ email }: { email: string }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <Seal size={72} state="verified" />
      <h1
        className="mt-6 text-[22px] text-ink"
        style={{
          fontFamily: "var(--font-display)",
          fontVariationSettings: "'opsz' 30, 'wght' 520",
        }}
      >
        You&rsquo;re in.
      </h1>
      <p className="mt-1 text-[14px] text-ink-muted">
        {email ? `Signed in as ${email}` : "Signed in."}
      </p>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
        Establishing secure session
        <span className="sb-caret ml-0.5 inline-block">▍</span>
      </p>
      {/* Static no-JS fallback link. */}
      <noscript>
        <a href="/dashboard" className="mt-4 text-[13px] text-oxblood underline">
          Continue
        </a>
      </noscript>
    </div>
  );
}
