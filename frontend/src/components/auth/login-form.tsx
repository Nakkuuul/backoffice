"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ApiError, login, storeToken } from "@/lib/api";
import { Field, PasswordField } from "./field";
import { SubmitButton } from "./submit-button";
import { Seal } from "./seal";

const USER_STORAGE_KEY = "bo_user";

export function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sealState, setSealState] = useState<"idle" | "press" | "verified">(
    "idle",
  );
  const [shake, setShake] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // ESC clears the error banner.
  useEffect(() => {
    if (!error) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setError(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [error]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (loading) return;

      setError(null);
      setLoading(true);
      setSealState("press");

      try {
        const res = await login({ email, password });

        storeToken(res.token);
        try {
          window.localStorage.setItem(
            USER_STORAGE_KEY,
            JSON.stringify(res.user),
          );
        } catch {
          // Non-fatal: the dashboard falls back to a stub if user is absent.
        }

        setSealState("verified");
        // Route to the backoffice. (userType from res.user is available here
        // for finer routing once /portal and role-specific areas exist.)
        router.replace("/dashboard");
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Something went wrong. Please try again.";
        setError(message);
        setSealState("idle");
        setLoading(false);
        setShake(true);
        // Move focus to the error so screen readers + sighted users see it.
        window.requestAnimationFrame(() => {
          errorRef.current?.focus();
          passwordRef.current?.focus();
        });
      }
    },
    [email, password, loading, router],
  );

  return (
    <div className="w-full max-w-[400px] px-6 py-12 sm:px-10">
      {/* Mobile-only seal above the form. */}
      <div className="mb-8 flex justify-center lg:hidden">
        <Seal size={56} state={sealState} />
      </div>

      <form
        noValidate
        onSubmit={handleSubmit}
        onAnimationEnd={() => setShake(false)}
        className={shake ? "sb-animate-shake" : undefined}
      >
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-oxblood">
          Secure Access
        </p>
        <h1
          className="mt-2 text-[22px] text-ink"
          style={{
            fontFamily: "var(--font-display)",
            fontVariationSettings: "'opsz' 30, 'wght' 520",
          }}
        >
          Sign in to your account
        </h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          Staff &amp; client access.
        </p>

        {/* Error banner. */}
        <div
          ref={errorRef}
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
            ref={passwordRef}
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
                className="h-4 w-4 rounded-[3px] border-field-border text-oxblood accent-oxblood focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised"
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

          <SubmitButton loading={loading} />
        </div>

        {/* Incised 2px rule: 1px ink line + 1px light highlight beneath. */}
        <div className="mt-8" aria-hidden="true">
          <div className="h-px w-full bg-rule" />
          <div className="h-px w-full bg-paper-raised/0 shadow-[0_1px_0_rgba(255,255,255,0.7)]" />
        </div>

        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
          v2026.06 · Sapphire Broking Pvt Ltd · Authorized access only
        </p>
      </form>
    </div>
  );
}
