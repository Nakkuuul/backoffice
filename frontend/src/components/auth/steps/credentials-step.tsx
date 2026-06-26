"use client";

import { useState, type FormEvent } from "react";
import { Field, PasswordField } from "../field";
import { SubmitButton } from "../submit-button";
import { StepHeader } from "../step-chrome";

interface CredentialsStepProps {
  loading: boolean;
  initialEmail?: string;
  onSubmit: (email: string, password: string) => void;
}

export function CredentialsStep({ loading, initialEmail = "", onSubmit }: CredentialsStepProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    onSubmit(email.trim(), password);
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <StepHeader eyebrow="Secure Access" title="Sign in to your account" subtitle="Staff & client access." />

      <div className="mt-6 flex flex-col gap-5">
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

        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={256}
          value={password}
          disabled={loading}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex items-center justify-between gap-3">
          <label className="flex select-none items-center gap-2 text-[13px] text-ink-muted">
            <input
              type="checkbox"
              name="remember"
              className="h-4 w-4 rounded-[3px] border-field-border accent-oxblood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised"
            />
            Keep me signed in
          </label>
          <a
            href="#"
            className="group relative text-[13px] font-medium text-oxblood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised"
          >
            Forgot access?
            <span
              aria-hidden="true"
              className="sb-link-underline absolute inset-x-0 -bottom-0.5 h-px bg-gold"
            />
          </a>
        </div>

        <SubmitButton loading={loading} label="Sign in" loadingLabel="Authorising…" />
      </div>
    </form>
  );
}
