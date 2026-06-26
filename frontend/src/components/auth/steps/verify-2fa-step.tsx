"use client";

import { useState, type FormEvent } from "react";
import { OtpInput } from "../otp-input";
import { Field } from "../field";
import { SubmitButton } from "../submit-button";
import { StepHeader } from "../step-chrome";

interface VerifyStepProps {
  loading: boolean;
  invalid?: boolean;
  onSubmit: (code: string) => void;
}

export function VerifyTwoFactorStep({ loading, invalid = false, onSubmit }: VerifyStepProps) {
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    const v = mode === "totp" ? code : recovery.trim();
    if (!v) return;
    onSubmit(v);
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <StepHeader
        eyebrow="Two-factor"
        title="Enter your code"
        subtitle={
          mode === "totp"
            ? "Open your authenticator app and enter the current 6-digit code."
            : "Enter one of the recovery codes you saved when enrolling."
        }
      />

      <div className="mt-6 flex flex-col items-center gap-6">
        {mode === "totp" ? (
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(c) => {
              if (!loading) onSubmit(c);
            }}
            disabled={loading}
            invalid={invalid}
            autoFocus
          />
        ) : (
          <div className="w-full">
            <Field
              label="Recovery code"
              name="recovery-code"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXXX-XXXXX-XXXXX"
              mono
              required
              value={recovery}
              disabled={loading}
              error={invalid ? "That code wasn’t accepted." : null}
              onChange={(e) => setRecovery(e.target.value)}
            />
          </div>
        )}

        <div className="w-full">
          <SubmitButton
            loading={loading}
            disabled={mode === "totp" ? !/^\d{6}$/.test(code) : recovery.trim().length < 8}
            label="Verify & sign in"
            loadingLabel="Verifying…"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "totp" ? "recovery" : "totp"));
            setCode("");
            setRecovery("");
          }}
          className="group relative text-[13px] font-medium text-oxblood focus-visible:outline-none"
        >
          {mode === "totp" ? "Use a recovery code instead" : "Use authenticator code instead"}
          <span
            aria-hidden="true"
            className="sb-link-underline absolute inset-x-0 -bottom-0.5 h-px bg-gold"
          />
        </button>
      </div>
    </form>
  );
}
