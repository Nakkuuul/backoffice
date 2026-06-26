import { Seal } from "@/components/auth/seal";
import { LoginFlow } from "@/components/auth/login-flow";
import { Guilloche } from "@/components/auth/guilloche";
import { MathLayer } from "@/components/auth/math-layer";
import { LedgerBackdrop } from "@/components/auth/ledger-backdrop";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-paper text-ink font-sans lg:grid lg:grid-cols-[1.4fr_1fr]">
      {/* LEFT — the "ledger" panel. Paper-on-paper, hairline seam, living grain. */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-rule-strong px-12 py-12 lg:flex">
        {/* Slow drifting aurora — a faint living tint over the parchment. */}
        <div
          aria-hidden="true"
          className="sb-aurora pointer-events-none absolute -inset-[25%] opacity-70"
          style={{
            background:
              "radial-gradient(40% 38% at 28% 30%, rgba(110,31,42,0.10), transparent 70%), radial-gradient(36% 34% at 76% 24%, rgba(154,123,51,0.12), transparent 70%), radial-gradient(44% 40% at 62% 82%, rgba(31,77,58,0.10), transparent 72%)",
            filter: "blur(56px)",
          }}
        />
        {/* Faint ledger / graph-paper grid (both axes). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:repeating-linear-gradient(90deg,transparent,transparent_47px,rgba(28,26,23,0.025)_47px,rgba(28,26,23,0.025)_48px),repeating-linear-gradient(0deg,transparent,transparent_31px,rgba(28,26,23,0.02)_31px,rgba(28,26,23,0.02)_32px)]"
        />
        {/* Living printed grain. */}
        <div
          aria-hidden="true"
          className="sb-grain-anim pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(28,26,23,0.025)_1px,transparent_1px)] [background-size:4px_4px]"
        />
        {/* Slow scanning pass. */}
        <div
          aria-hidden="true"
          className="sb-scanline pointer-events-none absolute inset-x-0 h-24"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(201,168,106,0.07) 45%, rgba(201,168,106,0.10) 50%, transparent)",
          }}
        />
        {/* Centerpiece guilloché engraving — the hero illustration. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2"
        >
          <Guilloche className="h-full w-full" />
        </div>
        {/* Mathematics illustrations: Fibonacci spiral, waves, formulas. */}
        <MathLayer />
        {/* Reports & calculations: ledger tables, charts, ticker, formulas. */}
        <LedgerBackdrop />

        {/* Readability scrim: the backdrop recedes behind the (left-aligned) text
            so the headline + copy stay crisp while the engraving stays vivid right. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, var(--color-paper) 0%, rgba(244,241,234,0.92) 15%, rgba(244,241,234,0.5) 36%, rgba(244,241,234,0) 58%)",
          }}
        />

        {/* Masthead cluster. */}
        <div
          className="sb-reveal relative flex items-center gap-4"
          style={{ ["--sb-delay" as string]: "60ms" }}
        >
          <Seal size={96} aura />
          <span
            className="text-[26px] text-ink"
            style={{
              fontFamily: "var(--font-display)",
              fontVariationSettings: "'opsz' 60, 'wght' 480",
              textShadow:
                "0 0 16px var(--color-paper), 0 0 16px var(--color-paper), 0 1px 0 rgba(255,255,255,0.6)",
            }}
          >
            Sapphire Broking
          </span>
        </div>

        {/* Centered editorial block. */}
        <div className="relative max-w-md">
          <span aria-hidden="true" className="sb-draw mb-6 block h-px w-14 origin-left bg-oxblood" />
          <h2
            className="sb-reveal text-ink"
            style={{
              ["--sb-delay" as string]: "200ms",
              fontFamily: "var(--font-display)",
              fontVariationSettings: "'opsz' 120, 'wght' 460",
              fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              textShadow: "0 0 22px var(--color-paper), 0 0 22px var(--color-paper)",
            }}
          >
            The Backoffice.
          </h2>
          <p
            className="sb-reveal mt-5 max-w-sm text-[15px] leading-relaxed text-ink/75"
            style={{
              ["--sb-delay" as string]: "320ms",
              textShadow: "0 0 14px var(--color-paper), 0 0 10px var(--color-paper)",
            }}
          >
            One ledger for accounts, compliance, and operations — kept exact, kept private.
          </p>
        </div>

        {/* Bottom machine standing line. */}
        <div
          aria-hidden="true"
          className="sb-reveal relative space-y-1 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-muted"
          style={{ ["--sb-delay" as string]: "440ms" }}
        >
          <p>SEBI REG · INZ000XXXXXX · MEMBER NSE / BSE · EST. 2019</p>
          <p className="text-ink-muted/70">
            SVR — IST · BUILD 2026.06
            <span className="sb-caret ml-1 inline-block text-oxblood">▍</span>
          </p>
        </div>
      </section>

      {/* RIGHT — the "door" panel. Half-shade raised so the form lifts. */}
      <section className="flex flex-1 items-center justify-center bg-paper-raised">
        <LoginFlow />
      </section>
    </main>
  );
}
