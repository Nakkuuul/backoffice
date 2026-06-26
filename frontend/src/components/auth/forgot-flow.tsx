"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Seal } from "./seal";
import { Field } from "./field";
import { SubmitButton } from "./submit-button";
import { StepHeader } from "./step-chrome";

/**
 * "Forgot access" — request a reset via one of the backend's channels. UI ONLY:
 * the submit is not wired to the API yet; it simulates the round-trip and shows
 * the (enumeration-safe) confirmation the backend will return.
 */
const METHODS = [
  { id: "email_link", label: "Email link", hint: "We’ll email you a secure, single-use reset link." },
  { id: "email_otp", label: "Email code", hint: "We’ll email you a 6-digit one-time code." },
  { id: "sms_otp", label: "SMS code", hint: "We’ll text a 6-digit code to your registered phone." },
] as const;
type Method = (typeof METHODS)[number]["id"];

const primaryLink =
  "flex h-12 w-full items-center justify-center rounded-[6px] bg-oxblood text-[15px] font-medium text-on-accent transition-colors hover:bg-oxblood-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised";

export function ForgotFlow({ monogram = "SB" }: { monogram?: string }) {
  const [method, setMethod] = useState<Method>("email_link");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const active = METHODS.find((m) => m.id === method)!;
  const isOtp = method !== "email_link";

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || !email.trim()) return;
    setLoading(true);
    // UI only — not wired to /auth/forgot-password yet. Simulate the request.
    window.setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 800);
  }

  return (
    <div className="w-full max-w-[420px] px-6 py-12 sm:px-10">
      <div className="mb-8 flex justify-center lg:hidden">
        <Seal size={56} monogram={monogram} />
      </div>

      {sent ? (
        <div className="sb-animate-step">
          <StepHeader
            eyebrow="Check your inbox"
            title="Instructions sent"
            subtitle={`If an account matches ${email.trim()}, ${isOtp ? "a reset code" : "a reset link"} is on its way.`}
          />
          <div className="mt-6 rounded-[8px] border border-rule bg-paper px-4 py-3 text-[13.5px] leading-relaxed text-ink-muted">
            {isOtp
              ? "Enter the code we sent, along with a new password, on the next screen. The code expires shortly and can be used once."
              : "Open the link from your email to choose a new password. It expires shortly and can be used once."}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {isOtp ? (
              <Link href="/reset-password" className={primaryLink}>
                Enter your code →
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-[13px] font-medium text-oxblood hover:underline"
            >
              Use a different method
            </button>
          </div>

          <Footer />
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="sb-animate-step">
          <StepHeader
            eyebrow="Account recovery"
            title="Forgot your access?"
            subtitle="Choose how you’d like to reset your password."
          />

          <div className="mt-6 flex flex-col gap-5">
            <div>
              <span className="mb-1.5 block text-[13px] font-medium tracking-[0.01em] text-ink-muted">Reset method</span>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={method === m.id}
                    onClick={() => setMethod(m.id)}
                    className={`rounded-[6px] border px-2 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] transition-colors ${
                      method === m.id
                        ? "border-oxblood bg-oxblood-tint text-oxblood"
                        : "border-field-border bg-field text-ink-muted hover:border-oxblood/50"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{active.hint}</p>
            </div>

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

            <SubmitButton loading={loading} disabled={!email.trim()} label="Send reset instructions" loadingLabel="Sending…" />
          </div>

          <Footer />
        </form>
      )}
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-8">
      <div className="h-px w-full bg-rule" aria-hidden="true" />
      <Link
        href="/login"
        className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.12em] text-oxblood hover:underline"
      >
        ← Back to sign in
      </Link>
    </div>
  );
}
