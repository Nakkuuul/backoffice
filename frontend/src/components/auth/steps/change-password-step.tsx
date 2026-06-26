"use client";

import { useMemo, useState, type FormEvent } from "react";
import { PasswordField } from "../field";
import { SubmitButton } from "../submit-button";
import { StepHeader } from "../step-chrome";

interface ChangePasswordStepProps {
  loading: boolean;
  onSubmit: (newPassword: string) => void;
}

function Criterion({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-[12.5px] text-ink-muted">
      <span
        className={`relative grid h-4 w-4 place-items-center rounded-full border transition-colors duration-200 ${
          met ? "border-forest bg-forest-tint" : "border-field-border"
        }`}
      >
        {met ? (
          <svg key="met" viewBox="0 0 12 12" className="sb-pop h-2.5 w-2.5" aria-hidden="true">
            <path
              d="M2.5 6.2l2.2 2.2 4.6-4.8"
              fill="none"
              stroke="#1f4d3a"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span className={met ? "text-ink" : undefined}>{label}</span>
    </li>
  );
}

export function ChangePasswordStep({ loading, onSubmit }: ChangePasswordStepProps) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const checks = useMemo(
    () => ({
      length: next.length >= 8,
      letter: /[A-Za-z]/.test(next),
      number: /[0-9]/.test(next),
      match: next.length > 0 && next === confirm,
    }),
    [next, confirm],
  );
  const valid = checks.length && checks.letter && checks.number && checks.match;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || !valid) return;
    onSubmit(next);
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <StepHeader
        eyebrow="First sign-in"
        title="Set a new password"
        subtitle="Your account was issued a temporary password. Choose a new one to continue."
      />

      <div className="mt-6 flex flex-col gap-5">
        <PasswordField
          label="New password"
          name="new-password"
          autoComplete="new-password"
          required
          maxLength={256}
          value={next}
          disabled={loading}
          onChange={(e) => setNext(e.target.value)}
        />
        <PasswordField
          label="Confirm new password"
          name="confirm-password"
          autoComplete="new-password"
          required
          maxLength={256}
          value={confirm}
          disabled={loading}
          error={confirm.length > 0 && !checks.match ? "Passwords do not match" : null}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Criterion met={checks.length} label="At least 8 characters" />
          <Criterion met={checks.letter} label="Contains a letter" />
          <Criterion met={checks.number} label="Contains a number" />
          <Criterion met={checks.match} label="Passwords match" />
        </ul>

        <SubmitButton
          loading={loading}
          disabled={!valid}
          label="Set password & continue"
          loadingLabel="Saving…"
        />
      </div>
    </form>
  );
}
