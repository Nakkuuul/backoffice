import { Seal } from "@/components/auth/seal";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-paper text-ink font-sans lg:grid lg:grid-cols-[1.4fr_1fr]">
      {/* LEFT — the "ledger" panel. Paper-on-paper, hairline seam, faint grain. */}
      <section className="relative hidden flex-col justify-between border-r border-rule-strong px-12 py-12 lg:flex">
        {/* Near-invisible printed grain. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(28,26,23,0.02)_1px,transparent_1px)] [background-size:4px_4px]"
        />

        {/* Masthead cluster. */}
        <div className="relative flex items-center gap-4">
          <Seal size={96} />
          <span
            className="text-[26px] text-ink"
            style={{
              fontFamily: "var(--font-display)",
              fontVariationSettings: "'opsz' 60, 'wght' 480",
              textShadow:
                "0 1px 0 rgba(255,255,255,0.6), 0 -1px 0 rgba(28,26,23,0.12)",
            }}
          >
            Sapphire Broking
          </span>
        </div>

        {/* Centered editorial block. */}
        <div className="relative sb-animate-rise max-w-md">
          <span
            aria-hidden="true"
            className="mb-6 block h-px w-14 bg-oxblood"
          />
          <h2
            className="text-ink"
            style={{
              fontFamily: "var(--font-display)",
              fontVariationSettings: "'opsz' 120, 'wght' 460",
              fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
            }}
          >
            The Backoffice.
          </h2>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-ink-muted">
            One ledger for accounts, compliance, and operations — kept exact,
            kept private.
          </p>
        </div>

        {/* Bottom machine standing line. */}
        <div
          aria-hidden="true"
          className="relative space-y-1 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-muted"
        >
          <p>SEBI REG · INZ000XXXXXX · MEMBER NSE / BSE · EST. 2019</p>
          <p className="text-ink-muted/70">
            SVR — IST · BUILD 2026.06
          </p>
        </div>
      </section>

      {/* RIGHT — the "door" panel. Half-shade raised so the form lifts. */}
      <section className="flex flex-1 items-center justify-center bg-paper-raised">
        <LoginForm />
      </section>
    </main>
  );
}
