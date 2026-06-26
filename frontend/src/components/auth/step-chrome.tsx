"use client";

import { forwardRef } from "react";

/** Per-step header: mono oxblood eyebrow, serif title, muted subtitle. */
export function StepHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-oxblood">
        {eyebrow}
      </p>
      <h1
        className="mt-2 text-[22px] leading-tight text-ink"
        style={{
          fontFamily: "var(--font-display)",
          fontVariationSettings: "'opsz' 30, 'wght' 520",
        }}
      >
        {title}
      </h1>
      {subtitle ? <p className="mt-1 text-[14px] text-ink-muted">{subtitle}</p> : null}
    </div>
  );
}

/** Animated, focusable error banner (assertive live region). */
export const ErrorBanner = forwardRef<HTMLDivElement, { error: string | null }>(
  function ErrorBanner({ error }, ref) {
    return (
      <div
        ref={ref}
        role="alert"
        aria-live="assertive"
        tabIndex={-1}
        className={`overflow-hidden transition-[max-height,opacity] duration-200 focus:outline-none ${
          error ? "mt-5 max-h-24 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {error ? (
          <div className="rounded-[6px] border border-danger/30 bg-oxblood-tint px-3.5 py-2.5 text-[13px] text-danger">
            {error}
          </div>
        ) : null}
      </div>
    );
  },
);
