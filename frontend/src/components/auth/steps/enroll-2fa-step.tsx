"use client";

import { useState } from "react";
/* eslint-disable @next/next/no-img-element */
import { OtpInput } from "../otp-input";
import { QrPlaceholder } from "../qr-placeholder";
import { SubmitButton } from "../submit-button";
import { StepHeader } from "../step-chrome";
import type { SetupResponse } from "@/lib/api";

interface EnrollStepProps {
  loading: boolean;
  setup: SetupResponse | null;
  recoveryCodes: string[] | null;
  onConfirm: (code: string) => void;
  onContinue: () => void;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          },
          () => {},
        );
      }}
      className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted transition-colors hover:text-oxblood focus-visible:text-oxblood focus-visible:outline-none"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

export function EnrollTwoFactorStep({
  loading,
  setup,
  recoveryCodes,
  onConfirm,
  onContinue,
}: EnrollStepProps) {
  const [code, setCode] = useState("");

  // ── Recovery-codes view (after a successful confirm) ──────────────────────
  if (recoveryCodes) {
    return (
      <div>
        <StepHeader
          eyebrow="Two-factor · Enabled"
          title="Save your recovery codes"
          subtitle="Each code works once if you lose your authenticator. Store them somewhere safe — they won't be shown again."
        />

        <div className="mt-6 rounded-[8px] border border-rule-strong bg-paper p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {recoveryCodes.map((rc, i) => (
              <span
                key={rc}
                className="sb-reveal font-mono text-[13px] tracking-[0.06em] text-ink"
                style={{ ["--sb-delay" as string]: `${i * 45}ms` }}
              >
                {rc}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <CopyButton text={recoveryCodes.join("\n")} label="Copy all" />
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="relative mt-6 h-12 w-full overflow-hidden rounded-[6px] bg-oxblood text-[15px] font-medium text-on-accent transition-[background-color,transform] duration-150 ease-out hover:bg-oxblood-hover hover:[transform:translateY(-1px)] active:[transform:translateY(0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised motion-reduce:transition-none motion-reduce:hover:[transform:none]"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "rgba(201,168,106,0.55)" }}
          />
          I&rsquo;ve saved them — enter the backoffice
        </button>
      </div>
    );
  }

  // ── Scan + confirm view ───────────────────────────────────────────────────
  const secretGroups = setup ? (setup.secret.match(/.{1,4}/g) ?? []).join(" ") : "";

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!loading && /^\d{6}$/.test(code)) onConfirm(code);
      }}
    >
      <StepHeader
        eyebrow="Two-factor · Set up"
        title="Scan to enrol"
        subtitle="Scan the code with Google Authenticator, Authy, or 1Password, then enter the 6-digit code it shows."
      />

      <div className="mt-6 flex flex-col items-center gap-5">
        {setup?.qrCode ? (
          <img
            src={setup.qrCode}
            alt="Two-factor QR code"
            width={188}
            height={188}
            className="rounded-[10px] border border-rule-strong bg-white p-3"
          />
        ) : (
          <QrPlaceholder size={188} />
        )}

        <div className="w-full rounded-[8px] border border-rule bg-paper px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              Can&rsquo;t scan? Enter key
            </span>
            {setup ? <CopyButton text={setup.secret} /> : null}
          </div>
          <p className="mt-1 break-all font-mono text-[13px] tracking-[0.08em] text-ink">
            {secretGroups || "····"}
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-3">
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(c) => {
              if (!loading) onConfirm(c);
            }}
            disabled={loading || !setup}
            autoFocus
          />
        </div>

        <SubmitButton
          loading={loading}
          disabled={!/^\d{6}$/.test(code) || !setup}
          label="Verify & enable"
          loadingLabel="Verifying…"
        />
      </div>
    </form>
  );
}
