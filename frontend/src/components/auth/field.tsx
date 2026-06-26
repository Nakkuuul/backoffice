"use client";

import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";

type BaseFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  /** Render the typed value in machine (mono) type once non-empty. */
  mono?: boolean;
  /** Linked error text; sets aria-invalid + aria-describedby when present. */
  error?: string | null;
};

const baseInputClasses =
  "h-12 w-full rounded-[6px] border border-field-border bg-field px-3.5 text-[15px] text-ink " +
  "shadow-[inset_0_1px_2px_rgba(28,26,23,0.06)] outline-none transition-colors duration-200 " +
  "placeholder:text-ink-muted/60 focus:border-oxblood " +
  "focus-visible:shadow-[0_0_0_2px_var(--color-paper-raised),0_0_0_4px_var(--color-oxblood)]";

const labelClasses =
  "mb-1.5 block text-[13px] font-medium tracking-[0.01em] text-ink-muted";

/** Label-on-top text input with the shared focus ring + gold underline primitive. */
export const Field = forwardRef<HTMLInputElement, BaseFieldProps>(
  function Field(
    { label, mono = false, error, className = "", value, ...rest },
    ref,
  ) {
    const autoId = useId();
    const id = rest.name ? `field-${rest.name}` : autoId;
    const errorId = `${id}-error`;
    const [focused, setFocused] = useState(false);
    const hasValue = typeof value === "string" ? value.length > 0 : false;

    return (
      <div>
        <label htmlFor={id} className={labelClasses}>
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onFocus={(e) => {
              setFocused(true);
              rest.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              rest.onBlur?.(e);
            }}
            className={[
              baseInputClasses,
              mono && hasValue ? "font-mono tracking-[0.02em]" : "font-sans",
              error ? "border-danger focus:border-danger" : "",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...rest}
          />
          {/* Shared left→right gold underline focus primitive. */}
          <span
            aria-hidden="true"
            className={`sb-underline pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gold ${
              focused ? "sb-underline-active" : ""
            }`}
          />
        </div>
        {error ? (
          <p id={errorId} className="mt-1.5 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

type PasswordFieldProps = BaseFieldProps;

/** Password input with a real SHOW/HIDE word toggle and a Caps-Lock chip. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ label, error, value, className = "", ...rest }, ref) {
    const autoId = useId();
    const id = rest.name ? `field-${rest.name}` : autoId;
    const errorId = `${id}-error`;
    const [visible, setVisible] = useState(false);
    const [focused, setFocused] = useState(false);
    const [capsOn, setCapsOn] = useState(false);

    function trackCaps(e: KeyboardEvent<HTMLInputElement>) {
      // getModifierState reflects the *current* Caps Lock state.
      setCapsOn(e.getModifierState("CapsLock"));
    }

    return (
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor={id} className={labelClasses + " mb-0"}>
            {label}
          </label>
          {capsOn ? (
            <span
              role="status"
              className="rounded-[3px] border border-gold/50 bg-paper px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted"
            >
              Caps
            </span>
          ) : null}
        </div>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onFocus={(e) => {
              setFocused(true);
              rest.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              setCapsOn(false);
              rest.onBlur?.(e);
            }}
            onKeyUp={(e) => {
              trackCaps(e);
              rest.onKeyUp?.(e);
            }}
            onKeyDown={(e) => {
              trackCaps(e);
              rest.onKeyDown?.(e);
            }}
            className={[
              baseInputClasses,
              "pr-16 font-sans",
              error ? "border-danger focus:border-danger" : "",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...rest}
          />
          <button
            type="button"
            aria-pressed={visible}
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center rounded-r-[6px] px-3.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted transition-colors hover:text-oxblood focus-visible:text-oxblood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised"
          >
            {visible ? "Hide" : "Show"}
          </button>
          <span
            aria-hidden="true"
            className={`sb-underline pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gold ${
              focused ? "sb-underline-active" : ""
            }`}
          />
        </div>
        {error ? (
          <p id={errorId} className="mt-1.5 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
