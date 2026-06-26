"use client";

interface SubmitButtonProps {
  loading: boolean;
  /** Idle label. */
  label?: string;
  /** Label shown while loading (rendered in mono caps). */
  loadingLabel?: string;
  /** Disable independently of loading (e.g. incomplete OTP). */
  disabled?: boolean;
}

/**
 * Primary CTA: oxblood fill, a 1px antique-brass top hairline, a tactile
 * "stamp" press, and a loading state that crossfades the label to a real
 * mono caps string with a sweeping gold progress underline.
 */
export function SubmitButton({
  loading,
  label = "Sign in",
  loadingLabel = "Authorising…",
  disabled = false,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      aria-busy={loading}
      disabled={loading || disabled}
      className="relative h-12 w-full overflow-hidden rounded-[6px] bg-oxblood text-[15px] font-medium text-on-accent transition-[background-color,transform] duration-150 ease-out hover:bg-oxblood-hover hover:[transform:translateY(-1px)] active:[transform:translateY(0)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:[transform:none]"
    >
      {/* Gold top hairline. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "rgba(201,168,106,0.55)" }}
      />
      {loading ? (
        <span className="inline-flex items-center justify-center font-mono text-[12px] uppercase tracking-[0.18em]">
          {loadingLabel}
        </span>
      ) : (
        label
      )}
      {/* Sweeping gold progress underline while loading. */}
      {loading ? (
        <span
          aria-hidden="true"
          className="sb-sweep pointer-events-none absolute inset-x-0 bottom-0 h-[2px] w-1/3"
          style={{ background: "rgba(201,168,106,0.7)" }}
        />
      ) : null}
    </button>
  );
}
