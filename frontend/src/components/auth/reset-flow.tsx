"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Seal } from "./seal";
import { Field, PasswordField } from "./field";
import { OtpInput } from "./otp-input";
import { SubmitButton } from "./submit-button";
import { StepHeader, ErrorBanner } from "./step-chrome";

/**
 * Complete a password reset. With a `token` (from the email link) → just choose a
 * new password; without one → enter the email + 6-digit code, then a new password.
 * UI ONLY: not wired to /auth/reset-password yet — submit validates locally and
 * shows the success state.
 */
const primaryLink =
  "flex h-12 w-full items-center justify-center rounded-[6px] bg-oxblood text-[15px] font-medium text-on-accent transition-colors hover:bg-oxblood-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised";

export function ResetFlow({ token, monogram = "SB" }: { token?: string; monogram?: string }) {
  const mode = token ? "link" : "otp";
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    if (mode === "otp" && !email.trim()) return setError("Enter your email.");
    if (mode === "otp" && !/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code we sent.");
    if (pw.length < 8) return setError("Your new password must be at least 8 characters.");
    if (pw !== confirm) return setError("The two passwords don’t match.");
    setError(null);
    setLoading(true);
    // UI only — not wired to the API yet. Simulate the reset round-trip.
    window.setTimeout(() => {
      setLoading(false);
      setDone(true);
    }, 800);
  }

  if (done) {
    return (
      <div className="w-full max-w-[420px] px-6 py-12 sm:px-10">
        <div className="flex flex-col items-center py-6 text-center">
          <Seal size={72} state="verified" monogram={monogram} />
          <h1
            className="mt-6 text-[22px] text-ink"
            style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'opsz' 30, 'wght' 520" }}
          >
            Password reset.
          </h1>
          <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-ink-muted">
            Your password has been updated. Sign in with your new credentials — two-factor still applies.
          </p>
          <Link href="/login" className={`${primaryLink} mt-7`}>
            Back to sign in →
          </Link>
        </div>
      </div>
    );
  }

  const incomplete = pw.length < 8 || (mode === "otp" && (!email.trim() || !/^\d{6}$/.test(otp)));

  return (
    <div className="w-full max-w-[420px] px-6 py-12 sm:px-10">
      <div className="mb-8 flex justify-center lg:hidden">
        <Seal size={56} monogram={monogram} />
      </div>

      <ErrorBanner error={error} />

      <form noValidate onSubmit={handleSubmit} className="sb-animate-step">
        <StepHeader
          eyebrow="Account recovery"
          title="Set a new password"
          subtitle={
            mode === "link"
              ? "Choose a new password for your account."
              : "Enter the code we sent, then choose a new password."
          }
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
                <OtpInput value={otp} onChange={setOtp} disabled={loading} invalid={Boolean(error) && !/^\d{6}$/.test(otp)} />
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
    </div>
  );
}
