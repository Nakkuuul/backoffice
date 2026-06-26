"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Seal } from "./seal";
import { ErrorBanner } from "./step-chrome";
import { CredentialsStep } from "./steps/credentials-step";
import { ChangePasswordStep } from "./steps/change-password-step";
import { EnrollTwoFactorStep } from "./steps/enroll-2fa-step";
import { VerifyTwoFactorStep } from "./steps/verify-2fa-step";
import {
  ApiError,
  login as apiLogin,
  changePassword as apiChangePassword,
  setupTwoFactor as apiSetup,
  enableTwoFactor as apiEnable,
  verifyTwoFactor as apiVerify,
  type AuthResponse,
  type SetupResponse,
  type Stage,
} from "@/lib/api";

type UiStage = "credentials" | Stage;

const PREVIEW_CODES = [
  "K7H2M-9QXR4-WP3JD",
  "T8N5B-2VC6F-LMZ9Q",
  "A4D7G-XH1KP-RS8WN",
  "Q2W9E-7TY4U-IO5PA",
  "Z3X6C-V8B2N-MK1JH",
  "L9P4O-3IU7Y-TR6EW",
];

const VALID: UiStage[] = ["credentials", "change_password", "enroll_2fa", "verify_2fa", "authenticated"];

export function LoginFlow({ companyName }: { companyName?: string | null }) {
  const router = useRouter();

  const [stage, setStage] = useState<UiStage>("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const [password, setPassword] = useState(""); // currentPassword for the change-password step
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const previewRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false); // synchronous single-flight guard

  // Design-preview aid (no APIs called): /login?stage=verify_2fa etc.
  useEffect(() => {
    /* One-shot mount seed for design preview only; the query string isn't known
       during SSR so this can't be a lazy initializer without a hydration mismatch. */
    /* eslint-disable react-hooks/set-state-in-effect */
    const param = new URLSearchParams(window.location.search).get("stage");
    if (!param) return;
    previewRef.current = true;
    if (param === "recovery") {
      setStage("enroll_2fa");
      setSetup({ qrCode: null, otpauthUrl: "", secret: "JBSWY3DPEHPK3PXP" });
      setRecoveryCodes(PREVIEW_CODES);
    } else if ((VALID as string[]).includes(param)) {
      setStage(param as UiStage);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Fetch the 2FA setup payload (QR + secret) when entering enrollment.
  useEffect(() => {
    if (stage !== "enroll_2fa" || setup || recoveryCodes || previewRef.current) return;
    let cancelled = false;
    apiSetup().then(
      (res) => !cancelled && setSetup(res),
      (err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 401
            ? "Your sign-in session expired. Please sign in again."
            : err instanceof ApiError
              ? err.message
              : "Couldn't start two-factor setup. Please try again.",
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [stage, setup, recoveryCodes]);

  const fail = useCallback((err: unknown) => {
    const message =
      err instanceof ApiError || err instanceof Error
        ? err.message
        : "Something went wrong. Please try again.";
    setError(message);
    setLoading(false);
    setShake(true);
    window.requestAnimationFrame(() => errorRef.current?.focus());
  }, []);

  const enterAuthenticated = useCallback(() => {
    setError(null);
    setStage("authenticated"); // tokens are already in httpOnly cookies (set by the BFF)
    if (!previewRef.current) window.setTimeout(() => router.replace("/overview"), 1300);
  }, [router]);

  // Apply a backend response: advance to the next challenge, or finish.
  const apply = useCallback(
    (res: AuthResponse) => {
      // The login password is only the change-password step's currentPassword;
      // drop it from memory as soon as we move past that step.
      if (res.stage !== "change_password") setPassword("");
      if (res.stage === "authenticated") {
        enterAuthenticated();
      } else {
        setError(null);
        setLoading(false);
        setStage(res.stage);
      }
    },
    [enterAuthenticated],
  );

  // ── Stage actions (busyRef makes them single-flight) ───────────────────────
  const onCredentials = useCallback(
    async (email: string, p: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setLoading(true);
      setError(null);
      setPassword(p);
      try {
        apply(await apiLogin(email, p));
      } catch (err) {
        fail(err);
      } finally {
        busyRef.current = false;
      }
    },
    [apply, fail],
  );

  const onChangePassword = useCallback(
    async (newPassword: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setLoading(true);
      setError(null);
      try {
        apply(await apiChangePassword(password, newPassword));
      } catch (err) {
        fail(err);
      } finally {
        busyRef.current = false;
      }
    },
    [password, apply, fail],
  );

  const onConfirmEnroll = useCallback(
    async (code: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const res = await apiEnable(code); // authenticated session cookies set by the BFF
        setRecoveryCodes(res.recoveryCodes);
        setLoading(false);
      } catch (err) {
        fail(err);
      } finally {
        busyRef.current = false;
      }
    },
    [fail],
  );

  const onVerify = useCallback(
    async (code: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setLoading(true);
      setError(null);
      try {
        apply(await apiVerify(code));
      } catch (err) {
        fail(err);
      } finally {
        busyRef.current = false;
      }
    },
    [apply, fail],
  );

  const sealState: "idle" | "press" | "verified" =
    stage === "authenticated" ? "verified" : loading ? "press" : "idle";

  return (
    <div className="w-full max-w-[420px] px-6 py-12 sm:px-10">
      <div className="mb-8 flex justify-center lg:hidden">
        <Seal size={56} state={sealState} />
      </div>

      <ErrorBanner ref={errorRef} error={error} />

      <div
        key={stage + (recoveryCodes ? "-rc" : "")}
        className={`sb-animate-step ${shake ? "sb-animate-shake" : ""}`}
        onAnimationEnd={() => setShake(false)}
      >
        {stage === "credentials" ? <CredentialsStep loading={loading} onSubmit={onCredentials} /> : null}

        {stage === "change_password" ? (
          <ChangePasswordStep loading={loading} onSubmit={onChangePassword} />
        ) : null}

        {stage === "enroll_2fa" ? (
          <EnrollTwoFactorStep
            loading={loading}
            setup={setup}
            recoveryCodes={recoveryCodes}
            onConfirm={onConfirmEnroll}
            onContinue={enterAuthenticated}
          />
        ) : null}

        {stage === "verify_2fa" ? (
          <VerifyTwoFactorStep loading={loading} invalid={Boolean(error)} onSubmit={onVerify} />
        ) : null}

        {stage === "authenticated" ? <AuthenticatedView /> : null}
      </div>

      {stage !== "authenticated" ? (
        <>
          <div className="mt-8" aria-hidden="true">
            <div className="h-px w-full bg-rule" />
            <div className="h-px w-full shadow-[0_1px_0_rgba(255,255,255,0.7)]" />
          </div>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
            v2026.06{companyName ? ` · ${companyName}` : ""} · Authorized access only
          </p>
        </>
      ) : null}
    </div>
  );
}

function AuthenticatedView() {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <Seal size={72} state="verified" />
      <h1
        className="mt-6 text-[22px] text-ink"
        style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'opsz' 30, 'wght' 520" }}
      >
        You&rsquo;re in.
      </h1>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
        Establishing secure session
        <span className="sb-caret ml-0.5 inline-block">▍</span>
      </p>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/overview" className="mt-4 text-[13px] text-oxblood underline">
          Continue
        </a>
      </noscript>
    </div>
  );
}
