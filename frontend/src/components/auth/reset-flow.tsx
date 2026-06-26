"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Seal } from "./seal";
import { Field, PasswordField } from "./field";
import { OtpInput } from "./otp-input";
import { SubmitButton } from "./submit-button";
import { StepHeader, ErrorBanner } from "./step-chrome";
import { ApiError, resetPassword, verifyResetToken } from "@/lib/api";

/**
 * Complete a password reset (POST /auth/reset-password). With a `token` (from the
 * email link) → choose a new password; the token is pre-checked on mount via
 * /auth/reset-password/verify. Without a token → enter email + 6-digit code, then
 * a new password.
 */
const primaryLink =
  "flex h-12 w-full items-center justify-center rounded-[6px] bg-oxblood text-[15px] font-medium text-on-accent transition-colors hover:bg-oxblood-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised";

export function ResetFlow({ token, monogram = "SB" }: { token?: string; monogram?: string }) {
  const mode = token ? "link" : "otp";
  const [linkValid, setLinkValid] = useState<boolean | null>(mode === "link" ? null : true);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Pre-check the link token so we can show an "expired" state before the form.
  useEffect(() => {
    if (mode !== "link" || !token) return;
    let cancelled = false;
    verifyResetToken(token).then(
      (r) => !cancelled && setLinkValid(r.valid),
      () => !cancelled && setLinkValid(false),
    );
    return () => {
      cancelled = true;
    };
  }, [mode, token]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    if (mode === "otp" && !email.trim()) return setError("Enter your email.");
    if (mode === "otp" && !/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code we sent.");
    if (pw.length < 8) return setError("Your new password must be at least 8 characters.");
    if (pw !== confirm) return setError("The two passwords don’t match.");
    setError(null);
    setLoading(true);
    try {
      await resetPassword(mode === "link" ? { token, newPassword: pw } : { email: email.trim(), otp, newPassword: pw });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t reset your password. Please try again.");
      if (mode === "link" && err instanceof ApiError && err.code === "RESET_INVALID") setLinkValid(false);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Shell>
        <div className="flex flex-col items-center py-6 text-center">
          <Seal size={72} state="verified" monogram={monogram} />
          <h1 className="mt-6 text-[22px] text-ink" style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'opsz' 30, 'wght' 520" }}>
            Password reset.
          </h1>
          <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-ink-muted">
            Your password has been updated. Sign in with your new credentials — two-factor still applies.
          </p>
          <Link href="/login" className={`${primaryLink} mt-7`}>
            Back to sign in →
          </Link>
        </div>
      </Shell>
    );
  }

  if (mode === "link" && linkValid === null) {
    return (
      <Shell>
        <p className="py-10 text-center font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted">
          Verifying your reset link<span className="sb-caret ml-0.5 inline-block">▍</span>
        </p>
      </Shell>
    );
  }

  if (mode === "link" && linkValid === false) {
    return (
      <Shell>
        <div className="mb-8 flex justify-center lg:hidden">
          <Seal size={56} monogram={monogram} />
        </div>
        <StepHeader
          eyebrow="Account recovery"
          title="This link has expired"
          subtitle="Reset links are single-use and time-limited. Request a fresh one to continue."
        />
        <div className="mt-7 flex flex-col gap-3">
          <Link href="/forgot-password" className={primaryLink}>
            Request a new link →
          </Link>
          <Link href="/login" className="text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted hover:text-oxblood">
            ← Back to sign in
          </Link>
        </div>
      </Shell>
    );
  }

  const incomplete = pw.length < 8 || (mode === "otp" && (!email.trim() || !/^\d{6}$/.test(otp)));

  return (
    <Shell>
      <div className="mb-8 flex justify-center lg:hidden">
        <Seal size={56} monogram={monogram} />
      </div>

      <ErrorBanner error={error} />

      <form noValidate onSubmit={handleSubmit} className="sb-animate-step">
        <StepHeader
          eyebrow="Account recovery"
          title="Set a new password"
          subtitle={mode === "link" ? "Choose a new password for your account." : "Enter the code we sent, then choose a new password."}
        />

        <div className="mt-6 flex flex-col gap-5">
          {mode === "otp" ? (
            <>
              <Field
                label="Email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                required
                mono
                value={email}
                disabled={loading}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div>
                <span className="mb-2 block text-[13px] font-medium tracking-[0.01em] text-ink-muted">Reset code</span>
                <OtpInput value={otp} onChange={setOtp} disabled={loading} invalid={Boolean(error)} />
              </div>
            </>
          ) : null}

          <PasswordField
            label="New password"
            name="new-password"
            autoComplete="new-password"
            required
            maxLength={256}
            value={pw}
            disabled={loading}
            onChange={(e) => setPw(e.target.value)}
          />
          <PasswordField
            label="Confirm new password"
            name="confirm-password"
            autoComplete="new-password"
            required
            maxLength={256}
            value={confirm}
            disabled={loading}
            error={confirm.length > 0 && confirm !== pw ? "Doesn’t match." : null}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <p className="-mt-1 text-[12.5px] text-ink-muted">Use at least 8 characters.</p>

          <SubmitButton loading={loading} disabled={incomplete} label="Reset password" loadingLabel="Resetting…" />
        </div>

        <div className="mt-8">
          <div className="h-px w-full bg-rule" aria-hidden="true" />
          <div className="mt-4 flex items-center justify-between gap-3">
            <Link href="/login" className="font-mono text-[11px] uppercase tracking-[0.12em] text-oxblood hover:underline">
              ← Back to sign in
            </Link>
            {mode === "otp" ? (
              <Link href="/forgot-password" className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted hover:text-oxblood">
                Request a new code
              </Link>
            ) : null}
          </div>
        </div>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-[420px] px-6 py-12 sm:px-10">{children}</div>;
}
