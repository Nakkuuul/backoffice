"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
}

/**
 * Segmented one-time-code input. Auto-advances on type, backspaces to the
 * previous box, supports paste-to-fill and arrow navigation. Each filled cell
 * "pops" in; the active cell shows the gold focus underline. The parent can
 * reset by passing value="".
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = false,
  invalid = false,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [cells, setCells] = useState<string[]>(() => Array(length).fill(""));

  // External reset (e.g. parent clears the code after an error).
  useEffect(() => {
    if (value === "") setCells(Array(length).fill(""));
  }, [value, length]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function emit(next: string[]) {
    setCells(next);
    const joined = next.join("");
    onChange(joined);
    if (next.every((c) => c !== "")) onComplete?.(joined);
  }

  function handleChange(i: number, raw: string) {
    const ch = raw.replace(/\D/g, "").slice(-1);
    const next = [...cells];
    next[i] = ch;
    emit(next);
    if (ch && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (cells[i]) {
        const next = [...cells];
        next[i] = "";
        emit(next);
      } else if (i > 0) {
        const next = [...cells];
        next[i - 1] = "";
        emit(next);
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      refs.current[i + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const digits = (e.clipboardData.getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, length)
      .split("");
    if (digits.length === 0) return;
    const next = Array(length).fill("");
    digits.forEach((d, idx) => (next[idx] = d));
    emit(next);
    refs.current[Math.min(digits.length, length - 1)]?.focus();
  }

  return (
    <div className="flex items-center gap-2.5" role="group" aria-label="One-time code">
      {Array.from({ length }).map((_, i) => (
        <label key={i} className="group relative block">
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            disabled={disabled}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={invalid || undefined}
            value={cells[i] ?? ""}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={`peer h-14 w-11 rounded-[7px] border bg-field text-center font-mono text-[20px] text-transparent shadow-[inset_0_1px_2px_rgba(28,26,23,0.06)] caret-oxblood outline-none transition-[border-color,box-shadow] duration-150 focus:border-oxblood focus-visible:shadow-[0_0_0_2px_var(--color-paper-raised),0_0_0_4px_var(--color-oxblood)] disabled:opacity-60 sm:w-12 ${
              invalid ? "border-danger" : "border-field-border"
            }`}
          />
          {/* Active-cell gold underline. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-1 -bottom-px h-px origin-left scale-x-0 bg-gold transition-transform duration-200 peer-focus:scale-x-100 motion-reduce:transition-none"
          />
          {/* Pop the glyph when the cell fills (remounts via key). */}
          {cells[i] ? (
            <span
              key={cells[i]}
              aria-hidden="true"
              className="sb-pop pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[20px] text-ink"
            >
              {cells[i]}
            </span>
          ) : null}
        </label>
      ))}
    </div>
  );
}
