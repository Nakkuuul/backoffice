import { Seal, companyMonogram } from "./seal";
import { Guilloche } from "./guilloche";
import { MathLayer } from "./math-layer";
import { LedgerBackdrop } from "./ledger-backdrop";

/**
 * The left "ledger" hero panel shared across the auth pages (login / forgot /
 * reset). Brand name + standing line come from the backend (passed in by the
 * page's server-side branding fetch). Decorative only — no interactivity.
 */
export function LedgerPanel({ name, standing = [] }: { name: string; standing?: string[] }) {
  return (
    <section className="relative hidden flex-col justify-between overflow-hidden border-r border-rule-strong px-12 py-12 lg:flex">
      {/* Slow drifting aurora. */}
      <div
        aria-hidden="true"
        className="sb-aurora pointer-events-none absolute -inset-[25%] opacity-70"
        style={{
          background:
            "radial-gradient(40% 38% at 28% 30%, rgba(110,31,42,0.10), transparent 70%), radial-gradient(36% 34% at 76% 24%, rgba(154,123,51,0.12), transparent 70%), radial-gradient(44% 40% at 62% 82%, rgba(31,77,58,0.10), transparent 72%)",
          filter: "blur(56px)",
        }}
      />
      {/* Faint ledger / graph-paper grid. */}
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
      {/* Centerpiece guilloché engraving. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2"
      >
        <Guilloche className="h-full w-full" />
      </div>
      <MathLayer />
      <LedgerBackdrop />

      {/* Readability scrim. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, var(--color-paper) 0%, rgba(244,241,234,0.92) 15%, rgba(244,241,234,0.5) 36%, rgba(244,241,234,0) 58%)",
        }}
      />

      {/* Masthead cluster. */}
      <div className="sb-reveal relative flex items-center gap-4" style={{ ["--sb-delay" as string]: "60ms" }}>
        <Seal size={96} aura monogram={companyMonogram(name)} />
        <span
          className="text-[26px] text-ink"
          style={{
            fontFamily: "var(--font-display)",
            fontVariationSettings: "'opsz' 60, 'wght' 480",
            textShadow: "0 0 16px var(--color-paper), 0 0 16px var(--color-paper), 0 1px 0 rgba(255,255,255,0.6)",
          }}
        >
          {name}
        </span>
      </div>

      {/* Editorial block. */}
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

      {/* Standing line. */}
      <div
        aria-hidden="true"
        className="sb-reveal relative space-y-1 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-muted"
        style={{
          ["--sb-delay" as string]: "440ms",
          textShadow: "0 0 12px var(--color-paper), 0 0 8px var(--color-paper)",
        }}
      >
        {standing.length ? <p>{standing.join(" · ")}</p> : null}
        <p className="text-ink-muted/70">
          SVR — IST · BUILD 2026.06
          <span className="sb-caret ml-1 inline-block text-oxblood">▍</span>
        </p>
      </div>
    </section>
  );
}

/** Shared branding → standing-line parts (SEBI / member exchanges / est year). */
export function standingLine(brand: { sebiRegNo?: string | null; exchanges?: string[]; foundedYear?: number | null } | null): string[] {
  return [
    brand?.sebiRegNo ? `SEBI REG · ${brand.sebiRegNo}` : null,
    brand?.exchanges?.length ? `MEMBER ${brand.exchanges.join(" / ")}` : null,
    brand?.foundedYear ? `EST. ${brand.foundedYear}` : null,
  ].filter(Boolean) as string[];
}
